# NVIDIA Chatterbox Text-to-Speech (Rishith) — speak the intervention aloud.
# Hosted NVIDIA Riva over gRPC (grpc.nvcf.nvidia.com:443) via nvidia-riva-client.
# Default function-id = Resemble.AI Chatterbox multilingual TTS.
import os
import wave

NVIDIA_TTS_KEY = os.getenv("NVIDIA_TTS_KEY")
RIVA_SERVER = os.getenv("NVIDIA_RIVA_SERVER", "grpc.nvcf.nvidia.com:443")
# Chatterbox multilingual TTS (build.nvidia.com/resembleai/chatterbox-multilingual-tts).
TTS_FUNCTION_ID = os.getenv("NVIDIA_TTS_FUNCTION_ID", "ddacc747-1269-4fab-bfd9-8f593dead106")
TTS_VOICE = os.getenv("NVIDIA_TTS_VOICE", "")  # empty -> model default
SAMPLE_RATE = int(os.getenv("NVIDIA_TTS_SAMPLE_RATE", "44100"))


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
            w.writeframes(resp.audio)
        return out_path
    except Exception:
        return None
