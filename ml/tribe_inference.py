"""TRIBE v2 wrapper — predicts a *healthy* brain's response to a stimulus.

Meta TRIBE v2 (https://github.com/facebookresearch/tribev2) maps stimuli
(video/audio/text) to ~20k fMRI surface-vertex activations. We use its
prediction as the "healthy baseline" to compare the user's behavioral response
against. Predictions per stimulus are cached (they're deterministic for a given
stimulus, and the real model is expensive to run).

NOTE (Rishith): `TribeModel._infer` is a deterministic STUB so the pipeline runs
today. Swap it for the real model:

    from tribev2 import TribeModel
    model = TribeModel.from_pretrained("facebook/tribev2", cache_folder="./cache")
    df = model.get_events_dataframe(video_path="stimulus.mp4")
    preds, segments = model.predict(events=df)   # (n_timesteps, ~20k vertices)

then reduce `preds` to (engagement, valence, region_activations) below.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Dict, List

CACHE_DIR = Path(__file__).with_name("cache")
BASELINE_CACHE = CACHE_DIR / "baselines.json"

# Brain regions we surface in the iOS "Brain View" (reduced from ~20k vertices).
REGIONS = [
    "prefrontal_cortex", "amygdala", "anterior_cingulate", "insula",
    "hippocampus", "visual_cortex", "auditory_cortex", "motor_cortex",
]


class TribeModel:
    def __init__(self, model_name: str = "tribe-v2-stub") -> None:
        self.model_name = model_name
        self._cache: Dict[str, Dict] = self._load_cache()
        # TODO(real): self.model = TribeModel.from_pretrained("facebook/tribev2", ...)

    # --- public API --------------------------------------------------------
    def predict(self, stimulus: Dict) -> Dict:
        """Healthy-brain prediction for a stimulus, with per-region activations."""
        key = self._key(stimulus)
        if key in self._cache:
            return self._cache[key]
        pred = self._infer(stimulus)
        self._cache[key] = pred
        self._save_cache()
        return pred

    def baseline(self, stimulus_id: str) -> Dict | None:
        """Return a cached prediction by stimulus_id, if present."""
        for pred in self._cache.values():
            if pred.get("stimulus_id") == stimulus_id:
                return pred
        return None

    # --- replace this with a real TRIBE v2 forward pass --------------------
    def _infer(self, stimulus: Dict) -> Dict:
        seed = f"{stimulus.get('type','text')}|{stimulus.get('content','')}|{stimulus.get('prompt','')}"
        h = hashlib.sha256(seed.encode()).digest()

        engagement = 0.55 + (h[0] / 255.0) * 0.40   # healthy skews engaged
        valence = 0.55 + (h[1] / 255.0) * 0.40       # and positive

        regions = {
            name: round(0.4 + 0.5 * abs(math.sin((h[i] / 255.0) * math.pi + i)), 4)
            for i, name in enumerate(REGIONS)
        }
        activation_summary: List[float] = [
            round(0.5 + 0.5 * math.sin((h[i % len(h)] / 255.0) * math.pi + i), 4)
            for i in range(16)
        ]
        return {
            "stimulus_id": stimulus.get("stimulus_id", self._key(stimulus)),
            "predicted_engagement": round(engagement, 4),
            "predicted_valence": round(valence, 4),
            "regions": regions,
            "activation_summary": activation_summary,
        }

    # --- cache -------------------------------------------------------------
    @staticmethod
    def _key(stimulus: Dict) -> str:
        seed = f"{stimulus.get('type','text')}|{stimulus.get('content','')}|{stimulus.get('prompt','')}"
        return hashlib.sha256(seed.encode()).hexdigest()[:16]

    def _load_cache(self) -> Dict[str, Dict]:
        if BASELINE_CACHE.exists():
            try:
                return json.loads(BASELINE_CACHE.read_text())
            except Exception:
                return {}
        return {}

    def _save_cache(self) -> None:
        CACHE_DIR.mkdir(exist_ok=True)
        BASELINE_CACHE.write_text(json.dumps(self._cache, indent=2))
