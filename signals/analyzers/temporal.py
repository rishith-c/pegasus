def analyze_temporal(response_time_ms: float) -> dict:
    """
    Returns a burnout contribution 0-20 from response latency.
    Healthy engagement: < 5s. Checked-out: > 30s.
    """
    seconds = response_time_ms / 1000

    if seconds < 5:
        label = "immediate"
        contribution = 0
    elif seconds < 15:
        label = "normal"
        contribution = seconds / 15 * 8
    elif seconds < 30:
        label = "slow"
        contribution = 8 + (seconds - 15) / 15 * 8
    else:
        label = "disengaged"
        contribution = 20

    return {
        "response_time_ms": response_time_ms,
        "response_label": label,
        "burnout_contribution": round(min(contribution, 20), 2),
    }
