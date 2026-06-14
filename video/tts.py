# NVIDIA Text-to-Speech (Rishith) — speak Pegasus's replies aloud.
# Hosted NVIDIA Riva over gRPC (grpc.nvcf.nvidia.com:443) via nvidia-riva-client.
# Default function-id = Magpie TTS Multilingual (the Chatterbox function isn't
# available to this account; Magpie is and sounds natural).
import os
import wave

import numpy as np

NVIDIA_TTS_KEY = os.getenv("NVIDIA_TTS_KEY")
RIVA_SERVER = os.getenv("NVIDIA_RIVA_SERVER", "grpc.nvcf.nvidia.com:443")
# ai-magpie-tts-multilingual on build.nvidia.com.
TTS_FUNCTION_ID = os.getenv("NVIDIA_TTS_FUNCTION_ID", "877104f7-e885-42b9-8de8-f6e4c6303969")
TTS_VOICE = os.getenv("NVIDIA_TTS_VOICE", "")  # empty -> model default
SAMPLE_RATE = int(os.getenv("NVIDIA_TTS_SAMPLE_RATE", "44100"))
# Peak-normalize the voice so it's clearly audible on a phone speaker (loud).
TTS_GAIN_CAP = float(os.getenv("NVIDIA_TTS_GAIN_CAP", "12"))
TTS_TARGET_PEAK = float(os.getenv("NVIDIA_TTS_TARGET_PEAK", "31000"))


def _boost(audio: bytes) -> bytes:
    """Peak-normalize raw PCM16 toward full scale so the reply plays loud."""
    try:
        s = np.frombuffer(audio, dtype=np.int16).astype(np.float32)
        peak = float(np.max(np.abs(s))) or 1.0
        gain = min(TTS_TARGET_PEAK / peak, TTS_GAIN_CAP)
        return np.clip(s * gain, -32768, 32767).astype(np.int16).tobytes()
    except Exception:
        return audio


def speak(text: str, out_path: str = "intervention.wav"):
    """Synthesize speech to a WAV file. Returns the path, or None on failure."""
    if not NVIDIA_TTS_KEY or not text:
        return None
    try:
        import riva.client

        auth = riva.client.Auth(
            uri=RIVA_SERVER,
            use_ssl=True,
            metadata_args=[
                ["function-id", TTS_FUNCTION_ID],
                ["authorization", f"Bearer {NVIDIA_TTS_KEY}"],
            ],
        )
        tts = riva.client.SpeechSynthesisService(auth)
        resp = tts.synthesize(
            text,
            voice_name=TTS_VOICE or None,
            language_code="en-US",
            encoding=riva.client.AudioEncoding.LINEAR_PCM,
            sample_rate_hz=SAMPLE_RATE,
        )
        with wave.open(out_path, "wb") as w:  # resp.audio is raw PCM16 mono
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(_boost(resp.audio))
        return out_path
    except Exception:
        return None
