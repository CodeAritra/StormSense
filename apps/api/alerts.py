import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from .models import Alert, Bounds
from .config import DISTRICTS_FILE, ALERT_MIN_PROB
from .db import get_stored_status, save_alert

# Severity dictionaries for i18n
SEVERITY_MAP = {
    "watch": {"en": "WATCH", "bn": "সতর্কতা", "hi": "निगरानी", "cap": "Minor"},
    "warning": {"en": "WARNING", "bn": "সতর্কবার্তা", "hi": "चेतावनी", "cap": "Moderate"},
    "severe": {"en": "SEVERE WARNING", "bn": "তীব্র সতর্কতা", "hi": "गंभीर चेतावनी", "cap": "Severe"}
}

def load_districts() -> List[Dict[str, Any]]:
    if not DISTRICTS_FILE.exists():
        return []
    try:
        with open(DISTRICTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("features", [])
    except Exception:
        return []

def get_district_pixel_bounds(geom_coords, bounds: Bounds, grid_size: int = 128) -> Tuple[int, int, int, int]:
    """Computes pixel bounding box for a district polygon or multipolygon."""
    pts = []
    def _recurse(c):
        if len(c) == 2 and isinstance(c[0], (int, float)) and isinstance(c[1], (int, float)):
            pts.append(c)
        else:
            for item in c:
                _recurse(item)
    _recurse(geom_coords)
    
    if not pts:
        return 0, 0, 0, 0

    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    
    # Grid mapping: x is lon (west -> east), y is lat (north -> south)
    x1 = int(np.clip(((min_lon - bounds.west) / (bounds.east - bounds.west)) * grid_size, 0, grid_size - 1))
    x2 = int(np.clip(((max_lon - bounds.west) / (bounds.east - bounds.west)) * grid_size, 0, grid_size - 1))
    
    y1 = int(np.clip(((bounds.north - max_lat) / (bounds.north - bounds.south)) * grid_size, 0, grid_size - 1))
    y2 = int(np.clip(((bounds.north - min_lat) / (bounds.north - bounds.south)) * grid_size, 0, grid_size - 1))
    
    return min(y1, y2), max(y1, y2) + 1, min(x1, x2), max(x1, x2) + 1

def generate_multilingual_messages(district_props: dict, severity: str, eta_min: int) -> Dict[str, str]:
    sev = SEVERITY_MAP.get(severity, SEVERITY_MAP["watch"])
    name_en = district_props.get("name_en", "District")
    name_bn = district_props.get("name_bn", "জেলা")
    name_hi = district_props.get("name_hi", "जिला")
    
    msg_en = f"LIGHTNING {sev['en']}: {name_en} in about {eta_min} min. Stay indoors, avoid open fields, trees and water. - IMD"
    msg_bn = f"বজ্রপাত {sev['bn']}: {name_bn}, প্রায় {eta_min} মিনিটের মধ্যে। ঘরে থাকুন, খোলা মাঠ, গাছ ও জল থেকে দূরে থাকুন। - IMD"
    msg_hi = f"बिजली {sev['hi']}: {name_hi}, लगभग {eta_min} मिनट में। घर के अंदर रहें, खुले मैदान, पेड़ और पानी से दूर रहें। - IMD"
    
    return {
        "en": msg_en,
        "bn": msg_bn,
        "hi": msg_hi
    }

def compute_alerts(
    event_id: str,
    index: int,
    lght_preds: np.ndarray,  # [12, 128, 128]
    vil_preds: np.ndarray,   # [12, 128, 128]
    bounds: Bounds
) -> List[Alert]:
    districts = load_districts()
    lead_minutes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]
    alerts: List[Alert] = []
    
    for feat in districts:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        if not coords:
            continue
            
        dist_id = props.get("id", "unknown")
        dist_name = props.get("name_en", "District")
        
        y1, y2, x1, x2 = get_district_pixel_bounds(coords, bounds)
        if y2 <= y1 or x2 <= x1:
            continue
            
        dist_lght = lght_preds[:, y1:y2, x1:x2]
        dist_vil = vil_preds[:, y1:y2, x1:x2]
        
        # Max probability across all 12 lead frames
        max_prob_per_lead = np.max(dist_lght, axis=(1, 2))
        overall_peak_prob = float(np.max(max_prob_per_lead))
        overall_peak_vil = float(np.max(dist_vil))
        
        if overall_peak_prob >= ALERT_MIN_PROB:
            # First lead frame where threshold is breached
            exceeding_indices = np.where(max_prob_per_lead >= ALERT_MIN_PROB)[0]
            first_idx = int(exceeding_indices[0]) if len(exceeding_indices) > 0 else 0
            eta_min = lead_minutes[first_idx]
            
            # Severity classification
            if overall_peak_prob >= 0.80 or overall_peak_vil >= 0.70:
                severity = "severe"
            elif overall_peak_prob >= 0.60 or overall_peak_vil >= 0.45:
                severity = "warning"
            else:
                severity = "watch"
                
            alert_id = f"{event_id}-{index}-{dist_id}"
            
            # Check SQLite status (if approved earlier)
            stored_status = get_stored_status(alert_id)
            current_status = stored_status if stored_status else "proposed"
            
            messages = generate_multilingual_messages(props, severity, eta_min)
            
            alert = Alert(
                id=alert_id,
                district_id=dist_id,
                district_name=dist_name,
                severity=severity,
                eta_min=eta_min,
                peak_prob=round(overall_peak_prob, 2),
                peak_vil=round(overall_peak_vil, 2),
                status=current_status,
                messages=messages
            )
            # Store proposed alert in DB
            save_alert(alert, event_id, index)
            alerts.append(alert)
            
    # Sort alerts: severe first, then warning, then watch; then by ETA ascending
    severity_rank = {"severe": 0, "warning": 1, "watch": 2}
    alerts.sort(key=lambda a: (severity_rank.get(a.severity, 3), a.eta_min))
    return alerts

def compute_district_severities(
    lght_preds: np.ndarray,  # [12, 128, 128]
    vil_preds: np.ndarray,   # [12, 128, 128]
    vil_now: np.ndarray,     # [128, 128]
    bounds: Bounds
) -> Dict[str, Any]:
    """
    Computes per-district warning severity for T0 (now) and for each of the 12 forecast lead steps.
    """
    districts = load_districts()
    now_map = {}
    leads_maps = [{} for _ in range(12)]
    
    for feat in districts:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        if not coords:
            continue
            
        dist_id = props.get("id", "unknown")
        y1, y2, x1, x2 = get_district_pixel_bounds(coords, bounds)
        if y2 <= y1 or x2 <= x1:
            now_map[dist_id] = "normal"
            for k in range(12):
                leads_maps[k][dist_id] = "normal"
            continue
            
        # T0 Now evaluation
        now_patch = vil_now[y1:y2, x1:x2]
        max_now_vil = float(np.max(now_patch)) if now_patch.size > 0 else 0.0
        if max_now_vil >= 0.65:
            now_map[dist_id] = "severe"
        elif max_now_vil >= 0.40:
            now_map[dist_id] = "warning"
        elif max_now_vil >= 0.18:
            now_map[dist_id] = "watch"
        else:
            now_map[dist_id] = "normal"
            
        # 12 Forecast Lead steps
        dist_lght = lght_preds[:, y1:y2, x1:x2]
        dist_vil = vil_preds[:, y1:y2, x1:x2]
        
        for k in range(12):
            lght_k = float(np.max(dist_lght[k])) if dist_lght[k].size > 0 else 0.0
            vil_k = float(np.max(dist_vil[k])) if dist_vil[k].size > 0 else 0.0
            
            if lght_k >= 0.65 or vil_k >= 0.60:
                leads_maps[k][dist_id] = "severe"
            elif lght_k >= 0.38 or vil_k >= 0.35:
                leads_maps[k][dist_id] = "warning"
            elif lght_k >= 0.15 or vil_k >= 0.18:
                leads_maps[k][dist_id] = "watch"
            else:
                leads_maps[k][dist_id] = "normal"
                
    return {
        "now": now_map,
        "leads": leads_maps
    }

def build_cap_xml(alert_dict: dict) -> str:
    """Constructs valid Common Alerting Protocol (CAP 1.2) XML."""
    ns = "urn:oasis:names:tc:emergency:cap:1.2"
    root = ET.Element("alert", xmlns=ns)
    
    alert_id = alert_dict.get("id", "alert_001")
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    
    ET.SubElement(root, "identifier").text = f"IN-IMD-STORMSENSE-{alert_id}"
    ET.SubElement(root, "sender").text = "nowcasting@imd.gov.in"
    ET.SubElement(root, "sent").text = now_utc
    ET.SubElement(root, "status").text = "Exercise"
    ET.SubElement(root, "msgType").text = "Alert"
    ET.SubElement(root, "scope").text = "Public"
    
    severity_key = alert_dict.get("severity", "watch")
    sev_info = SEVERITY_MAP.get(severity_key, SEVERITY_MAP["watch"])
    cap_severity = sev_info["cap"]
    
    msgs = alert_dict.get("messages", {})
    dist_name = alert_dict.get("district_name", "District")
    eta_min = alert_dict.get("eta_min", 15)
    
    langs = [
        ("en-IN", "en", f"Severe Thunderstorm and Lightning Alert for {dist_name}",
         f"High probability convective storm approaching {dist_name}. ETA approximately {eta_min} minutes.",
         "Seek immediate shelter in a sturdy building. Avoid open fields, elevated areas, trees, and water bodies."),
        ("bn-IN", "bn", f"{dist_name}-এর জন্য বজ্রপাত ও ঝড়ের সতর্কতা",
         f"{dist_name}-এ তীব্র বজ্রঝড় আসন্ন। প্রায় {eta_min} মিনিটের মধ্যে আঘাত হানতে পারে।",
         "অবিলম্বে নিরাপদ পাকা ভবনে আশ্রয় নিন। খোলা মাঠ, গাছপালা ও জলাশয় থেকে দূরে থাকুন।"),
        ("hi-IN", "hi", f"{dist_name} के लिए आंधी और बिजली गिरने की चेतावनी",
         f"{dist_name} में तेज आंधी और आकाशीय बिजली का खतरा। लगभग {eta_min} मिनट में प्रभाव की संभावना।",
         "तुरंत किसी पक्के मकान में शरण लें। खुले मैदान, पेड़ और पानी से दूर रहें।")
    ]
    
    for lang_code, lang_key, headline, desc, instr in langs:
        info = ET.SubElement(root, "info")
        ET.SubElement(info, "language").text = lang_code
        ET.SubElement(info, "category").text = "Met"
        ET.SubElement(info, "event").text = "Thunderstorm and Lightning"
        ET.SubElement(info, "urgency").text = "Expected"
        ET.SubElement(info, "severity").text = cap_severity
        ET.SubElement(info, "certainty").text = "Observed"
        ET.SubElement(info, "headline").text = headline
        ET.SubElement(info, "description").text = msgs.get(lang_key, desc)
        ET.SubElement(info, "instruction").text = instr
        
        area = ET.SubElement(info, "area")
        ET.SubElement(area, "areaDesc").text = dist_name
        # Circle placeholder: center approx 22.5, 88.3, radius 25km
        ET.SubElement(area, "circle").text = "22.57,88.36,25.0"
        
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="utf-8").decode("utf-8")
