def analyze_typing(typing_wpm: float, error_rate: float) -> dict:
    """
    Returns a burnout contribution 0-25 from typing behavior.
    Low WPM + high error rate = cognitive fatigue signal.
    """
    # WPM below 30 is severely slow; 60+ is baseline healthy
    wpm_score = max(0.0, min(1.0, (60 - typing_wpm) / 60))

    # error_rate is 0-100 (percent of keystrokes that were backspaces)
    error_score = min(1.0, error_rate / 30)

    contribution = (wpm_score * 0.5 + error_score * 0.5) * 25

    if typing_wpm < 20:
        pattern = "severely_slow"
    elif typing_wpm < 40:
        pattern = "slow"
    elif typing_wpm < 80:
        pattern = "normal"
    else:
        pattern = "fast"

    return {
        "typing_wpm": typing_wpm,
        "error_rate": error_rate,
        "pattern": pattern,
        "burnout_contribution": round(contribution, 2),
    }
