# StormSense Model Directory

This directory is where your ML teammate drops the trained ONNX model file.

## Expected File
`models/nowcast.onnx`

## Activation
In `.env` or your environment variables, set:
```bash
MODEL_BACKEND=onnx
```

If `MODEL_BACKEND=mock` (the default), StormSense runs using the built-in physics-based optical flow and advection simulation engine.

## Specification Checklist
Before copying `nowcast.onnx` here, ensure it passes the verification script in `ML_HANDOFF.md`:
- **Input Node:** `frames` with shape `[1, 39, 128, 128]`, `float32`, values `0.0` to `1.0`.
- **Output Nodes:**
  - `vil`: shape `[1, 12, 128, 128]`, `float32`, values `0.0` to `1.0`.
  - `lightning`: shape `[1, 12, 128, 128]`, `float32`, raw logits.
- **Provider:** CPU (`CPUExecutionProvider`).

For detailed instructions and the `verify_onnx.py` script, read [ML_HANDOFF.md](../ML_HANDOFF.md).
