"""Multimodal fusion — combine the facial emotion read with voice acoustics
(pitch variability, tremor) into a single affect + stress estimate.

Faces and voices each leak stress in different ways; fusing them is more robust
than either alone (a forced smile with a shaky voice is not "happy").
"""
from __future__ import annotations

from typing import Dict, List, Optional


def fuse(face: Dict, voice: Optional[Dict] = None) -> Dict:
    """`face` from EmotionDetector.detect(); `voice` optional dict with
    ``pitch_variability`` (Hz) and ``voice_tremor`` (bool). Returns a unified read.
    Facial affect leads (0.6); voice arousal supports (0.4)."""
    stress = float(face.get("stress_score", 0))
    signals: List[str] = [f"face:{face.get('dominant_emotion', 'unknown')}"]

    if voice:
        pitch_var = float(voice.get("pitch_variability", 0) or 0)
        tremor = bool(voice.get("voice_tremor", False))
        voice_stress = (40.0 if tremor else 0.0) + min(pitch_var / 100.0, 1.0) * 40.0
        stress = stress * 0.6 + voice_stress * 0.4
        signals.append("voice:" + ("shaky" if tremor else "tense" if pitch_var > 55 else "steady"))

    valence = float(face.get("valence", 0))
    mood = "positive" if valence > 0.2 else "negative" if valence < -0.2 else "neutral"
    return {
        "mood": mood,
        "stress_score": int(round(min(max(stress, 0), 100))),
        "valence": valence,
        "arousal": float(face.get("arousal", 0)),
        "signals": signals,
    }
