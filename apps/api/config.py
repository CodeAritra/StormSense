import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent.parent

# Read .env file from apps/api/.env first, then root .env
def load_env():
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v

load_env()

def resolve_path(env_val: str | None, default_path: Path) -> Path:
    if not env_val:
        return default_path
    p = Path(env_val)
    if p.is_absolute():
        return p
    # Try resolving relative to BASE_DIR (apps/api)
    if (BASE_DIR / p).exists():
        return (BASE_DIR / p).resolve()
    # Try resolving relative to PROJECT_ROOT (repo root)
    if (PROJECT_ROOT / p).exists():
        return (PROJECT_ROOT / p).resolve()
    # Default fallback relative to PROJECT_ROOT
    return (PROJECT_ROOT / p).resolve()

class RegionBounds(BaseModel):
    west: float = float(os.getenv("REGION_WEST", "86.6"))
    south: float = float(os.getenv("REGION_SOUTH", "20.85"))
    east: float = float(os.getenv("REGION_EAST", "90.1"))
    north: float = float(os.getenv("REGION_NORTH", "24.29"))

MODEL_BACKEND = os.getenv("MODEL_BACKEND", "mock").lower()
MODEL_PATH = resolve_path(os.getenv("MODEL_PATH"), PROJECT_ROOT / "models" / "nowcast.onnx")
EVENTS_DIR = resolve_path(os.getenv("EVENTS_DIR"), BASE_DIR / "data" / "events")
DISTRICTS_FILE = resolve_path(os.getenv("DISTRICTS_FILE"), BASE_DIR / "data" / "districts.geojson")
METRICS_FILE = resolve_path(os.getenv("METRICS_FILE"), BASE_DIR / "data" / "metrics.json")
DB_PATH = resolve_path(os.getenv("DB_PATH"), BASE_DIR / "stormsense.db")

DEFAULT_BOUNDS = RegionBounds()
REPLAY_TICK_SECONDS = float(os.getenv("REPLAY_TICK_SECONDS", "2.0"))
ALERT_MIN_PROB = float(os.getenv("ALERT_MIN_PROB", "0.5"))
API_PORT = int(os.getenv("API_PORT", "8000"))

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]
