"""Burnout scoring: deviation of behavior from the TRIBE healthy baseline.

All language/AI is **Hugging Face** (no Anthropic):
  - sentiment/emotion via a HF text-classification model
  - interventions via a HF chat (instruct) model
Both degrade gracefully (sentiment -> 0.5, intervention -> canned copy) so the
demo runs even if HF is unreachable.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

HF_TOKEN = os.getenv("HF_TOKEN")
EMOTION_MODEL = os.getenv("HF_EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base")
CHAT_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")

_POSITIVE_EMOTIONS = {"joy", "neutral", "surprise"}


class BurnoutScorer:
    def __init__(self) -> None:
        self._client = None  # lazy huggingface_hub.InferenceClient

    def _hf(self):
        if self._client is None:
            from huggingface_hub import InferenceClient

            self._client = InferenceClient(token=HF_TOKEN)
        return self._client

    # --- language ----------------------------------------------------------
    def hf_sentiment(self, text: str) -> float:
        """0-1 positivity from a HF emotion model. Returns 0.5 on any failure."""
        if not text or not HF_TOKEN:
            return 0.5
        try:
            results = self._hf().text_classification(text, model=EMOTION_MODEL)
            # results: list of {label, score} across all emotions.
            pos = sum(r.score for r in results if r.label.lower() in _POSITIVE_EMOTIONS)
            return min(max(float(pos), 0.0), 1.0)
        except Exception:
            return 0.5

    # --- scoring -----------------------------------------------------------
    def compute_deviation(self, tribe_baseline: Optional[Dict], signals: Dict) -> Dict:
        baseline = tribe_baseline or {}
        regions = baseline.get("regions", {}) or {}
        expected = float(regions.get("prefrontal_cortex", 0.5))

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
        labels = {
            "prefrontal_cortex": "Prefrontal cortex: elevated cognitive load",
            "amygdala_region": "Amygdala: heightened stress response",
            "temporal_lobe": "Temporal lobe: altered language processing",
        }
        return [labels[k] for k, v in regions.items() if k in labels and float(v) > 0.6]

    def _intervene(self, score: int, level: str, indicators: List[str]) -> str:
        """One warm, specific action via a HF chat model. Canned fallback."""
        if not HF_TOKEN:
            return self._fallback(level)
        try:
            resp = self._hf().chat_completion(
                model=CHAT_MODEL,
                max_tokens=120,
                temperature=0.7,
                messages=[{
                    "role": "user",
                    "content": (
                        f"Burnout {score}/100 ({level}). Signs: {', '.join(indicators)}. "
                        "Give ONE specific action in under 2 sentences. Warm but direct. "
                        "You are a check engine light, not a therapist. No preamble."
                    ),
                }],
            )
            text = resp.choices[0].message.content.strip()
            return text or self._fallback(level)
        except Exception:
            return self._fallback(level)

    @staticmethod
    def _fallback(level: str) -> str:
        return {
            "green": "You're tracking well. Take a real 5-minute break before your next task.",
            "yellow": "Step outside for 10 minutes and drink water before you continue.",
            "red": "Stop work for today if you can, and message one person you trust right now.",
        }.get(level, "Take a 10-minute break and step outside for some fresh air.")
