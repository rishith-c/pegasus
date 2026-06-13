import re

FUTURE_WORDS    = ["will", "going to", "gonna", "tomorrow", "next", "plan", "soon", "later", "future", "hope"]
SELF_REF_WORDS  = {"i", "me", "my", "myself", "mine", "i'm", "i've", "i'll"}
HEDGING_PHRASES = ["idk", "i guess", "whatever", "maybe", "kinda", "sort of", "i dunno", "probably", "meh", "fine", "nm"]
FLAT_INDICATORS = {"fine", "ok", "okay", "nothing", "same", "meh", "nm"}
EXHAUSTION_RE   = re.compile(r"\b(tired|exhausted|drained|burned out|burnout|stressed|overwhelmed)\b", re.IGNORECASE)
NEGATION_RE     = re.compile(r"\b(can't|cannot|won't|don't|didn't|doesn't|never|not)\b", re.IGNORECASE)


def analyze_linguistic(text: str) -> dict:
    if not text:
        return {
            "future_tense_pct": 50, "self_referential_pct": 0,
            "hedging_count": 0, "flat_affect": False,
            "linguistic_flags": [], "burnout_contribution": 0,
        }

    words     = re.findall(r"\b\w+\b", text.lower())
    total     = max(len(words), 1)
    text_low  = text.lower()

    future_count   = sum(1 for w in FUTURE_WORDS if w in text_low)
    self_ref_count = sum(1 for w in words if w in SELF_REF_WORDS)
    hedging_count  = sum(1 for h in HEDGING_PHRASES if h in text_low)
    exhaustion_n   = len(EXHAUSTION_RE.findall(text))
    negation_n     = len(NEGATION_RE.findall(text))
    exclamations   = text.count("!")
    emoji_count    = len(re.findall(r"[\U0001F300-\U0001FFFF\U00002702-\U000027B0]+", text))

    flat_affect = (
        len(words) < 5
        or any(text.strip().lower() == f for f in FLAT_INDICATORS)
        or (exclamations == 0 and emoji_count == 0 and len(words) < 10)
    )

    flags = []
    if future_count == 0 and len(words) > 5:
        flags.append("no future-oriented language (possible loss of motivation)")
    if self_ref_count / total > 0.25:
        flags.append("high self-referential language (possible rumination)")
    if hedging_count >= 2:
        flags.append("frequent hedging/disengagement language")
    if flat_affect:
        flags.append("flat affect — minimal emotional expression")
    if exhaustion_n >= 1:
        flags.append("exhaustion language")
    if negation_n >= 2:
        flags.append("high negation")

    contribution = min(15,
        exhaustion_n * 4 + negation_n * 1.5 + hedging_count * 1.5 +
        (1 if self_ref_count / total > 0.25 else 0) +
        (1 if flat_affect else 0)
    )

    return {
        # ── spec-required field names ──
        "future_tense_pct":     round(future_count / total * 100, 1),
        "self_referential_pct": round(self_ref_count / total * 100, 1),
        "hedging_count":        hedging_count,
        "flat_affect":          flat_affect,
        "linguistic_flags":     flags,
        # ── extras used by combined_signal_score ──
        "exclamation_count":    exclamations,
        "emoji_count":          emoji_count,
        "word_count":           len(words),
        "burnout_contribution": round(contribution, 2),
    }
