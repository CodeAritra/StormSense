# StormSense: Complete Project Setup & GitHub Deployment Guide

**Smart India Hackathon 2026 - Problem Statement 26072**  
**Project:** StormSense - AI Thunderstorm and Lightning Nowcasting Prototype  
**Ministry / Dept:** Ministry of Earth Sciences (MoES), India Meteorological Department (IMD)

---

## Part 1: Pushing this Project to GitHub

Follow these steps to initialize and push your clean codebase to GitHub.

### Step 1: Check Git Status in your Terminal
Open your terminal in the project root (`thunderstorm`):

```powershell
# Check if git is already initialized
git status
```

If Git is not initialized:
```powershell
git init
git branch -M main
```

### Step 2: Verify `.gitignore`
A `.gitignore` file has been added to the root to prevent committing `node_modules/`, `__pycache__/`, local SQLite databases (`stormsense.db`), and local `.env` files.

Verify that sensitive or heavy files are excluded:
```powershell
git status --ignored
```
*(You should see `node_modules/`, `apps/api/stormsense.db`, and `.env` in the untracked/ignored list).*

### Step 3: Stage and Commit the Codebase
```powershell
git add .
git commit -m "feat: complete StormSense nowcasting prototype with ONNX inference & React dashboard"
```

### Step 4: Link your Remote GitHub Repository and Push
1. Go to [GitHub](https://github.com/new) and create a new repository (e.g., `stormsense` or `sih-stormsense-nowcasting`).
2. Do **not** initialize it with a README, .gitignore, or license (we already have them).
3. Copy your remote URL and run:

```powershell
# Replace with your actual GitHub repository URL
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# Push the code to GitHub
git push -u origin main
```

---

## Part 2: Setup Instructions for Collaborators & Evaluators

Anyone cloning this repository (including your ML teammate or hackathon evaluators) can get the full application running end-to-end using these instructions.

### 1. Prerequisites
- **Git** installed
- **Python 3.10, 3.11, or 3.12**
- **Node.js 18+** and **npm**
- *(Optional)* Docker and Docker Compose

---

### 2. Clone the Repository

```bash
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
cd thunderstorm
```

---

### 3. Backend Setup (FastAPI & ONNX Inference)

1. **Create and activate a Python virtual environment:**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r apps/api/requirements.txt
   ```

3. **Configure Environment:**
   ```bash
   # Copy template
   cp apps/api/.env.example apps/api/.env
   ```
   *Edit `apps/api/.env` if you want to switch between `MODEL_BACKEND=mock` and `MODEL_BACKEND=onnx`.*

4. **Verify Model File (if using ONNX):**
   Ensure your teammate's trained model is located at `models/nowcast.onnx`.
   You can run the self-test verification script:
   ```bash
   python verify_onnx.py
   ```

5. **Start the Backend API Server:**
   ```bash
   uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   - API runs at: **`http://localhost:8000`**
   - Interactive Swagger API docs: **`http://localhost:8000/docs`**
   - Health status: **`http://localhost:8000/api/health`**

---

### 4. Frontend Setup (React 18, Vite & MapLibre GL)

1. **Navigate to the web directory:**
   ```bash
   cd apps/web
   ```

2. **Install npm dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   ```bash
   # Copy template
   cp .env.example .env
   ```
   *By default, `VITE_API_URL=http://localhost:8000` connects directly to the local backend.*

4. **Start the Frontend Development Server:**
   ```bash
   npm run dev
   ```
   - Web Dashboard runs at: **`http://localhost:5173`**

---

### 5. Alternative: Run with Docker Compose

To launch the entire stack (both frontend and backend) in isolated containers with a single command:

```bash
docker-compose up --build
```

- Dashboard: **`http://localhost:5173`**
- API & Docs: **`http://localhost:8000/docs`**

---

## Part 3: Architecture & Key Directories

```
thunderstorm/
├── .env.example               # Root environment reference
├── .gitignore                 # Excludes node_modules, .env, *.db
├── Makefile                   # make dev, make test, make build
├── docker-compose.yml         # Container orchestration
├── ML_HANDOFF.md              # Tensor contract & export guide for ML teammate
├── PRD.md                     # Full product requirements specification
├── SETUP_GUIDE.md             # This guide
├── README.md                  # Project overview & demo walkthrough
├── verify_onnx.py             # Standalone ONNX model verification script
├── models/
│   ├── README.md              # Drop-in instructions for nowcast.onnx
│   └── nowcast.onnx           # Trained deep learning ONNX model
└── apps/
    ├── api/                   # Python FastAPI Backend
    │   ├── .env               # Backend environment variables
    │   ├── .env.example       # Backend environment template
    │   ├── main.py            # API routes (REST + WebSocket)
    │   ├── config.py          # Configuration & path resolution
    │   ├── models.py          # Pydantic schemas
    │   ├── db.py              # SQLite database (alerts & feedback)
    │   ├── replay.py          # Replay clock & WebSocket broadcast
    │   ├── render.py          # Radar/lightning PNG colormap renderer
    │   ├── alerts.py          # Multilingual alert engine & CAP 1.2 XML
    │   ├── inference/
    │   │   ├── base.py        # Abstract Nowcaster interface
    │   │   ├── mock.py        # Physics-based advection mock
    │   │   └── onnx_backend.py# ONNX Runtime CPU inference
    │   ├── data/
    │   │   ├── districts.geojson
    │   │   ├── metrics.json
    │   │   └── events/        # Synthetic and SEVIR test events
    │   └── tests/
    │       └── test_api.py    # Pytest test suite
    └── web/                   # React 18 + JavaScript Frontend
        ├── .env               # Frontend environment variables
        ├── .env.example       # Frontend environment template
        ├── package.json       # React, MapLibre, Recharts, Zustand, Tailwind
        ├── vite.config.js     # Vite configuration with dynamic proxy
        └── src/
            ├── components/    # MapView, TimeSlider, AlertModal, PhonePreview, etc.
            ├── pages/         # Dashboard & AI vs Baseline Metrics
            └── store/         # Zustand global state store
```

---

## Part 4: Running Automated Tests

To verify that the API schemas, CAP 1.2 XML generator, and alert threshold engines are working correctly:

```bash
# Run pytest from the repository root
pytest apps/api/tests -v
```

---

## Part 5: Frequently Asked Questions & Troubleshooting

### Q1: The browser shows a blank or dark map.
- **Cause:** Third-party tile blockers (e.g. Brave Shields) or slow initial load.
- **Fix:** In [MapView.jsx](apps/web/src/components/MapView.jsx), we use OpenStreetMap tiles with a permanent dark canvas fallback `#080d1a` and bundled local MapLibre CSS. Refresh your browser (`Ctrl + F5`).

### Q2: Port 8000 or 5173 is already in use.
- **Backend:** Change `API_PORT=8001` in `apps/api/.env` and run `uvicorn apps.api.main:app --port 8001 --reload`.
- **Frontend:** Update `VITE_API_URL=http://localhost:8001` in `apps/web/.env`.

### Q3: How do I swap from Mock back to ONNX (or vice versa)?
- In `apps/api/.env`, change:
  ```bash
  MODEL_BACKEND=onnx   # or MODEL_BACKEND=mock
  ```
- Restart the backend terminal. The top-right badge on the dashboard will update automatically.
