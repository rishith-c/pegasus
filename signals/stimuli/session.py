import uuid
from dataclasses import dataclass, field
from .bank import select_session_stimuli

_sessions: dict[str, "StimuliSession"] = {}


@dataclass
class StimuliSession:
    session_id: str
    user_id: str
    stimuli: list
    reactions: list = field(default_factory=list)
    current_index: int = 0
    complete: bool = False

    def current_stimulus(self) -> dict | None:
        if self.current_index < len(self.stimuli):
            return self.stimuli[self.current_index]
        return None

    def record_reaction(self, reaction: dict) -> None:
        self.reactions.append(reaction)
        self.current_index += 1
        if self.current_index >= len(self.stimuli):
            self.complete = True

    def mean_deviation(self) -> float:
        if not self.reactions:
            return 0.0
        return round(sum(r["deviation"] for r in self.reactions) / len(self.reactions), 3)

    def burnout_score(self) -> float:
        """Converts mean deviation (0-1) to a 0-100 burnout contribution."""
        return round(self.mean_deviation() * 100, 1)


def create_session(user_id: str) -> StimuliSession:
    session_id = str(uuid.uuid4())
    session = StimuliSession(
        session_id=session_id,
        user_id=user_id,
        stimuli=select_session_stimuli(),
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> StimuliSession | None:
    return _sessions.get(session_id)
