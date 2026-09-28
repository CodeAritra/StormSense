import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import (
    MODEL_BACKEND, MODEL_PATH, EVENTS_DIR, DISTRICTS_FILE, METRICS_FILE,
    DEFAULT_BOUNDS, CORS_ORIGINS
)
from .models import (
    HealthResponse, EventSummary, Bounds, ReplayState, ReplayStartRequest,
    ReplaySeekRequest, ForecastResponse, Alert, FeedbackRequest, FeedbackSummary
)
from .db import (
    init_db, approve_alert, get_alert, get_alerts_history,
    add_feedback, get_feedback_summary
)
from .replay import replay_engine
from .inference.base import Nowcaster
from .inference.mock import MockNowcaster
from .inference.onnx_backend import OnnxNowcaster
from .render import array_to_png_bytes, extract_storm_cells
from .alerts import compute_alerts, build_cap_xml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stormsense.api")

# In-memory LRU Cache for forecasts: (event_id, index) -> dict containing arrays & metadata
FORECAST_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_MAX_SIZE = 256

# In-memory cache for event arrays: event_id -> (vil, ir, lght)
EVENT_ARRAYS_CACHE: Dict[str, Dict[str, np.ndarray]] = {}

def get_nowcaster() -> Nowcaster:
    if MODEL_BACKEND == "onnx":
        logger.info(f"Initializing OnnxNowcaster with model at {MODEL_PATH}")
        return OnnxNowcaster(MODEL_PATH)
    else:
        logger.info("Initializing MockNowcaster (swappable physics-advection mock)")
        return MockNowcaster()

nowcaster_instance: Optional[Nowcaster] = None

def ensure_synthetic_events():
    """Generates synthetic events if they are missing from disk."""
    evt1_npz = EVENTS_DIR / "evt_001.npz"
    evt2_npz = EVENTS_DIR / "evt_002.npz"
    if not evt1_npz.exists() or not evt2_npz.exists():
        try:
            from .scripts.make_synthetic_event import generate_event
            EVENTS_DIR.mkdir(parents=True, exist_ok=True)
            if not evt1_npz.exists():
                generate_event(
                    event_id="evt_001",
                    title="Nor'wester demo event (Kolkata corridor)",
                    description="Severe convective event crossing Hooghly, Howrah, and Kolkata, replay",
                    start_time="2019-07-10T09:00:00Z",
                    output_dir=EVENTS_DIR
                )
            if not evt2_npz.exists():
                generate_event(
                    event_id="evt_002",
                    title="Scattered convective storms (South Bengal)",
                    description="Developing multicellular storm cells across Bardhaman and Bankura, replay",
                    start_time="2020-05-18T14:30:00Z",
                    output_dir=EVENTS_DIR
                )
        except Exception as e:
            logger.error(f"Error generating synthetic events: {e}")

def load_event_arrays(event_id: str) -> Dict[str, np.ndarray]:
    if event_id in EVENT_ARRAYS_CACHE:
        return EVENT_ARRAYS_CACHE[event_id]
        
    npz_path = EVENTS_DIR / f"{event_id}.npz"
    if not npz_path.exists():
        ensure_synthetic_events()
        
    if not npz_path.exists():
        # Fallback empty arrays
        zeros = np.zeros((49, 128, 128), dtype=np.float32)
        return {"vil": zeros, "ir": zeros, "lght": zeros}
        
    with np.load(npz_path) as data:
        # Normalize uint8 0..255 to float32 0..1
        vil = data["vil"].astype(np.float32) / 255.0
        ir = data["ir"].astype(np.float32) / 255.0
        lght = data["lght"].astype(np.float32) / 255.0
        res = {"vil": vil, "ir": ir, "lght": lght}
        EVENT_ARRAYS_CACHE[event_id] = res
        return res

@asynccontextmanager
async def lifespan(app: FastAPI):
    global nowcaster_instance
    logger.info("Initializing StormSense API services...")
    init_db()
    ensure_synthetic_events()
    replay_engine.load_event_meta("evt_001")
    
    try:
        nowcaster_instance = get_nowcaster()
    except Exception as e:
        logger.error(f"Failed to load nowcaster backend: {e}. Falling back to MockNowcaster.")
        nowcaster_instance = MockNowcaster()
        
    # Start background replay tick task
    replay_task = asyncio.create_task(replay_engine.tick_loop())
    yield
    # Shutdown
    replay_task.cancel()
    try:
        await replay_task
    except asyncio.CancelledError:
        pass
    logger.info("StormSense API services stopped cleanly.")

app = FastAPI(
    title="StormSense API",
    description="AI Thunderstorm and Lightning Nowcasting Engine - MoES / IMD Prototype",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- 7.1 Health -----------------
@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        backend=MODEL_BACKEND,
        version="0.1.0"
    )

# ----------------- 7.2 Events Catalog -----------------
@app.get("/api/events")
async def get_events():
    events = []
    if EVENTS_DIR.exists():
        for json_file in sorted(EVENTS_DIR.glob("*.json")):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    events.append(data)
            except Exception as e:
                logger.error(f"Failed to read {json_file}: {e}")
                
    if not events:
        # Default fallback
        events.append({
            "id": "evt_001",
            "title": "Nor'wester demo event",
            "description": "Severe convective event, replay",
            "n_frames": 49,
            "frame_step_min": 5,
            "bounds": {"west": DEFAULT_BOUNDS.west, "south": DEFAULT_BOUNDS.south, "east": DEFAULT_BOUNDS.east, "north": DEFAULT_BOUNDS.north},
            "start_time_utc": "2019-07-10T09:00:00Z"
        })
    return events

# ----------------- 7.3 Replay Controls -----------------
@app.post("/api/replay/start")
async def replay_start(req: ReplayStartRequest):
    await replay_engine.start(req.event_id, req.speed, req.start_index)
    return replay_engine.get_state()

@app.post("/api/replay/pause")
async def replay_pause():
    await replay_engine.pause()
    return replay_engine.get_state()

@app.post("/api/replay/resume")
async def replay_resume():
    await replay_engine.resume()
    return replay_engine.get_state()

@app.post("/api/replay/seek")
async def replay_seek(req: ReplaySeekRequest):
    await replay_engine.seek(req.index)
    return replay_engine.get_state()

@app.get("/api/replay/state", response_model=ReplayState)
async def replay_state():
    return replay_engine.get_state()

@app.websocket("/ws/replay")
async def ws_replay(websocket: WebSocket):
    await replay_engine.register(websocket)
    try:
        while True:
            # Keep connection open; listen for incoming messages if any
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        replay_engine.unregister(websocket)
    except Exception:
        replay_engine.unregister(websocket)

# ----------------- 7.4 Forecast Engine -----------------
def run_forecast(event_id: str, index: int) -> Dict[str, Any]:
    cache_key = f"{event_id}-{index}"
    if cache_key in FORECAST_CACHE:
        return FORECAST_CACHE[cache_key]
        
    t_start = time.perf_counter()
    arrays = load_event_arrays(event_id)
    n_total = len(arrays["vil"])
    idx = max(12, min(n_total - 1, index))
    
    # 13 past frames: [idx-12 .. idx]
    past_vil = arrays["vil"][idx-12 : idx+1]
    past_ir = arrays["ir"][idx-12 : idx+1]
    past_lght = arrays["lght"][idx-12 : idx+1]
    
    global nowcaster_instance
    if nowcaster_instance is None:
        nowcaster_instance = get_nowcaster()
        
    t_infer_start = time.perf_counter()
    pred_res = nowcaster_instance.predict(past_vil, past_ir, past_lght)
    t_infer_end = time.perf_counter()
    inference_ms = round((t_infer_end - t_infer_start) * 1000, 2)
    
    vil_pred = pred_res["vil"]          # [12, 128, 128]
    lght_pred = pred_res["lightning"]    # [12, 128, 128]
    explain = pred_res.get("explain", {"radar": 0.55, "satellite": 0.25, "lightning": 0.20})
    
    # Render timing simulation & storm cell extraction
    t_render_start = time.perf_counter()
    vil_now = past_vil[-1]
    prev_vil = past_vil[-2] if len(past_vil) > 1 else vil_now
    bounds = Bounds(
        west=DEFAULT_BOUNDS.west,
        south=DEFAULT_BOUNDS.south,
        east=DEFAULT_BOUNDS.east,
        north=DEFAULT_BOUNDS.north
    )
    storm_cells = extract_storm_cells(vil_now, prev_vil, bounds)
    t_render_end = time.perf_counter()
    render_ms = round((t_render_end - t_render_start) * 1000, 2)
    
    # Alert calculation timing
    t_alert_start = time.perf_counter()
    alerts = compute_alerts(event_id, idx, lght_pred, vil_pred, bounds)
    t_alert_end = time.perf_counter()
    alert_ms = round((t_alert_end - t_alert_start) * 1000, 2)
    
    total_ms = round((time.perf_counter() - t_start) * 1000, 2)
    
    # 12 actual future frames for comparison if available
    vil_actual = []
    if idx + 12 < n_total:
        vil_actual = arrays["vil"][idx+1 : idx+13]
    else:
        vil_actual = arrays["vil"][idx:]
        
    # Construct response dictionary
    overlay_urls = {
        "vil_pred": [f"/api/overlay/{event_id}/{idx}/vil_pred/{k}.png" for k in range(12)],
        "lightning": [f"/api/overlay/{event_id}/{idx}/lightning/{k}.png" for k in range(12)],
        "vil_actual": [f"/api/overlay/{event_id}/{idx}/vil_actual/{k}.png" for k in range(len(vil_actual))],
        "vil_now": f"/api/overlay/{event_id}/{idx}/vil_now/0.png"
    }
    
    lead_minutes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
    
    result = {
        "event_id": event_id,
        "index": idx,
        "issued_at_utc": "2019-07-10T11:00:00Z",
        "lead_minutes": lead_minutes,
        "bounds": bounds.model_dump(),
        "overlays": overlay_urls,
        "storm_cells": [c.model_dump() for c in storm_cells],
        "explain": explain,
        "timing": {
            "inference_ms": inference_ms,
            "render_ms": render_ms,
            "alert_ms": alert_ms,
            "total_ms": total_ms
        },
        "backend": MODEL_BACKEND,
        # Cache raw arrays for fast overlay generation
        "_raw": {
            "vil_now": vil_now,
            "vil_pred": vil_pred,
            "lightning": lght_pred,
            "vil_actual": vil_actual
        },
        "_alerts": alerts
    }
    
    if len(FORECAST_CACHE) >= CACHE_MAX_SIZE:
        FORECAST_CACHE.pop(next(iter(FORECAST_CACHE)))
    FORECAST_CACHE[cache_key] = result
    return result

@app.get("/api/forecast")
async def get_forecast(event_id: str = "evt_001", index: int = 24):
    fc = run_forecast(event_id, index)
    # Strip internal raw array keys
    res = {k: v for k, v in fc.items() if not k.startswith("_")}
    return res

# ----------------- 7.5 Overlays -----------------
@app.get("/api/overlay/{event_id}/{index}/{layer}/{k}.png")
async def get_overlay(event_id: str, index: int, layer: str, k: int = 0):
    fc = run_forecast(event_id, index)
    raw = fc.get("_raw", {})
    
    arr: Optional[np.ndarray] = None
    if layer == "vil_now":
        arr = raw.get("vil_now")
    elif layer == "vil_pred":
        vil_preds = raw.get("vil_pred")
        if vil_preds is not None and 0 <= k < len(vil_preds):
            arr = vil_preds[k]
    elif layer == "lightning":
        lght_preds = raw.get("lightning")
        if lght_preds is not None and 0 <= k < len(lght_preds):
            arr = lght_preds[k]
    elif layer == "vil_actual":
        vil_acts = raw.get("vil_actual")
        if vil_acts is not None and 0 <= k < len(vil_acts):
            arr = vil_acts[k]
            
    if arr is None:
        arr = np.zeros((128, 128), dtype=np.float32)
        
    png_bytes = array_to_png_bytes(arr, layer)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "max-age=3600, public"}
    )

# ----------------- 7.7 Alerts & Actions -----------------
@app.get("/api/alerts")
async def get_alerts(event_id: str = "evt_001", index: int = 24):
    fc = run_forecast(event_id, index)
    alerts = fc.get("_alerts", [])
    return [a.model_dump() for a in alerts]

@app.post("/api/alerts/{alert_id}/approve")
async def api_approve_alert(alert_id: str):
    approved = approve_alert(alert_id)
    if not approved:
        raise HTTPException(status_code=404, detail="Alert not found")
    return approved

@app.get("/api/alerts/{alert_id}/cap.xml")
async def api_get_cap_xml(alert_id: str):
    alert_dict = get_alert(alert_id)
    if not alert_dict:
        # Synthesize fallback alert dict
        alert_dict = {
            "id": alert_id,
            "district_name": "Kolkata",
            "severity": "severe",
            "eta_min": 15,
            "messages": {}
        }
    xml_content = build_cap_xml(alert_dict)
    return Response(content=xml_content, media_type="application/xml")

@app.get("/api/alerts/history")
async def api_get_alerts_history():
    return get_alerts_history()

# ----------------- 7.10 Feedback -----------------
@app.post("/api/feedback")
async def api_feedback(req: FeedbackRequest):
    if req.outcome not in ("hit", "miss", "false_alarm"):
        raise HTTPException(status_code=400, detail="Invalid outcome. Must be hit, miss, or false_alarm.")
    add_feedback(req.alert_id, req.outcome, req.note)
    return {"status": "recorded"}

@app.get("/api/feedback/summary", response_model=FeedbackSummary)
async def api_feedback_summary():
    return get_feedback_summary()

# ----------------- 7.11 Metrics -----------------
@app.get("/api/metrics")
async def api_metrics():
    if METRICS_FILE.exists():
        with open(METRICS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"is_placeholder": True, "error": "metrics.json not found"}

# ----------------- Districts GeoJSON -----------------
@app.get("/api/districts")
async def api_districts():
    if DISTRICTS_FILE.exists():
        with open(DISTRICTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}
