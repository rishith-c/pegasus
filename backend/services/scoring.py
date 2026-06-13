"""Backend-side scoring fallback + result normalization.

When Rishith's ML service (8003) is up, we use its burnout_result directly
(normalize_ml_result). When it is offline, the local fallbacks produce a
principled burnout_result from the available signals, so the backend is
independently demoable. Both paths emit the contract `breakdown`
{imessage, typing, facial, voice, tribe} (PRD §4.5 fusion).
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
    if "tribe_expected_engagement" in stimulus:
        return float(stimulus["tribe_expected_engagement"])
    return _CATEGORY_EXPECTED.get(stimulus.get("category"), 0.5)


def _video_signals(video: dict | None) -> tuple[float, float]:
    """(facial 0-100, voice 0-100) from a normalized video-signal dict."""
    if not video:
        return 0.0, 0.0
    facial = float(video.get("facial_score") or 0)
    voice = float(video.get("voice_score") or 0)
    return round(min(100.0, facial), 1), round(min(100.0, voice), 1)


def synth_brain(level: str, score: int):
    """Public: synthesized (flagged_regions, regions) for the brain-view fallback."""
    return _brain(level, score)


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


def _typing_burnout(raw: dict) -> float:
    """0-100 typing-biometrics burnout contribution from raw signals."""
    err = float(raw.get("error_rate") or 0)
    wpm = float(raw.get("typing_wpm") or 0)
    val = min(60.0, err)
    if 0 < wpm < 20:
        val += 25
    elif wpm > 120:
        val += 10
    return round(min(100.0, val), 1)


def _breakdown(analysis: dict, raw: dict, tribe_dev: float, facial: float = 0.0, voice: float = 0.0) -> dict:
    """Per-stream burnout contributions (0-100), the PRD §4.5 fusion inputs."""
    sentiment = float(analysis.get("sentiment_score", 0.5))
    return {
        "imessage": round(min(100.0, (1 - sentiment) * 100), 1),
        "typing": _typing_burnout(raw),
        "facial": round(facial, 1),
        "voice": round(voice, 1),
        "tribe": round(min(100.0, tribe_dev * 100), 1),
    }


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

    seen, deduped = set(), []
    for item in out:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    return deduped[:5]


def local_analysis(raw: dict) -> dict:
    """Last-resort analysis when the signals service is ALSO offline."""
    err = float(raw.get("error_rate") or 0)
    wpm = float(raw.get("typing_wpm") or 0)
    rt = float(raw.get("response_time_ms") or 0)

    combined = min(35.0, err)
    if 0 < wpm < 20:
        combined += 20
    elif wpm > 120:
        combined += 10
    if rt > 60000:
        combined += 20
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


def fallback_score(stimulus: dict | None, analysis: dict, raw: dict, video: dict | None = None) -> dict:
    """Score a text/typing pulse-check locally from signals + the stimulus baseline.

    `video` (latest known facial/voice for the user) is surfaced in the breakdown
    for continuity but does not move a text-channel score.
    """
    expected = _expected_engagement(stimulus)
    combined = float(analysis.get("combined_signal_score", 50)) / 100.0  # 0-1 burnout
    actual_engagement = max(0.0, min(1.0, 1 - combined))

    tribe_dev = round(abs(expected - actual_engagement), 3)
    behavioral_dev = round(combined, 3)
    facial, voice = _video_signals(video)

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
    prior_beh = float(prior.get("behavioral_deviation") or 0.0)
    prior_bd = prior.get("breakdown") or {}

    score = int(round(100 * (0.65 * video_burden + 0.35 * prior_beh)))
    score = max(0, min(100, score))
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
        "tribe_deviation": float(prior.get("tribe_deviation") or 0.0),
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

    tribe_dev = float(result.get("tribe_deviation", 0.0))
    facial, voice = _video_signals(video)
    breakdown = result.get("breakdown") or _breakdown(analysis, raw, tribe_dev, facial, voice)

    return {
        "score": score,
        "level": level,
        "tribe_deviation": tribe_dev,
        "behavioral_deviation": float(result.get("behavioral_deviation", 0.0)),
        "top_indicators": result.get("top_indicators") or [],
        "intervention": result.get("intervention") or _intervention(level),
        "brain_regions_flagged": flagged,
        "brain_regions": regions,
        "breakdown": breakdown,
        "confidence": float(result.get("confidence", 0.8)),
        "source": "tribe",
    }
