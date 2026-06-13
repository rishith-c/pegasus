def analyze_typing(
    typing_wpm: float,
    error_rate: float,
    hesitation_count: int = 0,
    burst_pattern: str = "steady",
    avg_key_hold_ms: float = 100,
    flight_time_ms: float = 150,
    correction_loops: int = 0,
) -> dict:
    """
    Interprets typing biometrics into a burnout contribution 0-25.
    All fields except wpm and error_rate are optional (SMS / simple callers
    won't have them; defaults represent normal healthy behavior).
    """
    # WPM: below 30 = severe, 60+ = healthy
    wpm_score = max(0.0, min(1.0, (60 - typing_wpm) / 60))

    # Error rate: 0-100 (backspaces / total keystrokes %)
    error_score = min(1.0, error_rate / 20)

    # Hesitations (pauses > 3s mid-word)
    hesitation_score = min(1.0, hesitation_count / 5)

    # Burst pattern
    burst_score = {"steady": 0.0, "burst-pause": 0.4, "erratic": 1.0}.get(burst_pattern, 0.0)

    # Key hold time: 80-120ms healthy; >180ms = pressing hard (stress)
    hold_score = min(1.0, max(0.0, (avg_key_hold_ms - 120) / 100)) if avg_key_hold_ms > 0 else 0.0

    # Flight time: 100-200ms healthy; >400ms = cognitive slowing
    flight_score = min(1.0, max(0.0, (flight_time_ms - 200) / 300)) if flight_time_ms > 0 else 0.0

    # Correction loops (typing then deleting whole words)
    correction_score = min(1.0, correction_loops / 3)

    # Weighted contribution (25 pts total)
    contribution = (
        wpm_score        * 0.22 +
        error_score      * 0.18 +
        hesitation_score * 0.15 +
        burst_score      * 0.15 +
        hold_score       * 0.10 +
        flight_score     * 0.10 +
        correction_score * 0.10
    ) * 25

    # Classify overall pattern
    if typing_wpm < 20 or burst_pattern == "erratic":
        pattern = "severely_impaired"
    elif typing_wpm < 40 or error_rate > 15 or hesitation_count > 3:
        pattern = "stressed"
    elif typing_wpm < 60 or error_rate > 8:
        pattern = "mildly_stressed"
    else:
        pattern = "normal"

    return {
        "typing_wpm":       typing_wpm,
        "error_rate":       error_rate,
        "hesitation_count": hesitation_count,
        "burst_pattern":    burst_pattern,
        "avg_key_hold_ms":  avg_key_hold_ms,
        "flight_time_ms":   flight_time_ms,
        "correction_loops": correction_loops,
        "pattern":          pattern,
        "burnout_contribution": round(min(contribution, 25), 2),
    }
