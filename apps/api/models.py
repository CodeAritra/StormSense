from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class Bounds(BaseModel):
    west: float
    south: float
    east: float
    north: float

class EventSummary(BaseModel):
    id: str
    title: str
    description: str
    n_frames: int
    frame_step_min: int
    bounds: Bounds
    start_time_utc: str

class ReplayState(BaseModel):
    event_id: Optional[str] = None
    playing: bool = False
    speed: float = 1.0
    current_index: int = 12
    n_frames: int = 49
    max_index: int = 36

class StormCell(BaseModel):
    id: str
    lat: float
    lon: float
    max_vil: float
    area_km2: float
    motion_kmh: float
    heading_deg: float

class Timing(BaseModel):
    inference_ms: float
    render_ms: float
    alert_ms: float
    total_ms: float

class ForecastResponse(BaseModel):
    event_id: str
    index: int
    issued_at_utc: str
    lead_minutes: List[int]
    bounds: Bounds
    overlays: Dict[str, Any]
    storm_cells: List[StormCell] = []
    storm_cells_now: Optional[List[StormCell]] = None
    storm_cells_by_lead: Optional[List[List[StormCell]]] = None
    district_severities: Optional[Dict[str, Any]] = None
    explain: Dict[str, float]
    timing: Timing
    backend: str

class Alert(BaseModel):
    id: str
    district_id: str
    district_name: str
    severity: str  # watch | warning | severe
    eta_min: int
    peak_prob: float
    peak_vil: float
    status: str = "proposed"  # proposed | approved
    messages: Optional[Dict[str, str]] = None  # en, bn, hi

# Request / Response helper schemas
class ReplayStartRequest(BaseModel):
    event_id: str = "evt_001"
    speed: float = 1.0
    start_index: int = 12

class ReplaySeekRequest(BaseModel):
    index: int

class FeedbackRequest(BaseModel):
    alert_id: str
    outcome: str  # hit | miss | false_alarm
    note: str = ""

class FeedbackSummary(BaseModel):
    total: int
    hit: int
    miss: int
    false_alarm: int
    hit_rate: float

class HealthResponse(BaseModel):
    status: str
    backend: str
    version: str
