// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Drawing Model
// All drawings are stored as price/time anchor points, NOT pixels.
// This means they survive zoom, scroll, resize, and serialization.
//
// Every drawing has:
//   - id: unique identifier
//   - type: tool type (trendline, fib, hray, etc.)
//   - points: array of {price, time} anchor points
//   - style: visual properties (color, width, etc.)
//   - state: interaction state (idle, creating, selected, dragging)
// ═══════════════════════════════════════════════════════════════════

let idCounter = 0;

/**
 * Generate a unique drawing ID.
 * @returns {string}
 */
export function generateId() {
  return `draw_${Date.now()}_${++idCounter}`;
}

/**
 * @typedef {Object} AnchorPoint
 * @property {number} price - Price value
 * @property {number} time  - Unix timestamp (ms)
 */

/**
 * @typedef {Object} DrawingStyle
 * @property {string}  color       - Primary color
 * @property {number}  lineWidth   - Line width in CSS pixels
 * @property {number[]} [dash]     - Dash pattern (empty = solid)
 * @property {string}  [fillColor] - Fill color (for shapes)
 * @property {number}  [opacity]   - Fill opacity (0-1)
 * @property {boolean} [showLabel] - Show price/% labels
 * @property {string}  [font]      - Label font
 */

/**
 * @typedef {Object} Drawing
 * @property {string}       id
 * @property {string}       type      - Tool type
 * @property {AnchorPoint[]} points   - Anchor points in price/time space
 * @property {DrawingStyle}  style    - Visual properties
 * @property {string}       state     - 'idle' | 'creating' | 'selected'
 * @property {boolean}      locked    - Prevent editing
 * @property {boolean}      visible   - Show/hide toggle
 * @property {Object}       [meta]    - Tool-specific metadata
 */

/** Default style for each tool type */
export const DEFAULT_STYLES = {
  trendline: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
  },
  hray: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
  },
  hline: {
    color: '#787B86',
    lineWidth: 1,
    dash: [6, 4],
    showLabel: true,
  },
  ray: {
    color: '#2962FF',
    lineWidth: 2,
    dash: [],
    showLabel: false,
  },
  extendedline: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    showLabel: false,
  },
  fib: {
    color: '#787B86',
    lineWidth: 1,
    dash: [],
    showLabel: true,
    opacity: 0.08,
  },
  rect: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.1)',
    opacity: 0.1,
  },
  channel: {
    color: '#2962FF',
    lineWidth: 1,
    dash: [],
    fillColor: 'rgba(41, 98, 255, 0.05)',
  },
  crossline: {
    color: '#787B86',
    lineWidth: 1,
    dash: [4, 4],
    showLabel: true,
  },
};

/** Fibonacci retracement levels (TradingView defaults) */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

/** Fibonacci level colors */
export const FIB_COLORS = {
  0:     '#787B86',
  0.236: '#F44336',
  0.382: '#FF9800',
  0.5:   '#FFEB3B',
  0.618: '#4CAF50',
  0.786: '#00BCD4',
  1:     '#787B86',
  1.618: '#2196F3',
  2.618: '#9C27B0',
};

/** Tool configuration: how many anchor points each tool needs */
export const TOOL_POINT_COUNT = {
  trendline: 2,
  hray: 1,       // 1 point (price only, extends infinitely)
  hline: 1,      // 1 point (horizontal line across chart)
  ray: 2,        // 2 points (extends from p1 through p2)
  extendedline: 2, // 2 points (extends both directions)
  fib: 2,        // 2 points (start + end of range)
  rect: 2,       // 2 points (opposite corners)
  channel: 3,    // 3 points (2 for baseline + 1 for width)
  crossline: 1,  // 1 point (vertical + horizontal cross)
};

/**
 * Create a new drawing object.
 *
 * @param {string} type - Tool type
 * @param {AnchorPoint} [firstPoint] - Optional first anchor point
 * @param {Partial<DrawingStyle>} [styleOverrides] - Custom style
 * @returns {Drawing}
 */
export function createDrawing(type, firstPoint, styleOverrides = {}) {
  const defaultStyle = DEFAULT_STYLES[type] || DEFAULT_STYLES.trendline;

  return {
    id: generateId(),
    type,
    points: firstPoint ? [{ ...firstPoint }] : [],
    style: { ...defaultStyle, ...styleOverrides },
    state: 'creating',
    locked: false,
    visible: true,
    meta: {},
  };
}

/**
 * Serialize drawings for persistence (IndexedDB / localStorage).
 *
 * @param {Drawing[]} drawings
 * @returns {string} JSON string
 */
export function serializeDrawings(drawings) {
  return JSON.stringify(drawings.map(d => ({
    id: d.id,
    type: d.type,
    points: d.points,
    style: d.style,
    locked: d.locked,
    visible: d.visible,
    meta: d.meta,
  })));
}

/**
 * Deserialize drawings from storage.
 *
 * @param {string} json
 * @returns {Drawing[]}
 */
export function deserializeDrawings(json) {
  try {
    const arr = JSON.parse(json);
    return arr.map(d => ({
      ...d,
      state: 'idle',
    }));
  } catch {
    return [];
  }
}
