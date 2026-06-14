"""Conversational companion — multi-turn chat grounded in the user's state.

Hugging Face only (no Anthropic). The model is Pegasus: a warm "check engine
light" companion, NOT a therapist. Each turn is grounded in:
  - the running conversation (last ~12 messages),
  - the user's current burnout reading (score/level), and
  - coping snippets retrieved from the mental-health corpus (reuses the RAG
    retriever from rag_intervention.py).

Everything degrades gracefully: if HF is unreachable, ``reply()`` still returns
a warm, contextual response built from the retrieved snippet + a reflective
follow-up, so the conversation never dead-ends. ``reply()`` never raises.
"""
from __future__ import annotations

import os
import re
from typing import Dict, List, Optional

HF_TOKEN = os.getenv("HF_TOKEN")
CHAT_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")

_MAX_TURNS = 12  # trailing messages kept as context

_SYSTEM = (
    "You are Pegasus — a warm, grounded companion inside a mental-health "
    '"check engine light" app. You are NOT a therapist and you never diagnose. '
    "You listen first, reflect back what you hear in plain language, and offer "
    "one small, concrete next step only when it helps. Keep replies short: 1-3 "
    "sentences, conversational, no bullet lists, no clinical jargon. "
    "CRUCIAL: respond to the SPECIFIC thing they just said — quote or name the exact "
    "detail back (the person, the task, the deadline, the feeling, the event they "
    "mentioned) and react to THAT. Never give a generic, templated, or "
    "one-size-fits-all reply, and never repeat a stock phrase. If they mention "
    "something concrete, your reply must reference it directly. "
    "Ask a gentle, specific follow-up that builds on what they actually said. "
    "If someone over-reassures or insists they're fine (\"I'm fine, really, don't "
    "worry, all good\"), don't just take it at face value — warmly acknowledge it, "
    "then gently invite one honest detail about how their day actually went."
)

_CRISIS_RE = re.compile(
    r"\b(kill myself|suicide|suicidal|end it all|want to die|self.?harm|hurt myself)\b",
    re.I,
)
_CRISIS_REPLY = (
    "I'm really glad you told me. I can't be the right support for this on my own — "
    "please reach out right now to someone you trust or a crisis line (in the US, "
    "call or text 988). You don't have to carry this alone."
)

_NEG = {
    "tired", "exhausted", "drained", "burnt", "burned", "stressed", "anxious",
    "overwhelmed", "sad", "down", "lonely", "angry", "frustrated", "hopeless",
    "can't", "cant", "struggling", "worried", "scared", "numb", "empty",
}

_rag_engine = None


def _rag():
    global _rag_engine
    if _rag_engine is None:
        from rag_intervention import RagInterventionEngine

        _rag_engine = RagInterventionEngine()
    return _rag_engine


def _trim(messages: List[Dict]) -> List[Dict]:
    """Keep the last few user/assistant turns with clean role/content shape."""
    out: List[Dict] = []
    for m in messages or []:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out[-_MAX_TURNS:]


def _last_user(messages: List[Dict]) -> str:
    for m in reversed(messages or []):
        if m.get("role") == "user" and (m.get("content") or "").strip():
            return m["content"].strip()
    return ""


class ChatEngine:
    def __init__(self) -> None:
        self._client = None  # lazy huggingface_hub.InferenceClient

    def _hf(self):
        if self._client is None:
            from huggingface_hub import InferenceClient

            self._client = InferenceClient(token=HF_TOKEN)
        return self._client

    def reply(
        self,
        messages: List[Dict],
        score: Optional[int] = None,
        level: Optional[str] = None,
    ) -> str:
        """One companion turn. Never raises; always returns a non-empty string."""
        msgs = _trim(messages)
        last = _last_user(msgs)

        if _CRISIS_RE.search(last):
            return _CRISIS_REPLY

        grounding = self._grounding(last, level)

        if HF_TOKEN:
            try:
                system = _SYSTEM
                if score is not None:
                    system += (
                        f"\n\nPrivate context (do not state the number unless asked): the "
                        f"person's current Pegasus burnout reading is {score}/100 ({level}). "
                        "Let it shape your tone, not your words."
                    )
                if grounding:
                    system += (
                        "\n\nCoping notes you may quietly draw from (never quote verbatim):\n"
                        + grounding
                    )
                resp = self._hf().chat_completion(
                    model=CHAT_MODEL,
                    max_tokens=160,  # short replies → snappier voice turnaround
                    temperature=0.8,
                    messages=[{"role": "system", "content": system}] + msgs,
                )
                text = (resp.choices[0].message.content or "").strip()
                if text:
                    return text
            except Exception:
                pass

        return self._fallback(last, level)

    def _grounding(self, query: str, level: Optional[str]) -> str:
        try:
            retrieved = _rag().retrieve(level or "any", [query] if query else [], k=2)
            return "\n".join(f"- {s['text']}" for s in retrieved)
        except Exception:
            return ""

    def _fallback(self, last_user: str, level: Optional[str]) -> str:
        """Warm, contextual reply with no model — reflect + ground + follow up."""
        tokens = set(re.findall(r"[a-z']+", last_user.lower()))
        heavy = bool(tokens & _NEG)

        try:
            retrieved = _rag().retrieve(level or "any", [last_user] if last_user else [], k=1)
            tip = retrieved[0]["text"] if retrieved else ""
        except Exception:
            tip = ""

        if not last_user:
            return "I'm here. What's on your mind right now?"

        opener = (
            "That sounds heavy, and it makes sense you'd feel it. "
            if heavy
            else "Thanks for sharing that with me. "
        )
        follow = "What does that look like for you today?" if heavy else "Tell me a little more?"
        body = f"{tip} " if tip else ""
        return f"{opener}{body}{follow}".strip()
