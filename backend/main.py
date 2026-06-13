"""Pegasus backend — FastAPI orchestrator on port 8001.

Wesley's frontend calls this service; this service calls Dhruva's signals (8002)
and Rishith's ML/TRIBE (8003), persists everything to SQLite, and serves history.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from models.database import init_db
from routes import brain, history, response, score, stimulus

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Pegasus Backend Orchestrator", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stimulus.router)
app.include_router(response.router)
app.include_router(score.router)
app.include_router(brain.router)
app.include_router(history.router)


@app.get("/")
def root():
    return {"service": "Pegasus Backend", "version": "1.1.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "backend",
        "port": config.BACKEND_PORT,
        "signals_url": config.SIGNAL_SERVICE_URL,
        "ml_url": config.ML_SERVICE_URL,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=config.BACKEND_PORT, reload=True)
