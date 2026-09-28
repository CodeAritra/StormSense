import math
import struct
import zipfile
from pathlib import Path

def create_npy_bytes(shape, data_bytes, dtype_str="|u1"):
    # NumPy 1.0 format
    magic = b"\x93NUMPY\x01\x00"
    header_dict = f"{{'descr': '{dtype_str}', 'fortran_order': False, 'shape': {tuple(shape)}, }}\n"
    # Pad so total prefix (10 bytes magic+version+len + len(header)) is a multiple of 64
    current_len = 10 + len(header_dict.encode("latin1"))
    pad_len = (64 - (current_len % 64)) % 64
    header_str = header_dict[:-1] + (" " * pad_len) + "\n"
    header_bytes = header_str.encode("latin1")
    header_len = struct.pack("<H", len(header_bytes))
    return magic + header_len + header_bytes + data_bytes

def generate_npz_event(event_id: str, output_path: Path):
    n_frames = 49
    h, w = 128, 128
    
    if event_id == "evt_001":
        cells = [
            {"x0": 25.0, "y0": 85.0, "vx": 1.4, "vy": -1.1, "sigma": 9.0, "peak": 24, "val": 0.95},
            {"x0": 15.0, "y0": 95.0, "vx": 1.6, "vy": -1.0, "sigma": 7.0, "peak": 28, "val": 0.85},
            {"x0": 45.0, "y0": 60.0, "vx": 1.1, "vy": -0.8, "sigma": 6.0, "peak": 18, "val": 0.65}
        ]
    else:
        cells = [
            {"x0": 20.0, "y0": 35.0, "vx": 1.2, "vy": 0.8, "sigma": 8.0, "peak": 22, "val": 0.88},
            {"x0": 30.0, "y0": 55.0, "vx": 1.0, "vy": 0.7, "sigma": 7.5, "peak": 26, "val": 0.78},
            {"x0": 65.0, "y0": 70.0, "vx": 0.9, "vy": 0.5, "sigma": 6.5, "peak": 32, "val": 0.72}
        ]
        
    vil_byte_list = bytearray(n_frames * h * w)
    ir_byte_list = bytearray(n_frames * h * w)
    lght_byte_list = bytearray(n_frames * h * w)
    
    idx = 0
    for t in range(n_frames):
        for y in range(h):
            for x in range(w):
                v_max = 0.0
                for c in cells:
                    cx = c["x0"] + c["vx"] * t
                    cy = c["y0"] + c["vy"] * t
                    dt = abs(t - c["peak"])
                    time_factor = math.exp(- (dt * dt) / (2.0 * 144.0))
                    sig = c["sigma"] * (1.0 + 0.25 * math.sin(t / 8.0))
                    dx = x - cx
                    dy = y - cy
                    dist_sq = dx * dx + dy * dy
                    val = c["val"] * time_factor * math.exp(- dist_sq / (2.0 * sig * sig))
                    if val > v_max:
                        v_max = val
                        
                # Add slight turbulence
                turb = 0.04 * math.sin(x / 5.0 + t / 4.0) * math.cos(y / 5.0 - t / 4.0)
                vil_val = max(0.0, min(1.0, v_max + turb))
                
                # IR coldness
                ir_val = max(0.0, min(1.0, 0.85 - 0.70 * (vil_val ** 1.3)))
                
                # Lightning
                if vil_val > 0.40:
                    lght_val = min(1.0, (vil_val ** 2.2) * 1.1)
                else:
                    lght_val = 0.0
                    
                vil_byte_list[idx] = int(vil_val * 255.0)
                ir_byte_list[idx] = int(ir_val * 255.0)
                lght_byte_list[idx] = int(lght_val * 255.0)
                idx += 1
                
    vil_npy = create_npy_bytes((n_frames, h, w), bytes(vil_byte_list))
    ir_npy = create_npy_bytes((n_frames, h, w), bytes(ir_byte_list))
    lght_npy = create_npy_bytes((n_frames, h, w), bytes(lght_byte_list))
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("vil.npy", vil_npy)
        zf.writestr("ir.npy", ir_npy)
        zf.writestr("lght.npy", lght_npy)
        
    print(f"Generated {output_path.name}: {output_path.stat().st_size} bytes")

if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent.parent / "data" / "events"
    generate_npz_event("evt_001", out_dir / "evt_001.npz")
    generate_npz_event("evt_002", out_dir / "evt_002.npz")
