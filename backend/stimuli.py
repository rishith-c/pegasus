"""Daily stimulus pool. Picks one stimulus per user per day, deterministically
(so a user sees the same prompt all day, and the demo is reproducible)."""
from __future__ import annotations

import datetime
import hashlib
from typing import Dict, List

POOL: List[Dict] = [
    {"stimulus_id": "s1", "type": "text",
     "content": "A quiet morning, steam rising off a coffee cup by a rain-streaked window.",
     "prompt": "Describe what this scene makes you feel, in a few sentences."},
    {"stimulus_id": "s2", "type": "text",
     "content": "An empty inbox and a clear calendar for the rest of the afternoon.",
     "prompt": "What's the first thing you'd do with this time?"},
    {"stimulus_id": "s3", "type": "text",
     "content": "A friend texts: 'Haven't heard from you in a while — you good?'",
     "prompt": "Write the reply you'd actually send right now."},
    {"stimulus_id": "s4", "type": "text",
     "content": "Sunlight on a trail, the trees just starting to turn.",
     "prompt": "What would you want to be doing in this moment?"},
    {"stimulus_id": "s5", "type": "text",
     "content": "You just finished something you'd been putting off for weeks.",
     "prompt": "How does that land for you? Say more than 'good'."},
]


def stimulus_for(user_id: str, day: datetime.date | None = None) -> Dict:
    day = day or datetime.date.today()
    seed = f"{user_id}|{day.isoformat()}"
    idx = int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(POOL)
    return POOL[idx]
