import json
from pathlib import Path
import numpy as np

def generate_event(event_id: str, title: str, description: str, start_time: str, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    n_frames = 49
    h, w = 128, 128
    
    # Coordinate grids
    y, x = np.ogrid[:h, :w]
    
    vil_frames = np.zeros((n_frames, h, w), dtype=np.float32)
    ir_frames = np.zeros((n_frames, h, w), dtype=np.float32)
    lght_frames = np.zeros((n_frames, h, w), dtype=np.float32)
    
    # Storm cells parameterization for Nor'wester realistic trajectory
    # Moving generally from West-Southwest towards East-Northeast
    if event_id == "evt_001":
        # Event 1: Major severe storm cell crossing Hooghly, Howrah, Kolkata into North 24 Parganas
        cells = [
            {"x0": 25.0, "y0": 85.0, "vx": 1.4, "vy": -1.1, "sigma": 9.0, "peak_frame": 24, "max_val": 0.95},
            {"x0": 15.0, "y0": 95.0, "vx": 1.6, "vy": -1.0, "sigma": 7.0, "peak_frame": 28, "max_val": 0.85},
            {"x0": 45.0, "y0": 60.0, "vx": 1.1, "vy": -0.8, "sigma": 6.0, "peak_frame": 18, "max_val": 0.65}
        ]
    else:
        # Event 2: Scattered convective line across Bankura & Bardhaman drifting southeast
        cells = [
            {"x0": 20.0, "y0": 35.0, "vx": 1.2, "vy": 0.8, "sigma": 8.0, "peak_frame": 22, "max_val": 0.88},
            {"x0": 30.0, "y0": 55.0, "vx": 1.0, "vy": 0.7, "sigma": 7.5, "peak_frame": 26, "max_val": 0.78},
            {"x0": 65.0, "y0": 70.0, "vx": 0.9, "vy": 0.5, "sigma": 6.5, "peak_frame": 32, "max_val": 0.72}
        ]
        
    for t in range(n_frames):
        vil_t = np.zeros((h, w), dtype=np.float32)
        
        for cell in cells:
            cx = cell["x0"] + cell["vx"] * t
            cy = cell["y0"] + cell["vy"] * t
            
            # Growth and decay curve: peaked at peak_frame
            time_dist = abs(t - cell["peak_frame"])
            intensity = cell["max_val"] * np.exp(- (time_dist ** 2) / (2 * 12.0 ** 2))
            current_sigma = cell["sigma"] * (1.0 + 0.3 * np.sin(t / 8.0))
            
            # Gaussian blob
            blob = intensity * np.exp(- ((x - cx) ** 2 + (y - cy) ** 2) / (2 * current_sigma ** 2))
            vil_t = np.maximum(vil_t, blob)
            
        # Add smooth turbulence
        turb = 0.05 * np.sin(x / 5.0 + t / 4.0) * np.cos(y / 5.0 - t / 4.0)
        vil_t = np.clip(vil_t + turb, 0.0, 1.0)
        vil_frames[t] = vil_t
        
        # IR: colder cloud tops in strong convective areas (low IR temp ~ cold)
        # Background warm ~ 0.85, storm core cold ~ 0.15
        ir_t = 0.85 - 0.70 * (vil_t ** 1.3)
        ir_frames[t] = np.clip(ir_t, 0.0, 1.0)
        
        # Lightning: high probability / flash counts concentrated where VIL > 0.45
        lght_mask = (vil_t > 0.40).astype(np.float32)
        lght_intensity = (vil_t ** 2.2) * lght_mask * (0.8 + 0.2 * np.random.RandomState(t * 101).rand(h, w))
        lght_frames[t] = np.clip(lght_intensity, 0.0, 1.0)

    # Scale to uint8 (0..255)
    vil_uint8 = (vil_frames * 255.0).astype(np.uint8)
    ir_uint8 = (ir_frames * 255.0).astype(np.uint8)
    lght_uint8 = (lght_frames * 255.0).astype(np.uint8)
    
    npz_path = output_dir / f"{event_id}.npz"
    np.savez_compressed(npz_path, vil=vil_uint8, ir=ir_uint8, lght=lght_uint8)
    
    meta = {
        "id": event_id,
        "title": title,
        "description": description,
        "n_frames": n_frames,
        "frame_step_min": 5,
        "bounds": {"west": 86.6, "south": 20.85, "east": 90.1, "north": 24.29},
        "start_time_utc": start_time
    }
    
    json_path = output_dir / f"{event_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        
    print(f"Generated {event_id}: {npz_path.name} ({npz_path.stat().st_size} bytes), {json_path.name}")

if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent.parent / "data" / "events"
    generate_event(
        event_id="evt_001",
        title="Nor'wester demo event (Kolkata corridor)",
        description="Severe convective event crossing Hooghly, Howrah, and Kolkata, replay",
        start_time="2019-07-10T09:00:00Z",
        output_dir=out_dir
    )
    generate_event(
        event_id="evt_002",
        title="Scattered convective storms (South Bengal)",
        description="Developing multicellular storm cells across Bardhaman and Bankura, replay",
        start_time="2020-05-18T14:30:00Z",
        output_dir=out_dir
    )
