// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Chart Export & Sharing
//
// Export chart as PNG download, copy to clipboard, generate
// shareable URL with encoded chart state.
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '../constants.js';

/**
 * Draw a "TradeForge" watermark on a canvas context.
 * Called before export to brand the output.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawWatermark(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.font = `700 11px ${M}`;
  ctx.fillStyle = C.t2;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('TradeForge', width - 8, height - 6);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Export the chart canvas as a PNG file download.
 * Creates a temporary canvas at 1x DPR for clean output,
 * adds watermark, and triggers browser download.
 *
 * @param {HTMLCanvasElement} canvas - The chart canvas element
 * @param {string} [filename] - Download filename (default: symbol-tf-timestamp.png)
 * @param {Object} [options] - { symbol, tf }
 */
export function exportChartPNG(canvas, filename, options = {}) {
  if (!canvas) return;

  const { symbol = 'CHART', tf = '' } = options;

  // Create export canvas at display resolution
  const exportCanvas = document.createElement('canvas');
  const w = canvas.width;
  const h = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  exportCanvas.width = w;
  exportCanvas.height = h;
  const ctx = exportCanvas.getContext('2d');

  // Draw the chart
  ctx.drawImage(canvas, 0, 0);

  // Add watermark
  drawWatermark(ctx, w / dpr, h / dpr);

  // Generate filename
  const ts = new Date().toISOString().slice(0, 10);
  const name = filename || `tradeforge-${symbol}-${tf}-${ts}.png`;

  // Trigger download
  const link = document.createElement('a');
  link.download = name;
  link.href = exportCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copy chart image to clipboard.
 * Uses the Clipboard API with canvas.toBlob().
 * Falls back to a basic alert if not supported.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<boolean>} success
 */
export async function copyChartToClipboard(canvas) {
  if (!canvas) return false;

  // Create export canvas with watermark
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const dpr = window.devicePixelRatio || 1;
  drawWatermark(ctx, canvas.width / dpr, canvas.height / dpr);

  try {
    const blob = await new Promise((resolve) =>
      exportCanvas.toBlob(resolve, 'image/png')
    );
    if (!blob) return false;

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch (err) {
    console.warn('Clipboard write failed:', err);
    return false;
  }
}

// ─── Shareable URL ────────────────────────────────────────────

/**
 * Encode chart state into a compact URL-safe string.
 * Format: base64(JSON({ s, t, c, i }))
 *
 * @param {Object} state - { symbol, tf, chartType, indicators }
 * @returns {string} encoded state string
 */
export function encodeChartState(state) {
  const compact = {
    s: state.symbol,
    t: state.tf,
    c: state.chartType,
    i: (state.indicators || []).map((ind) => ({
      t: ind.type,
      p: ind.params,
      c: ind.color,
    })),
  };

  try {
    const json = JSON.stringify(compact);
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

/**
 * Decode chart state from a URL-safe string.
 *
 * @param {string} encoded
 * @returns {Object|null} { symbol, tf, chartType, indicators }
 */
export function decodeChartState(encoded) {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const compact = JSON.parse(json);

    return {
      symbol: compact.s || 'BTC',
      tf: compact.t || '3m',
      chartType: compact.c || 'candles',
      indicators: (compact.i || []).map((ind) => ({
        type: ind.t,
        params: ind.p || {},
        color: ind.c || '#f59e0b',
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Generate a shareable URL for the current chart state.
 * Appends ?chart=<encoded> to the current page URL.
 *
 * @param {Object} state - { symbol, tf, chartType, indicators }
 * @returns {string} full shareable URL
 */
export function generateShareURL(state) {
  const encoded = encodeChartState(state);
  if (!encoded) return window.location.href;

  const url = new URL(window.location.href);
  url.searchParams.set('chart', encoded);
  return url.toString();
}

/**
 * Parse chart state from the current URL if present.
 *
 * @returns {Object|null} decoded chart state or null
 */
export function parseShareURL() {
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('chart');
    if (!encoded) return null;
    return decodeChartState(encoded);
  } catch {
    return null;
  }
}

// ─── S1.1: Snapshot with P&L Overlay ────────────────────────────

/**
 * Create an annotated snapshot canvas with P&L overlay and trade markers.
 * Used for sharing chart screenshots with trade context.
 *
 * @param {HTMLCanvasElement} canvas - The chart canvas
 * @param {Object} [annotations] - { trades, symbol, tf, totalPnl, winRate, tradeCount }
 * @returns {HTMLCanvasElement} Annotated canvas
 */
export function createAnnotatedSnapshot(canvas, annotations = {}) {
  if (!canvas) return canvas;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;
  const BANNER_H = 36 * dpr;

  // Create output canvas with room for P&L banner
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h + BANNER_H;
  const ctx = out.getContext('2d');

  // Draw P&L banner at top
  ctx.fillStyle = '#111319';
  ctx.fillRect(0, 0, w, BANNER_H);

  ctx.save();
  ctx.scale(dpr, dpr);
  const bannerH = BANNER_H / dpr;

  // Symbol + timeframe
  ctx.font = `800 13px ${M}`;
  ctx.fillStyle = '#e1e4ea';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const symLabel = `${annotations.symbol || ''} ${annotations.tf || ''}`.trim();
  ctx.fillText(symLabel, 12, bannerH / 2);

  // P&L
  if (annotations.totalPnl != null) {
    const pnl = annotations.totalPnl;
    const pnlColor = pnl >= 0 ? '#22c55e' : '#ef4444';
    const pnlText = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    ctx.font = `800 14px ${M}`;
    ctx.fillStyle = pnlColor;
    ctx.textAlign = 'center';
    ctx.fillText(pnlText, (w / dpr) / 2, bannerH / 2);
  }

  // Stats (right side)
  const stats = [];
  if (annotations.tradeCount != null) stats.push(`${annotations.tradeCount} trades`);
  if (annotations.winRate != null) stats.push(`${annotations.winRate.toFixed(0)}% WR`);
  if (stats.length) {
    ctx.font = `600 10px ${M}`;
    ctx.fillStyle = '#9ba1b0';
    ctx.textAlign = 'right';
    ctx.fillText(stats.join(' · '), (w / dpr) - 12, bannerH / 2);
  }

  // Border line
  ctx.fillStyle = '#2a2f42';
  ctx.fillRect(0, bannerH - 1, w / dpr, 1);

  ctx.restore();

  // Draw the original chart below the banner
  ctx.drawImage(canvas, 0, BANNER_H);

  // Watermark
  drawWatermark(ctx, w / dpr, (h + BANNER_H) / dpr);

  return out;
}

/**
 * Export annotated snapshot as PNG download.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} annotations
 * @param {string} [filename]
 */
export function exportAnnotatedPNG(canvas, annotations, filename) {
  const annotated = createAnnotatedSnapshot(canvas, annotations);
  const sym = annotations.symbol || 'CHART';
  const ts = new Date().toISOString().slice(0, 10);
  const name = filename || `tradeforge-${sym}-annotated-${ts}.png`;

  const link = document.createElement('a');
  link.download = name;
  link.href = annotated.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Copy annotated snapshot to clipboard.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} annotations
 * @returns {Promise<boolean>}
 */
export async function copyAnnotatedToClipboard(canvas, annotations) {
  const annotated = createAnnotatedSnapshot(canvas, annotations);
  try {
    const blob = await new Promise((resolve) =>
      annotated.toBlob(resolve, 'image/png')
    );
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
