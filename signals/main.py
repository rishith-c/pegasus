from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from analyzers import analyze_sentiment, analyze_typing, analyze_temporal, analyze_linguistic
from alerts import send_red_alert
from stimuli import create_session, get_session, compute_actual_engagement
from imessage import handle_incoming, record_stimulus_sent, send_stimulus, parse_twilio_webhook

load_dotenv()

app = FastAPI(title="Pegasus Signal Processor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# in-memory store: user_id -> latest signal record
_signals_store: dict[str, dict] = {}


# ── Request models ─────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    user_id: str
    response_text: str
    response_time_ms: float
    # Core typing fields
    typing_wpm: float
    error_rate: float                   # 0-100 (backspaces / total keys %)
    # Rich biometric fields (optional — from TypingBiometrics in collector.js)
    hesitation_count: Optional[int]   = 0
    burst_pattern: Optional[str]      = "steady"
    avg_key_hold_ms: Optional[float]  = 100
    flight_time_ms: Optional[float]   = 150
    correction_loops: Optional[int]   = 0


class AlertRequest(BaseModel):
    user_id: str
    phone: str
    score: float
    level: str        # "green" | "yellow" | "red"
    intervention: str


class StartSessionRequest(BaseModel):
    user_id: str


class ReactRequest(BaseModel):
    user_id: str
    session_id: str
    stimulus_id: str
    response_text: str
    response_time_ms: float
    typing_wpm: float
    error_rate: float
    hesitation_count: Optional[int]   = 0
    burst_pattern: Optional[str]      = "steady"
    avg_key_hold_ms: Optional[float]  = 100
    flight_time_ms: Optional[float]   = 150
    correction_loops: Optional[int]   = 0


class SendStimulusRequest(BaseModel):
    user_id: str
    phone: str


# ── Core endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "signals", "port": 8002}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    sentiment  = analyze_sentiment(req.response_text)
    typing     = analyze_typing(
        typing_wpm       = req.typing_wpm,
        error_rate       = req.error_rate,
        hesitation_count = req.hesitation_count or 0,
        burst_pattern    = req.burst_pattern or "steady",
        avg_key_hold_ms  = req.avg_key_hold_ms or 100,
        flight_time_ms   = req.flight_time_ms or 150,
        correction_loops = req.correction_loops or 0,
    )
    temporal   = analyze_temporal(req.response_time_ms)
    linguistic = analyze_linguistic(req.response_text)

    # combined_signal_score: 0-100 (higher = more burnout signals)
    # Weights: sentiment 40pts, typing 25pts, temporal 20pts, linguistic 15pts
    combined = min(100, round(
        (1 - sentiment["sentiment_score"]) * 40
        + typing["burnout_contribution"]
        + temporal["burnout_contribution"]
        + linguistic["burnout_contribution"],
        2,
    ))

    result = {
        "user_id":              req.user_id,
        "sentiment_score":      sentiment["sentiment_score"],
        "energy_level":         sentiment["energy_level"],
        "linguistic_flags":     sentiment["flags"] + linguistic["linguistic_flags"],
        "combined_signal_score": combined,
        "detail": {
            "sentiment":  sentiment,
            "typing":     typing,
            "temporal":   temporal,
            "linguistic": linguistic,
        },
    }

    _signals_store[req.user_id] = result
    return result


@app.get("/signals/{user_id}")
def get_signals(user_id: str):
    if user_id not in _signals_store:
        raise HTTPException(status_code=404, detail=f"No signals found for user {user_id}")
    return _signals_store[user_id]


# ── Alert endpoints ────────────────────────────────────────────────────────────

def _fire_alert(user_id: str, phone: str, score: float, level: str, intervention: str) -> dict:
    if level == "red":
        try:
            return send_red_alert(phone=phone, user_id=user_id, score=score, intervention=intervention)
        except EnvironmentError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Twilio error: {str(e)}")

    if level == "yellow":
        import os
        tmpl = os.path.join(
            os.path.dirname(__file__), "alerts", "templates", "yellow_warning.txt"
        )
        with open(tmpl) as f:
            body = f.read().format(user_id=user_id, score=round(score, 1), intervention=intervention)
        # Yellow: log only (SMS on red only to avoid noise)
        print(f"[yellow_alert] {user_id}: {body}")
        return {"sent": False, "reason": "yellow level — logged, SMS reserved for red"}

    return {"sent": False, "reason": f"level is '{level}', no action needed"}


@app.post("/alert")
def alert(req: AlertRequest):
    return _fire_alert(req.user_id, req.phone, req.score, req.level, req.intervention)


@app.post("/alert/send")
def alert_send(req: AlertRequest):
    """Spec-named alias for /alert."""
    return _fire_alert(req.user_id, req.phone, req.score, req.level, req.intervention)


# ── Stimuli endpoints ──────────────────────────────────────────────────────────

@app.post("/stimuli/start")
def start_session(req: StartSessionRequest):
    session  = create_session(req.user_id)
    stimulus = session.current_stimulus()
    return {
        "session_id":     session.session_id,
        "total_stimuli":  len(session.stimuli),
        "stimulus_number": 1,
        "stimulus":       stimulus,
    }


@app.post("/stimuli/react")
async def react_to_stimulus(req: ReactRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {req.session_id} not found")
    if session.complete:
        raise HTTPException(status_code=400, detail="Session already complete")

    current = session.current_stimulus()
    if current["id"] != req.stimulus_id:
        raise HTTPException(
            status_code=400,
            detail=f"Expected stimulus {current['id']}, got {req.stimulus_id}",
        )

    sentiment  = analyze_sentiment(req.response_text)
    typing     = analyze_typing(
        typing_wpm       = req.typing_wpm,
        error_rate       = req.error_rate,
        hesitation_count = req.hesitation_count or 0,
        burst_pattern    = req.burst_pattern or "steady",
        avg_key_hold_ms  = req.avg_key_hold_ms or 100,
        flight_time_ms   = req.flight_time_ms or 150,
        correction_loops = req.correction_loops or 0,
    )
    temporal   = analyze_temporal(req.response_time_ms)
    linguistic = analyze_linguistic(req.response_text)

    actual_engagement = compute_actual_engagement(sentiment, typing, temporal)
    tribe_expected    = current["tribe_expected_engagement"]
    deviation         = round(abs(tribe_expected - actual_engagement), 3)

    reaction = {
        "stimulus_id":               req.stimulus_id,
        "stimulus_valence":          current["valence"],
        "tribe_expected_engagement": tribe_expected,
        "actual_engagement":         actual_engagement,
        "deviation":                 deviation,
        "behavioral_signals": {
            "sentiment":  sentiment,
            "typing":     typing,
            "temporal":   temporal,
            "linguistic": linguistic,
        },
    }

    session.record_reaction(reaction)
    next_stimulus = session.current_stimulus()

    return {
        "reaction_recorded":         True,
        "stimulus_id":               req.stimulus_id,
        "tribe_expected_engagement": tribe_expected,
        "actual_engagement":         actual_engagement,
        "deviation":                 deviation,
        "session_complete":          session.complete,
        "stimulus_number":           session.current_index,
        "total_stimuli":             len(session.stimuli),
        "next_stimulus":             next_stimulus,
    }


@app.get("/stimuli/results/{session_id}")
def session_results(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {
        "session_id":      session_id,
        "user_id":         session.user_id,
        "complete":        session.complete,
        "stimuli_count":   len(session.stimuli),
        "reactions_count": len(session.reactions),
        "mean_deviation":  session.mean_deviation(),
        "burnout_score":   session.burnout_score(),
        "reactions":       session.reactions,
    }


# ── iMessage / SMS endpoints ───────────────────────────────────────────────────

@app.post("/imessage/send")
def imessage_send(req: SendStimulusRequest):
    """Send today's daily pulse-check stimulus via Twilio SMS."""
    try:
        result = send_stimulus(phone=req.phone, user_id=req.user_id)
        record_stimulus_sent(phone=req.phone, stimulus=result["stimulus"])
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/imessage/webhook")
async def imessage_webhook(request: Request):
    """
    Twilio SMS/iMessage inbound webhook.
    Analyzes the user's response and replies with their current Pulse score.
    Returns TwiML so Twilio can deliver the reply inline.
    """
    form = dict(await request.form())
    parsed = parse_twilio_webhook(form)

    reply_text = await handle_incoming(
        from_number=parsed["from_number"],
        body=parsed["body"],
    )

    # Escape XML special chars in reply
    safe = reply_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{safe}</Message></Response>'
    return Response(content=twiml, media_type="application/xml")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
