// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — PaneWidget
// Dual-canvas architecture per TradingView's Lightweight Charts.
//
// DOM structure per pane:
//   <div class="tf-pane">          ← position: relative container
//     <canvas class="tf-main">     ← z-index: 0, candlesticks/grid/indicators
//     <canvas class="tf-top">      ← z-index: 1, crosshair/tooltip/rubber-band
//   </div>
//
// The main canvas ONLY redraws when:
//   - Data changes (new bar, historical load)
//   - Viewport changes (scroll, zoom, resize)
//   - Indicator add/remove/update
//   - Drawing committed
//
// The top canvas redraws on EVERY mouse move (crosshair only).
// This eliminates the #1 performance problem in the old codebase.
// ═══════════════════════════════════════════════════════════════════

import { createFancyCanvas } from './FancyCanvas.js';

/**
 * @typedef {Object} PaneWidgetOptions
 * @property {number}  [minHeight=80]  - Minimum pane height in CSS px
 * @property {boolean} [isMainPane=false] - Is this the main price pane?
 */

/**
 * Create a PaneWidget with dual-canvas architecture.
 *
 * @param {HTMLElement} container - Parent DOM element
 * @param {PaneWidgetOptions} [options={}]
 * @returns {Object} PaneWidget instance
 */
export function createPaneWidget(container, options = {}) {
  const { minHeight = 80, isMainPane = false } = options;

  // ── Create DOM structure ──
  const paneEl = document.createElement('div');
  paneEl.className = 'tf-pane';
  paneEl.style.position = 'relative';
  paneEl.style.overflow = 'hidden';
  paneEl.style.width = '100%';
  paneEl.style.height = '100%';
  paneEl.style.minHeight = minHeight + 'px';
  container.appendChild(paneEl);

  // ── Create dual canvases ──
  // Main canvas: expensive renders (candles, grid, indicators, committed drawings)
  const mainCanvas = createFancyCanvas(paneEl, { zIndex: 0 });

  // Top canvas: cheap renders (crosshair, tooltip, rubber-band drawing preview)
  const topCanvas = createFancyCanvas(paneEl, { zIndex: 1 });

  // ── Dirty flags ──
  // The batch rendering model: events set dirty flags, actual rendering
  // happens once per requestAnimationFrame when flags are checked.
  let mainDirty = true;
  let topDirty = true;
  let disposed = false;

  // ── Renderer registrations ──
  /** @type {Array<(ctx: CanvasRenderingContext2D, size: any) => void>} */
  const mainRenderers = [];

  /** @type {Array<(ctx: CanvasRenderingContext2D, size: any) => void>} */
  const topRenderers = [];

  // ── Size sync ──
  // When either canvas resizes, mark both as dirty
  mainCanvas.setResizeCallback(() => {
    mainDirty = true;
    topDirty = true;
  });

  // ── Public API ──

  return {
    /** The pane container DOM element */
    get element() { return paneEl; },

    /** Main canvas (candles, grid, indicators) */
    get mainCanvas() { return mainCanvas; },

    /** Top canvas (crosshair, tooltips) */
    get topCanvas() { return topCanvas; },

    /** Whether this is the main price pane */
    get isMainPane() { return isMainPane; },

    /** Current size info */
    get size() { return mainCanvas.size; },

    // ── Dirty flag management ──

    /** Mark the main canvas as needing redraw */
    invalidateMain() {
      mainDirty = true;
    },

    /** Mark the top canvas as needing redraw */
    invalidateTop() {
      topDirty = true;
    },

    /** Mark both canvases as needing redraw */
    invalidateAll() {
      mainDirty = true;
      topDirty = true;
    },

    /** Check if main canvas needs redraw */
    get isMainDirty() { return mainDirty; },

    /** Check if top canvas needs redraw */
    get isTopDirty() { return topDirty; },

    // ── Renderer registration ──

    /**
     * Register a renderer for the main canvas.
     * Renderers are called in order during paint.
     *
     * @param {(ctx: CanvasRenderingContext2D, size: any) => void} renderer
     * @returns {() => void} Unregister function
     */
    addMainRenderer(renderer) {
      mainRenderers.push(renderer);
      mainDirty = true;
      return () => {
        const idx = mainRenderers.indexOf(renderer);
        if (idx !== -1) {
          mainRenderers.splice(idx, 1);
          mainDirty = true;
        }
      };
    },

    /**
     * Register a renderer for the top canvas (crosshair, etc).
     *
     * @param {(ctx: CanvasRenderingContext2D, size: any) => void} renderer
     * @returns {() => void} Unregister function
     */
    addTopRenderer(renderer) {
      topRenderers.push(renderer);
      topDirty = true;
      return () => {
        const idx = topRenderers.indexOf(renderer);
        if (idx !== -1) {
          topRenderers.splice(idx, 1);
          topDirty = true;
        }
      };
    },

    // ── Paint cycle ──

    /**
     * Paint the main canvas if dirty.
     * Called by ChartEngine on each requestAnimationFrame.
     * Returns true if painting occurred (for perf metrics).
     */
    paintMain() {
      if (!mainDirty || disposed) return false;
      mainDirty = false;

      mainCanvas.clear();
      const size = mainCanvas.size;

      for (let i = 0; i < mainRenderers.length; i++) {
        mainCanvas.draw(mainRenderers[i]);
      }

      return true;
    },

    /**
     * Paint the top canvas if dirty.
     * This is the fast path — only crosshair and overlays.
     * Called by ChartEngine on mouse move or animation tick.
     * Returns true if painting occurred.
     */
    paintTop() {
      if (!topDirty || disposed) return false;
      topDirty = false;

      topCanvas.clear();
      const size = topCanvas.size;

      for (let i = 0; i < topRenderers.length; i++) {
        topCanvas.draw(topRenderers[i]);
      }

      return true;
    },

    /**
     * Paint both canvases if dirty.
     * Primary method called from the render loop.
     */
    paint() {
      const didMain = this.paintMain();
      const didTop = this.paintTop();
      return didMain || didTop;
    },

    // ── Cleanup ──

    /**
     * Dispose: remove DOM, disconnect observers, free canvas memory.
     */
    dispose() {
      if (disposed) return;
      disposed = true;

      mainRenderers.length = 0;
      topRenderers.length = 0;

      mainCanvas.dispose();
      topCanvas.dispose();

      if (paneEl.parentElement) {
        paneEl.parentElement.removeChild(paneEl);
      }
    },
  };
}
