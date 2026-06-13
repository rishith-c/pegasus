"""Voice stress analysis: Whisper transcription + librosa acoustic features.

Heavy deps (whisper, librosa, numpy) are imported lazily, and the Whisper model
is loaded on first use, so the FastAPI app boots fast.
"""
from __future__ import annotations

from typing import Dict


class VoiceStressAnalyzer:
    def __init__(self, model_size: str = "base") -> None:
        self.model_size = model_size
        self._model = None  # lazy-loaded on first analyze

    def _whisper(self):
        if self._model is None:
            import whisper  # lazy

            self._model = whisper.load_model(self.model_size)
        return self._model

    def analyze_audio(self, audio_path: str) -> Dict:
        import librosa  # lazy
        import numpy as np

        result = self._whisper().transcribe(audio_path)
        transcript = result.get("text", "").strip()
        segments = result.get("segments", [])
        duration = segments[-1]["end"] if segments else 0.0

        y, sr = librosa.load(audio_path)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = []
        for t in range(pitches.shape[1]):
            idx = magnitudes[:, t].argmax()
            p = pitches[idx, t]
            if p > 0:
                pitch_values.append(float(p))

        word_count = len(transcript.split())
        speaking_rate = (word_count / max(duration, 1)) * 60

        pauses = 0
        for i in range(1, len(segments)):
            if segments[i]["start"] - segments[i - 1]["end"] > 0.5:
                pauses += 1

        pitch_std = float(np.std(pitch_values)) if pitch_values else 0.0
        return {
            "transcript": transcript,
            "pitch_mean_hz": round(float(np.mean(pitch_values)), 1) if pitch_values else 0.0,
            "pitch_variability": round(pitch_std, 1),
            "speaking_rate_wpm": round(speaking_rate, 1),
            "pause_frequency": pauses,
            "voice_tremor": pitch_std > 50,
            "duration_seconds": round(float(duration), 1),
        }
