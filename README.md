# StormSense: AI Thunderstorm and Lightning Nowcasting Prototype

**Smart India Hackathon 2026 - Problem Statement 26072**  
**Ministry / Department:** Ministry of Earth Sciences (MoES), India Meteorological Department (IMD)  
**Theme:** Disaster Management  
**Architecture:** FastAPI Backend + React 18 & JavaScript Dashboard + Swappable Inference Layer (`mock` / `onnx`)

> **Key Documentation:**
> - [SETUP_GUIDE.md](SETUP_GUIDE.md): Complete instructions for pushing to GitHub & setup for collaborators/evaluators.
> - [ML_HANDOFF.md](ML_HANDOFF.md): Teammate contract, tensor shapes, and `verify_onnx.py` verification guide.
> - [PRD.md](PRD.md): Full product requirements document.

---

## 1. Quick Start

### Prerequisites
- Python 3.10 or 3.11
- Node.js 18+ and npm
- (Optional) Docker and Docker Compose

### Option A: Local Development (Recommended)

1. **Clone and enter repository:**
   ```bash
   cd thunderstorm
   ```

2. **Start the FastAPI backend:**
   ```bash
   # Create and activate virtual environment (optional)
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate

   # Install dependencies
   pip install -r apps/api/requirements.txt

   # Start backend server
   uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   Backend will start at: `http://localhost:8000` (Swagger docs at `/docs`)

3. **Start the React + JavaScript dashboard:**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```
   Frontend will start at: `http://localhost:5173`

### Option B: Docker Compose

```bash
docker-compose up --build
```
- Web dashboard: `http://localhost:5173`
- API backend: `http://localhost:8000`

---

## 2. Environment Configuration

The application uses separate `.env` files for frontend and backend isolation:

### Backend Configuration (`apps/api/.env`)
```bash
# Backend mode: 'mock' (default) or 'onnx'
MODEL_BACKEND=onnx

# Path to trained model when teammate delivers it
MODEL_PATH=../../models/nowcast.onnx

# Data paths (relative to apps/api)
EVENTS_DIR=./data/events
DISTRICTS_FILE=./data/districts.geojson
METRICS_FILE=./data/metrics.json
DB_PATH=./stormsense.db

# Demo Geographic Region (South Bengal Corridor)
REGION_WEST=86.6
REGION_SOUTH=20.85
REGION_EAST=90.1
REGION_NORTH=24.29

# Replay settings
REPLAY_TICK_SECONDS=2.0
ALERT_MIN_PROB=0.5
API_PORT=8000
```

### Frontend Configuration (`apps/web/.env`)
```bash
# Backend API Base URL
VITE_API_URL=http://localhost:8000

# Live Replay WebSocket URL
VITE_WS_URL=ws://localhost:8000/ws/replay

# App Title
VITE_APP_TITLE=StormSense AI Nowcasting Dashboard
```

---

## 3. Team Division & Swapping to ONNX

This project is built for a two-person collaboration:
- **Teammate:** Responsible for model training, PyTorch-to-ONNX export, test events, and evaluation metrics.
- **Aritra:** Responsible for frontend, backend, replay clock, map rendering, and alert dispatch pipelines.

See [ML_HANDOFF.md](ML_HANDOFF.md) for the exact model input/output contract and verification script.

### Swapping from Mock to ONNX:
1. Drop the delivered model file into `models/nowcast.onnx`.
2. Change `.env` setting to:
   ```bash
   MODEL_BACKEND=onnx
   ```
3. Restart the backend. The backend will switch to ONNX Runtime CPU inference automatically.

---

## 4. Acceptance Test: 7-Step Demo Flow

Follow this flow during hackathon presentation or evaluation:

1. **Start the App:** Open `http://localhost:5173`. Ensure `evt_001` is selected and press **Play Replay**. Radar cells will advect across the map and the simulation clock advances.
2. **Explore Lead Time Horizon:** Drag the bottom timeline slider to **+45 min**. Observe the predicted radar intensity and lightning risk cones. Toggle **Compare Actual** to inspect AI forecast against ground truth.
3. **Inspect District Severity:** Watch districts (Hooghly, Howrah, Kolkata, North 24 Parganas) colorize yellow, orange, and red based on peak lightning probability.
4. **Multilingual Alert Dispatch:** Click **Preview** on the top alert card in the left sidebar. Switch between **English**, **বাংলা (Bengali)**, and **हिन्दी (Hindi)** tabs inside the simulated mobile screen.
5. **Approve and Download CAP:** Click **Approve & Send Alert**. Notice the simulated sent timestamp, and click **Download Standards-Compliant CAP 1.2 XML** to view the OASIS CAP alert file.
6. **Continuous Feedback:** Submit a post-event verification (**Hit** / **Miss** / **False Alarm**). Observe the feedback hit rate update in the footer strip.
7. **Inspect AI Benchmark Metrics:** Click the **AI vs Baseline** tab in the header. Review the Critical Success Index (CSI), POD, and FAR curves comparing the AI model against optical flow and persistence baselines. Point out the sub-100ms pipeline latency badge in the header.

---

## 5. Running Automated Tests

Run the backend pytest suite:
```bash
pytest apps/api/tests -v
```

This verifies:
- API health and event catalog endpoints
- Replay state engine and seek synchronization
- Forecast JSON response shape matching specifications
- Colormap overlay RGBA PNG rendering
- Multilingual CAP 1.2 XML well-formedness
- Feedback logging and hit rate calculation
