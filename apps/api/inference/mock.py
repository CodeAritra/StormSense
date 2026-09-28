import time
import numpy as np
from .base import Nowcaster

try:
    from scipy.ndimage import shift as nd_shift, gaussian_filter
except ImportError:
    # Pure numpy fallback for shift and gaussian filter if scipy is missing
    def nd_shift(arr, shift_vals, mode="nearest"):
        sy, sx = int(round(shift_vals[0])), int(round(shift_vals[1]))
        res = np.zeros_like(arr)
        h, w = arr.shape
        src_y1 = max(0, -sy)
        src_y2 = min(h, h - sy)
        src_x1 = max(0, -sx)
        src_x2 = min(w, w - sx)
        dst_y1 = max(0, sy)
        dst_y2 = min(h, h + sy)
        dst_x1 = max(0, sx)
        dst_x2 = min(w, w + sx)
        if src_y2 > src_y1 and src_x2 > src_x1 and dst_y2 > dst_y1 and dst_x2 > dst_x1:
            res[dst_y1:dst_y2, dst_x1:dst_x2] = arr[src_y1:src_y2, src_x1:src_x2]
        return res

    def gaussian_filter(arr, sigma):
        # Simple box blur approximation
        k = max(1, int(round(sigma * 2)))
        pad = np.pad(arr, k, mode="edge")
        out = np.zeros_like(arr)
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                out += pad[k + dy : k + dy + arr.shape[0], k + dx : k + dx + arr.shape[1]]
        return out / ((2 * k + 1) ** 2)

class MockNowcaster(Nowcaster):
    """
    Demo-quality physics-based advection mock nowcaster.
    Uses phase correlation to estimate storm motion, advects VIL forward 12 lead steps,
    applies growth/decay and increasing uncertainty blur, and derives lightning probability.
    """
    def predict(self, vil: np.ndarray, ir: np.ndarray, lght: np.ndarray) -> dict:
        start_time = time.perf_counter()
        
        # vil shape: [13, 128, 128]
        last_vil = vil[-1]
        prev_vil = vil[-2] if len(vil) > 1 else last_vil
        last_ir = ir[-1] if len(ir) > 0 else np.full_like(last_vil, 0.5)
        
        h, w = last_vil.shape
        
        # Estimate motion vector (dy, dx) via phase correlation
        try:
            fa = np.fft.fft2(prev_vil)
            fb = np.fft.fft2(last_vil)
            cross_power = (fb * np.conj(fa)) / (np.abs(fb * np.conj(fa)) + 1e-7)
            corr = np.real(np.fft.ifft2(cross_power))
            
            y_max, x_max = np.unravel_index(np.argmax(corr), corr.shape)
            dy = y_max if y_max < h // 2 else y_max - h
            dx = x_max if x_max < w // 2 else x_max - w
            
            # Bound velocity to realistic meteorological displacement (e.g. -4 to +4 pixels per 5m)
            dy = max(-4.0, min(4.0, float(dy)))
            dx = max(-4.0, min(4.0, float(dx)))
            
            # Default to realistic Bengal Nor'wester vector (northeast drift) if motion estimate is near zero
            if abs(dy) < 0.2 and abs(dx) < 0.2:
                dy, dx = -1.1, 1.4
        except Exception:
            dy, dx = -1.1, 1.4
            
        vil_preds = np.zeros((12, h, w), dtype=np.float32)
        lght_preds = np.zeros((12, h, w), dtype=np.float32)
        
        for k in range(12):
            lead_step = k + 1
            # Advect forward
            shift_y = dy * lead_step
            shift_x = dx * lead_step
            advected = nd_shift(last_vil, (shift_y, shift_x), mode="nearest")
            
            # Growth in strong core (VIL > 0.4), decay in margins
            core_mask = advected > 0.40
            growth = np.where(core_mask, 1.0 + 0.012 * lead_step, 1.0 - 0.015 * lead_step)
            modified = np.clip(advected * growth, 0.0, 1.0)
            
            # Gaussian blur increases with lead time (uncertainty widening)
            sigma = 0.5 + 0.22 * lead_step
            blurred_vil = np.clip(gaussian_filter(modified, sigma=sigma), 0.0, 1.0)
            vil_preds[k] = blurred_vil
            
            # Lightning probability = sigmoid(8 * (vil - 0.45)) + cold IR cloud factor
            logit = 8.0 * (blurred_vil - 0.45)
            p_vil = 1.0 / (1.0 + np.exp(-logit))
            
            # Cold IR cloud contribution (lower IR temperature = higher convective cloud top)
            ir_coldness = np.clip((0.65 - last_ir) / 0.5, 0.0, 1.0)
            # Advect IR coldness slightly too
            advected_ir = nd_shift(ir_coldness, (shift_y * 0.8, shift_x * 0.8), mode="nearest")
            
            p_combined = 0.70 * p_vil + 0.30 * advected_ir
            p_combined = np.where(blurred_vil < 0.25, 0.0, p_combined)
            
            # Add spatial dispersion for lightning with lead time
            p_lght = np.clip(gaussian_filter(p_combined, sigma=0.6 + 0.15 * lead_step), 0.0, 1.0)
            lght_preds[k] = p_lght
            
        inference_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        return {
            "vil": vil_preds,
            "lightning": lght_preds,
            "explain": {
                "radar": 0.55,
                "satellite": 0.25,
                "lightning": 0.20
            },  # placeholder until real model provides attribution
            "inference_ms": inference_ms
        }
