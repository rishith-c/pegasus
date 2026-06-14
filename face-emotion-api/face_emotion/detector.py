"""EmotionDetector — the core of the Pegasus Face-Emotion framework.

Classifies facial affect from an image with a ViT face-expression model
(Hugging Face, default ``trpakov/vit-face-expression``, FER-7 labels: angry,
disgust, fear, happy, neutral, sad, surprise) and maps it to a compact read:
the dominant emotion, the full distribution, a valence/arousal estimate, and a
"healthy vs. distress" affect score for wellbeing apps.

Single image or a batch of frames (a short video). Degrades gracefully — an
empty/unknown read rather than an exception — so a product never hard-fails.
"""
from __future__ import annotations

import os
from collections import defaultdict
from typing import Dict, List, Optional

FACE_MODEL = os.getenv("FACE_EMOTION_MODEL", "trpakov/vit-face-expression")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HF_API_KEY")

# FER label → valence (unpleasant -1 .. pleasant 1) and arousal (calm 0 .. 1).
_VALENCE = {"happy": 0.9, "surprise": 0.3, "neutral": 0.0,
            "sad": -0.8, "fear": -0.7, "angry": -0.8, "disgust": -0.6}
_AROUSAL = {"happy": 0.6, "surprise": 0.85, "neutral": 0.2,
            "sad": 0.4, "fear": 0.9, "angry": 0.85, "disgust": 0.6}
# A regulated, healthy face reads neutral/positive; distress reads negative.
_HEALTHY = {"happy": 1.0, "neutral": 0.85, "surprise": 0.55}
_STRESS = {"sad": 1.0, "fear": 1.0, "angry": 0.9, "disgust": 0.8}


class EmotionDetector:
    """Detect facial emotion + affect from images. Thread-safe to construct once
    and reuse (lazy Hugging Face client)."""

    def __init__(self, model: str = FACE_MODEL, token: Optional[str] = HF_TOKEN) -> None:
        self.model = model
        self._token = token
        self._client = None

    def _hf(self):
        if self._client is None:
            from huggingface_hub import InferenceClient

            self._client = InferenceClient(token=self._token)
        return self._client

    # --- public ------------------------------------------------------------
    def detect(self, image) -> Dict:
        """`image`: raw bytes, a file path, or a URL. Returns the emotion read."""
        return self._summarize(self._classify(image))

    def detect_frames(self, images: List) -> Dict:
        """Aggregate the emotion read across many frames (e.g. a short clip)."""
        agg: Dict[str, float] = defaultdict(float)
        n = 0
        for im in images:
            dist = self._classify(im)
            if dist:
                for label, score in dist.items():
                    agg[label] += score
                n += 1
        if n == 0:
            return self._empty()
        dist = {k: round(v / n, 4) for k, v in agg.items()}
        return self._summarize(dist, frames=n)

    # --- internals ---------------------------------------------------------
    def _classify(self, image) -> Dict[str, float]:
        try:
            res = self._hf().image_classification(image, model=self.model)
            return {r.label.lower(): float(r.score) for r in res}
        except Exception:
            return {}

    def _summarize(self, dist: Dict[str, float], frames: int = 1) -> Dict:
        if not dist:
            return self._empty()
        dominant = max(dist, key=dist.get)
        valence = sum(dist.get(k, 0.0) * w for k, w in _VALENCE.items())
        arousal = sum(dist.get(k, 0.0) * w for k, w in _AROUSAL.items())
        stress = sum(dist.get(k, 0.0) * w for k, w in _STRESS.items())
        healthy = sum(dist.get(k, 0.0) * w for k, w in _HEALTHY.items())
        total = stress + healthy + 1e-6
        return {
            "dominant_emotion": dominant,
            "emotions": dist,
            "valence": round(valence, 3),
            "arousal": round(arousal, 3),
            "stress_score": int(round(min(stress / total, 1.0) * 100)),
            "health_alignment": round(healthy / total, 3),
            "frames": frames,
            "model": self.model,
        }

    @staticmethod
    def _empty() -> Dict:
        return {
            "dominant_emotion": "unknown", "emotions": {}, "valence": 0.0,
            "arousal": 0.0, "stress_score": 0, "health_alignment": 0.0,
            "frames": 0, "model": FACE_MODEL,
        }
