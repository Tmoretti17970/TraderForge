// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — chartRenderer.js (Backward Compatibility Shim)
//
// The chart rendering engine has been replaced by src/chartEngine/.
// This shim re-exports symbols that are still referenced by other modules.
//
// Consumers should migrate to importing from 'src/chartEngine/' directly.
// See INTEGRATION_GUIDE.md for details.
// ═══════════════════════════════════════════════════════════════════

import { C, AXIS_WIDTH, TIME_AXIS_HEIGHT } from '../constants.js';
import { niceScale } from '../utils.js';

// setFormatSymbol was used to configure the renderer's current symbol.
// In v11, the ChartEngineWidget handles this internally.
// This is a no-op shim for backward compat.
let _formatSymbol = 'BTCUSDT';
export function setFormatSymbol(sym) { _formatSymbol = sym; }
export function getFormatSymbol() { return _formatSymbol; }

// computeLayout is still used by QuadChart's mini renderer.
// Provide a minimal version here.
export function computeLayout(data, startIdx, endIdx, chartW, chartH) {
  const visibleData = data.slice(startIdx, endIdx + 1);
  const barCount = endIdx - startIdx + 1;
  if (barCount < 1 || !visibleData.length) {
    return { barW: 8, gap: 2, bodyW: 6, yMin: 0, yMax: 100, yScale: null, visibleData, barCount };
  }
  const totalBarW = chartW / barCount;
  const gap = Math.max(1, Math.round(totalBarW * 0.2));
  const barW = totalBarW - gap;
  const bodyW = Math.max(1, Math.round(barW));

  let lo = Infinity, hi = -Infinity;
  for (const b of visibleData) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
  const range = hi - lo || 1;
  const pad = range * 0.05;
  const yScale = niceScale(lo - pad, hi + pad, Math.floor(chartH / 50));

  return { barW, gap, bodyW, yMin: yScale.min, yMax: yScale.max, yScale, visibleData, barCount, totalBarW };
}

// Minimal drawing functions for QuadChart mini-charts
export function drawGrid(ctx, layout, chartW, chartH) {
  if (!layout.yScale) return;
  ctx.fillStyle = 'rgba(54,58,69,0.3)';
  for (const tick of layout.yScale.ticks) {
    const y = chartH - ((tick - layout.yMin) / (layout.yMax - layout.yMin)) * chartH;
    ctx.fillRect(0, Math.round(y), chartW, 1);
  }
}

export function drawCandles(ctx, layout, chartW, chartH) {
  const { visibleData, totalBarW, bodyW, yMin, yMax } = layout;
  const p2y = (p) => chartH - ((p - yMin) / (yMax - yMin)) * chartH;

  for (const b of visibleData) {
    const idx = visibleData.indexOf(b);
    const x = (idx + 0.5) * totalBarW;
    const bull = b.close >= b.open;
    ctx.fillStyle = bull ? '#26A69A' : '#EF5350';

    // Wick
    ctx.fillRect(Math.round(x) - 0.5, Math.round(p2y(b.high)), 1, Math.round(p2y(b.low) - p2y(b.high)));
    // Body
    const oY = p2y(b.open), cY = p2y(b.close);
    const top = Math.min(oY, cY);
    const h = Math.max(1, Math.abs(oY - cY));
    ctx.fillRect(Math.round(x - bodyW / 2), Math.round(top), bodyW, h);
  }
}

export function drawVolume(ctx, layout, chartW, chartH) {
  const { visibleData, totalBarW, bodyW } = layout;
  let maxVol = 0;
  for (const b of visibleData) if ((b.volume || 0) > maxVol) maxVol = b.volume;
  if (maxVol === 0) return;

  const vH = chartH * 0.15;
  for (const b of visibleData) {
    const idx = visibleData.indexOf(b);
    const x = (idx + 0.5) * totalBarW;
    const bull = b.close >= b.open;
    const h = Math.max(1, (b.volume / maxVol) * vH);
    ctx.fillStyle = bull ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)';
    ctx.fillRect(Math.round(x - bodyW / 2), Math.round(chartH - h), bodyW, Math.round(h));
  }
}

// These are stubs — the full rendering is now in ChartEngineWidget
export function drawPriceAxis() {}
export function drawTimeAxis() {}
export function drawHollowCandles() {}
export function drawOHLC() {}
export function drawLine() {}
export function drawArea() {}
export function drawIndicatorLine() {}
export function drawBollinger() {}
export function drawCrosshair() {}
export function drawInfoBox() {}
export function drawTradeOverlays() {}
export function buildTimeIndex() { return new Map(); }
export function priceToY() { return 0; }
export function drawScriptOutputs() {}
export function drawVolumeProfile() {}
export function drawComparisonOverlay() {}
export function drawEnhancedTooltip() {}
export function drawSyncedCrosshair() {}
export function drawSRLevels() {}
export function drawPatternMarkers() {}
export function drawDivergenceLines() {}
