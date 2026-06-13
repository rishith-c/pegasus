# NVIDIA Text-to-Speech (Rishith) — speak the intervention aloud (bonus).
# Confirm the exact NIM endpoint in the NVIDIA API catalog (build.nvidia.com).
import os

import requests

NVIDIA_TTS_KEY = os.getenv("NVIDIA_TTS_KEY")
NVIDIA_TTS_URL = os.getenv(
    "NVIDIA_TTS_URL", "https://api.nvcf.nvidia.com/v1/speech/synthesize"
)


def speak(text: str, out_path: str = "intervention.wav"):
    """Synthesize speech to a WAV file. Returns the path, or None on failure."""
    if not NVIDIA_TTS_KEY:
        return None
    try:
        r = requests.post(
            NVIDIA_TTS_URL,
            headers={"Authorization": f"Bearer {NVIDIA_TTS_KEY}"},
            json={"text": text, "voice": "calm"},
            timeout=30,
        )
        r.raise_for_status()
        with open(out_path, "wb") as f:
            f.write(r.content)
        return out_path
    except Exception:
        return None
