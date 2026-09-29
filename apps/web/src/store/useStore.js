import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Events
  events: [],
  selectedEventId: 'evt_001',
  setEvents: (events) => set({ events }),
  setSelectedEventId: (id) => set({ selectedEventId: id }),

  // Replay
  replayState: {
    event_id: 'evt_001',
    playing: false,
    speed: 1.0,
    current_index: 12,
    n_frames: 49,
    max_index: 36,
  },
  setReplayState: (replayState) => set({ replayState }),

  // Timeline / Lead slider
  // leadIndex: -1 means "Now", 0..11 means +5m..+60m
  leadIndex: 0,
  isForecastAnimating: false,
  setLeadIndex: (updaterOrVal) =>
    set((state) => {
      const next = typeof updaterOrVal === 'function' ? updaterOrVal(state.leadIndex) : updaterOrVal;
      const safeNum = Number.isFinite(next) ? next : 0;
      return { leadIndex: Math.min(11, Math.max(-1, safeNum)) };
    }),
  setIsForecastAnimating: (isForecastAnimating) => set({ isForecastAnimating }),

  // Forecast & Overlays
  forecast: null,
  isLoadingForecast: false,
  forecastError: null,
  setForecast: (forecast) => set({ forecast, isLoadingForecast: false, forecastError: null }),
  setIsLoadingForecast: (isLoadingForecast) => set({ isLoadingForecast }),
  setForecastError: (error) => set({ forecastError: error, isLoadingForecast: false }),

  // Alerts
  alerts: [],
  setAlerts: (alerts) => set({ alerts }),
  activeModalAlert: null,
  setActiveModalAlert: (alert) => set({ activeModalAlert: alert }),

  // Layer Controls
  layerVisibility: {
    radarNow: true,
    predictedRadar: true,
    lightningRisk: true,
    actualRadar: false,
    districts: true,
    stormCells: true,
  },
  setLayerVisibility: (layer, visible) =>
    set((state) => ({
      layerVisibility: { ...state.layerVisibility, [layer]: visible },
    })),
  toggleLayer: (layer) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layer]: !state.layerVisibility[layer],
      },
    })),

  // Comparison & Opacity
  compareWithActual: false,
  setCompareWithActual: (val) => set({ compareWithActual: val }),
  compareBlend: 0.5,
  setCompareBlend: (val) => set({ compareBlend: val }),
  overlayOpacity: 0.85,
  setOverlayOpacity: (val) => set({ overlayOpacity: val }),

  // Map Navigation & Interaction
  flyToLocation: null,
  setFlyToLocation: (loc) => set({ flyToLocation: loc }),
  selectedStormCell: null,
  setSelectedStormCell: (cell) => set({ selectedStormCell: cell }),

  // Feedback Summary
  feedbackSummary: { total: 0, hit: 0, miss: 0, false_alarm: 0, hit_rate: 0.0 },
  setFeedbackSummary: (summary) => set({ feedbackSummary: summary }),

  // Navigation (Dashboard vs Metrics)
  currentPage: 'dashboard', // 'dashboard' | 'metrics'
  setCurrentPage: (page) => set({ currentPage: page }),
}));
