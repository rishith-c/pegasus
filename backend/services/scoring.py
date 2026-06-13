"""Backend-side scoring fallback + result normalization.

When Rishith's ML service (8003) is up, we use its burnout_result directly
(normalize_ml_result). When it is offline, the local fallbacks produce a
principled burnout_result from the available signals, so the backend is
independently demoable. Both paths emit the contract `breakdown`
{imessage, typing, facial, voice, tribe} (PRD §4.5 fusion).

All inputs are treated as untrusted: helpers coerce None / strings / bad numbers
and clamp out-of-range values, so the fallback path (the last line of defense)
never raises.
"""
from config import RED_THRESHOLD, YELLOW_THRESHOLD

# A healthy brain is expected to engage more with activating content than calm.
_CATEGORY_EXPECTED = {"calm": 0.45, "neutral": 0.50, "activating": 0.72}

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

# Plain-English, non-clinical descriptions for the Brain screen (PRD §5.2).
_REGION_EXPLANATIONS = {
    "amygdala": "threat & emotional reactivity — tends to run hot when stress is high",
    "anterior cingulate cortex": "conflict monitoring & emotional regulation — works harder under sustained strain",
    "insula": "body awareness — tracks discomfort, tension, and fatigue",
    "dorsolateral prefrontal cortex": "focus & self-control — dips when you're cognitively depleted",
    "medial prefrontal cortex": "self-reflection & calm baseline — active when you feel settled",
    "posterior cingulate cortex": "rest & mind-wandering — part of the calm 'default' network",
    "ventral striatum": "reward & motivation — quiets down when drive is low",
    "hippocampus": "memory & context — sensitive to chronic stress",
}

_INTERVENTIONS = {
    "green": "Your signals look steady today. Keep doing what works — a short walk "
             "or a moment of gratitude can lock in the good momentum.",
    "yellow": "Some early strain is showing. Try a 5-minute breathing break, step away "
              "from the screen, and protect one boundary today (decline one nonessential "
              "meeting).",
    "red": "Your signals point to significant strain. Please pause and step away from "
           "work for a bit, and take one thing off your plate today.",
}


def _num(x, default: float = 0.0) -> float:
    """Coerce to float, tolerating None / strings / bad input."""
    try:
        if x is None:
            return default
        return float(x)
    except (TypeError, ValueError):
        return default


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def level_for(score: int) -> str:
    if score < YELLOW_THRESHOLD:
        return "green"
    if score < RED_THRESHOLD:
        return "yellow"
    return "red"


def _intervention(level: str) -> str:
    return _INTERVENTIONS.get(level, _INTERVENTIONS["yellow"])


def region_explanations(regions: list[str]) -> dict:
    return {r: _REGION_EXPLANATIONS.get(r, "involved in processing this stimulus") for r in regions or []}


def _expected_engagement(stimulus: dict | None) -> float:
    if not stimulus:
        return 0.5
    if stimulus.get("tribe_expected_engagement") is not None:
        return _clamp(_num(stimulus.get("tribe_expected_engagement"), 0.5), 0.0, 1.0)
    return _CATEGORY_EXPECTED.get(stimulus.get("category"), 0.5)


def _video_signals(video: dict | None) -> tuple[float, float]:
    """(facial 0-100, voice 0-100) from a normalized video-signal dict."""
    if not video:
        return 0.0, 0.0
    facial = _clamp(_num(video.get("facial_score")), 0.0, 100.0)
    voice = _clamp(_num(video.get("voice_score")), 0.0, 100.0)
    return round(facial, 1), round(voice, 1)


def synth_brain(level: str, score: int):
    """Public: synthesized (flagged_regions, regions) for the brain-view fallback."""
    return _brain(level, score)


def _brain(level: str, score: int):
    """Return (flagged_regions, {region: activation 0-1}) synthesized from score."""
    flagged = _ACTIVE_REGIONS.get(level, _ACTIVE_REGIONS["yellow"])
    base = _clamp(score, 0, 100) / 100.0
    regions = {}
    for r in _ATLAS:
        if r in flagged:
            regions[r] = round(min(1.0, 0.55 + base * 0.45), 3)
        else:
            regions[r] = round(max(0.0, 0.35 - base * 0.2), 3)
    return flagged, regions


def _typing_burnout(raw: dict) -> float:
    """0-100 typing-biometrics burnout contribution from raw signals."""
    err = max(0.0, _num(raw.get("error_rate")))
    wpm = max(0.0, _num(raw.get("typing_wpm")))
    val = min(60.0, err)
    if 0 < wpm < 20:
        val += 25
    elif wpm > 120:
        val += 10
    return round(_clamp(val, 0.0, 100.0), 1)


def _breakdown(analysis: dict, raw: dict, tribe_dev: float, facial: float = 0.0, voice: float = 0.0) -> dict:
    """Per-stream burnout contributions (0-100), the PRD §4.5 fusion inputs."""
    sentiment = _clamp(_num(analysis.get("sentiment_score"), 0.5), 0.0, 1.0)
    return {
        "imessage": round(_clamp((1 - sentiment) * 100, 0.0, 100.0), 1),
        "typing": _typing_burnout(raw),
        "facial": round(_clamp(facial, 0.0, 100.0), 1),
        "voice": round(_clamp(voice, 0.0, 100.0), 1),
        "tribe": round(_clamp(tribe_dev * 100, 0.0, 100.0), 1),
    }


def _indicators(analysis: dict, raw: dict, level: str) -> list[str]:
    out: list[str] = []
    if _num(analysis.get("sentiment_score"), 0.5) < 0.4:
        out.append("negative sentiment")
    if analysis.get("energy_level") == "low":
        out.append("low energy")
    if _num(raw.get("error_rate")) > 15:
        out.append("high typing error rate")
    wpm = _num(raw.get("typing_wpm"))
    if 0 < wpm < 20:
        out.append("slowed typing")
    if _num(raw.get("response_time_ms")) > 60000:
        out.append("delayed response")
    for flag in analysis.get("linguistic_flags") or []:
        out.append(str(flag).replace("_", " "))

    if not out:
        out = ["healthy engagement"] if level == "green" else ["elevated stress signals"]

    seen, deduped = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped[:5]


def local_analysis(raw: dict) -> dict:
    """Last-resort analysis when the signals service is ALSO offline."""
    err = max(0.0, _num(raw.get("error_rate")))
    wpm = max(0.0, _num(raw.get("typing_wpm")))
    rt = max(0.0, _num(raw.get("response_time_ms")))

    combined = min(35.0, err)
    if 0 < wpm < 20:
        combined += 20
    elif wpm > 120:
        combined += 10
    if rt > 60000:
        combined += 20
    elif rt > 30000:
        combined += 10
    combined = _clamp(combined, 0.0, 100.0)

    return {
        "sentiment_score": 0.5,
        "energy_level": "low" if combined >= 40 else "medium",
        "linguistic_flags": [],
        "combined_signal_score": round(combined, 2),
        "detail": {},
        "_local": True,
    }


def fallback_score(stimulus: dict | None, analysis: dict, raw: dict, video: dict | None = None) -> dict:
    """Score a text/typing pulse-check locally from signals + the stimulus baseline.

    `video` (latest known facial/voice for the user) is surfaced in the breakdown
    for continuity but does not move a text-channel score.
    """
    analysis = analysis or {}
    raw = raw or {}
    expected = _expected_engagement(stimulus)
    combined = _clamp(_num(analysis.get("combined_signal_score"), 50.0) / 100.0, 0.0, 1.0)
    actual_engagement = _clamp(1 - combined, 0.0, 1.0)

    tribe_dev = round(abs(expected - actual_engagement), 3)
    behavioral_dev = round(combined, 3)
    facial, voice = _video_signals(video)

    score = int(_clamp(round(100 * (0.6 * behavioral_dev + 0.4 * tribe_dev)), 0, 100))
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
        "breakdown": _breakdown(analysis, raw, tribe_dev, facial, voice),
        "confidence": 0.55 if analysis.get("_local") else 0.7,
        "source": "fallback",
    }


def video_fallback_score(video: dict, prior: dict | None = None) -> dict:
    """Fuse a video check-in into a burnout score (PRD §4.5, facial weighted highest).

    `prior` is the user's most recent burnout_result (for behavioral/text context).
    """
    facial, voice = _video_signals(video)
    video_burden = (0.6 * facial + 0.4 * voice) / 100.0  # facial weighted highest

    prior = prior or {}
    prior_beh = _clamp(_num(prior.get("behavioral_deviation")), 0.0, 1.0)
    prior_bd = prior.get("breakdown") or {}

    score = int(_clamp(round(100 * (0.65 * video_burden + 0.35 * prior_beh)), 0, 100))
    level = level_for(score)

    indicators: list[str] = []
    if facial >= 65:
        indicators.append("strained facial expression")
    elif facial >= 40:
        indicators.append("facial tension")
    if voice >= 65:
        indicators.append("flat or strained voice")
    elif voice >= 40:
        indicators.append("vocal stress")
    if not indicators:
        indicators = ["relaxed facial & vocal signals"] if level == "green" else ["elevated facial/vocal strain"]

    flagged, regions = _brain(level, score)
    return {
        "score": score,
        "level": level,
        "tribe_deviation": _num(prior.get("tribe_deviation")),
        "behavioral_deviation": round(video_burden, 3),
        "top_indicators": indicators[:5],
        "intervention": _intervention(level),
        "brain_regions_flagged": flagged,
        "brain_regions": regions,
        "breakdown": {
            "imessage": prior_bd.get("imessage", 0.0),
            "typing": prior_bd.get("typing", 0.0),
            "facial": round(facial, 1),
            "voice": round(voice, 1),
            "tribe": prior_bd.get("tribe", 0.0),
        },
        "confidence": 0.6,
        "source": "fallback",
    }


def normalize_ml_result(
    result: dict,
    stimulus: dict | None,
    analysis: dict,
    raw: dict,
    video: dict | None = None,
) -> dict:
    """Coerce the ML service's burnout_result into our stored shape.

    Tolerates missing fields and synthesizes brain_regions / breakdown if absent.
    """
    result = result or {}
    score = int(_clamp(round(_num(result.get("score"))), 0, 100))
    level = result.get("level")
    if level not in ("green", "yellow", "red"):
        level = level_for(score)
    if score >= RED_THRESHOLD:
        level = "red"  # safety: a red-range score is never downgraded (PRD §6)

    regions = result.get("brain_regions") or result.get("regions")
    flagged = result.get("brain_regions_flagged") or []
    if not regions:
        synth_flagged, regions = _brain(level, score)
        if not flagged:
            flagged = synth_flagged
    elif not flagged:
        flagged = [k for k, _ in sorted(regions.items(), key=lambda kv: -kv[1])[:3]]

    tribe_dev = _num(result.get("tribe_deviation"))
    facial, voice = _video_signals(video)
    breakdown = result.get("breakdown") or _breakdown(analysis or {}, raw or {}, tribe_dev, facial, voice)

    return {
        "score": score,
        "level": level,
        "tribe_deviation": tribe_dev,
        "behavioral_deviation": _num(result.get("behavioral_deviation")),
        "top_indicators": result.get("top_indicators") or [],
        "intervention": result.get("intervention") or _intervention(level),
        "brain_regions_flagged": flagged,
        "brain_regions": regions,
        "breakdown": breakdown,
        "confidence": _num(result.get("confidence"), 0.8),
        "source": "tribe",
    }
