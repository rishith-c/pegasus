import random

# Each stimulus carries the TRIBE v2 expected engagement for a healthy brain.
# Positive stimuli → high predicted activation (0.75–0.90)
# Negative stimuli → moderate stress activation (0.55–0.70)
# Neutral stimuli  → low predicted activation (0.28–0.40)
# Cognitive tasks  → active processing baseline (0.60–0.72)

STIMULI = [
    # ── Positive ───────────────────────────────────────────────────────────────
    {
        "id": "pos_1", "type": "scenario", "valence": "positive",
        "tribe_expected_engagement": 0.85,
        "content": "Your team just shipped a feature that users love.",
        "prompt": "How does this make you feel? Respond honestly in a sentence or two.",
    },
    {
        "id": "pos_2", "type": "word", "valence": "positive",
        "tribe_expected_engagement": 0.80,
        "content": "VACATION",
        "prompt": "What comes to mind? Respond with whatever this word evokes for you.",
    },
    {
        "id": "pos_3", "type": "scenario", "valence": "positive",
        "tribe_expected_engagement": 0.88,
        "content": "Your manager praised your work in front of the whole team.",
        "prompt": "How does this make you feel? Respond in a sentence or two.",
    },
    {
        "id": "pos_4", "type": "word", "valence": "positive",
        "tribe_expected_engagement": 0.75,
        "content": "FRIDAY AFTERNOON",
        "prompt": "What comes to mind? Respond with whatever this evokes.",
    },
    {
        "id": "pos_5", "type": "scenario", "valence": "positive",
        "tribe_expected_engagement": 0.82,
        "content": "You just solved a bug that had been blocking the team for three days.",
        "prompt": "How does this make you feel?",
    },

    # ── Negative ───────────────────────────────────────────────────────────────
    {
        "id": "neg_1", "type": "scenario", "valence": "negative",
        "tribe_expected_engagement": 0.65,
        "content": "Your code broke production 10 minutes before a major client demo.",
        "prompt": "How do you feel reading this? Respond honestly.",
    },
    {
        "id": "neg_2", "type": "word", "valence": "negative",
        "tribe_expected_engagement": 0.60,
        "content": "DEADLINE",
        "prompt": "What comes to mind immediately? Respond with whatever this word evokes.",
    },
    {
        "id": "neg_3", "type": "scenario", "valence": "negative",
        "tribe_expected_engagement": 0.68,
        "content": "You have 47 unread Slack messages and a meeting starting in 5 minutes.",
        "prompt": "How does this scenario make you feel?",
    },
    {
        "id": "neg_4", "type": "word", "valence": "negative",
        "tribe_expected_engagement": 0.58,
        "content": "PERFORMANCE REVIEW",
        "prompt": "What comes to mind immediately? Respond with whatever this evokes.",
    },
    {
        "id": "neg_5", "type": "scenario", "valence": "negative",
        "tribe_expected_engagement": 0.62,
        "content": "Your pull request has 23 change requests and the feature was due yesterday.",
        "prompt": "How does this make you feel?",
    },

    # ── Neutral ────────────────────────────────────────────────────────────────
    {
        "id": "neu_1", "type": "scenario", "valence": "neutral",
        "tribe_expected_engagement": 0.35,
        "content": "Conference room B is available from 2pm to 4pm.",
        "prompt": "Any thoughts on this? Just respond naturally.",
    },
    {
        "id": "neu_2", "type": "word", "valence": "neutral",
        "tribe_expected_engagement": 0.30,
        "content": "OFFICE SUPPLIES",
        "prompt": "What comes to mind? Just respond naturally.",
    },
    {
        "id": "neu_3", "type": "word", "valence": "neutral",
        "tribe_expected_engagement": 0.32,
        "content": "QUARTERLY REPORT",
        "prompt": "What does this bring to mind?",
    },

    # ── Cognitive tasks ────────────────────────────────────────────────────────
    {
        "id": "cog_1", "type": "task", "valence": "neutral",
        "tribe_expected_engagement": 0.70,
        "content": "List three things you're looking forward to this week.",
        "prompt": "Take your time. Be honest.",
    },
    {
        "id": "cog_2", "type": "task", "valence": "neutral",
        "tribe_expected_engagement": 0.65,
        "content": "Describe how you feel about your current workload in two sentences.",
        "prompt": "Be as honest as you can.",
    },
    {
        "id": "cog_3", "type": "task", "valence": "neutral",
        "tribe_expected_engagement": 0.60,
        "content": "What's one thing at work that has been draining your energy lately?",
        "prompt": "Take your time. There is no right answer.",
    },
]

_by_id = {s["id"]: s for s in STIMULI}


def get_by_id(stimulus_id: str) -> dict | None:
    return _by_id.get(stimulus_id)


def select_session_stimuli(
    n_positive: int = 2,
    n_negative: int = 2,
    n_neutral: int = 1,
    n_cognitive: int = 1,
) -> list[dict]:
    positives  = [s for s in STIMULI if s["valence"] == "positive"]
    negatives  = [s for s in STIMULI if s["valence"] == "negative"]
    neutrals   = [s for s in STIMULI if s["valence"] == "neutral" and s["type"] != "task"]
    cognitives = [s for s in STIMULI if s["type"] == "task"]

    selected = (
        random.sample(positives,  min(n_positive,  len(positives)))  +
        random.sample(negatives,  min(n_negative,  len(negatives)))  +
        random.sample(neutrals,   min(n_neutral,   len(neutrals)))   +
        random.sample(cognitives, min(n_cognitive, len(cognitives)))
    )
    random.shuffle(selected)
    return selected
