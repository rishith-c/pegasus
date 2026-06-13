def compute_actual_engagement(sentiment: dict, typing: dict, temporal: dict) -> float:
    """
    Maps behavioral signals onto a 0-1 engagement score for comparison
    against tribe_expected_engagement from TRIBE v2.

    High engagement: positive sentiment, fast response, healthy WPM.
    Burned-out users show blunted responses to positive stimuli and
    flat/avoidant responses to negative ones.
    """
    # Speed: full credit under 3s, zero at 30s+
    speed = max(0.0, 1.0 - temporal["response_time_ms"] / 30_000)

    # Sentiment is the strongest predictor of emotional engagement
    sentiment_score = float(sentiment["sentiment_score"])

    # Typing vigor: full credit at 80 WPM
    wpm_factor = min(1.0, typing["typing_wpm"] / 80) if typing["typing_wpm"] > 0 else 0.0

    engagement = sentiment_score * 0.45 + speed * 0.35 + wpm_factor * 0.20
    return round(min(1.0, max(0.0, engagement)), 3)
