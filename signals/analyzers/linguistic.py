import re


_FUTURE_MARKERS = re.compile(
    r"\b(will|won't|gonna|going to|plan to|hope to|might|may|eventually|someday|later)\b",
    re.IGNORECASE,
)
_SELF_REF = re.compile(r"\b(I|me|my|myself|I'm|I've|I'll|I'd)\b", re.IGNORECASE)
_NEGATION = re.compile(r"\b(can't|cannot|won't|don't|didn't|doesn't|never|no longer|not)\b", re.IGNORECASE)
_EXHAUSTION = re.compile(r"\b(tired|exhausted|drained|burned out|burnout|stressed|overwhelmed|can't anymore)\b", re.IGNORECASE)


def analyze_linguistic(text: str) -> dict:
    """
    Returns a burnout contribution 0-15 from linguistic features.
    High self-reference + negation + exhaustion language = burnout signal.
    """
    words = text.split()
    total = max(len(words), 1)

    future_count = len(_FUTURE_MARKERS.findall(text))
    self_ref_count = len(_SELF_REF.findall(text))
    negation_count = len(_NEGATION.findall(text))
    exhaustion_count = len(_EXHAUSTION.findall(text))

    future_pct = round(future_count / total * 100, 1)
    self_ref_pct = round(self_ref_count / total * 100, 1)

    flags = []
    if future_pct > 20:
        flags.append("avoidant_future_focus")
    if self_ref_pct > 15:
        flags.append("high_self_reference")
    if negation_count >= 2:
        flags.append("high_negation")
    if exhaustion_count >= 1:
        flags.append("exhaustion_language")

    # contribution: weighted by exhaustion + negation density
    contribution = min(15, exhaustion_count * 5 + negation_count * 2 + (1 if self_ref_pct > 15 else 0))

    return {
        "future_tense_pct": future_pct,
        "self_reference_pct": self_ref_pct,
        "linguistic_flags": flags,
        "burnout_contribution": round(contribution, 2),
    }
