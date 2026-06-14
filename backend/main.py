"""Pegasus backend — FastAPI orchestrator on port 8001.

Wesley's Expo app and Dhruva's SMS bot both call this service; it calls Dhruva's
signals (8002), Rishith's ML/TRIBE (8003) and video (8004), persists everything
to SQLite, and serves history/metrics/brain views.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from models.database import init_db
from routes import brain, history, metrics, response, score, stimulus, video

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Pegasus Backend", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stimulus.router, prefix="/stimulus", tags=["stimulus"])
app.include_router(response.router, prefix="/response", tags=["response"])
app.include_router(score.router, prefix="/score", tags=["score"])
app.include_router(brain.router, prefix="/brain", tags=["brain"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(video.router, prefix="/video", tags=["video"])


@app.get("/")
def root():
    return {"service": "Pegasus Backend", "version": "2.0.0", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "pegasus backend running",
        "port": config.BACKEND_PORT,
        "signals_url": config.SIGNAL_SERVICE,
        "ml_url": config.ML_SERVICE,
        "video_url": config.VIDEO_SERVICE,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=config.BACKEND_PORT, reload=True)
