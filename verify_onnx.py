import time
import sys
from pathlib import Path
import numpy as np

try:
    import onnxruntime as ort
except ImportError:
    print("Error: 'onnxruntime' is not installed. Run: pip install onnxruntime")
    sys.exit(1)

model_path = Path("models/nowcast.onnx")

if not model_path.exists():
    print(f"\n[ERROR] Model file not found at: {model_path.resolve()}")
    print("Please copy your ONNX file to: models/nowcast.onnx\n")
    sys.exit(1)

print(f"\n[1/3] Loading ONNX model from: {model_path} ({model_path.stat().st_size / (1024*1024):.2f} MB)...")
try:
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
except Exception as e:
    print(f"[FAIL] Could not load model: {e}")
    sys.exit(1)

# Check inputs
inputs = session.get_inputs()
print(f"\n[2/3] Inspecting Model Inputs ({len(inputs)} input nodes):")
for inp in inputs:
    print(f"  - Name: '{inp.name}', Shape: {inp.shape}, Type: {inp.type}")

# Check outputs
outputs = session.get_outputs()
print(f"\n[3/3] Inspecting Model Outputs ({len(outputs)} output nodes):")
out_names = []
for out in outputs:
    print(f"  - Name: '{out.name}', Shape: {out.shape}, Type: {out.type}")
    out_names.append(out.name)

# Run test inference
print("\n[TEST] Running dummy inference with shape [1, 39, 128, 128]...")
dummy_input = np.random.rand(1, 39, 128, 128).astype(np.float32)
input_name = inputs[0].name

start_t = time.perf_counter()
res = session.run(None, {input_name: dummy_input})
elapsed_ms = (time.perf_counter() - start_t) * 1000

print(f"[SUCCESS] Inference executed in {elapsed_ms:.1f} ms!")
for i, arr in enumerate(res):
    name = out_names[i] if i < len(out_names) else f"output_{i}"
    print(f"  - Output '{name}': Shape {arr.shape}, Range [{arr.min():.3f}, {arr.max():.3f}]")

print("\nAll checks completed! The model is ready to use with StormSense.")
