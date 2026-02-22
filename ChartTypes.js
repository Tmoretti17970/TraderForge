// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Chart Type System
// Registry of chart rendering styles. Each type is a renderer plugin
// that conforms to the same draw() interface.
//
// Available types:
//   - candlestick  (default, solid filled)
//   - hollow       (hollow candles, filled only when bearish)
//   - heikinashi   (Heikin-Ashi smoothed candles)
//   - ohlc         (OHLC bars — no body, just tick marks)
//   - line         (close price line)
//   - area         (line with gradient fill)
//   - baseline     (line colored above/below a baseline)
// ═══════════════════════════════════════════════════════════════════

import {
  mediaToBitmap,
  positionsLine,
  positionsBox,
  candleBodyWidth,
} from '../CoordinateSystem.js';

/**
 * @typedef {Object} ChartTypeConfig
 * @property {string}   id       - Unique identifier
 * @property {string}   name     - Display name
 * @property {string}   icon     - Unicode icon
 * @property {boolean}  hasVolume - Whether volume makes sense with this type
 * @property {Function} draw     - Renderer function
 */

/** All available chart types */
export const CHART_TYPES = {
  candlestick: {
    id: 'candlestick',
    name: 'Candlestick',
    icon: '📊',
    hasVolume: true,
  },
  hollow: {
    id: 'hollow',
    name: 'Hollow Candles',
    icon: '▯',
    hasVolume: true,
  },
  heikinashi: {
    id: 'heikinashi',
    name: 'Heikin-Ashi',
    icon: '🔷',
    hasVolume: true,
  },
  ohlc: {
    id: 'ohlc',
    name: 'OHLC Bars',
    icon: '┤',
    hasVolume: true,
  },
  line: {
    id: 'line',
    name: 'Line',
    icon: '📈',
    hasVolume: false,
  },
  area: {
    id: 'area',
    name: 'Area',
    icon: '▨',
    hasVolume: false,
  },
  baseline: {
    id: 'baseline',
    name: 'Baseline',
    icon: '⚖',
    hasVolume: false,
  },
};

/**
 * Draw candlestick bars (solid filled).
 */
export function drawCandlesticks(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio } = params;
  if (!bars?.length) return;

  const bodyW = candleBodyWidth(barSpacing);

  // Wicks first, then bodies (2-pass per bull/bear = 4 total)
  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? theme.candleUpWick : theme.candleDownWick;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;
      const x = (startIdx + i - firstVisibleIdx + 0.5) * barSpacing;
      const wick = positionsLine(x, 1, pixelRatio);
      const hY = mediaToBitmap(priceToY(b.high), pixelRatio);
      const lY = mediaToBitmap(priceToY(b.low), pixelRatio);
      ctx.fillRect(wick.position, hY, wick.length, Math.max(1, lY - hY));
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? theme.candleUp : theme.candleDown;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;
      const x = (startIdx + i - firstVisibleIdx + 0.5) * barSpacing;
      const oY = mediaToBitmap(priceToY(b.open), pixelRatio);
      const cY = mediaToBitmap(priceToY(b.close), pixelRatio);
      const top = Math.min(oY, cY), h = Math.max(1, Math.max(oY, cY) - top);
      const box = positionsBox(x, bodyW, pixelRatio);
      ctx.fillRect(box.position, top, box.length, h);
    }
  }
}

/**
 * Draw hollow candlestick bars.
 * Bullish = outlined (hollow), Bearish = filled.
 */
export function drawHollowCandles(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio } = params;
  if (!bars?.length) return;

  const bodyW = candleBodyWidth(barSpacing);
  const wickW = Math.max(1, Math.round(pixelRatio));

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const bull = b.close >= b.open;
    const color = bull ? theme.candleUp : theme.candleDown;
    const x = (startIdx + i - firstVisibleIdx + 0.5) * barSpacing;

    // Wick
    ctx.fillStyle = color;
    const wick = positionsLine(x, 1, pixelRatio);
    const hY = mediaToBitmap(priceToY(b.high), pixelRatio);
    const lY = mediaToBitmap(priceToY(b.low), pixelRatio);
    ctx.fillRect(wick.position, hY, wick.length, Math.max(1, lY - hY));

    // Body
    const oY = mediaToBitmap(priceToY(b.open), pixelRatio);
    const cY = mediaToBitmap(priceToY(b.close), pixelRatio);
    const top = Math.min(oY, cY), h = Math.max(1, Math.max(oY, cY) - top);
    const box = positionsBox(x, bodyW, pixelRatio);

    if (bull) {
      // Hollow: clear interior, draw border
      ctx.clearRect(box.position, top, box.length, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = wickW;
      ctx.strokeRect(box.position + 0.5, top + 0.5, box.length - 1, h - 1);
    } else {
      // Filled
      ctx.fillStyle = color;
      ctx.fillRect(box.position, top, box.length, h);
    }
  }
}

/**
 * Draw OHLC bars (tick marks, no body fill).
 */
export function drawOHLCBars(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio } = params;
  if (!bars?.length) return;

  const tickW = Math.max(2, Math.floor(barSpacing * 0.3));
  const lineW = Math.max(1, Math.round(pixelRatio));

  for (let pass = 0; pass < 2; pass++) {
    const isBull = pass === 0;
    ctx.fillStyle = isBull ? theme.candleUp : theme.candleDown;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      if ((b.close >= b.open) !== isBull) continue;

      const x = (startIdx + i - firstVisibleIdx + 0.5) * barSpacing;
      const centerX = Math.round(x * pixelRatio);

      const hY = mediaToBitmap(priceToY(b.high), pixelRatio);
      const lY = mediaToBitmap(priceToY(b.low), pixelRatio);
      const oY = mediaToBitmap(priceToY(b.open), pixelRatio);
      const cY = mediaToBitmap(priceToY(b.close), pixelRatio);

      // Vertical line (high to low)
      ctx.fillRect(centerX, hY, lineW, Math.max(1, lY - hY));

      // Open tick (left)
      const tickBW = Math.max(1, Math.round(tickW * pixelRatio));
      ctx.fillRect(centerX - tickBW, oY, tickBW, lineW);

      // Close tick (right)
      ctx.fillRect(centerX + lineW, cY, tickBW, lineW);
    }
  }
}

/**
 * Draw line chart (close price only).
 */
export function drawLineChart(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio, bitmapHeight } = params;
  if (!bars?.length || bars.length < 2) return;

  const lineWidth = Math.max(1, Math.round(2 * pixelRatio));
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (let i = 0; i < bars.length; i++) {
    const x = Math.round((startIdx + i - firstVisibleIdx + 0.5) * barSpacing * pixelRatio);
    const y = Math.round(priceToY(bars[i].close) * pixelRatio);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Draw area chart (line with gradient fill below).
 */
export function drawAreaChart(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio, bitmapHeight } = params;
  if (!bars?.length || bars.length < 2) return;

  const lineWidth = Math.max(1, Math.round(2 * pixelRatio));

  // Build path
  ctx.beginPath();
  let firstX = 0, lastX = 0;
  for (let i = 0; i < bars.length; i++) {
    const x = Math.round((startIdx + i - firstVisibleIdx + 0.5) * barSpacing * pixelRatio);
    const y = Math.round(priceToY(bars[i].close) * pixelRatio);
    if (i === 0) { ctx.moveTo(x, y); firstX = x; }
    else ctx.lineTo(x, y);
    lastX = x;
  }

  // Stroke line
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Fill area
  ctx.lineTo(lastX, bitmapHeight);
  ctx.lineTo(firstX, bitmapHeight);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, bitmapHeight);
  gradient.addColorStop(0, theme.areaTopColor);
  gradient.addColorStop(1, theme.areaBottomColor);
  ctx.fillStyle = gradient;
  ctx.fill();
}

/**
 * Draw baseline chart (line colored above/below a reference price).
 */
export function drawBaselineChart(ctx, bars, params, theme) {
  const { barSpacing, startIdx, firstVisibleIdx, priceToY, pixelRatio, bitmapHeight } = params;
  if (!bars?.length || bars.length < 2) return;

  // Baseline = first visible bar's close
  const baseline = bars[0].close;
  const baseY = Math.round(priceToY(baseline) * pixelRatio);
  const lineWidth = Math.max(1, Math.round(2 * pixelRatio));

  // Draw baseline
  ctx.strokeStyle = theme.textDisabled || '#4E5266';
  ctx.lineWidth = Math.max(1, Math.round(pixelRatio));
  ctx.setLineDash([Math.round(4 * pixelRatio), Math.round(4 * pixelRatio)]);
  ctx.beginPath();
  ctx.moveTo(0, baseY + 0.5);
  ctx.lineTo(Math.round(bars.length * barSpacing * pixelRatio), baseY + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw colored line segments
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';

  for (let i = 1; i < bars.length; i++) {
    const prevX = Math.round((startIdx + i - 1 - firstVisibleIdx + 0.5) * barSpacing * pixelRatio);
    const currX = Math.round((startIdx + i - firstVisibleIdx + 0.5) * barSpacing * pixelRatio);
    const prevY = Math.round(priceToY(bars[i - 1].close) * pixelRatio);
    const currY = Math.round(priceToY(bars[i].close) * pixelRatio);

    const aboveBaseline = bars[i].close >= baseline;
    ctx.strokeStyle = aboveBaseline ? theme.candleUp : theme.candleDown;

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
  }
}

/**
 * Convert OHLCV bars to Heikin-Ashi and draw as candlesticks.
 */
export function drawHeikinAshi(ctx, bars, params, theme) {
  if (!bars?.length) return;

  // Convert to Heikin-Ashi
  const ha = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      open: haOpen,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      close: haClose,
      volume: b.volume,
      time: b.time,
    });
  }

  // Draw using standard candlestick renderer
  drawCandlesticks(ctx, ha, params, theme);
}

/**
 * Get the draw function for a chart type.
 * @param {string} typeId
 * @returns {Function}
 */
export function getChartDrawFunction(typeId) {
  switch (typeId) {
    case 'candlestick': return drawCandlesticks;
    case 'hollow':      return drawHollowCandles;
    case 'heikinashi':  return drawHeikinAshi;
    case 'ohlc':        return drawOHLCBars;
    case 'line':        return drawLineChart;
    case 'area':        return drawAreaChart;
    case 'baseline':    return drawBaselineChart;
    default:            return drawCandlesticks;
  }
}

/**
 * Get list of chart types for UI.
 * @returns {Array<{id: string, name: string, icon: string}>}
 */
export function getChartTypeList() {
  return Object.values(CHART_TYPES);
}

// Alias for ChartEngineWidget compatibility
export const getChartTypeRenderer = getChartDrawFunction;
