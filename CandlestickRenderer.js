// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Candlestick Renderer
// Pixel-perfect OHLCV candlestick rendering in bitmap coordinate space.
//
// Every position is Math.round(). Every width is Math.floor().
// No sub-pixel rendering. No blur. No anti-aliasing artifacts.
//
// Color scheme matches TradingView defaults:
//   Up (bullish):   #26A69A (teal)
//   Down (bearish): #EF5350 (coral red)
// ═══════════════════════════════════════════════════════════════════

import {
  mediaToBitmap,
  positionsBox,
  positionsLine,
  candleBodyWidth,
} from '../CoordinateSystem.js';

/**
 * @typedef {Object} CandleTheme
 * @property {string} upColor      - Fill color for bullish candles
 * @property {string} downColor    - Fill color for bearish candles
 * @property {string} upWickColor  - Wick color for bullish candles
 * @property {string} downWickColor - Wick color for bearish candles
 * @property {boolean} [fillBody=true] - Fill the body (vs outline only)
 */

/** TradingView default dark theme */
export const DEFAULT_CANDLE_THEME = {
  upColor: '#26A69A',
  downColor: '#EF5350',
  upWickColor: '#26A69A',
  downWickColor: '#EF5350',
  fillBody: true,
};

/**
 * Create a candlestick renderer that draws OHLCV bars onto a canvas.
 *
 * @param {CandleTheme} [theme] - Color theme
 * @returns {Object} Renderer with a draw() method
 */
export function createCandlestickRenderer(theme = DEFAULT_CANDLE_THEME) {
  let currentTheme = { ...theme };

  return {
    /**
     * Update the color theme.
     * @param {Partial<CandleTheme>} newTheme
     */
    setTheme(newTheme) {
      Object.assign(currentTheme, newTheme);
    },

    /**
     * Draw candlesticks onto the canvas context.
     * ALL coordinates are computed in bitmap space for pixel-perfection.
     *
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {Object} params
     * @param {Array<{open:number, high:number, low:number, close:number}>} params.bars - Visible OHLCV bars
     * @param {number} params.startIdx       - Index of first visible bar in full dataset
     * @param {number} params.barSpacing     - CSS pixels per bar
     * @param {number} params.firstVisibleIdx - Index offset for X positioning
     * @param {(price: number) => number} params.priceToY - Price → CSS Y transform
     * @param {number} params.pixelRatio     - Device pixel ratio
     * @param {number} params.bitmapWidth    - Canvas width in physical pixels
     * @param {number} params.bitmapHeight   - Canvas height in physical pixels
     */
    draw(ctx, {
      bars,
      startIdx,
      barSpacing,
      firstVisibleIdx,
      priceToY,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    }) {
      if (!bars || bars.length === 0) return;

      const bodyWidth = candleBodyWidth(barSpacing);
      const wickWidthMedia = 1; // Always 1 CSS pixel

      // Pre-calculate bitmap wick width (same for all candles)
      const wickBitmap = Math.max(1, Math.round(wickWidthMedia * pixelRatio));

      // Batch bullish and bearish draws separately to minimize ctx state changes.
      // Two passes: first wicks (lines), then bodies (filled rects).
      // This reduces fillStyle switches from 2N to 4.

      // ── Pass 1: All wicks ──
      for (let pass = 0; pass < 2; pass++) {
        const isBull = pass === 0;
        ctx.fillStyle = isBull ? currentTheme.upWickColor : currentTheme.downWickColor;

        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          const bull = bar.close >= bar.open;
          if (bull !== isBull) continue;

          // X center in CSS pixels
          const barIdx = startIdx + i;
          const xMedia = (barIdx - firstVisibleIdx + 0.5) * barSpacing;

          // Wick: vertical line from high to low
          const highY = mediaToBitmap(priceToY(bar.high), pixelRatio);
          const lowY = mediaToBitmap(priceToY(bar.low), pixelRatio);

          // Pixel-perfect wick position
          const wick = positionsLine(xMedia, wickWidthMedia, pixelRatio);
          const wickHeight = Math.max(1, lowY - highY);

          ctx.fillRect(wick.position, highY, wick.length, wickHeight);
        }
      }

      // ── Pass 2: All bodies ──
      for (let pass = 0; pass < 2; pass++) {
        const isBull = pass === 0;
        ctx.fillStyle = isBull ? currentTheme.upColor : currentTheme.downColor;

        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          const bull = bar.close >= bar.open;
          if (bull !== isBull) continue;

          const barIdx = startIdx + i;
          const xMedia = (barIdx - firstVisibleIdx + 0.5) * barSpacing;

          // Body: rectangle from open to close
          const openY = mediaToBitmap(priceToY(bar.open), pixelRatio);
          const closeY = mediaToBitmap(priceToY(bar.close), pixelRatio);

          const bodyTop = Math.min(openY, closeY);
          const bodyBot = Math.max(openY, closeY);
          const bodyHeight = Math.max(1, bodyBot - bodyTop); // Min 1px body

          // Pixel-perfect body position
          const body = positionsBox(xMedia, bodyWidth, pixelRatio);

          if (currentTheme.fillBody) {
            ctx.fillRect(body.position, bodyTop, body.length, bodyHeight);
          } else {
            // Outline only (hollow candles)
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = wickBitmap;
            ctx.strokeRect(
              body.position + 0.5 * wickBitmap,
              bodyTop + 0.5 * wickBitmap,
              body.length - wickBitmap,
              bodyHeight - wickBitmap
            );
          }
        }
      }
    },
  };
}


// ═══════════════════════════════════════════════════════════════════
// Heikin-Ashi Candlestick Renderer
// Same rendering logic, different data transformation.
// ═══════════════════════════════════════════════════════════════════

/**
 * Convert standard OHLCV bars to Heikin-Ashi bars.
 * HA Close = (O + H + L + C) / 4
 * HA Open  = (prev HA Open + prev HA Close) / 2
 * HA High  = max(H, HA Open, HA Close)
 * HA Low   = min(L, HA Open, HA Close)
 *
 * @param {Array<{open:number, high:number, low:number, close:number, volume?:number, time?:number}>} bars
 * @returns {Array<{open:number, high:number, low:number, close:number, volume?:number, time?:number}>}
 */
export function toHeikinAshi(bars) {
  if (!bars || bars.length === 0) return [];

  const ha = new Array(bars.length);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;

    let haOpen;
    if (i === 0) {
      haOpen = (bar.open + bar.close) / 2;
    } else {
      haOpen = (ha[i - 1].open + ha[i - 1].close) / 2;
    }

    ha[i] = {
      open: haOpen,
      high: Math.max(bar.high, haOpen, haClose),
      low: Math.min(bar.low, haOpen, haClose),
      close: haClose,
      volume: bar.volume,
      time: bar.time,
    };
  }

  return ha;
}


// ═══════════════════════════════════════════════════════════════════
// Line Chart Renderer
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a line chart renderer (close price only).
 *
 * @param {Object} [options]
 * @param {string} [options.color='#2962FF']    - Line color
 * @param {number} [options.lineWidth=2]        - Line width in CSS pixels
 * @param {string} [options.areaTopColor]       - Gradient top (if area fill)
 * @param {string} [options.areaBottomColor]    - Gradient bottom (if area fill)
 * @returns {Object} Renderer with a draw() method
 */
export function createLineRenderer(options = {}) {
  const {
    color = '#2962FF',
    lineWidth = 2,
    areaTopColor = null,
    areaBottomColor = null,
  } = options;

  return {
    draw(ctx, {
      bars,
      startIdx,
      barSpacing,
      firstVisibleIdx,
      priceToY,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    }) {
      if (!bars || bars.length < 2) return;

      const bitmapLineWidth = Math.max(1, Math.round(lineWidth * pixelRatio));

      ctx.lineWidth = bitmapLineWidth;
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Build path
      ctx.beginPath();
      let firstX = 0, firstY = 0;

      for (let i = 0; i < bars.length; i++) {
        const barIdx = startIdx + i;
        const xMedia = (barIdx - firstVisibleIdx + 0.5) * barSpacing;
        const x = Math.round(xMedia * pixelRatio);
        const y = Math.round(priceToY(bars[i].close) * pixelRatio);

        if (i === 0) {
          ctx.moveTo(x, y);
          firstX = x;
          firstY = y;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Area fill (gradient below the line)
      if (areaTopColor && areaBottomColor) {
        const lastIdx = bars.length - 1;
        const lastBarIdx = startIdx + lastIdx;
        const lastXMedia = (lastBarIdx - firstVisibleIdx + 0.5) * barSpacing;
        const lastX = Math.round(lastXMedia * pixelRatio);

        // Continue path down to bottom, back to start
        ctx.lineTo(lastX, bitmapHeight);
        ctx.lineTo(firstX, bitmapHeight);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, bitmapHeight);
        gradient.addColorStop(0, areaTopColor);
        gradient.addColorStop(1, areaBottomColor);

        ctx.fillStyle = gradient;
        ctx.fill();
      }
    },
  };
}


// ═══════════════════════════════════════════════════════════════════
// Volume Histogram Renderer
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a volume histogram renderer.
 *
 * @param {Object} [options]
 * @param {string} [options.upColor='#26A69A80']   - Bullish volume color
 * @param {string} [options.downColor='#EF535080'] - Bearish volume color
 * @returns {Object} Renderer
 */
export function createVolumeRenderer(options = {}) {
  const {
    upColor = '#26A69A80',
    downColor = '#EF535080',
  } = options;

  return {
    draw(ctx, {
      bars,
      startIdx,
      barSpacing,
      firstVisibleIdx,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    }) {
      if (!bars || bars.length === 0) return;

      // Find max volume for scaling
      let maxVol = 0;
      for (let i = 0; i < bars.length; i++) {
        const v = bars[i].volume || 0;
        if (v > maxVol) maxVol = v;
      }
      if (maxVol === 0) return;

      const bodyWidth = Math.max(1, Math.floor(barSpacing * 0.7));

      // Two-pass rendering to minimize fillStyle switches
      for (let pass = 0; pass < 2; pass++) {
        const isBull = pass === 0;
        ctx.fillStyle = isBull ? upColor : downColor;

        for (let i = 0; i < bars.length; i++) {
          const bar = bars[i];
          const bull = bar.close >= bar.open;
          if (bull !== isBull) continue;

          const vol = bar.volume || 0;
          if (vol === 0) continue;

          const barIdx = startIdx + i;
          const xMedia = (barIdx - firstVisibleIdx + 0.5) * barSpacing;

          // Height proportional to volume, from bottom
          const heightFraction = vol / maxVol;
          const heightMedia = (bitmapHeight / pixelRatio) * heightFraction;
          const heightBitmap = Math.max(1, Math.round(heightMedia * pixelRatio));

          const body = positionsBox(xMedia, bodyWidth, pixelRatio);
          const top = bitmapHeight - heightBitmap;

          ctx.fillRect(body.position, top, body.length, heightBitmap);
        }
      }
    },
  };
}
