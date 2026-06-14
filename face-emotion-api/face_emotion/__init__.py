"""Pegasus Face-Emotion — a small framework for facial affect + multimodal
emotion detection, built for the Pegasus mental-health app.

    from face_emotion import EmotionDetector, fuse

    det = EmotionDetector()
    face = det.detect("selfie.jpg")          # dominant emotion + valence/arousal + stress
    read = fuse(face, voice={"pitch_variability": 70, "voice_tremor": True})
"""
from .detector import EmotionDetector
from .fusion import fuse

__all__ = ["EmotionDetector", "fuse"]
__version__ = "0.1.0"
