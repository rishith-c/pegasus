def analyze_typing(metrics: dict) -> dict:
    """
    Accepts a metrics dict (from TypingBiometrics in collector.js).
    Returns stress_score 0-100 and flags for Jason's combined scorer.
    """
    wpm           = metrics.get("typing_wpm", 60)
    error_rate    = metrics.get("error_rate", 0)
    response_time = metrics.get("response_time_ms", 3000)
    hesitations   = metrics.get("hesitation_count", 0)
    burst         = metrics.get("burst_pattern", "steady")
    hold_ms       = metrics.get("avg_key_hold_ms", 100)
    flight_ms     = metrics.get("flight_time_ms", 150)
    corrections   = metrics.get("correction_loops", 0)

    stress = 0
    flags  = []

    if wpm < 30:
        stress += 25; flags.append("very slow typing speed")
    elif wpm < 45:
        stress += 12

    if error_rate > 15:
        stress += 25; flags.append("high error/correction rate")
    elif error_rate > 8:
        stress += 12

    if response_time > 10_000:
        stress += 20; flags.append("very delayed response")
    elif response_time > 6_000:
        stress += 10

    if hesitations > 3:
        stress += 15; flags.append("frequent mid-word hesitations")
    elif hesitations > 1:
        stress += 7

    if burst == "erratic":
        stress += 10; flags.append("erratic typing rhythm")
    elif burst == "burst-pause":
        stress += 5

    if hold_ms > 180:
        stress += 5  # pressing hard — physical stress proxy
    if flight_ms > 400:
        stress += 5  # cognitive slowing
    if corrections > 2:
        stress += 5; flags.append("repeated correction loops")

    if wpm < 20 or burst == "erratic":
        pattern = "severely_impaired"
    elif wpm < 40 or error_rate > 15 or hesitations > 3:
        pattern = "stressed"
    elif wpm < 60 or error_rate > 8:
        pattern = "mildly_stressed"
    else:
        pattern = "normal"

    return {
        "stress_score":          min(stress, 100),
        "pattern":               pattern,
        "flags":                 flags,
        # keep raw fields so /analyze can surface them flat
        "typing_wpm":            wpm,
        "error_rate":            error_rate,
        "hesitation_count":      hesitations,
        "burst_pattern":         burst,
        "burnout_contribution":  min(stress * 0.25, 25),
    }
