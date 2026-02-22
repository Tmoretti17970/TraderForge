// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — FancyCanvas
// HiDPI-aware canvas wrapper inspired by TradingView's fancy-canvas.
//
// Key responsibilities:
//   1. Create canvas at physical device pixel resolution
//   2. Handle devicePixelRatio changes (zoom, display switch)
//   3. Use devicePixelContentBox (ResizeObserver) when available
//   4. Provide bitmap-space drawing context
//   5. Clean disposal to prevent iOS Safari memory issues
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} CanvasSize
 * @property {number} mediaWidth   - Width in CSS pixels
 * @property {number} mediaHeight  - Height in CSS pixels
 * @property {number} bitmapWidth  - Width in physical pixels
 * @property {number} bitmapHeight - Height in physical pixels
 * @property {number} pixelRatio   - Current device pixel ratio
 */

/**
 * Creates and manages an HiDPI-aware canvas element.
 * The canvas buffer is sized at physical pixel dimensions for crispness,
 * then CSS-scaled back down to display size.
 *
 * @param {HTMLElement} container - Parent DOM element
 * @param {Object} [options]
 * @param {string} [options.position='absolute'] - CSS position
 * @param {number} [options.zIndex=0] - CSS z-index
 * @returns {Object} FancyCanvas instance
 */
export function createFancyCanvas(container, options = {}) {
  const { position = 'absolute', zIndex = 0 } = options;

  const canvas = document.createElement('canvas');
  canvas.style.position = position;
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = String(zIndex);
  canvas.style.display = 'block';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d', {
    alpha: true,
    desynchronized: true, // Hint: reduce latency for crosshair canvas
  });

  let mediaWidth = 0;
  let mediaHeight = 0;
  let bitmapWidth = 0;
  let bitmapHeight = 0;
  let pixelRatio = window.devicePixelRatio || 1;
  let disposed = false;

  /** @type {ResizeObserver|null} */
  let resizeObserver = null;

  /** @type {((size: CanvasSize) => void)|null} */
  let onResize = null;

  /**
   * Resize the canvas buffer to match physical pixel dimensions.
   * This is called whenever the container size or pixel ratio changes.
   *
   * @param {number} mw - Media width (CSS pixels)
   * @param {number} mh - Media height (CSS pixels)
   * @param {number} bw - Bitmap width (physical pixels)
   * @param {number} bh - Bitmap height (physical pixels)
   */
  function applySize(mw, mh, bw, bh) {
    if (disposed) return;

    const ratio = bw / (mw || 1);

    // Only resize if dimensions actually changed
    if (bitmapWidth === bw && bitmapHeight === bh && pixelRatio === ratio) return;

    mediaWidth = mw;
    mediaHeight = mh;
    bitmapWidth = bw;
    bitmapHeight = bh;
    pixelRatio = ratio;

    // Set the actual canvas buffer size (physical pixels)
    canvas.width = bw;
    canvas.height = bh;

    // CSS dimensions are set via 100% width/height
    // but we also set explicit pixel values for older browsers
    canvas.style.width = mw + 'px';
    canvas.style.height = mh + 'px';

    if (onResize) {
      onResize({ mediaWidth, mediaHeight, bitmapWidth, bitmapHeight, pixelRatio });
    }
  }

  /**
   * Start observing the container for size changes.
   * Uses devicePixelContentBox when available (true pixel-perfect sizing)
   * Falls back to contentRect * devicePixelRatio.
   */
  function observe() {
    if (disposed) return;

    // Try devicePixelContentBox first (best accuracy)
    let useDevicePixelContentBox = false;

    resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;

      for (const entry of entries) {
        if (entry.target !== container) continue;

        // contentRect gives us CSS dimensions
        const cr = entry.contentRect;
        const mw = Math.max(1, Math.round(cr.width));
        const mh = Math.max(1, Math.round(cr.height));

        let bw, bh;

        if (useDevicePixelContentBox && entry.devicePixelContentBoxSize) {
          // Exact physical pixels — no rounding errors at any zoom
          const dpx = entry.devicePixelContentBoxSize[0];
          bw = dpx.inlineSize;
          bh = dpx.blockSize;
        } else {
          // Fallback: multiply CSS size by pixel ratio
          const ratio = window.devicePixelRatio || 1;
          bw = Math.max(1, Math.round(mw * ratio));
          bh = Math.max(1, Math.round(mh * ratio));
        }

        applySize(mw, mh, bw, bh);
      }
    });

    // Test if devicePixelContentBox is supported
    try {
      resizeObserver.observe(container, { box: ['device-pixel-content-box'] });
      useDevicePixelContentBox = true;
    } catch {
      // Fallback for browsers without devicePixelContentBox
      resizeObserver.observe(container, { box: 'content-box' });
    }
  }

  // Start observing immediately
  observe();

  // ── Public API ──

  return {
    /** The underlying <canvas> DOM element */
    get canvas() { return canvas; },

    /** The 2D rendering context */
    get ctx() { return ctx; },

    /** Current dimensions */
    get size() {
      return { mediaWidth, mediaHeight, bitmapWidth, bitmapHeight, pixelRatio };
    },

    /** Current pixel ratio */
    get pixelRatio() { return pixelRatio; },

    /** Media width in CSS pixels */
    get mediaWidth() { return mediaWidth; },

    /** Media height in CSS pixels */
    get mediaHeight() { return mediaHeight; },

    /** Bitmap width in physical pixels */
    get bitmapWidth() { return bitmapWidth; },

    /** Bitmap height in physical pixels */
    get bitmapHeight() { return bitmapHeight; },

    /**
     * Register a callback for resize events.
     * @param {(size: CanvasSize) => void} callback
     */
    setResizeCallback(callback) {
      onResize = callback;
    },

    /**
     * Clear the entire canvas (in bitmap space).
     */
    clear() {
      if (disposed) return;
      ctx.clearRect(0, 0, bitmapWidth, bitmapHeight);
    },

    /**
     * Execute a drawing function in bitmap coordinate space.
     * The context is pre-configured with the current pixel ratio.
     * All coordinates in the callback should be in BITMAP (physical pixel) space.
     *
     * @param {(ctx: CanvasRenderingContext2D, size: CanvasSize) => void} drawFn
     */
    draw(drawFn) {
      if (disposed) return;
      ctx.save();
      drawFn(ctx, { mediaWidth, mediaHeight, bitmapWidth, bitmapHeight, pixelRatio });
      ctx.restore();
    },

    /**
     * Dispose: remove canvas from DOM, disconnect observer, release memory.
     * Critical for iOS Safari which has a global canvas memory limit.
     */
    dispose() {
      if (disposed) return;
      disposed = true;

      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }

      // Release canvas memory (iOS Safari fix)
      canvas.width = 0;
      canvas.height = 0;

      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }

      onResize = null;
    },
  };
}
