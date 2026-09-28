# StormSense: Team Roles & ML Handover Contract

**Smart India Hackathon 2026 - Problem Statement 26072**  
**Project:** StormSense - AI Thunderstorm and Lightning Nowcasting Prototype  
**Team Division:** Two-person development split

---

## 1. Team Responsibilities

| Role | Owner | Core Responsibilities | Key Deliverables |
|---|---|---|---|
| **ML & Data Science** | Teammate | - Train nowcasting model (SEVIR / radar / satellite / lightning)<br>- Export model to optimized ONNX format<br>- Provide test storm events in `.npz` format<br>- Generate AI vs baseline performance metrics (`metrics.json`) | 1. `models/nowcast.onnx`<br>2. `apps/api/data/events/*.npz` & `*.json`<br>3. `apps/api/data/metrics.json` |
| **Full-Stack Engineering** | Aritra | - FastAPI backend & replay clock engine<br>- Swappable inference layer (`mock` + `onnx`)<br>- Map overlay rendering pipeline & storm cell extraction<br>- Multilingual alert engine & CAP 1.2 XML generator<br>- React 18 + JavaScript dashboard, time slider, MapLibre map | 1. `apps/api/` (FastAPI backend)<br>2. `apps/web/` (React dashboard)<br>3. End-to-end integration & demo pipeline |

---

## 2. Decoupled Development Workflow

To ensure both teammates can work in parallel without blocking each other:

1. **Aritra builds against `MODEL_BACKEND=mock`:**
   - The backend includes a realistic physics-based advection mock generator.
   - The full dashboard, map, time slider, alerts, and CAP generation can be built and tested without waiting for model training.

2. **The ML teammate trains and validates independently:**
   - Model training happens in PyTorch / TensorFlow / notebook environment.
   - Once trained, export the model to `nowcast.onnx` following the exact contract in Section 3.
   - Run the self-validation script (Section 4) to ensure tensor shapes and names match.

3. **Plug-and-play handoff:**
   - Copy `nowcast.onnx` into `models/`.
   - Set `MODEL_BACKEND=onnx` in `.env`.
   - The backend automatically switches from mock inference to the ONNX model with zero frontend or backend code changes.

---

## 3. ONNX Model Contract (Exact Specification)

The backend loads the model via `onnxruntime` using CPU execution. The model must strictly follow these input and output specifications.

### 3.1 Input Specification

- **Input Node Name:** `frames`
- **Tensor Shape:** `[1, 39, 128, 128]`
- **Data Type:** `float32`
- **Value Range:** Normalized values between `0.0` and `1.0`
- **Channel Ordering (39 channels total):**
  - **Channels 0 to 12 (13 frames):** VIL (Vertically Integrated Liquid) radar frames.
  - **Channels 13 to 25 (13 frames):** IR (ir107) satellite cloud-top temperature frames.
  - **Channels 26 to 38 (13 frames):** Lightning flash counts / density frames.
  - **Temporal Sequence:** Oldest frame to newest frame within each group (5-minute intervals covering $t-60$ min to $t=0$ min).

### 3.2 Output Specification

The model must produce two outputs:

| Output | Node Name | Shape | Data Type | Value Range / Activation | Description |
|---|---|---|---|---|---|
| **VIL Forecast** | `vil` | `[1, 12, 128, 128]` | `float32` | `0.0` to `1.0` (Sigmoid already applied) | 12 lead frames (+5 to +60 min) |
| **Lightning Risk** | `lightning` | `[1, 12, 128, 128]` | `float32` | **Raw logits** (Do NOT apply sigmoid) | 12 lead frames (+5 to +60 min). The backend applies sigmoid. |

### 3.3 Performance Requirements

- **Runtime:** ONNX Runtime (`onnxruntime` CPU provider).
- **Latency Target:** Under 200 ms per inference on modern x86 CPU.
- **Model Size:** Recommended under 150 MB for easy git/LFS or drive transfer.

---

## 4. PyTorch Export Guide & Self-Validation Script

### 4.1 PyTorch to ONNX Export Snippet

```python
import torch

# Assuming your trained PyTorch model is `model`
model.eval()

# Dummy input matching the contract: batch_size=1, 39 channels, 128x128
dummy_input = torch.randn(1, 39, 128, 128, dtype=torch.float32)

torch.onnx.export(
    model,
    dummy_input,
    "nowcast.onnx",
    export_params=True,
    opset_version=14,
    do_constant_folding=True,
    input_names=["frames"],
    output_names=["vil", "lightning"],
    dynamic_axes={
        # Keep batch dimension dynamic if desired, spatial must be 128x128
        "frames": {0: "batch_size"},
        "vil": {0: "batch_size"},
        "lightning": {0: "batch_size"},
    }
)
print("Export complete: nowcast.onnx")
```

### 4.2 Teammate Self-Validation Script (`verify_onnx.py`)

Run this script before sending `nowcast.onnx` to Aritra:

```python
import time
import numpy as np
import onnxruntime as ort

MODEL_PATH = "nowcast.onnx"

print(f"Checking {MODEL_PATH}...")
session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])

# Check inputs
inputs = session.get_inputs()
print(f"Inputs count: {len(inputs)}")
for inp in inputs:
    print(f"  Input name: '{inp.name}', shape: {inp.shape}, type: {inp.type}")
assert inputs[0].name == "frames", f"Expected input name 'frames', got '{inputs[0].name}'"

# Check outputs
outputs = session.get_outputs()
print(f"Outputs count: {len(outputs)}")
out_names = [out.name for out in outputs]
print(f"  Output names: {out_names}")
assert "vil" in out_names, "Missing output node 'vil'"
assert "lightning" in out_names, "Missing output node 'lightning'"

# Run test inference
test_input = np.random.rand(1, 39, 128, 128).astype(np.float32)
start = time.perf_counter()
res = session.run(None, {"frames": test_input})
elapsed_ms = (time.perf_counter() - start) * 1000

res_dict = {out.name: val for out, val in zip(outputs, res)}
vil_out = res_dict["vil"]
lght_out = res_dict["lightning"]

print(f"\nInference successful in {elapsed_ms:.1f} ms!")
print(f"  VIL output shape: {vil_out.shape}, min: {vil_out.min():.3f}, max: {vil_out.max():.3f}")
print(f"  Lightning output shape: {lght_out.shape}, min: {lght_out.min():.3f}, max: {lght_out.max():.3f}")

# Verification assertions
assert vil_out.shape == (1, 12, 128, 128), f"VIL shape mismatch: {vil_out.shape}"
assert lght_out.shape == (1, 12, 128, 128), f"Lightning shape mismatch: {lght_out.shape}"
assert 0.0 <= vil_out.min() and vil_out.max() <= 1.0, "VIL output must be in range [0, 1] (apply sigmoid before export)"

print("\nAll checks passed! This model is ready for handoff.")
```

---

## 5. Replay Event Data Format (`.npz` + `.json`)

The backend replay engine replays historical storm sequences frame-by-frame. The ML teammate provides real sample storm events extracted from the test dataset.

### 5.1 Storage Location
Save in `apps/api/data/events/`:
- `apps/api/data/events/<event_id>.npz`
- `apps/api/data/events/<event_id>.json`

### 5.2 Array File (`<event_id>.npz`)
Contains three arrays saved via `np.savez_compressed`:

| Array Key | Shape | Type | Description |
|---|---|---|---|
| `vil` | `[49, 128, 128]` | `uint8` | VIL values scaled to 0-255 (backend divides by 255 to get 0.0-1.0) |
| `ir` | `[49, 128, 128]` | `uint8` | Cleaned IR brightness temperature scaled 0-255 |
| `lght` | `[49, 128, 128]` | `uint8` | Lightning strike counts or density scaled 0-255 |

*Note on 49 frames:* 49 frames at 5-minute intervals equals 4 hours of storm history (12 frames warm-up + replay duration + 12 ground truth forecast frames for comparison).

### 5.3 Metadata File (`<event_id>.json`)
```json
{
  "id": "evt_001",
  "title": "Severe Convective Nor'wester Event",
  "description": "High-intensity storm with severe lightning over South Bengal demo corridor",
  "n_frames": 49,
  "frame_step_min": 5,
  "bounds": {
    "west": 86.6,
    "south": 20.85,
    "east": 90.1,
    "north": 24.29
  },
  "start_time_utc": "2019-07-10T09:00:00Z"
}
```

---

## 6. Evaluation Metrics Format (`metrics.json`)

The React frontend includes a dedicated Metrics page displaying AI performance vs standard meteorological baselines (Persistence and Optical Flow).

### 6.1 Storage Location
Save in `apps/api/data/metrics.json`.

### 6.2 Schema
```json
{
  "is_placeholder": false,
  "dataset": "SEVIR (held-out test set, 120 storm events)",
  "lead_minutes": [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  "csi": {
    "persistence":  [0.62, 0.49, 0.38, 0.30, 0.24, 0.19, 0.15, 0.12, 0.10, 0.08, 0.07, 0.06],
    "optical_flow": [0.70, 0.58, 0.48, 0.40, 0.33, 0.27, 0.22, 0.18, 0.15, 0.12, 0.10, 0.08],
    "model":        [0.78, 0.71, 0.64, 0.58, 0.52, 0.47, 0.42, 0.38, 0.34, 0.31, 0.28, 0.25]
  },
  "pod": {
    "persistence":  [0.65, 0.52, 0.41, 0.33, 0.27, 0.22, 0.18, 0.15, 0.12, 0.10, 0.09, 0.08],
    "optical_flow": [0.74, 0.63, 0.53, 0.45, 0.38, 0.32, 0.27, 0.23, 0.19, 0.16, 0.14, 0.12],
    "model":        [0.82, 0.76, 0.70, 0.65, 0.60, 0.55, 0.51, 0.47, 0.43, 0.40, 0.37, 0.34]
  },
  "far": {
    "persistence":  [0.25, 0.32, 0.39, 0.45, 0.51, 0.56, 0.61, 0.65, 0.69, 0.72, 0.75, 0.77],
    "optical_flow": [0.20, 0.27, 0.33, 0.38, 0.43, 0.48, 0.52, 0.56, 0.59, 0.62, 0.65, 0.67],
    "model":        [0.12, 0.16, 0.20, 0.24, 0.28, 0.31, 0.34, 0.37, 0.40, 0.43, 0.45, 0.47]
  },
  "lightning": {
    "pod": 0.81,
    "far": 0.22,
    "csi": 0.66,
    "brier": 0.084
  }
}
```

*Note:* If the real model evaluation numbers are still running, set `"is_placeholder": true`. The UI will display a tag informing judges that these are provisional benchmarks.

---

## 7. Handover Checklist & Timeline

### Milestone 1: Interface Agreement (Day 1)
- [x] Both teammates review this contract.
- [ ] ML teammate confirms input/output dimensions and names.
- [ ] Aritra implements backend skeleton and mock advection engine.

### Milestone 2: Dummy ONNX Model Dry Run (Day 1 - 2)
- [ ] ML teammate exports an untrained/dummy model with the exact contract shape.
- [ ] Aritra drops it into `models/nowcast.onnx` and tests `MODEL_BACKEND=onnx`.
- [ ] Confirms inference pipeline, colormap rendering, and timing badge run end-to-end.

### Milestone 3: Real Event Data & Benchmarks (Day 2)
- [ ] ML teammate delivers at least 1 real event (`evt_001.npz` + `evt_001.json`).
- [ ] ML teammate delivers real or provisional `metrics.json`.
- [ ] Aritra verifies replay on the MapLibre dashboard with time slider.

### Milestone 4: Final Trained Model Delivery & Polish (Day 2 - 3)
- [ ] ML teammate delivers final trained `nowcast.onnx` that passes `verify_onnx.py`.
- [ ] Joint rehearsal of the 7-step demo flow (acceptance test in Section 11 of PRD).
- [ ] Final hackathon presentation readiness.
