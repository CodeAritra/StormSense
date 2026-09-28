import pytest
import xml.etree.ElementTree as ET
import numpy as np
from fastapi.testclient import TestClient
from apps.api.main import app, run_forecast
from apps.api.alerts import build_cap_xml, compute_alerts
from apps.api.models import Bounds

client = TestClient(app)

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["backend"] in ("mock", "onnx")
    assert "version" in data

def test_events_endpoint():
    res = client.get("/api/events")
    assert res.status_code == 200
    events = res.json()
    assert isinstance(events, list)
    assert len(events) >= 1
    assert "id" in events[0]
    assert "bounds" in events[0]

def test_replay_state_and_controls():
    # Get state
    res = client.get("/api/replay/state")
    assert res.status_code == 200
    state = res.json()
    assert "current_index" in state
    assert "playing" in state

    # Seek
    seek_res = client.post("/api/replay/seek", json={"index": 20})
    assert seek_res.status_code == 200
    assert seek_res.json()["current_index"] == 20

def test_forecast_response_shape():
    res = client.get("/api/forecast?event_id=evt_001&index=24")
    assert res.status_code == 200
    data = res.json()
    assert data["event_id"] == "evt_001"
    assert data["index"] == 24
    assert len(data["lead_minutes"]) == 12
    assert "overlays" in data
    assert len(data["overlays"]["vil_pred"]) == 12
    assert len(data["overlays"]["lightning"]) == 12
    assert "storm_cells" in data
    assert "timing" in data
    assert "inference_ms" in data["timing"]
    assert "total_ms" in data["timing"]

def test_overlay_png_generation():
    res = client.get("/api/overlay/evt_001/24/vil_now/0.png")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 100

    pred_res = client.get("/api/overlay/evt_001/24/vil_pred/0.png")
    assert pred_res.status_code == 200
    assert pred_res.headers["content-type"] == "image/png"

def test_alert_thresholds_and_cap_xml():
    # Test CAP XML generation
    dummy_alert = {
        "id": "evt_001-24-kolkata",
        "district_id": "kolkata",
        "district_name": "Kolkata",
        "severity": "severe",
        "eta_min": 15,
        "peak_prob": 0.88,
        "peak_vil": 0.82,
        "status": "proposed",
        "messages": {
            "en": "LIGHTNING SEVERE: Kolkata in about 15 min.",
            "bn": "বজ্রপাত তীব্র সতর্কতা: কলকাতা",
            "hi": "बिजली गंभीर चेतावनी: कोलकाता"
        }
    }
    xml_str = build_cap_xml(dummy_alert)
    assert xml_str.startswith('<?xml version="1.0" encoding="UTF-8"?>')
    root = ET.fromstring(xml_str.replace('<?xml version="1.0" encoding="UTF-8"?>', ''))
    assert "alert" in root.tag
    
    # Check info blocks for 3 languages
    info_nodes = [child for child in root if "info" in child.tag]
    assert len(info_nodes) == 3

def test_feedback_endpoint():
    res = client.post("/api/feedback", json={
        "alert_id": "evt_001-24-kolkata",
        "outcome": "hit",
        "note": "Accurate prediction during rehearsal"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "recorded"

    sum_res = client.get("/api/feedback/summary")
    assert sum_res.status_code == 200
    assert sum_res.json()["hit"] >= 1
