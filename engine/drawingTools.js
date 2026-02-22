// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — drawingTools.js (Backward Compatibility Shim)
// Drawing tools are now in src/chartEngine/tools/
// This shim provides the old API surface for existing consumers.
// ═══════════════════════════════════════════════════════════════════

// Tool configuration (matches old format)
export const TOOL_CONFIG = {
  trendline: { label: 'Trend Line', points: 2, icon: '📈' },
  hlevel:    { label: 'H-Level',    points: 1, icon: '─' },
  fib:       { label: 'Fib Retrace',points: 2, icon: '≡' },
  ray:       { label: 'Ray',        points: 2, icon: '→' },
  hline:     { label: 'H-Line',     points: 1, icon: '┄' },
  rect:      { label: 'Rectangle',  points: 2, icon: '□' },
  channel:   { label: 'Channel',    points: 3, icon: '⊏' },
  cross:     { label: 'Crossline',  points: 1, icon: '✚' },
  extended:  { label: 'Extended',   points: 2, icon: '↔' },
  select:    { label: 'Select',     points: 0, icon: '⬚' },
};

/**
 * Magnet snap to nearest OHLC price within threshold.
 */
export function magnetSnap(price, bar, threshold = 0.002) {
  if (!bar) return price;
  const prices = [bar.open, bar.high, bar.low, bar.close];
  let closest = price;
  let minDist = Infinity;
  for (const p of prices) {
    const dist = Math.abs(p - price);
    if (dist < minDist) { minDist = dist; closest = p; }
  }
  const relThreshold = Math.abs(price) * threshold;
  return minDist <= relThreshold ? closest : price;
}

// Drawing rendering is now handled by ChartEngineWidget
export function drawAllDrawings() {}
export function drawPendingPreview() {}
