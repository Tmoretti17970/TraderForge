// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Grid & Crosshair Renderers
//
// Grid: drawn on MAIN canvas (redraws only on viewport change)
// Crosshair: drawn on TOP canvas (redraws on every mouse move)
//
// This separation is why the chart stays fast — moving the mouse
// never triggers a redraw of candles, indicators, or grid.
// ═══════════════════════════════════════════════════════════════════

import { mediaToBitmap, positionsLine } from '../CoordinateSystem.js';

// ─── Grid Renderer ──────────────────────────────────────────────

/**
 * @typedef {Object} GridTheme
 * @property {string} color      - Grid line color
 * @property {string} borderColor - Chart border color (optional)
 */

export const DEFAULT_GRID_THEME = {
  color: 'rgba(54, 58, 69, 0.3)',     // #363A45 at 30% — TradingView default
  borderColor: 'rgba(54, 58, 69, 0.6)',
};

/**
 * Create a grid renderer for horizontal and vertical lines.
 *
 * @param {GridTheme} [theme]
 * @returns {Object}
 */
export function createGridRenderer(theme = DEFAULT_GRID_THEME) {
  let currentTheme = { ...theme };

  return {
    setTheme(newTheme) {
      Object.assign(currentTheme, newTheme);
    },

    /**
     * Draw grid lines on the main canvas.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     * @param {number[]} params.yTicks         - Price values for horizontal lines
     * @param {number[]} params.xTicks         - X positions (CSS px) for vertical lines
     * @param {(price: number) => number} params.priceToY - Price → CSS Y
     * @param {number} params.pixelRatio
     * @param {number} params.bitmapWidth
     * @param {number} params.bitmapHeight
     */
    draw(ctx, { yTicks, xTicks, priceToY, pixelRatio, bitmapWidth, bitmapHeight }) {
      ctx.fillStyle = currentTheme.color;

      // ── Horizontal grid lines (at price levels) ──
      for (let i = 0; i < yTicks.length; i++) {
        const yMedia = priceToY(yTicks[i]);
        const line = positionsLine(yMedia, 1, pixelRatio);
        ctx.fillRect(0, line.position, bitmapWidth, line.length);
      }

      // ── Vertical grid lines (at time labels) ──
      if (xTicks) {
        for (let i = 0; i < xTicks.length; i++) {
          const line = positionsLine(xTicks[i], 1, pixelRatio);
          ctx.fillRect(line.position, 0, line.length, bitmapHeight);
        }
      }
    },
  };
}


// ─── Crosshair Renderer ─────────────────────────────────────────

/**
 * @typedef {Object} CrosshairTheme
 * @property {string} lineColor   - Crosshair line color
 * @property {number[]} dashPattern - Dash pattern (in CSS pixels)
 * @property {number} lineWidth   - Width in CSS pixels
 * @property {string} labelBg     - Label background color
 * @property {string} labelText   - Label text color
 * @property {string} labelFont   - Label font
 */

export const DEFAULT_CROSSHAIR_THEME = {
  lineColor: 'rgba(149, 152, 161, 0.5)',  // #9598A1 at 50%
  dashPattern: [4, 4],
  lineWidth: 1,
  labelBg: '#363A45',
  labelText: '#D1D4DC',
  labelFont: '11px Arial',
};

/**
 * Create a crosshair renderer for the top canvas.
 * Draws two dashed lines (horizontal + vertical) at the cursor position.
 *
 * @param {CrosshairTheme} [theme]
 * @returns {Object}
 */
export function createCrosshairRenderer(theme = DEFAULT_CROSSHAIR_THEME) {
  let currentTheme = { ...theme };

  return {
    setTheme(newTheme) {
      Object.assign(currentTheme, newTheme);
    },

    /**
     * Draw crosshair on the top canvas.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     * @param {number|null} params.x        - Cursor X in CSS pixels (null = no crosshair)
     * @param {number|null} params.y        - Cursor Y in CSS pixels
     * @param {number} params.pixelRatio
     * @param {number} params.bitmapWidth
     * @param {number} params.bitmapHeight
     */
    draw(ctx, { x, y, pixelRatio, bitmapWidth, bitmapHeight }) {
      if (x === null || y === null) return;

      const bitmapLineWidth = Math.max(1, Math.round(currentTheme.lineWidth * pixelRatio));
      const dashBitmap = currentTheme.dashPattern.map(d => Math.round(d * pixelRatio));

      ctx.strokeStyle = currentTheme.lineColor;
      ctx.lineWidth = bitmapLineWidth;
      ctx.setLineDash(dashBitmap);

      // ── Horizontal line ──
      const hLine = positionsLine(y, currentTheme.lineWidth, pixelRatio);
      const hY = hLine.position + Math.floor(hLine.length / 2) + 0.5;

      ctx.beginPath();
      ctx.moveTo(0, hY);
      ctx.lineTo(bitmapWidth, hY);
      ctx.stroke();

      // ── Vertical line ──
      const vLine = positionsLine(x, currentTheme.lineWidth, pixelRatio);
      const vX = vLine.position + Math.floor(vLine.length / 2) + 0.5;

      ctx.beginPath();
      ctx.moveTo(vX, 0);
      ctx.lineTo(vX, bitmapHeight);
      ctx.stroke();

      ctx.setLineDash([]);
    },
  };
}


// ─── Price Label Renderer ───────────────────────────────────────

/**
 * Draw a price label on the price axis at a given Y position.
 * Used for: current price badge, crosshair price label.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} params
 * @param {string} params.text       - Price text to display
 * @param {number} params.yMedia     - Y position in CSS pixels
 * @param {number} params.axisWidth  - Price axis width in CSS pixels
 * @param {string} params.bgColor    - Background color
 * @param {string} params.textColor  - Text color
 * @param {string} params.font       - CSS font string
 * @param {number} params.pixelRatio
 */
export function drawPriceLabel(ctx, {
  text, yMedia, axisWidth, bgColor, textColor, font, pixelRatio,
}) {
  const x = 0;
  const y = Math.round(yMedia * pixelRatio);
  const width = Math.round(axisWidth * pixelRatio);
  const height = Math.round(20 * pixelRatio);
  const padding = Math.round(4 * pixelRatio);
  const fontSize = Math.round(11 * pixelRatio);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y - Math.floor(height / 2), width, height);

  // Text
  ctx.fillStyle = textColor;
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width - padding, y);
}


// ─── OHLCV Legend Overlay ───────────────────────────────────────

/**
 * Draw OHLCV values as a legend in the top-left of the chart.
 * Renders on the TOP canvas so it updates with the crosshair.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} params
 * @param {{open:number,high:number,low:number,close:number,volume?:number,time?:number}|null} params.bar
 * @param {string} params.symbol     - Ticker symbol
 * @param {string} params.timeframe  - Current timeframe
 * @param {(price: number) => string} params.formatPrice
 * @param {number} params.pixelRatio
 */
export function drawOHLCVLegend(ctx, { bar, symbol, timeframe, formatPrice, pixelRatio }) {
  if (!bar) return;

  const fontSize = Math.round(12 * pixelRatio);
  const smallFontSize = Math.round(11 * pixelRatio);
  const x = Math.round(8 * pixelRatio);
  let y = Math.round(16 * pixelRatio);
  const lineHeight = Math.round(16 * pixelRatio);
  const isBull = bar.close >= bar.open;

  // Symbol + timeframe header
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.fillStyle = '#D1D4DC';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`${symbol}  ${timeframe}`, x, y);

  y += lineHeight;
  ctx.font = `${smallFontSize}px Arial`;

  // OHLCV values with color coding
  const items = [
    { label: 'O', value: formatPrice(bar.open) },
    { label: 'H', value: formatPrice(bar.high) },
    { label: 'L', value: formatPrice(bar.low) },
    { label: 'C', value: formatPrice(bar.close) },
  ];

  let xOffset = x;
  const valueColor = isBull ? '#26A69A' : '#EF5350';
  const labelColor = '#787B86';
  const spacing = Math.round(6 * pixelRatio);

  for (const item of items) {
    ctx.fillStyle = labelColor;
    ctx.fillText(item.label, xOffset, y);
    xOffset += ctx.measureText(item.label).width + Math.round(2 * pixelRatio);

    ctx.fillStyle = valueColor;
    ctx.fillText(item.value, xOffset, y);
    xOffset += ctx.measureText(item.value).width + spacing;
  }

  // Volume on next line
  if (bar.volume != null) {
    y += lineHeight;
    ctx.fillStyle = labelColor;
    ctx.fillText('Vol', x, y);
    const volX = x + ctx.measureText('Vol').width + Math.round(2 * pixelRatio);
    ctx.fillStyle = '#787B86';
    ctx.fillText(formatVolume(bar.volume), volX, y);
  }

  // Change %
  if (bar.open > 0) {
    const changePct = ((bar.close - bar.open) / bar.open * 100).toFixed(2);
    const changeStr = (bar.close >= bar.open ? '+' : '') + changePct + '%';
    y += lineHeight;
    ctx.fillStyle = valueColor;
    ctx.fillText(changeStr, x, y);
  }
}

/**
 * Format volume with K, M, B suffixes.
 * @param {number} vol
 * @returns {string}
 */
function formatVolume(vol) {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return String(Math.round(vol));
}

// Alias for ChartEngineWidget compatibility
export const createGridCrosshair = createCrosshairRenderer;
