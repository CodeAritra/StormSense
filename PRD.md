# PRD: StormSense, AI Thunderstorm and Lightning Nowcasting Prototype

**Project:** Smart India Hackathon 2026, Problem Statement 26072
**Org / Dept:** Ministry of Earth Sciences, India Meteorological Department
**Theme:** Disaster Management
**Doc owner:** Aritra (frontend + backend)
**Status:** Prototype build, hackathon scope

---

## 0. Instructions for the AI coding agent (read first)

You are building a working prototype from this PRD. Follow these rules:

1. Build in the phase order in Section 12. Finish and run each phase before starting the next.
2. The ML model is trained separately by a teammate (see `ML_HANDOFF.md` for the ML contract and handover checklist). **Do not write training code.** Build everything around a swappable inference layer (Section 6). Ship with a working `mock` backend so the whole product runs end to end today, and an `onnx` backend that activates when `nowcast.onnx` is dropped into `/models`.
3. Prefer simple, readable code. No over-engineering. SQLite, not Postgres. No auth. No Docker required to run (but add a `docker-compose.yml` at the end).
4. Every API response shape must match Section 7 exactly. Frontend and backend share the types in Section 8.
5. After each phase, write a short "how to run" note in `README.md` and make sure `make dev` (or the documented commands) starts everything.
6. Do not use em dashes in any user-facing text or copy.
7. If something is ambiguous, pick the simplest option, note the assumption in `README.md`, and continue.

---

## 1. Problem summary (plain language)

Thunderstorms and lightning form fast, kill people and damage crops, and current forecasts are too slow and too coarse to warn people in time. We need an AI system that predicts **where storms and lightning will be in the next 0 to 60 minutes (prototype) and up to 3 hours (roadmap)**, using multiple data sources (radar, satellite, lightning, weather model data), and turns that prediction into an **alert that reaches people in their language**.

Key term: **nowcasting** = very short-term, high-resolution forecast (minutes to about 3 hours, 1 to 3 km grid).

## 2. Product goal

A forecaster-facing web dashboard plus an alert pipeline that:

1. Shows current and predicted storm intensity and lightning risk on a map, with a time slider.
2. Shows uncertainty honestly, and shows how much better the AI is than a simple baseline.
3. Generates impact-based, multilingual (English, Bengali, Hindi) alerts and a standards-based CAP alert file.
4. Runs a **replay mode** of a past storm event so the demo works on any day, even with no live storm.

### Success criteria (prototype)
- Full demo flow (Section 11) works with zero manual steps besides pressing Play.
- Dashboard loads and renders a forecast in under 2 seconds after selecting an event.
- Pipeline latency (frames in to alert out) is measured and displayed. Target under 2 minutes, expected far lower in replay.
- Swapping from `mock` to `onnx` requires changing one env variable and nothing else.

## 3. Non-goals (do not build)
- Model training, data download scripts, or data science notebooks (teammate owns these).
- User accounts, login, roles.
- Real SMS or push delivery (simulate with a phone preview UI).
- Live ingestion from IMD or INSAT (build the adapter interface and stub only).
- A native mobile app (web preview of the alert phone screen is enough; native app is a stretch goal, Section 13).

## 4. Users
| User | Need |
|---|---|
| IMD forecaster (primary) | See storm and lightning forecast, trust it, approve and send alerts fast |
| District disaster officer | Get clear, area-specific warnings with time to impact |
| Citizen / farmer (indirect) | Receive a short warning in own language with what to do |
| SIH judge | Understand the value in 3 minutes, see numbers, see it working |

## 5. System architecture

```
                    +-----------------------------+
 replay events ---> |        FastAPI backend      |
 (npz + meta)       |                             |
                    |  Replay Engine (clock)      |
 nowcast.onnx ----> |  Inference Layer            |
 (or mock)          |   - mock | onnx (switch)    |
                    |  Rendering (PNG overlays)   |
                    |  Alert Engine + CAP + i18n  |
                    |  SQLite (alerts, feedback)  |
                    +-------------+---------------+
                                  | REST + WebSocket
                    +-------------v---------------+
                    |  React + JavaScript web app |
                    |  MapLibre GL dashboard      |
                    +-----------------------------+
```

### Repo layout (monorepo)
```
stormsense/
  README.md
  Makefile
  docker-compose.yml
  ML_HANDOFF.md          # team contract & ONNX export specs for ML teammate
  apps/
    api/
      main.py
      config.py
      models.py            # pydantic schemas (Section 8)
      db.py                # sqlite helpers
      replay.py            # replay engine
      inference/
        base.py            # Nowcaster interface
        mock.py            # MockNowcaster
        onnx_backend.py    # OnnxNowcaster
      render.py            # array -> colored PNG overlay
      alerts.py            # alert engine, i18n, CAP
      data/
        districts.geojson  # demo districts (Section 9)
        events/            # <event_id>.npz + <event_id>.json
        metrics.json       # AI vs baseline numbers (from teammate)
      requirements.txt
    web/
      package.json
      vite.config.js
      src/
        main.jsx
        App.jsx
        api/client.js
        types.js           # mirrors Section 8 (JSDoc / constants)
        components/
          MapView.jsx
          TimeSlider.jsx
          LayerControls.jsx
          AlertPanel.jsx
          AlertModal.jsx
          PhonePreview.jsx
          StormCellList.jsx
          ExplainPanel.jsx
          MetricsChart.jsx
          LatencyBadge.jsx
        pages/
          Dashboard.jsx
          Metrics.jsx
  models/
    README.md              # where to drop nowcast.onnx
```

## 6. Inference layer (swappable, most important design point)

### Interface
```python
# apps/api/inference/base.py
from abc import ABC, abstractmethod
import numpy as np

class Nowcaster(ABC):
    @abstractmethod
    def predict(self, vil: np.ndarray, ir: np.ndarray, lght: np.ndarray) -> dict:
        """
        vil, ir, lght: float32 arrays, shape [13, 128, 128], values 0..1
                       (13 past frames, oldest first, 5 minute step)
        returns {
          "vil":       float32 [12, 128, 128]  values 0..1   (next 12 frames, 5 min step)
          "lightning": float32 [12, 128, 128]  probability 0..1
          "explain":   {"radar": float, "satellite": float, "lightning": float}  # sums to 1, optional
          "inference_ms": float
        }
        """
```

### Backend switch
`MODEL_BACKEND=mock` (default) or `MODEL_BACKEND=onnx`. Read from `.env`.

### OnnxNowcaster (activates when `/models/nowcast.onnx` exists)
Contract agreed with the ML teammate:
- Input tensor name: `frames`, shape `[1, 39, 128, 128]`, float32, values 0 to 1.
- Channel order: 13 VIL frames, then 13 IR (ir107) frames, then 13 lightning frames (oldest to newest within each group). Concatenate as `[vil(13), ir(13), lght(13)]`.
- Output `vil`: `[1, 12, 128, 128]`, already sigmoid, 0 to 1.
- Output `lightning`: `[1, 12, 128, 128]`, **raw logits**. Apply sigmoid in the backend to get probability.
- Use `onnxruntime` with CPU provider. Load session once at startup.
- If model file is missing and `MODEL_BACKEND=onnx`, fail at startup with a clear message.

### MockNowcaster (must look realistic, not random noise)
Goal: demo-quality forecasts before the real model exists.
- Estimate motion between the last two VIL frames with a simple global shift (phase correlation via `numpy.fft`, or `cv2.calcOpticalFlowFarneback` if OpenCV is allowed) and advect the last VIL frame forward for each of 12 lead steps.
- Add a mild growth/decay factor per lead step (multiply by `1 + 0.01*k` where local VIL is above a threshold, otherwise `1 - 0.01*k`), and Gaussian blur that increases with lead time (uncertainty).
- Lightning probability = `sigmoid(a * (vil_pred - 0.45) * 8)` combined with IR cold-cloud term, clipped, and smoothed. Higher and wider at longer lead to mimic uncertainty.
- Fill `explain` with plausible fixed weights (for example radar 0.55, satellite 0.25, lightning 0.20) and add a comment `# placeholder until real model provides attribution`.
- Must run in under 200 ms per call on CPU.

## 7. API specification

Base URL: `http://localhost:8000`. JSON unless stated. Enable CORS for `http://localhost:5173`.

### 7.1 Health
`GET /api/health` returns `{ "status": "ok", "backend": "mock" | "onnx", "version": "0.1.0" }`

### 7.2 Events (replay catalog)
`GET /api/events` returns `EventSummary[]`
```json
[{
  "id": "evt_001",
  "title": "Nor'wester demo event",
  "description": "Severe convective event, replay",
  "n_frames": 49,
  "frame_step_min": 5,
  "bounds": {"west": 86.6, "south": 20.85, "east": 90.1, "north": 24.29},
  "start_time_utc": "2019-07-10T09:00:00Z"
}]
```

### 7.3 Replay control (server-side clock so all clients stay in sync)
- `POST /api/replay/start` body `{ "event_id": "evt_001", "speed": 1.0, "start_index": 12 }`
- `POST /api/replay/pause`
- `POST /api/replay/resume`
- `POST /api/replay/seek` body `{ "index": 30 }`
- `GET  /api/replay/state` returns `ReplayState`
- `WS   /ws/replay` pushes a `ReplayState` message every tick and after any control action.

Replay logic: `current_index` is the "now" frame (needs at least 12 previous frames, so minimum valid index is 12; default start 12). Each tick (default 1 tick = 2 seconds real time at speed 1.0) advances `current_index` by 1 until `n_frames - 13` (so 12 truth frames remain for comparison), then pauses.

### 7.4 Forecast
`GET /api/forecast?event_id=evt_001&index=24` returns `ForecastResponse`
- Runs the active Nowcaster on frames `[index-12 .. index]`.
- Caches result per `(event_id, index)` in memory (LRU 256).
- Returns metadata plus URLs to per-frame PNG overlays (server rendered).

```json
{
  "event_id": "evt_001",
  "index": 24,
  "issued_at_utc": "2019-07-10T11:00:00Z",
  "lead_minutes": [5,10,15,20,25,30,35,40,45,50,55,60],
  "bounds": {"west": 86.6, "south": 20.85, "east": 90.1, "north": 24.29},
  "overlays": {
    "vil_pred":   ["/api/overlay/evt_001/24/vil_pred/0.png", "...", "/api/overlay/evt_001/24/vil_pred/11.png"],
    "lightning":  ["/api/overlay/evt_001/24/lightning/0.png", "..."],
    "vil_actual": ["/api/overlay/evt_001/24/vil_actual/0.png", "..."],
    "vil_now":    "/api/overlay/evt_001/24/vil_now/0.png"
  },
  "storm_cells": [
    {"id": "c1", "lat": 22.8, "lon": 88.1, "max_vil": 0.82, "area_km2": 420,
     "motion_kmh": 38, "heading_deg": 65}
  ],
  "explain": {"radar": 0.55, "satellite": 0.25, "lightning": 0.20},
  "timing": {"inference_ms": 41.2, "render_ms": 30.5, "alert_ms": 3.1, "total_ms": 78.4},
  "backend": "mock"
}
```

### 7.5 Overlays
`GET /api/overlay/{event_id}/{index}/{layer}/{k}.png`
- `layer`: `vil_pred`, `lightning`, `vil_actual` (truth frame k, for comparison), `vil_now` (current frame, k ignored).
- Returns RGBA PNG at 128x128 (frontend scales up smoothly).
- Colormaps:
  - VIL: transparent below 0.1, then green, yellow, orange, red, magenta as value rises (radar style).
  - Lightning probability: transparent below 0.2, then yellow to orange to red to purple as probability goes 0.2 to 1.0. Alpha scales with probability.
- Set `Cache-Control: max-age=3600`.

### 7.6 Storm cells
Computed from `vil_now` and the first predicted frame: threshold VIL above 0.4, connected components (`scipy.ndimage.label`), centroid to lat/lon via bounds, area in km2 (pixel is about 3 km, so 9 km2 per pixel), motion from centroid shift between the last two frames. Return the top 8 by max VIL.

### 7.7 Alerts
- `GET  /api/alerts?event_id=evt_001&index=24` returns `Alert[]` (computed live by the alert engine for that moment, and merged with any stored status).
- `POST /api/alerts/{alert_id}/approve` marks approved, stores it in SQLite, returns the alert with generated messages.
- `GET  /api/alerts/{alert_id}/cap.xml` returns CAP 1.2 XML (`application/xml`).
- `GET  /api/alerts/history` returns all approved alerts (newest first).

Alert engine rules (in `alerts.py`):
- For each district polygon (Section 9), take the max lightning probability across all 12 lead frames inside the district (use pixel mask from polygon rasterization, or bounding box for simplicity).
- If max probability is at least 0.5, create an alert:
  - `severity`: `watch` if p is 0.5 to 0.7, `warning` if 0.7 to 0.85, `severe` if above 0.85.
  - `eta_min`: lead time of the first frame where p is at least 0.5.
  - `peak_prob`, `peak_vil`.
- Deterministic `alert_id = f"{event_id}-{index}-{district_id}"`.

### 7.8 Messages (multilingual, template based, no external API)
For each alert produce `en`, `bn`, `hi` text under 160 characters (SMS friendly). Templates use district name (localized name in districts file), ETA and severity.

Example templates:
- en: `LIGHTNING {SEVERITY}: {DISTRICT} in about {ETA} min. Stay indoors, avoid open fields, trees and water. - IMD`
- bn: `বজ্রপাত {SEVERITY_BN}: {DISTRICT_BN}, প্রায় {ETA} মিনিটের মধ্যে। ঘরে থাকুন, খোলা মাঠ, গাছ ও জল থেকে দূরে থাকুন। - IMD`
- hi: `बिजली {SEVERITY_HI}: {DISTRICT_HI}, लगभग {ETA} मिनट में। घर के अंदर रहें, खुले मैदान, पेड़ और पानी से दूर रहें। - IMD`

Provide severity words: watch / সতর্কতা / निगरानी, warning / সতর্কবার্তা / चेतावनी, severe / তীব্র / गंभीर.

### 7.9 CAP export
Build CAP 1.2 XML with `identifier`, `sender` (`imd.gov.in` placeholder), `sent`, `status=Exercise` (prototype), `msgType=Alert`, `scope=Public`, and one `info` block per language (`en-IN`, `bn-IN`, `hi-IN`) containing `event`, `urgency`, `severity`, `certainty`, `headline`, `description`, `instruction`, and an `area` with `areaDesc` and a polygon or circle. Validate that output is well-formed XML.

### 7.10 Feedback loop
`POST /api/feedback` body `{ "alert_id": "...", "outcome": "hit" | "miss" | "false_alarm", "note": "" }` stores in SQLite.
`GET /api/feedback/summary` returns counts and hit rate (used in UI to show the feedback loop concept, with a note that retraining is roadmap).

### 7.11 Metrics
`GET /api/metrics` serves `data/metrics.json` as is (produced by ML teammate). Schema in Section 8. Ship a **placeholder file** with plausible clearly-labeled sample numbers and a `"is_placeholder": true` flag. The UI must show a visible "Sample numbers, replace with real evaluation" tag when this flag is true.

## 8. Shared data types

### Python (pydantic, `models.py`)
```python
class Bounds(BaseModel):
    west: float; south: float; east: float; north: float

class EventSummary(BaseModel):
    id: str; title: str; description: str
    n_frames: int; frame_step_min: int
    bounds: Bounds; start_time_utc: str

class ReplayState(BaseModel):
    event_id: str | None
    playing: bool
    speed: float
    current_index: int
    n_frames: int
    max_index: int

class StormCell(BaseModel):
    id: str; lat: float; lon: float
    max_vil: float; area_km2: float
    motion_kmh: float; heading_deg: float

class Timing(BaseModel):
    inference_ms: float; render_ms: float; alert_ms: float; total_ms: float

class ForecastResponse(BaseModel):
    event_id: str; index: int; issued_at_utc: str
    lead_minutes: list[int]; bounds: Bounds
    overlays: dict
    storm_cells: list[StormCell]
    explain: dict[str, float]
    timing: Timing
    backend: str

class Alert(BaseModel):
    id: str; district_id: str; district_name: str
    severity: str            # watch | warning | severe
    eta_min: int; peak_prob: float; peak_vil: float
    status: str              # proposed | approved
    messages: dict[str, str] | None   # en, bn, hi
```

### JavaScript (`types.js` / JSDoc)
Mirror the same shapes exactly (camelCase not required, keep snake_case to match JSON).

### metrics.json schema
```json
{
  "is_placeholder": true,
  "dataset": "SEVIR (US), held-out test set",
  "lead_minutes": [5,10,15,20,25,30,35,40,45,50,55,60],
  "csi": {
    "persistence": [0.0],
    "optical_flow": [0.0],
    "model": [0.0]
  },
  "pod":  {"persistence": [], "optical_flow": [], "model": []},
  "far":  {"persistence": [], "optical_flow": [], "model": []},
  "lightning": {"pod": 0.0, "far": 0.0, "csi": 0.0, "brier": 0.0}
}
```
Each list has 12 values aligned to `lead_minutes`.

## 9. Demo geography and data

### Important honesty note
The training data (SEVIR) is from the US. For the demo, replay events are georeferenced onto a **South Bengal demo region** so the map, districts and alerts make sense to Indian judges. The UI must show a small persistent label: **"Demo mapping: replay data placed on South Bengal region. Model pipeline is sensor-agnostic."** Do not hide this.

### Region
- Center approx Kolkata (22.57 N, 88.36 E).
- Bounds (configurable in `config.py`): west 86.6, south 20.85, east 90.1, north 24.29.

### Districts file (`districts.geojson`)
Create a simple GeoJSON FeatureCollection with about 10 demo districts as **rough rectangles or simple polygons** inside the bounds. Properties: `id`, `name_en`, `name_bn`, `name_hi`, `population`, `farmland_pct`. Suggested districts: Kolkata, North 24 Parganas, South 24 Parganas, Howrah, Hooghly, Nadia, Purba Medinipur, Paschim Medinipur, Bardhaman, Bankura. Rough locations are fine, they are for demo. Add a comment in README that boundaries are simplified placeholders.

### Replay event files
- `data/events/<event_id>.npz` with arrays: `vil` `[49,128,128]` uint8, `ir` `[49,128,128]` uint8, `lght` `[49,128,128]` uint8 (binary 0/1 or counts clipped to 255).
- `data/events/<event_id>.json` with the fields of `EventSummary`.
- **Ship a synthetic event generator** `apps/api/scripts/make_synthetic_event.py` that creates 2 realistic-looking events (moving Gaussian blob storm cells that grow, merge and decay, with cold IR cores and lightning near the strongest cells) so the app runs before the teammate delivers real SEVIR events. Real events will be dropped in later using the same format.
- Normalize on load: divide by 255 to get float32 0..1.

## 10. Frontend requirements (React + JavaScript + Vite)

Libraries: `react`, `react-dom`, `vite`, `maplibre-gl`, `recharts`, `zustand` (state), `tailwindcss`. No other UI framework needed.

Map basemap: use MapLibre with a free style that needs no API key (for example a raster OSM tile source, or `https://demotiles.maplibre.org/style.json`). Dark theme UI.

### 10.1 Dashboard page (`/`)
Layout: left sidebar (controls and alerts), main map, bottom timeline.

**Header bar**
- App name StormSense, event selector dropdown, Play / Pause button, speed (1x, 2x, 4x), "Now" time in IST and UTC.
- `LatencyBadge`: shows `timing.total_ms` and text like "Data to alert: 78 ms (replay)". Turns green when under 2 minutes target.
- Backend badge: `mock` or `onnx`.

**Map (`MapView`)**
- Image overlays via MapLibre `image` source using event bounds (four corner coordinates) and a raster layer. Smooth resampling, opacity slider.
- Layers (toggle in `LayerControls`): Radar now, Predicted radar, Lightning risk, Actual radar (truth, for comparison), District boundaries, Storm cell markers.
- District polygons colored by alert severity (none, watch yellow, warning orange, severe red), tooltip on hover with name and peak probability and ETA.
- Storm cell markers with an arrow rotated by heading and a popup showing max VIL, area, speed.
- Legend for VIL and lightning colormaps.

**Time slider (`TimeSlider`)**
- 13 stops: Now, +5, +10, ... +60 min. Dragging swaps the predicted overlay to that lead frame. Autoplay loop button ("animate forecast").
- Toggle "Compare with actual": splits or blends predicted vs actual radar for the selected lead time (a simple opacity crossfade slider is fine).
- Show a confidence note that grows with lead time (for example "Confidence: high / medium / lower" bands based on lead, plus the widening blur in the overlay).

**Sidebar**
1. `AlertPanel`: list of proposed alerts sorted by severity then ETA. Each card shows district, severity chip, ETA, peak probability, population exposed (from districts file). Buttons: Preview, Approve and send.
2. `StormCellList`: top cells with intensity and motion. Clicking flies the map to it.
3. `ExplainPanel`: horizontal bars for `explain` (radar, satellite, lightning) with a caption "Which input drove this forecast". Show "(placeholder attribution)" tag when backend is `mock`.

**Alert modal (`AlertModal` + `PhonePreview`)**
- Opens on Preview or Approve.
- Language tabs: English, Bengali, Hindi. Phone-frame mockup shows the SMS-style text, plus a push-notification style card.
- Buttons: Approve and send (calls approve endpoint, shows "Sent (simulated)" state with timestamp), Download CAP XML.
- After approval, show a feedback control: Hit / Miss / False alarm (calls feedback endpoint).

**Footer strip:** feedback summary (hit rate) and the demo mapping honesty label.

### 10.2 Metrics page (`/metrics`)
- Fetch `/api/metrics`.
- Recharts line chart: CSI vs lead time, three lines (persistence, optical flow, model). Same for POD and FAR in tabs.
- Lightning summary cards (POD, FAR, CSI, Brier).
- Explanatory text in simple language under each chart: "Higher CSI is better. FAR lower is better."
- If `is_placeholder` is true, show a prominent amber banner: "Sample numbers. Replace with real evaluation results."

### 10.3 UX rules
- Responsive down to tablet width; dashboard must work on a 1366x768 laptop.
- Loading skeletons while forecast loads; error toasts if API fails.
- Prefetch overlay images for all 12 leads as soon as a forecast arrives so the slider is instant.
- Keep everything keyboard friendly (space toggles play, left/right arrows move slider).

## 11. Demo flow (acceptance test)

1. Open the app, pick `evt_001`, press Play. Radar moves, "Now" advances.
2. At a moment with a strong storm, drag the time slider to +45 min and see predicted storm and lightning risk. Toggle "Compare with actual" and see how close it is.
3. District polygons turn orange or red. Alert cards appear with ETA.
4. Click Preview on the top alert. Switch English, Bengali, Hindi tabs. Click Approve and send. Show "Sent (simulated)". Download CAP XML.
5. Mark the alert as Hit. Feedback strip updates.
6. Open the Metrics page and show AI vs baselines chart.
7. Point at the latency badge and the backend badge.

Definition of done: steps 1 to 7 work in one continuous run without console errors.

## 12. Build phases (agent: do in this order)

**Phase 1: Backend skeleton and data**
- FastAPI app, config, CORS, health endpoint, SQLite init.
- Synthetic event generator and 2 events in `data/events`.
- `/api/events`, replay engine with WebSocket, `/api/replay/*`.
- Done when: `curl /api/events` works and WebSocket ticks.

**Phase 2: Inference and forecast**
- `Nowcaster` interface, `MockNowcaster`, `OnnxNowcaster`, backend switch.
- Renderer (colormaps to PNG), `/api/forecast`, `/api/overlay/...`, storm cell extraction, timing.
- Done when: forecast JSON returns and overlay PNGs open in a browser and look like storms.

**Phase 3: Alerts**
- Districts file, alert engine, i18n templates, CAP XML, approve, history, feedback endpoints.
- Done when: alerts appear for a strong-storm index and CAP XML is well-formed.

**Phase 4: Frontend dashboard**
- Vite + React + JS + Tailwind setup, API client, zustand store, WebSocket hook.
- Map with overlays, layer controls, time slider, alert panel, storm cells, explain panel, latency badge.
- Done when: demo flow steps 1 to 3 work.

**Phase 5: Alert UI, metrics page, polish**
- Alert modal with phone preview, CAP download, feedback buttons, metrics page with placeholder JSON.
- Skeletons, toasts, keyboard shortcuts, legends, honesty labels.
- Done when: all demo flow steps work.

**Phase 6: Packaging**
- `Makefile` (`make dev` runs API and web), `docker-compose.yml`, `README.md` with run steps, env vars, how to drop in `nowcast.onnx` and real events and `metrics.json`.
- Basic tests: API tests for forecast shape, alert thresholds, CAP well-formedness (pytest), one smoke test for the frontend build.

## 13. Stretch goals (only after Section 11 passes)
1. React Native app that receives alerts (Expo) with location-based filtering.
2. Live ingestion adapters (INSAT via MOSDAC, ERA5) behind the same `Nowcaster` interface.
3. Extend lead time to 180 minutes with lead bands 0 to 30, 30 to 60, 60 to 180.
4. Real districts GeoJSON and real population/farmland layers.
5. Probabilistic ensemble view (percentile bands).
6. Kafka or Redis streaming and PostGIS instead of SQLite.
7. Radar gap filler: satellite-to-radar "virtual radar" layer for areas without radar coverage.

## 14. Roadmap talking points (for pitch, not to build)
- Radar gap filler using satellite to estimate radar where none exists.
- Impact-based alerts tied to population, farms, crowd events.
- Cell broadcast, SMS, voice in many Indian languages plus CAP for NDMA and state systems.
- Feedback loop retraining model from forecaster and public hit/miss reports.
- Scale from one region to all India as IMD radar and INSAT data access is granted.

## 15. Risks and decisions

| Risk | Decision |
|---|---|
| ML model not ready | `mock` backend ships first, `onnx` swaps in later |
| No IMD data | Replay events plus synthetic generator; state honestly in UI |
| Metrics not ready | Placeholder JSON with visible banner |
| Time crunch | Cut order: stretch goals, then phone preview polish, then explain panel. Never cut replay, map, slider, alerts, latency badge, metrics page |

## 16. Tech stack summary
- **Backend:** Python 3.11, FastAPI, Uvicorn, NumPy, SciPy, Pillow, onnxruntime, pydantic, SQLite (sqlite3), websockets
- **Frontend:** React 18, JavaScript, Vite, TailwindCSS, MapLibre GL JS, Recharts, Zustand
- **Tooling:** pytest, ESLint, Prettier, Makefile, Docker Compose

## 17. Config (`.env` example)
```
MODEL_BACKEND=mock
MODEL_PATH=../../models/nowcast.onnx
EVENTS_DIR=./data/events
REGION_WEST=86.6
REGION_SOUTH=20.85
REGION_EAST=90.1
REGION_NORTH=24.29
REPLAY_TICK_SECONDS=2
ALERT_MIN_PROB=0.5
API_PORT=8000
```
Frontend `.env`: `VITE_API_URL=http://localhost:8000`