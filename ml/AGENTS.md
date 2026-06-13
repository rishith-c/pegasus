# `/ml` — Rishith's agent

You are **Rishith**. You own **`ml/` only**. You build the TRIBE v2 brain model
service on **:8003**. Read `../AGENTS.md` and `../shared/contract.md` first.

## Never touch
`/frontend`, `/backend`, `/signals`, `/shared`. Need data from them? Call their
API. Need a contract change? Ask Jason.

## Your endpoints (:8003)
- `GET  /health` → `{status, model}`
- `POST /predict` → TRIBE v2 healthy-brain prediction for a stimulus
- `POST /score` → deviation (prediction vs behavioral signal) → burnout score
- `POST /intervention` → Claude-generated message + action

## Files
- `tribe.py` — TRIBE v2 wrapper. **Currently a deterministic stub.** Your main
  job: replace `TribePredictor._infer` with a real TRIBE v2 forward pass.
- `scoring.py` — deviation → 0-100 burnout score + level.
- `intervention.py` — Claude (`claude-sonnet-4-6`), falls back to canned text.
- `main.py` — FastAPI wiring.

## Run
```bash
cd ml && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add ANTHROPIC_API_KEY (optional; stub works without)
uvicorn main:app --reload --port 8003
```

## Git
```bash
git checkout feat/rishith-ml
git add ml/        # ONLY ml/
git commit -m "feat(ml): ..." && git push origin feat/rishith-ml
```
