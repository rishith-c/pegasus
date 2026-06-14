"""Safety invariants for burnout results.

PRD §6: Pegasus never diagnoses, and a RED result must ALWAYS include a path to
human support — never just an app suggestion. The backend is the single point
that returns the final burnout_result, so we enforce that invariant here,
regardless of whether the score came from the ML service or the local fallback.
"""

# Shown to the user and appended to red interventions if not already present.
HUMAN_SUPPORT_TEXT = (
    "You don't have to handle this alone — reaching out is a strong move. Talk to "
    "someone you trust or your campus counseling center, and if you'd like to speak "
    "with a trained counselor right now, you can call or text 988 (the Suicide & "
    "Crisis Lifeline, US) any time."
)

# Structured resources for the app to render as tappable support options.
SUPPORT_RESOURCES = [
    {"name": "988 Suicide & Crisis Lifeline (US)", "contact": "Call or text 988", "type": "crisis"},
    {"name": "Crisis Text Line", "contact": "Text HOME to 741741", "type": "crisis"},
    {"name": "Campus counseling", "contact": "Reach your campus counseling center", "type": "counseling"},
    {"name": "A trusted person", "contact": "Message a friend or family member you trust", "type": "personal"},
]


def support_for(level: str) -> list:
    """Support resources to attach to a result (only red carries them)."""
    return list(SUPPORT_RESOURCES) if level == "red" else []


def ensure_human_support(result: dict) -> dict:
    """Guarantee a red intervention names a concrete human-support path."""
    if result.get("level") == "red":
        intervention = (result.get("intervention") or "").strip()
        if "988" not in intervention:
            result["intervention"] = (intervention + " " + HUMAN_SUPPORT_TEXT).strip()
    return result
