"""Pegasus Video service (:8004) — facial + voice stress from a check-in clip.

Run (from inside /video):
    uvicorn main:app --port 8004 --reload

Endpoints:
    GET  /health
    POST /analyze/video   multipart 'video' -> { facial, voice, combined_score }

Heavy analyzers (MediaPipe / librosa) load lazily on the first call, so the
service boots instantly and /health works before models are ready.
Requires ffmpeg on the system (audio extraction):  brew install ffmpeg
"""
from __future__ import annotations

import base64
import json
import os
import tempfile
import threading
import urllib.request
from typing import Optional

try:  # load NVIDIA keys + ML_URL from video/.env before the analyzers import
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    pass

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# The ML service hosts the companion brain (/chat). On a phone both run on the
# laptop; override with ML_URL if they live elsewhere.
ML_URL = os.getenv("ML_URL", "http://127.0.0.1:8003").rstrip("/")
SIGNALS_URL = os.getenv("SIGNALS_URL", "http://127.0.0.1:8002").rstrip("/")
TTS_SAMPLE_RATE = int(os.getenv("NVIDIA_TTS_SAMPLE_RATE", "44100"))

app = FastAPI(title="Pegasus Video")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_facial = None
_voice = None
_hf_facial = None


def _get_facial():
    global _facial
    if _facial is None:
        from facial_analyzer import FacialStressAnalyzer

        _facial = FacialStressAnalyzer()
    return _facial


def _get_voice():
    global _voice
    if _voice is None:
        from voice_analyzer import VoiceStressAnalyzer

        _voice = VoiceStressAnalyzer()
    return _voice


def _get_hf_facial():
    global _hf_facial
    if _hf_facial is None:
        from facial_hf import HFFacialModel

        _hf_facial = HFFacialModel()
    return _hf_facial


def _to_wav16k(src_path: str) -> str:
    """Transcode any uploaded clip to 16k mono WAV for robust ASR. Returns the
    wav path (falls back to the source if ffmpeg isn't available)."""
    wav = src_path + ".16k.wav"
    if os.system(f"ffmpeg -i {src_path} -vn -ar 16000 -ac 1 {wav} -y -loglevel quiet") == 0 and os.path.exists(wav):
        return wav
    return src_path


def _chat_reply(user_id: str, messages: list, score: Optional[int], level: Optional[str]) -> str:
    """Ask the ML companion for the next turn. Warm fallback if it's unreachable."""
    body = json.dumps(
        {"user_id": user_id, "messages": messages, "score": score, "level": level}
    ).encode()
    req = urllib.request.Request(
        f"{ML_URL}/chat", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return (json.loads(r.read().decode()).get("reply") or "").strip() or _safe_reply()
    except Exception:
        return _safe_reply()


def _safe_reply() -> str:
    return "I'm right here with you. Take your time — what's been weighing on you?"


def _update_wellness(user_id: str, transcript: str) -> None:
    """Fire-and-forget: derive a wellness reading from what the user just said so
    the app's live score actually moves with the conversation."""
    if not transcript:
        return
    try:
        body = json.dumps({
            "user_id": user_id, "stimulus_id": "conversation",
            "signals": {"response_text": transcript},
        }).encode()
        req = urllib.request.Request(
            f"{ML_URL}/score", data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=60).read()
    except Exception:
        pass


def _try_reminder(user_id: str, text: str) -> Optional[str]:
    """If the user asked for a reminder, schedule it via signals and return a
    confirmation line; else None (fall through to normal conversation)."""
    if not text:
        return None
    try:
        body = json.dumps({"user_id": user_id, "text": text}).encode()
        req = urllib.request.Request(
            f"{SIGNALS_URL}/schedule-reminder", data=body,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read().decode())
        if d.get("scheduled"):
            return f"Done — I'll text you in {d.get('human', 'a bit')} to {d.get('task', 'take a break')}."
    except Exception:
        pass
    return None


def _speak_b64(text: str) -> Optional[str]:
    """Synthesize `text` with Chatterbox TTS and return base64 WAV (or None)."""
    if not text:
        return None
    import tts as tts_mod

    out = tempfile.mktemp(suffix=".wav")
    try:
        path = tts_mod.speak(text, out)
        if not path or not os.path.exists(path):
            return None
        with open(path, "rb") as fh:
            return base64.b64encode(fh.read()).decode("ascii")
    except Exception:
        return None
    finally:
        try:
            os.unlink(out)
        except OSError:
            pass


@app.get("/health")
def health():
    return {"status": "video running", "ml_url": ML_URL}


@app.post("/analyze/video")
async def analyze_video(video: UploadFile = File(...)):
    import cv2

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(await video.read())
        path = tmp.name
    audio = path.replace(".mp4", ".wav")
    try:
        # Sample every 10th frame (~3fps from 30fps source).
        cap = cv2.VideoCapture(path)
        frames, i = [], 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            if i % 10 == 0:
                frames.append(frame)
            i += 1
        cap.release()

        # Facial structure (MediaPipe 468-landmark geometry) — brow/eye/jaw tension.
        try:
            facial_result = _get_facial().analyze_video(frames) if frames else {"error": "no frames", "facial_stress_score": 0}
        except Exception as e:
            facial_result = {"error": f"facial failed: {e}", "facial_stress_score": 0}

        # HF affect: compare the face to a model that knows healthy expression.
        # This drives the headline stress score (deviation from healthy affect);
        # the MediaPipe geometry above stays as the structural detail.
        try:
            hf = _get_hf_facial().analyze_frames(frames) if frames else None
        except Exception:
            hf = None
        if hf:
            facial_result.pop("error", None)
            facial_result["emotion_distribution"] = hf["emotion_distribution"]
            facial_result["dominant_affect"] = hf["dominant_affect"]
            facial_result["health_alignment"] = hf["health_alignment"]
            facial_result["facial_model"] = hf["model"]
            facial_result.setdefault("facial_indicators", {})["overall_affect"] = hf["overall_affect"]
            geo = facial_result.get("facial_stress_score") or 0
            # HF affect leads (0.65); geometric tension supports (0.35).
            facial_result["facial_stress_score"] = (
                int(round(hf["facial_stress_score"] * 0.65 + geo * 0.35)) if geo
                else hf["facial_stress_score"]
            )
            facial_result["source"] = "hf+mediapipe" if geo else "huggingface"

        try:
            os.system(f"ffmpeg -i {path} -vn -ar 16000 {audio} -y -loglevel quiet")
            voice_result = _get_voice().analyze_audio(audio)
        except Exception as e:
            voice_result = {"error": f"voice failed: {e}", "pitch_mean_hz": 0, "voice_tremor": False, "pause_frequency": 0}

        fs = facial_result.get("facial_stress_score", 0)
        vs = (
            min(voice_result.get("pitch_mean_hz", 150) / 300, 1) * 40
            + (20 if voice_result.get("voice_tremor") else 0)
            + min(voice_result.get("pause_frequency", 0) / 10, 1) * 40
        )
        return {"facial": facial_result, "voice": voice_result, "combined_score": int(fs * 0.6 + vs * 0.4)}
    finally:
        for p in (path, audio):
            try:
                os.unlink(p)
            except OSError:
                pass


class TtsReq(BaseModel):
    text: str


@app.post("/tts")
def tts(req: TtsReq):
    """Speak arbitrary text (used for Pegasus's opening line in the video call)."""
    return {"audio_b64": _speak_b64(req.text), "sample_rate": TTS_SAMPLE_RATE}


@app.post("/converse")
async def converse(
    audio: UploadFile = File(...),
    history: str = Form("[]"),
    user_id: str = Form("demo_user"),
    score: Optional[int] = Form(None),
    level: Optional[str] = Form(None),
):
    """One spoken turn of the video-call conversation:
      user audio -> parakeet STT (+ voice-stress) -> ML companion reply ->
      Chatterbox TTS. Returns the transcript, the reply text, the reply audio
      (base64 WAV), and the per-turn voice-stress read for mental-health tracking.
    Degrades gracefully: if STT/TTS are down you still get a text reply."""
    with tempfile.NamedTemporaryFile(suffix=".upload", delete=False) as tmp:
        tmp.write(await audio.read())
        src = tmp.name
    wav = _to_wav16k(src)
    try:
        try:
            voice_result = _get_voice().analyze_audio(wav)
        except Exception as e:
            voice_result = {"transcript": "", "error": f"voice failed: {e}"}

        transcript = (voice_result.get("transcript") or "").strip()
        if transcript:
            threading.Thread(target=_update_wellness, args=(user_id, transcript), daemon=True).start()

        try:
            msgs = json.loads(history) if history else []
            if not isinstance(msgs, list):
                msgs = []
        except Exception:
            msgs = []
        if transcript:
            msgs = msgs + [{"role": "user", "content": transcript}]

        # "Remind me / text me in N minutes…" → schedule it and confirm.
        reply = _try_reminder(user_id, transcript) or _chat_reply(user_id, msgs, score, level)
        return {
            "transcript": transcript,
            "reply": reply,
            "voice": voice_result,
            "audio_b64": _speak_b64(reply),
            "sample_rate": TTS_SAMPLE_RATE,
        }
    finally:
        for p in (src, wav):
            try:
                if p != src or os.path.exists(p):
                    os.unlink(p)
            except OSError:
                pass


@app.post("/facial-frame")
async def facial_frame(image: UploadFile = File(...)):
    """Single-frame facial affect via the HF model — fast, for the live video
    call's periodic read (no 60s record + heavy analyze)."""
    import cv2
    import numpy as np

    raw = await image.read()
    frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return {"facial_stress_score": 0, "overall_affect": "neutral", "emotion_distribution": {}}
    try:
        hf = _get_hf_facial().analyze_frames([frame])
    except Exception:
        hf = None
    return hf or {"facial_stress_score": 0, "overall_affect": "neutral", "emotion_distribution": {}}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8004)
