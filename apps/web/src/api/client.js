const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(url, options = {}) {
  const fullUrl = `${API_BASE}${url}`;
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Network error');
    throw new Error(`API Error ${res.status}: ${errorText}`);
  }
  return res.json();
}

export const api = {
  getHealth: () => request('/api/health'),
  getEvents: () => request('/api/events'),
  
  // Replay controls
  startReplay: (eventId, speed = 1.0, startIndex = 12) =>
    request('/api/replay/start', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, speed, start_index: startIndex }),
    }),
  pauseReplay: () => request('/api/replay/pause', { method: 'POST' }),
  resumeReplay: () => request('/api/replay/resume', { method: 'POST' }),
  seekReplay: (index) =>
    request('/api/replay/seek', {
      method: 'POST',
      body: JSON.stringify({ index }),
    }),
  getReplayState: () => request('/api/replay/state'),

  // Forecast & Overlays
  getForecast: (eventId, index) =>
    request(`/api/forecast?event_id=${encodeURIComponent(eventId)}&index=${index}`),
    
  // Alerts
  getAlerts: (eventId, index) =>
    request(`/api/alerts?event_id=${encodeURIComponent(eventId)}&index=${index}`),
  approveAlert: (alertId) =>
    request(`/api/alerts/${encodeURIComponent(alertId)}/approve`, { method: 'POST' }),
  getAlertsHistory: () => request('/api/alerts/history'),
  getCapXmlUrl: (alertId) => `${API_BASE}/api/alerts/${encodeURIComponent(alertId)}/cap.xml`,

  // Feedback loop
  submitFeedback: (alertId, outcome, note = '') =>
    request('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ alert_id: alertId, outcome, note }),
    }),
  getFeedbackSummary: () => request('/api/feedback/summary'),

  // Metrics & Districts
  getMetrics: () => request('/api/metrics'),
  getDistricts: () => request('/api/districts'),

  // Overlay URL helper - prepends API_BASE for Docker / standalone builds
  getOverlayUrl: (relativePath) => {
    if (!relativePath) return '';
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;
    return `${API_BASE}${relativePath}`;
  },

  // WebSocket connection helper
  createReplayWebSocket: (onMessage, onError) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_API_URL 
      ? new URL(import.meta.env.VITE_API_URL).host 
      : window.location.host;
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws/replay`;

    let ws = null;
    let reconnectTimeout = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (e) {
            console.error('WS parse error:', e);
          }
        };
        ws.onerror = (e) => {
          if (onError) onError(e);
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 2000);
        };
      } catch (err) {
        if (onError) onError(err);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }
};
