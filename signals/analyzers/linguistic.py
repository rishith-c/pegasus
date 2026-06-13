import re

_FUTURE_MARKERS = re.compile(
    r"\b(will|won't|gonna|going to|plan to|hope to|might|may|eventually|someday|later)\b",
    re.IGNORECASE,
)
_SELF_REF = re.compile(r"\b(I|me|my|myself|I'm|I've|I'll|I'd)\b", re.IGNORECASE)
_NEGATION = re.compile(
    r"\b(can't|cannot|won't|don't|didn't|doesn't|never|no longer|not)\b",
    re.IGNORECASE,
)
_EXHAUSTION = re.compile(
    r"\b(tired|exhausted|drained|burned out|burnout|stressed|overwhelmed|can't anymore)\b",
    re.IGNORECASE,
)
_HEDGING = re.compile(
    r"\b(idk|i don't know|i guess|i think|maybe|whatever|fine|sort of|kind of|i suppose|meh|doesn't matter)\b",
    re.IGNORECASE,
)
_EMOJI = re.compile(
    r"[\U0001F300-\U0001FFFF"
    r"\U00002702-\U000027B0"
    r"\U0001F1E0-\U0001F1FF"
    r"\U00002500-\U00002BEF"
    r"\U0001F004-\U0001F0CF"
    r"\U0001F018-\U0001F270"
    r"☀-⛿"
    r"✂-➰]+",
    re.UNICODE,
)


def analyze_linguistic(text: str) -> dict:
    """
    Returns a burnout contribution 0-15 from linguistic features.
    Signals: exhaustion language, high negation, hedging words, flat affect
    (disappearing exclamation marks and emoji), high self-reference.
    """
    words = text.split()
    total = max(len(words), 1)
    chars = len(text)

    future_count     = len(_FUTURE_MARKERS.findall(text))
    self_ref_count   = len(_SELF_REF.findall(text))
    negation_count   = len(_NEGATION.findall(text))
    exhaustion_count = len(_EXHAUSTION.findall(text))
    hedging_count    = len(_HEDGING.findall(text))
    exclamation_count = text.count("!")
    emoji_count      = len(_EMOJI.findall(text))

    future_pct   = round(future_count   / total * 100, 1)
    self_ref_pct = round(self_ref_count / total * 100, 1)
    hedging_pct  = round(hedging_count  / total * 100, 1)

    flags = []
    if future_pct > 20:
        flags.append("avoidant_future_focus")
    if self_ref_pct > 15:
        flags.append("high_self_reference")
    if negation_count >= 2:
        flags.append("high_negation")
    if exhaustion_count >= 1:
        flags.append("exhaustion_language")
    if hedging_pct > 10:
        flags.append("high_hedging")
    if exclamation_count == 0 and chars > 30:
        flags.append("flat_affect_no_exclamation")
    if emoji_count == 0 and chars > 40:
        flags.append("flat_affect_no_emoji")

    # Contribution: exhaustion most weighted, then negation + hedging density
    contribution = min(15,
        exhaustion_count * 4 +
        negation_count   * 1.5 +
        hedging_count    * 1.5 +
        (1 if "high_self_reference" in flags else 0) +
        (1 if "flat_affect_no_exclamation" in flags else 0)
    )

    return {
        "future_tense_pct":    future_pct,
        "self_reference_pct":  self_ref_pct,
        "hedging_pct":         hedging_pct,
        "exclamation_count":   exclamation_count,
        "emoji_count":         emoji_count,
        "word_count":          len(words),
        "linguistic_flags":    flags,
        "burnout_contribution": round(contribution, 2),
    }
