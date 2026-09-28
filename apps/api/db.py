import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from .config import DB_PATH
from .models import Alert

def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            event_id TEXT,
            frame_index INTEGER,
            district_id TEXT,
            district_name TEXT,
            severity TEXT,
            eta_min INTEGER,
            peak_prob REAL,
            peak_vil REAL,
            status TEXT DEFAULT 'proposed',
            messages_json TEXT,
            created_at_utc TEXT,
            approved_at_utc TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id TEXT,
            outcome TEXT,
            note TEXT,
            created_at_utc TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_alert(alert: Alert, event_id: str, frame_index: int):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    messages_json = json.dumps(alert.messages, ensure_ascii=False) if alert.messages else "{}"
    
    cursor.execute("""
        INSERT INTO alerts (
            id, event_id, frame_index, district_id, district_name,
            severity, eta_min, peak_prob, peak_vil, status, messages_json, created_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            severity = excluded.severity,
            eta_min = excluded.eta_min,
            peak_prob = excluded.peak_prob,
            peak_vil = excluded.peak_vil,
            messages_json = excluded.messages_json
        WHERE alerts.status != 'approved'
    """, (
        alert.id, event_id, frame_index, alert.district_id, alert.district_name,
        alert.severity, alert.eta_min, alert.peak_prob, alert.peak_vil,
        alert.status, messages_json, now_str
    ))
    conn.commit()
    conn.close()

def approve_alert(alert_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        UPDATE alerts
        SET status = 'approved', approved_at_utc = ?
        WHERE id = ?
    """, (now_str, alert_id))
    conn.commit()
    
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return _row_to_alert_dict(row)
    return None

def get_alert(alert_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return _row_to_alert_dict(row)
    return None

def get_alerts_history() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM alerts
        WHERE status = 'approved'
        ORDER BY approved_at_utc DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [_row_to_alert_dict(r) for r in rows]

def get_stored_status(alert_id: str) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    return row["status"] if row else None

def add_feedback(alert_id: str, outcome: str, note: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO feedback (alert_id, outcome, note, created_at_utc)
        VALUES (?, ?, ?, ?)
    """, (alert_id, outcome, note, now_str))
    conn.commit()
    conn.close()

def get_feedback_summary() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outcome, COUNT(*) as cnt FROM feedback GROUP BY outcome")
    rows = cursor.fetchall()
    conn.close()
    
    counts = {"hit": 0, "miss": 0, "false_alarm": 0}
    for r in rows:
        outcome = r["outcome"]
        if outcome in counts:
            counts[outcome] = r["cnt"]
            
    total = sum(counts.values())
    hit_rate = round(counts["hit"] / total, 2) if total > 0 else 0.0
    return {
        "total": total,
        "hit": counts["hit"],
        "miss": counts["miss"],
        "false_alarm": counts["false_alarm"],
        "hit_rate": hit_rate
    }

def _row_to_alert_dict(row: sqlite3.Row) -> Dict[str, Any]:
    msgs = {}
    try:
        if row["messages_json"]:
            msgs = json.loads(row["messages_json"])
    except Exception:
        msgs = {}
    return {
        "id": row["id"],
        "district_id": row["district_id"],
        "district_name": row["district_name"],
        "severity": row["severity"],
        "eta_min": row["eta_min"],
        "peak_prob": row["peak_prob"],
        "peak_vil": row["peak_vil"],
        "status": row["status"],
        "messages": msgs,
        "created_at_utc": row["created_at_utc"] if "created_at_utc" in row.keys() else None,
        "approved_at_utc": row["approved_at_utc"] if "approved_at_utc" in row.keys() else None
    }
