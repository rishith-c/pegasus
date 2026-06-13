"""Burnout scoring: deviation of behavior from the TRIBE healthy baseline.

Language understanding via Hugging Face (fast emotion model, cross-checks the
sentiment that Dhruva's signals service also computes); intervention via Claude.
Both degrade gracefully (HF -> 0.5, Claude -> canned) so the demo runs offline.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

import requests

HF_TOKEN = os.getenv("HF_TOKEN")
HF_API = "https://api-inference.huggingface.co/models"
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"


class BurnoutScorer:
    def __init__(self) -> None:
        self._anthropic = None  # lazy

    # --- language ----------------------------------------------------------
    def hf_sentiment(self, text: str) -> float:
        """0-1 positivity from a HF emotion model. Returns 0.5 on any failure."""
        if not text or not HF_TOKEN:
            return 0.5
        try:
            r = requests.post(
                f"{HF_API}/{EMOTION_MODEL}",
                headers={"Authorization": f"Bearer {HF_TOKEN}"},
                json={"inputs": text},
                timeout=10,
            )
            results = r.json()
            scores = results[0] if isinstance(results, list) and results and isinstance(results[0], list) else results
            pos = sum(e["score"] for e in scores if e["label"] in ("joy", "neutral", "surprise"))
            return min(max(pos, 0.0), 1.0)
        except Exception:
            return 0.5

    # --- scoring -----------------------------------------------------------
    def compute_deviation(self, tribe_baseline: Optional[Dict], signals: Dict) -> Dict:
        baseline = tribe_baseline or {}
        regions = baseline.get("regions", {}) or {}
        expected = float(regions.get("prefrontal_cortex", 0.5))

        # Prefer a passed sentiment; otherwise compute from the response text.
        sentiment = signals.get("sentiment_score")
        if sentiment is None:
            sentiment = self.hf_sentiment(signals.get("response_text", ""))
        sentiment = float(sentiment)

        error_rate = float(signals.get("error_rate", 0))
        wpm = float(signals.get("typing_wpm", 60))
        rt = float(signals.get("response_time_ms", 3000))

        actual = (
            sentiment * 0.3
            + (1 - min(error_rate / 20, 1)) * 0.2
            + min(wpm / 80, 1) * 0.2
            + (1 - min(rt / 10000, 1)) * 0.3
        )
        deviation = abs(expected - actual)
        score = min(int(deviation * 150), 100)
        level = "green" if score < 30 else "yellow" if score < 65 else "red"

        ind: List[str] = []
        if error_rate > 10:
            ind.append("Elevated typing errors suggest cognitive strain")
        if rt > 8000:
            ind.append("Delayed response indicates mental fatigue")
        if sentiment < 0.3:
            ind.append("Negative sentiment drift detected")
        if wpm < 30:
            ind.append("Reduced typing speed suggests low energy")
        if not ind:
            ind.append("No significant warning signs")

        return {
            "score": score,
            "level": level,
            "tribe_deviation": round(deviation, 4),
            "behavioral_deviation": round(1 - actual, 4),
            "top_indicators": ind[:3],
            "intervention": self._intervene(score, level, ind),
            "brain_regions_flagged": self._flag_regions(regions),
            "confidence": round(min(0.5 + deviation * 0.5, 0.95), 3),
            "breakdown": {
                "imessage": int((1 - sentiment) * 100),
                "typing": int(min(error_rate / 20, 1) * 100),
                "facial": int(signals.get("facial_stress_score", 0)),
                "voice": int(signals.get("voice_stress_score", 0)),
                "tribe": int(deviation * 100),
            },
        }

    @staticmethod
    def _flag_regions(regions: Dict) -> List[str]:
        """Plain-English flags for brain regions above a load threshold."""
        labels = {
            "prefrontal_cortex": "Prefrontal cortex: elevated cognitive load",
            "amygdala_region": "Amygdala: heightened stress response",
            "temporal_lobe": "Temporal lobe: altered language processing",
        }
        return [labels[k] for k, v in regions.items() if k in labels and float(v) > 0.6]

    def _intervene(self, score: int, level: str, indicators: List[str]) -> str:
        try:
            if self._anthropic is None:
                from anthropic import Anthropic

                self._anthropic = Anthropic()
            r = self._anthropic.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=150,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Burnout {score}/100 ({level}). Signs: {', '.join(indicators)}. "
                        "Give ONE specific action in under 2 sentences. Warm but direct. "
                        "You are a check engine light, not a therapist."
                    ),
                }],
            )
            return r.content[0].text
        except Exception:
            return "Take a 10-minute break and step outside for some fresh air."
