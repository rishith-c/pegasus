# Voice stress (Rishith). NVIDIA parakeet ASR (hosted Riva gRPC) for the
# transcript + librosa for acoustic stress. Degrades gracefully (empty
# transcript / zeros) so a check-in never hard-fails.
import os

import numpy as np

NVIDIA_STT_KEY = os.getenv("NVIDIA_STT_KEY")
RIVA_SERVER = os.getenv("NVIDIA_RIVA_SERVER", "grpc.nvcf.nvidia.com:443")
# parakeet-tdt-0.6b-v2 — supports OFFLINE recognize (the 1.1b CTC function is
# streaming-only and rejects offline_recognize).
ASR_FUNCTION_ID = os.getenv("NVIDIA_ASR_FUNCTION_ID", "d3fe9151-442b-4204-a70d-5fcc597fd610")


class VoiceStressAnalyzer:
    def transcribe_nvidia(self, audio_path: str) -> str:
        if not NVIDIA_STT_KEY:
            return ""
        try:
            import riva.client

            auth = riva.client.Auth(
                uri=RIVA_SERVER,
                use_ssl=True,
                metadata_args=[
                    ["function-id", ASR_FUNCTION_ID],
                    ["authorization", f"Bearer {NVIDIA_STT_KEY}"],
                ],
            )
            asr = riva.client.ASRService(auth)
            # The /converse + /analyze paths feed a 16 kHz mono WAV. Set the
            # config explicitly (add_audio_file_specs picked params the model
            # wouldn't serve).
            config = riva.client.RecognitionConfig(
                encoding=riva.client.AudioEncoding.LINEAR_PCM,
                sample_rate_hertz=16000,
                language_code="en-US",
                max_alternatives=1,
                enable_automatic_punctuation=True,
            )
            with open(audio_path, "rb") as f:
                data = f.read()
            resp = asr.offline_recognize(data, config)
            return " ".join(
                r.alternatives[0].transcript for r in resp.results if r.alternatives
            ).strip()
        except Exception:
            return ""

    def analyze_audio(self, audio_path: str) -> dict:
        transcript = self.transcribe_nvidia(audio_path)
        try:
            import librosa  # lazy — voice stress is optional; transcript already done

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
