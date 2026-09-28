/**
 * @typedef {Object} Bounds
 * @property {number} west
 * @property {number} south
 * @property {number} east
 * @property {number} north
 */

/**
 * @typedef {Object} EventSummary
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} n_frames
 * @property {number} frame_step_min
 * @property {Bounds} bounds
 * @property {string} start_time_utc
 */

/**
 * @typedef {Object} ReplayState
 * @property {string|null} event_id
 * @property {boolean} playing
 * @property {number} speed
 * @property {number} current_index
 * @property {number} n_frames
 * @property {number} max_index
 */

/**
 * @typedef {Object} StormCell
 * @property {string} id
 * @property {number} lat
 * @property {number} lon
 * @property {number} max_vil
 * @property {number} area_km2
 * @property {number} motion_kmh
 * @property {number} heading_deg
 */

/**
 * @typedef {Object} Timing
 * @property {number} inference_ms
 * @property {number} render_ms
 * @property {number} alert_ms
 * @property {number} total_ms
 */

/**
 * @typedef {Object} ForecastResponse
 * @property {string} event_id
 * @property {number} index
 * @property {string} issued_at_utc
 * @property {number[]} lead_minutes
 * @property {Bounds} bounds
 * @property {Object.<string, string|string[]>} overlays
 * @property {StormCell[]} storm_cells
 * @property {Object.<string, number>} explain
 * @property {Timing} timing
 * @property {string} backend
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} district_id
 * @property {string} district_name
 * @property {('watch'|'warning'|'severe')} severity
 * @property {number} eta_min
 * @property {number} peak_prob
 * @property {number} peak_vil
 * @property {('proposed'|'approved')} status
 * @property {Object.<string, string>} [messages]
 */

export const LEAD_MINUTES = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
