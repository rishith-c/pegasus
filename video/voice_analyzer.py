# Voice stress (Rishith). NVIDIA STT for transcript, librosa for acoustics.
# Degrades gracefully (empty transcript / zeros) so a check-in never hard-fails.
import os

import librosa
import numpy as np
import requests

NVIDIA_STT_KEY = os.getenv("NVIDIA_STT_KEY")
# Confirm the exact NIM endpoint in the NVIDIA API catalog (build.nvidia.com).
NVIDIA_STT_URL = os.getenv(
    "NVIDIA_STT_URL", "https://api.nvcf.nvidia.com/v1/speech/transcribe"
)


class VoiceStressAnalyzer:
    def transcribe_nvidia(self, audio_path: str) -> str:
        if not NVIDIA_STT_KEY:
            return ""
        try:
            with open(audio_path, "rb") as f:
                r = requests.post(
                    NVIDIA_STT_URL,
                    headers={"Authorization": f"Bearer {NVIDIA_STT_KEY}"},
                    files={"audio": f},
                    timeout=30,
                )
            return r.json().get("text", "")
        except Exception:
            return ""

    def analyze_audio(self, audio_path: str) -> dict:
        transcript = self.transcribe_nvidia(audio_path)
        try:
            y, sr = librosa.load(audio_path)
            pitches, mags = librosa.piptrack(y=y, sr=sr)
            vals = [
                float(pitches[mags[:, t].argmax(), t])
                for t in range(pitches.shape[1])
                if pitches[mags[:, t].argmax(), t] > 0
            ]
            dur = float(librosa.get_duration(y=y, sr=sr))
            words = len(transcript.split())
            pitch_std = float(np.std(vals)) if vals else 0.0
            return {
                "transcript": transcript,
                "pitch_mean_hz": float(np.mean(vals)) if vals else 0.0,
                "pitch_variability": pitch_std,
                "speaking_rate_wpm": (words / max(dur, 1)) * 60,
                "pause_frequency": 0,
                "voice_tremor": bool(pitch_std > 50),
            }
        except Exception:
            return {
                "transcript": transcript, "pitch_mean_hz": 0, "pitch_variability": 0,
                "speaking_rate_wpm": 0, "pause_frequency": 0, "voice_tremor": False,
            }
