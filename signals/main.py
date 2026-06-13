from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from analyzers import analyze_sentiment, analyze_typing, analyze_temporal, analyze_linguistic
from alerts import send_red_alert

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


class AnalyzeRequest(BaseModel):
    user_id: str
    response_text: str
    response_time_ms: float
    typing_wpm: float
    error_rate: float  # 0-100 percent of keystrokes that were backspaces


class AlertRequest(BaseModel):
    user_id: str
    phone: str
    score: float
    level: str        # "green" | "yellow" | "red"
    intervention: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "signals", "port": 8002}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    sentiment = analyze_sentiment(req.response_text)
    typing = analyze_typing(req.typing_wpm, req.error_rate)
    temporal = analyze_temporal(req.response_time_ms)
    linguistic = analyze_linguistic(req.response_text)

    # combined_signal_score: 0-100 where higher = more burnout signals
    # Weights: sentiment 40pts, typing 25pts, temporal 20pts, linguistic 15pts
    sentiment_contrib = (1 - sentiment["sentiment_score"]) * 40
    combined = round(
        sentiment_contrib
        + typing["burnout_contribution"]
        + temporal["burnout_contribution"]
        + linguistic["burnout_contribution"],
        2,
    )
    combined = min(100, combined)

    all_flags = sentiment["flags"] + linguistic["linguistic_flags"]

    result = {
        "user_id": req.user_id,
        "sentiment_score": sentiment["sentiment_score"],
        "energy_level": sentiment["energy_level"],
        "linguistic_flags": all_flags,
        "combined_signal_score": combined,
        "detail": {
            "sentiment": sentiment,
            "typing": typing,
            "temporal": temporal,
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


@app.post("/alert")
def alert(req: AlertRequest):
    if req.level != "red":
        return {"sent": False, "reason": f"level is '{req.level}', SMS only fires on red"}

    try:
        result = send_red_alert(
            phone=req.phone,
            user_id=req.user_id,
            score=req.score,
            intervention=req.intervention,
        )
        return result
    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Twilio error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
