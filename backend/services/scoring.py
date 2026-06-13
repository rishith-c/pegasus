"""Backend-side scoring fallback + result normalization.

When Rishith's ML service (8003) is up, we use its burnout_result directly
(normalize_ml_result). When it is offline, fallback_score produces a principled
burnout_result from the signals analysis + the stimulus TRIBE baseline, so the
backend is independently demoable.
"""
from config import RED_THRESHOLD, YELLOW_THRESHOLD

# Named regions we surface as "flagged" per level, plus a small atlas we
# synthesize activations over for the brain heatmap.
_ACTIVE_REGIONS = {
    "green": ["medial prefrontal cortex", "posterior cingulate cortex"],
    "yellow": ["anterior cingulate cortex", "insula", "dorsolateral prefrontal cortex"],
    "red": ["amygdala", "anterior cingulate cortex", "insula"],
}
_ATLAS = [
    "medial prefrontal cortex",
    "dorsolateral prefrontal cortex",
    "anterior cingulate cortex",
    "posterior cingulate cortex",
    "insula",
    "amygdala",
    "ventral striatum",
    "hippocampus",
]

_INTERVENTIONS = {
    "green": "Your signals look steady today. Keep doing what works — a short walk "
             "or a moment of gratitude can lock in the good momentum.",
    "yellow": "Some early strain is showing. Try a 5-minute breathing break, step away "
              "from the screen, and protect one boundary today (decline one nonessential "
              "meeting).",
    "red": "Your signals point to significant strain. Please pause — take 15 minutes away "
           "from work, reach out to someone you trust, and consider one thing you can take "
           "off your plate today. You don't have to push through alone.",
}


def level_for(score: int) -> str:
    if score < YELLOW_THRESHOLD:
        return "green"
    if score < RED_THRESHOLD:
        return "yellow"
    return "red"


def _intervention(level: str) -> str:
    return _INTERVENTIONS.get(level, _INTERVENTIONS["yellow"])


def _brain(level: str, score: int):
    """Return (flagged_regions, {region: activation 0-1}) synthesized from score."""
    flagged = _ACTIVE_REGIONS.get(level, _ACTIVE_REGIONS["yellow"])
    base = score / 100.0
    regions = {}
    for r in _ATLAS:
        if r in flagged:
            regions[r] = round(min(1.0, 0.55 + base * 0.45), 3)
        else:
            regions[r] = round(max(0.0, 0.35 - base * 0.2), 3)
    return flagged, regions


def _indicators(analysis: dict, raw: dict, level: str) -> list[str]:
    out: list[str] = []
    if float(analysis.get("sentiment_score", 0.5)) < 0.4:
        out.append("negative sentiment")
    if analysis.get("energy_level") == "low":
        out.append("low energy")
    if float(raw.get("error_rate") or 0) > 15:
        out.append("high typing error rate")
    wpm = float(raw.get("typing_wpm") or 0)
    if 0 < wpm < 20:
        out.append("slowed typing")
    if float(raw.get("response_time_ms") or 0) > 60000:
        out.append("delayed response")
    for flag in analysis.get("linguistic_flags") or []:
        out.append(str(flag).replace("_", " "))

    if not out:
        out = ["healthy engagement"] if level == "green" else ["elevated stress signals"]

    # De-dupe, preserve order, cap at 5.
    seen, deduped = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped[:5]


def local_analysis(raw: dict) -> dict:
    """Last-resort analysis when the signals service is ALSO offline.

    Derives a crude combined_signal_score (0-100, higher = more burnout) from the
    raw behavioral metrics only.
    """
    err = float(raw.get("error_rate") or 0)
    wpm = float(raw.get("typing_wpm") or 0)
    rt = float(raw.get("response_time_ms") or 0)

    combined = min(35.0, err)            # backspace-heavy typing
    if 0 < wpm < 20:
        combined += 20                   # very slow typing
    elif wpm > 120:
        combined += 10                   # frantic typing
    if rt > 60000:
        combined += 20                   # took over a minute
    elif rt > 30000:
        combined += 10
    combined = min(100.0, combined)

    return {
        "sentiment_score": 0.5,
        "energy_level": "low" if combined >= 40 else "medium",
        "linguistic_flags": [],
        "combined_signal_score": round(combined, 2),
        "detail": {},
        "_local": True,
    }


def fallback_score(stimulus: dict | None, analysis: dict, raw: dict) -> dict:
    """Compute a burnout_result locally from signals + the TRIBE baseline."""
    expected = float(stimulus["tribe_expected_engagement"]) if stimulus else 0.5
    combined = float(analysis.get("combined_signal_score", 50)) / 100.0  # 0-1 burnout
    actual_engagement = max(0.0, min(1.0, 1 - combined))

    tribe_dev = round(abs(expected - actual_engagement), 3)
    behavioral_dev = round(combined, 3)

    score = int(round(100 * (0.6 * behavioral_dev + 0.4 * tribe_dev)))
    score = max(0, min(100, score))
    level = level_for(score)

    flagged, regions = _brain(level, score)
    return {
        "score": score,
        "level": level,
        "tribe_deviation": tribe_dev,
        "behavioral_deviation": behavioral_dev,
        "top_indicators": _indicators(analysis, raw, level),
        "intervention": _intervention(level),
        "brain_regions_flagged": flagged,
        "brain_regions": regions,
        "confidence": 0.55 if analysis.get("_local") else 0.7,
        "source": "fallback",
    }


def normalize_ml_result(result: dict, stimulus: dict | None) -> dict:
    """Coerce the ML service's burnout_result into our stored shape.

    Tolerates missing fields and synthesizes a brain_regions map if the ML
    service did not return one.
    """
    score = max(0, min(100, int(round(float(result.get("score", 0))))))
    level = result.get("level") or level_for(score)

    regions = result.get("brain_regions") or result.get("regions")
    flagged = result.get("brain_regions_flagged") or []
    if not regions:
        synth_flagged, regions = _brain(level, score)
        if not flagged:
            flagged = synth_flagged
    elif not flagged:
        flagged = [k for k, _ in sorted(regions.items(), key=lambda kv: -kv[1])[:3]]

    return {
        "score": score,
        "level": level,
        "tribe_deviation": float(result.get("tribe_deviation", 0.0)),
        "behavioral_deviation": float(result.get("behavioral_deviation", 0.0)),
        "top_indicators": result.get("top_indicators") or [],
        "intervention": result.get("intervention") or _intervention(level),
        "brain_regions_flagged": flagged,
        "brain_regions": regions,
        "confidence": float(result.get("confidence", 0.8)),
        "source": "tribe",
    }
