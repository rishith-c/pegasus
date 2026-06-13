import os
import requests
from dotenv import load_dotenv

load_dotenv()

_HF_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"
_HF_URL   = f"https://api-inference.huggingface.co/models/{_HF_MODEL}"


def analyze_sentiment(text: str) -> dict:
    token = os.getenv("HF_API_KEY")
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.post(
            _HF_URL,
            headers=headers,
            json={"inputs": text[:512]},  # model max input
            timeout=15,
        )
        resp.raise_for_status()
        raw = resp.json()

        # HF returns [[{label, score}, ...]] for single-input batches
        scores = raw[0] if isinstance(raw[0], list) else raw
        score_map = {item["label"].lower(): item["score"] for item in scores}

    except Exception:
        # Fallback if model is cold-loading or network fails
        score_map = {"positive": 0.33, "neutral": 0.34, "negative": 0.33}

    pos = score_map.get("positive", 0.0)
    neu = score_map.get("neutral", 0.0)
    neg = score_map.get("negative", 0.0)

    # sentiment_score: 0.0 = very negative/burned out, 1.0 = very positive/energized
    sentiment_score = round(pos + neu * 0.5, 3)

    if sentiment_score >= 0.65:
        energy_level = "high"
    elif sentiment_score >= 0.4:
        energy_level = "medium"
    else:
        energy_level = "low"

    flags = []
    if neg > 0.6:
        flags.append("disengaged")
    if neg > 0.8:
        flags.append("overwhelmed")
    if neu > 0.7 and pos < 0.15:
        flags.append("flat_affect")
    if pos < 0.1:
        flags.append("hopeless")

    return {
        "sentiment_score": sentiment_score,
        "energy_level":    energy_level,
        "flags":           flags,
    }
