"""HF facial-affect analysis (Rishith) — compares your face to a Hugging Face
model that knows what a healthy, regulated expression looks like.

A ViT face-expression classifier (default ``trpakov/vit-face-expression``, FER
labels: angry, disgust, fear, happy, neutral, sad, surprise) runs on sampled
frames via ``InferenceClient.image_classification``. We aggregate the emotion
distribution across frames and score burnout/stress as how far the affect
DEVIATES from a healthy (neutral/positive) profile — i.e. distress affect mass
vs. healthy affect mass.

No Anthropic. Degrades gracefully: returns ``None`` if HF is unavailable so the
caller can fall back to the geometric (MediaPipe) analyzer.
"""
from __future__ import annotations

import os
from collections import defaultdict
from typing import Dict, List, Optional

HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("HF_API_KEY")
FACE_MODEL = os.getenv("HF_FACE_MODEL", "trpakov/vit-face-expression")
MAX_FRAMES = int(os.getenv("HF_FACE_MAX_FRAMES", "6"))

# A healthy, regulated face reads mostly neutral / positive. Distress &
# burnout show elevated negative affect — that's what the stress score weights.
_HEALTHY = {"happy": 1.0, "neutral": 0.85, "surprise": 0.55}
_STRESS = {"sad": 1.0, "fear": 1.0, "angry": 0.9, "disgust": 0.8}


class HFFacialModel:
    def __init__(self) -> None:
        self._client = None

    def _hf(self):
        if self._client is None:
            from huggingface_hub import InferenceClient

            self._client = InferenceClient(token=HF_TOKEN)
        return self._client

    def _classify(self, jpg_bytes: bytes) -> Optional[Dict[str, float]]:
        try:
            res = self._hf().image_classification(jpg_bytes, model=FACE_MODEL)
            return {r.label.lower(): float(r.score) for r in res}
        except Exception:
            return None

    def analyze_frames(self, frames: List) -> Optional[Dict]:
        """frames: list of BGR numpy arrays (as decoded by OpenCV).
        Returns the affect analysis, or None if HF/frames are unavailable."""
        if not HF_TOKEN or not frames:
            return None
        import cv2  # local — keeps module import light

        step = max(1, len(frames) // MAX_FRAMES)
        sampled = frames[::step][:MAX_FRAMES]

        agg: Dict[str, float] = defaultdict(float)
        n = 0
        for f in sampled:
            ok, buf = cv2.imencode(".jpg", f)
            if not ok:
                continue
            dist = self._classify(buf.tobytes())
            if not dist:
                continue
            for label, score in dist.items():
                agg[label] += score
            n += 1
        if n == 0:
            return None

        emotions = {k: round(v / n, 3) for k, v in agg.items()}
        stress_mass = sum(emotions.get(k, 0.0) * w for k, w in _STRESS.items())
        healthy_mass = sum(emotions.get(k, 0.0) * w for k, w in _HEALTHY.items())
        total = stress_mass + healthy_mass + 1e-6

        stress_score = int(round(min(stress_mass / total, 1.0) * 100))
        dominant = max(emotions, key=emotions.get) if emotions else "neutral"
        affect = (
            "positive" if dominant in ("happy", "surprise")
            else "negative" if dominant in ("sad", "fear", "angry", "disgust")
            else "neutral"
        )
        return {
            "facial_stress_score": stress_score,        # 0 healthy .. 100 distress
            "health_alignment": round(healthy_mass / total, 3),  # 1.0 = fully healthy affect
            "emotion_distribution": emotions,
            "dominant_affect": dominant,
            "overall_affect": affect,
            "frames_analyzed": n,
            "model": FACE_MODEL,
            "source": "huggingface",
        }
