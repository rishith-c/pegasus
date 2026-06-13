"""RAG burnout-coaching intervention — Hugging Face only (no Anthropic).

A tiny in-memory retriever over ``data/mental_health_corpus.json`` plus a HF
chat model that turns the retrieved coping snippets into ONE warm, grounded
action. Everything degrades gracefully so the demo never breaks:

  - Embeddings via ``InferenceClient.feature_extraction`` (sentence-transformers
    all-MiniLM-L6-v2). If HF is unreachable, fall back to a pure-python
    keyword/tag-overlap cosine score — no extra dependencies.
  - Generation via ``InferenceClient.chat_completion`` (env ``HF_MODEL``,
    default Qwen/Qwen2.5-7B-Instruct), grounded only in retrieved snippets.
    If HF is unreachable, return the best retrieved snippet verbatim.

``suggest()`` NEVER raises — it always returns a non-empty string.
"""
from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from typing import Dict, List, Optional

HF_TOKEN = os.getenv("HF_TOKEN")
EMBED_MODEL = os.getenv("HF_EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
CHAT_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")

_CORPUS_PATH = Path(__file__).resolve().parent / "data" / "mental_health_corpus.json"
_TOKEN_RE = re.compile(r"[a-z]+")
_SAFE_FALLBACK = "Take a slow breath, then step away from the screen for five minutes before your next task."


def _tokens(text: str) -> List[str]:
    return _TOKEN_RE.findall((text or "").lower())


class RagInterventionEngine:
    def __init__(self) -> None:
        self._snippets: List[Dict] = self._load_corpus()
        self._client = None  # lazy huggingface_hub.InferenceClient
        self._embeddings: Optional[List[List[float]]] = None  # cached snippet vectors
        self._embeddings_tried = False

    # --- corpus ------------------------------------------------------------
    @staticmethod
    def _load_corpus() -> List[Dict]:
        try:
            data = json.loads(_CORPUS_PATH.read_text())
        except Exception:
            return []
        items = data.get("snippets") if isinstance(data, dict) else data
        out: List[Dict] = []
        for s in items or []:
            if isinstance(s, dict) and s.get("text"):
                out.append(s)
        return out

    # --- HF client ---------------------------------------------------------
    def _hf(self):
        if self._client is None:
            from huggingface_hub import InferenceClient

            self._client = InferenceClient(token=HF_TOKEN)
        return self._client

    # --- embeddings --------------------------------------------------------
    @staticmethod
    def _to_vector(raw) -> List[float]:
        """feature_extraction may return [dim] or [tokens, dim]; reduce to [dim]."""
        try:
            vec = raw.tolist()  # numpy ndarray
        except AttributeError:
            vec = raw
        # Unwrap a leading batch dim if present.
        while isinstance(vec, list) and len(vec) == 1 and isinstance(vec[0], list):
            vec = vec[0]
        if vec and isinstance(vec[0], list):  # token-level -> mean-pool
            cols = len(vec[0])
            pooled = [0.0] * cols
            for row in vec:
                for i in range(cols):
                    pooled[i] += float(row[i])
            n = len(vec)
            return [v / n for v in pooled]
        return [float(v) for v in vec]

    def _embed(self, text: str) -> Optional[List[float]]:
        if not HF_TOKEN:
            return None
        try:
            return self._to_vector(self._hf().feature_extraction(text, model=EMBED_MODEL))
        except Exception:
            return None

    def _snippet_embeddings(self) -> Optional[List[List[float]]]:
        """Embed the corpus once. None if HF embeddings are unavailable."""
        if self._embeddings_tried:
            return self._embeddings
        self._embeddings_tried = True
        if not HF_TOKEN or not self._snippets:
            return None
        vecs: List[List[float]] = []
        for s in self._snippets:
            v = self._embed(s["text"])
            if v is None:
                return None  # bail fully -> keyword fallback for consistency
            vecs.append(v)
        self._embeddings = vecs
        return self._embeddings

    @staticmethod
    def _cosine(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        if na == 0.0 or nb == 0.0:
            return 0.0
        return dot / (na * nb)

    # --- keyword fallback scoring -----------------------------------------
    def _keyword_score(self, snippet: Dict, query_tokens: set, indicators: List[str]) -> float:
        """Pure-python cosine-style overlap over tokens + tag matches."""
        ind_text = " ".join(indicators or [])
        ind_tokens = set(_tokens(ind_text))
        snippet_tokens = set(_tokens(snippet.get("text", "")))
        tag_tokens = set()
        for t in snippet.get("tags", []) or []:
            tag_tokens.update(_tokens(str(t).replace("_", " ")))

        wanted = query_tokens | ind_tokens
        if not wanted:
            return 0.0
        text_overlap = len(snippet_tokens & wanted)
        tag_overlap = len(tag_tokens & wanted)
        # Cosine-style normalization by vocab sizes; tags weighted higher as
        # they are curated topic labels.
        denom = math.sqrt(len(wanted)) * math.sqrt(max(len(snippet_tokens) + len(tag_tokens), 1))
        return (text_overlap + 2.0 * tag_overlap) / denom if denom else 0.0

    # --- retrieval ---------------------------------------------------------
    @staticmethod
    def _level_ok(snippet_level: str, level: str) -> bool:
        sl = (snippet_level or "any").lower()
        return sl == "any" or sl == (level or "").lower()

    def retrieve(self, level: str, indicators: List[str], k: int = 3) -> List[Dict]:
        if not self._snippets:
            return []
        query = " ".join(indicators or []) or "burnout stress coping"
        candidates = [s for s in self._snippets if self._level_ok(s.get("level"), level)]
        if not candidates:
            candidates = list(self._snippets)

        embeddings = self._snippet_embeddings()
        scored: List[tuple] = []
        if embeddings is not None:
            qv = self._embed(query)
            if qv is not None:
                idx = {id(s): i for i, s in enumerate(self._snippets)}
                for s in candidates:
                    scored.append((self._cosine(qv, embeddings[idx[id(s)]]), s))

        if not scored:  # keyword/tag-overlap fallback
            qtokens = set(_tokens(query))
            for s in candidates:
                scored.append((self._keyword_score(s, qtokens, indicators), s))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [s for _, s in scored[:k]]

    # --- generation --------------------------------------------------------
    def _generate(self, score: int, level: str, indicators: List[str], retrieved: List[Dict]) -> Optional[str]:
        if not HF_TOKEN or not retrieved:
            return None
        grounding = "\n".join(f"- {s['text']}" for s in retrieved)
        try:
            resp = self._hf().chat_completion(
                model=CHAT_MODEL,
                max_tokens=120,
                temperature=0.7,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a warm, practical burnout check-in coach, not a therapist or "
                            "clinician. You are a check engine light: you nudge, you do not diagnose. "
                            "Ground your advice ONLY in the provided coping notes. Never give clinical "
                            "labels or diagnoses. Reply with ONE specific, doable action in 1-2 warm "
                            "sentences, no preamble."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Burnout signal {score}/100 (level: {level}). "
                            f"Observed signs: {', '.join(indicators) or 'none specific'}.\n\n"
                            f"Coping notes you can draw from:\n{grounding}\n\n"
                            "Give one warm, specific action grounded in those notes."
                        ),
                    },
                ],
            )
            text = (resp.choices[0].message.content or "").strip()
            return text or None
        except Exception:
            return None

    # --- public ------------------------------------------------------------
    def suggest(self, score: int, level: str, indicators: List[str]) -> str:
        """Retrieve + generate ONE warm action. Never raises; always a string."""
        try:
            retrieved = self.retrieve(level, indicators or [], k=3)
            generated = self._generate(score, level, indicators or [], retrieved)
            if generated:
                return generated
            if retrieved:
                return retrieved[0]["text"]
            return _SAFE_FALLBACK
        except Exception:
            return _SAFE_FALLBACK
