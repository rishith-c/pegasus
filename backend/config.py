"""Central config for the Pegasus backend. Reads from environment / .env."""
import os

from dotenv import load_dotenv

load_dotenv()

# Where this backend listens.
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8001"))

# Downstream services we orchestrate.
SIGNAL_SERVICE = os.getenv("SIGNAL_SERVICE_URL", "http://localhost:8002")
ML_SERVICE = os.getenv("ML_SERVICE_URL", "http://localhost:8003")
VIDEO_SERVICE = os.getenv("VIDEO_SERVICE_URL", "http://localhost:8004")

# Persistence.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pegasus.db")

# HTTP timeouts (seconds) for calls to downstream services.
SERVICE_TIMEOUT = float(os.getenv("SERVICE_TIMEOUT", "15.0"))
VIDEO_TIMEOUT = float(os.getenv("VIDEO_TIMEOUT", "120.0"))

# Path to the shared/ folder (canonical contract + stimulus manifest).
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DIR = os.getenv("SHARED_DIR", os.path.join(os.path.dirname(_THIS_DIR), "shared"))

# Burnout level thresholds (score is 0-100, higher = more burnout).
YELLOW_THRESHOLD = 30
RED_THRESHOLD = 65
