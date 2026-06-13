import json
import os
import anthropic
from dotenv import load_dotenv

load_dotenv()

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


def analyze_sentiment(text: str) -> dict:
    client = _get_client()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{
            "role": "user",
            "content": (
                f'Analyze the emotional sentiment and energy level of this text written by someone at work: "{text}". '
                'Return ONLY a JSON object with no explanation: '
                '{"sentiment_score": 0.0-1.0, "energy_level": "low|medium|high", "flags": []}'
                '\nsentiment_score: 0.0=very negative/burned out, 1.0=very positive/energized. '
                'flags: list any of ["disengaged", "anxious", "overwhelmed", "hopeless", "flat_affect"]'
            )
        }]
    )

    raw = response.content[0].text.strip()
    # strip markdown code fences if Claude wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {"sentiment_score": 0.5, "energy_level": "medium", "flags": []}

    return {
        "sentiment_score": float(result.get("sentiment_score", 0.5)),
        "energy_level": result.get("energy_level", "medium"),
        "flags": result.get("flags", []),
    }
