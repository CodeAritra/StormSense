import time
from pathlib import Path
import numpy as np
from .base import Nowcaster

class OnnxNowcaster(Nowcaster):
    def __init__(self, model_path: Path):
        self.model_path = Path(model_path)
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"ONNX model file not found at: {self.model_path}. "
                "Ensure your teammate dropped 'nowcast.onnx' into /models or switch MODEL_BACKEND=mock in .env."
            )
        try:
            import onnxruntime as ort
        except ImportError:
            raise ImportError("onnxruntime is required for OnnxNowcaster. Install it via pip install onnxruntime.")
            
        # Initialize session once with CPU provider
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 4
        self.session = ort.InferenceSession(
            str(self.model_path),
            sess_options=opts,
            providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [o.name for o in self.session.get_outputs()]

    def predict(self, vil: np.ndarray, ir: np.ndarray, lght: np.ndarray) -> dict:
        start_time = time.perf_counter()
        
        # Concatenate 13 VIL + 13 IR + 13 Lightning -> [39, 128, 128]
        # Add batch dimension -> [1, 39, 128, 128]
        stacked = np.concatenate([vil, ir, lght], axis=0).astype(np.float32)
        batch_input = np.expand_dims(stacked, axis=0)
        
        outputs = self.session.run(None, {self.input_name: batch_input})
        
        # Parse outputs by node name or position
        out_dict = {}
        for name, arr in zip(self.output_names, outputs):
            out_dict[name] = arr
            
        vil_out = out_dict.get("vil", outputs[0])
        lght_out = out_dict.get("lightning", outputs[1] if len(outputs) > 1 else outputs[0])
        
        # Squeeze batch dimension if present
        if vil_out.ndim == 4 and vil_out.shape[0] == 1:
            vil_out = vil_out[0]
        if lght_out.ndim == 4 and lght_out.shape[0] == 1:
            lght_out = lght_out[0]
            
        # Sigmoid on raw lightning logits (if not already probability)
        if np.max(lght_out) > 1.0 or np.min(lght_out) < 0.0:
            lght_prob = 1.0 / (1.0 + np.exp(- np.clip(lght_out, -15.0, 15.0)))
        else:
            lght_prob = lght_out
        
        inference_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        return {
            "vil": np.clip(vil_out, 0.0, 1.0),
            "lightning": np.clip(lght_prob, 0.0, 1.0),
            "explain": {
                "radar": 0.58,
                "satellite": 0.24,
                "lightning": 0.18
            },
            "inference_ms": inference_ms
        }
