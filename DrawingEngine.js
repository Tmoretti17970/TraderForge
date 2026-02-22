// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — DrawingEngine
// State machine for drawing tool interactions.
//
// States:
//   IDLE     → No tool active, click selects/deselects drawings
//   CREATING → Tool active, clicking places anchor points
//   SELECTED → A drawing is selected, can drag anchors or delete
//   DRAGGING → An anchor point is being dragged
//   MOVING   → Entire drawing is being moved
//
// The engine does NOT render — it manages data and emits events.
// Rendering is handled by DrawingRenderer (separate file).
// ═══════════════════════════════════════════════════════════════════

import {
  createDrawing,
  TOOL_POINT_COUNT,
} from './DrawingModel.js';

/** Interaction states */
const STATE = {
  IDLE: 'idle',
  CREATING: 'creating',
  SELECTED: 'selected',
  DRAGGING: 'dragging',
  MOVING: 'moving',
};

/** Hit-test distance threshold in CSS pixels */
const HIT_THRESHOLD = 8;
const ANCHOR_RADIUS = 5;

/**
 * Create a DrawingEngine instance.
 *
 * @param {Object} [options]
 * @param {(drawings: Drawing[]) => void} [options.onChange] - Called when drawings change
 * @param {(state: string) => void} [options.onStateChange] - Called when interaction state changes
 * @returns {Object} DrawingEngine
 */
export function createDrawingEngine(options = {}) {
  const { onChange, onStateChange } = options;

  // ── State ──
  /** @type {import('./DrawingModel.js').Drawing[]} */
  let drawings = [];
  let interactionState = STATE.IDLE;
  let activeTool = null;         // Current tool type being created
  let activeDrawing = null;      // Drawing currently being created or edited
  let selectedDrawingId = null;  // ID of selected drawing
  let dragAnchorIdx = -1;        // Index of anchor being dragged
  let dragStartPrice = 0;        // Start price for whole-drawing moves
  let dragStartTime = 0;         // Start time for whole-drawing moves
  let dragPointOffsets = [];     // Offsets for whole-drawing moves

  // Coordinate converters (set by the chart engine)
  let pixelToPrice = null;       // (y) => price
  let pixelToTime = null;        // (x) => time
  let priceToPixel = null;       // (price) => y
  let timeToPixel = null;        // (time) => x

  function emit() {
    if (onChange) onChange([...drawings]);
  }

  function emitState() {
    if (onStateChange) onStateChange(interactionState);
  }

  function setState(newState) {
    interactionState = newState;
    emitState();
  }


  // ═══════════════════════════════════════════════════════════════
  // Coordinate Conversion
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update coordinate converters. Called by ChartEngine on every
   * viewport change (scroll, zoom, resize).
   */
  function setCoordinateConverters(converters) {
    pixelToPrice = converters.pixelToPrice;
    pixelToTime = converters.pixelToTime;
    priceToPixel = converters.priceToPixel;
    timeToPixel = converters.timeToPixel;
  }

  /**
   * Convert a drawing anchor point to pixel coordinates.
   * @param {import('./DrawingModel.js').AnchorPoint} point
   * @returns {{x: number, y: number}|null}
   */
  function anchorToPixel(point) {
    if (!priceToPixel || !timeToPixel) return null;
    return {
      x: timeToPixel(point.time),
      y: priceToPixel(point.price),
    };
  }

  /**
   * Convert pixel coordinates to a drawing anchor point.
   * @param {number} x - CSS pixel X
   * @param {number} y - CSS pixel Y
   * @returns {import('./DrawingModel.js').AnchorPoint}
   */
  function pixelToAnchor(x, y) {
    return {
      price: pixelToPrice ? pixelToPrice(y) : 0,
      time: pixelToTime ? pixelToTime(x) : Date.now(),
    };
  }


  // ═══════════════════════════════════════════════════════════════
  // Hit Testing
  // ═══════════════════════════════════════════════════════════════

  /**
   * Test if a pixel coordinate hits a drawing.
   * Returns the drawing and optionally which anchor point was hit.
   *
   * @param {number} x - CSS pixel X
   * @param {number} y - CSS pixel Y
   * @returns {{drawing: Drawing, anchorIdx: number}|null}
   */
  function hitTest(x, y) {
    // Test in reverse order (topmost first)
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (!d.visible || d.state === 'creating') continue;

      // Test anchor points first (higher priority)
      for (let j = 0; j < d.points.length; j++) {
        const px = anchorToPixel(d.points[j]);
        if (!px) continue;
        const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
        if (dist <= ANCHOR_RADIUS + 2) {
          return { drawing: d, anchorIdx: j };
        }
      }

      // Test the drawing body
      if (hitTestDrawing(d, x, y)) {
        return { drawing: d, anchorIdx: -1 };
      }
    }
    return null;
  }

  /**
   * Hit-test a specific drawing's body (lines, rects, etc).
   */
  function hitTestDrawing(drawing, x, y) {
    const points = drawing.points.map(p => anchorToPixel(p)).filter(Boolean);
    if (points.length === 0) return false;

    switch (drawing.type) {
      case 'trendline':
      case 'ray':
      case 'extendedline':
        return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD;

      case 'hray':
      case 'hline':
        return points.length >= 1 && Math.abs(y - points[0].y) < HIT_THRESHOLD;

      case 'crossline':
        return points.length >= 1 && (Math.abs(y - points[0].y) < HIT_THRESHOLD || Math.abs(x - points[0].x) < HIT_THRESHOLD);

      case 'fib':
        if (points.length < 2) return false;
        // Hit test fib region (between the two price levels)
        const minY = Math.min(points[0].y, points[1].y);
        const maxY = Math.max(points[0].y, points[1].y);
        return y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD;

      case 'rect':
        if (points.length < 2) return false;
        const left = Math.min(points[0].x, points[1].x);
        const right = Math.max(points[0].x, points[1].x);
        const top = Math.min(points[0].y, points[1].y);
        const bottom = Math.max(points[0].y, points[1].y);
        // Hit on edge or inside
        return x >= left - HIT_THRESHOLD && x <= right + HIT_THRESHOLD &&
               y >= top - HIT_THRESHOLD && y <= bottom + HIT_THRESHOLD;

      case 'channel':
        if (points.length < 2) return false;
        return distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD * 3;

      default:
        return false;
    }
  }

  /**
   * Distance from point to line segment.
   */
  function distToSegment(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);

    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }


  // ═══════════════════════════════════════════════════════════════
  // Mouse Event Handlers
  // ═══════════════════════════════════════════════════════════════

  /**
   * Handle mouse down / click.
   * @param {number} x - CSS pixel X
   * @param {number} y - CSS pixel Y
   * @returns {boolean} True if the event was consumed (don't scroll)
   */
  function onMouseDown(x, y) {
    if (interactionState === STATE.CREATING) {
      // Place next anchor point
      const anchor = pixelToAnchor(x, y);
      activeDrawing.points.push(anchor);

      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;

      if (activeDrawing.points.length >= neededPoints) {
        // Drawing complete
        activeDrawing.state = 'idle';
        activeDrawing = null;
        activeTool = null;
        setState(STATE.IDLE);
      }

      emit();
      return true;
    }

    // Hit test
    const hit = hitTest(x, y);

    if (hit) {
      selectedDrawingId = hit.drawing.id;
      drawings.forEach(d => d.state = d.id === selectedDrawingId ? 'selected' : 'idle');

      if (hit.anchorIdx >= 0 && !hit.drawing.locked) {
        // Start dragging anchor
        dragAnchorIdx = hit.anchorIdx;
        setState(STATE.DRAGGING);
      } else if (!hit.drawing.locked) {
        // Start moving entire drawing
        const anchor = pixelToAnchor(x, y);
        dragStartPrice = anchor.price;
        dragStartTime = anchor.time;
        dragPointOffsets = hit.drawing.points.map(p => ({
          dPrice: p.price - anchor.price,
          dTime: p.time - anchor.time,
        }));
        setState(STATE.MOVING);
      } else {
        setState(STATE.SELECTED);
      }

      emit();
      return true;
    }

    // Click on empty space — deselect
    if (selectedDrawingId) {
      selectedDrawingId = null;
      drawings.forEach(d => d.state = 'idle');
      setState(STATE.IDLE);
      emit();
    }

    return false;
  }

  /**
   * Handle mouse move.
   * @param {number} x
   * @param {number} y
   * @returns {boolean} True if consumed
   */
  function onMouseMove(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing) {
      // Update the "ghost" point (last point follows cursor)
      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      const anchor = pixelToAnchor(x, y);

      if (activeDrawing.points.length > 0 && activeDrawing.points.length < neededPoints) {
        // Replace or add temporary preview point
        if (activeDrawing.points.length === activeDrawing._confirmedPoints) {
          activeDrawing.points.push(anchor);
        } else {
          activeDrawing.points[activeDrawing.points.length - 1] = anchor;
        }
        emit();
      }
      return true;
    }

    if (interactionState === STATE.DRAGGING && selectedDrawingId) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing && dragAnchorIdx >= 0) {
        drawing.points[dragAnchorIdx] = pixelToAnchor(x, y);
        emit();
      }
      return true;
    }

    if (interactionState === STATE.MOVING && selectedDrawingId) {
      const drawing = drawings.find(d => d.id === selectedDrawingId);
      if (drawing) {
        const anchor = pixelToAnchor(x, y);
        for (let i = 0; i < drawing.points.length; i++) {
          drawing.points[i] = {
            price: anchor.price + dragPointOffsets[i].dPrice,
            time: anchor.time + dragPointOffsets[i].dTime,
          };
        }
        emit();
      }
      return true;
    }

    return false;
  }

  /**
   * Handle mouse up.
   * @returns {boolean}
   */
  function onMouseUp() {
    if (interactionState === STATE.DRAGGING || interactionState === STATE.MOVING) {
      setState(selectedDrawingId ? STATE.SELECTED : STATE.IDLE);
      dragAnchorIdx = -1;
      emit();
      return true;
    }
    return false;
  }

  /**
   * Handle keyboard events.
   * @param {string} key
   * @returns {boolean}
   */
  function onKeyDown(key) {
    if (key === 'Escape') {
      if (interactionState === STATE.CREATING && activeDrawing) {
        // Cancel current drawing
        drawings = drawings.filter(d => d.id !== activeDrawing.id);
        activeDrawing = null;
        activeTool = null;
        setState(STATE.IDLE);
        emit();
        return true;
      }
      if (selectedDrawingId) {
        selectedDrawingId = null;
        drawings.forEach(d => d.state = 'idle');
        setState(STATE.IDLE);
        emit();
        return true;
      }
    }

    if ((key === 'Delete' || key === 'Backspace') && selectedDrawingId) {
      drawings = drawings.filter(d => d.id !== selectedDrawingId);
      selectedDrawingId = null;
      setState(STATE.IDLE);
      emit();
      return true;
    }

    return false;
  }


  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  return {
    // ── Coordinate setup ──
    setCoordinateConverters,

    // ── Tool activation ──

    /**
     * Activate a drawing tool. Next click starts placing points.
     * @param {string} toolType - 'trendline', 'fib', 'hray', etc.
     * @param {Object} [styleOverrides] - Custom style
     */
    activateTool(toolType, styleOverrides = {}) {
      // Cancel any in-progress drawing
      if (activeDrawing) {
        drawings = drawings.filter(d => d.id !== activeDrawing.id);
      }

      activeTool = toolType;
      activeDrawing = createDrawing(toolType, null, styleOverrides);
      activeDrawing._confirmedPoints = 0;
      drawings.push(activeDrawing);

      // Deselect everything
      selectedDrawingId = null;
      drawings.forEach(d => { if (d !== activeDrawing) d.state = 'idle'; });

      setState(STATE.CREATING);
      emit();
    },

    /** Cancel the current tool */
    cancelTool() {
      if (activeDrawing) {
        drawings = drawings.filter(d => d.id !== activeDrawing.id);
        activeDrawing = null;
        activeTool = null;
      }
      setState(STATE.IDLE);
      emit();
    },

    /** Get the active tool type (or null) */
    get activeTool() { return activeTool; },

    // ── Event handlers ──
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onKeyDown,

    // ── Drawing management ──

    /** Get all drawings */
    get drawings() { return drawings; },

    /** Get selected drawing */
    get selectedDrawing() {
      return selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;
    },

    /** Get interaction state */
    get state() { return interactionState; },

    /**
     * Add a pre-built drawing (from deserialization).
     * @param {Drawing} drawing
     */
    addDrawing(drawing) {
      drawing.state = 'idle';
      drawings.push(drawing);
      emit();
    },

    /**
     * Remove a drawing by ID.
     * @param {string} id
     */
    removeDrawing(id) {
      drawings = drawings.filter(d => d.id !== id);
      if (selectedDrawingId === id) {
        selectedDrawingId = null;
        setState(STATE.IDLE);
      }
      emit();
    },

    /** Remove all drawings */
    clearAll() {
      drawings = [];
      selectedDrawingId = null;
      activeDrawing = null;
      activeTool = null;
      setState(STATE.IDLE);
      emit();
    },

    /** Toggle visibility of a drawing */
    toggleVisibility(id) {
      const d = drawings.find(d => d.id === id);
      if (d) { d.visible = !d.visible; emit(); }
    },

    /** Toggle lock on a drawing */
    toggleLock(id) {
      const d = drawings.find(d => d.id === id);
      if (d) { d.locked = !d.locked; emit(); }
    },

    /** Update a drawing's style */
    updateStyle(id, style) {
      const d = drawings.find(d => d.id === id);
      if (d) { Object.assign(d.style, style); emit(); }
    },

    /** Load drawings from serialized data */
    loadDrawings(drawingArray) {
      drawings = drawingArray.map(d => ({ ...d, state: 'idle' }));
      selectedDrawingId = null;
      setState(STATE.IDLE);
      emit();
    },

    /** Convert a pixel position to anchor (exposed for renderer) */
    pixelToAnchor,
    anchorToPixel,

    /** Dispose */
    dispose() {
      drawings = [];
      activeDrawing = null;
      activeTool = null;
      selectedDrawingId = null;
    },
  };
}
