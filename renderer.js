// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Indicator Renderer
// Renders computed indicator values on canvas.
//
// Overlay indicators draw on the main chart canvas.
// Pane indicators draw in their own sub-pane with custom Y scaling.
// ═══════════════════════════════════════════════════════════════════

/**
 * Render an overlay indicator on the main chart canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object}   indicator - Active indicator instance (with .computed)
 * @param {Object}   params
 * @param {number}   params.startIdx       - First visible bar index in data
 * @param {number}   params.endIdx         - Last visible bar index in data
 * @param {number}   params.barSpacing     - CSS pixels per bar
 * @param {Function} params.priceToY       - Price → CSS Y coordinate
 * @param {number}   params.pixelRatio
 * @param {number}   params.bitmapWidth
 * @param {number}   params.bitmapHeight
 */
export function renderOverlayIndicator(ctx, indicator, params) {
  if (!indicator.computed || !indicator.visible) return;

  const { startIdx, endIdx, barSpacing, priceToY, pixelRatio: pr, bitmapWidth, bitmapHeight } = params;

  // Render fills first (behind lines)
  if (indicator.fills) {
    for (const fill of indicator.fills) {
      const upperVals = indicator.computed[fill.upper];
      const lowerVals = indicator.computed[fill.lower];
      if (!upperVals || !lowerVals) continue;

      ctx.fillStyle = fill.color;
      ctx.beginPath();

      // Forward sweep (upper line)
      let started = false;
      for (let i = startIdx; i <= endIdx && i < upperVals.length; i++) {
        if (isNaN(upperVals[i])) continue;
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(priceToY(upperVals[i]) * pr);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }

      // Backward sweep (lower line)
      for (let i = Math.min(endIdx, lowerVals.length - 1); i >= startIdx; i--) {
        if (isNaN(lowerVals[i])) continue;
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(priceToY(lowerVals[i]) * pr);
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
    }
  }

  // Render line outputs
  for (const output of indicator.outputs) {
    const values = indicator.computed[output.key];
    if (!values || output.type !== 'line') continue;

    const lineWidth = Math.max(1, Math.round((output.width || 2) * pr));
    ctx.strokeStyle = output.color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.setLineDash(output.dash ? output.dash.map(d => Math.round(d * pr)) : []);

    ctx.beginPath();
    let started = false;

    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
      if (isNaN(values[i])) { started = false; continue; }
      const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
      const y = Math.round(priceToY(values[i]) * pr);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  }
}


/**
 * Render a pane indicator in its own sub-pane.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object}   indicator
 * @param {Object}   params
 * @param {number}   params.startIdx
 * @param {number}   params.endIdx
 * @param {number}   params.barSpacing
 * @param {number}   params.pixelRatio
 * @param {number}   params.paneTop      - Bitmap Y start of this pane
 * @param {number}   params.paneHeight   - Bitmap height of this pane
 * @param {number}   params.paneWidth    - Bitmap width (chart area, excluding axis)
 * @param {Object}   [theme]             - Theme colors
 */
export function renderPaneIndicator(ctx, indicator, params, theme = {}) {
  if (!indicator.computed || !indicator.visible) return;

  const {
    startIdx, endIdx, barSpacing,
    pixelRatio: pr, paneTop, paneHeight, paneWidth,
  } = params;

  const pc = indicator.paneConfig || {};

  // Determine Y range
  let dataMin = Infinity, dataMax = -Infinity;

  for (const output of indicator.outputs) {
    const values = indicator.computed[output.key];
    if (!values) continue;
    for (let i = startIdx; i <= endIdx && i < values.length; i++) {
      if (isNaN(values[i])) continue;
      if (values[i] < dataMin) dataMin = values[i];
      if (values[i] > dataMax) dataMax = values[i];
    }
  }

  // Use fixed range if defined, otherwise auto
  const yMin = pc.min !== undefined ? pc.min : dataMin - (dataMax - dataMin) * 0.1;
  const yMax = pc.max !== undefined ? pc.max : dataMax + (dataMax - dataMin) * 0.1;
  const yRange = yMax - yMin || 1;

  const valToY = (v) => paneTop + paneHeight - ((v - yMin) / yRange) * paneHeight;

  // ── Bands (horizontal reference lines) ──
  if (pc.bands) {
    for (const band of pc.bands) {
      const y = Math.round(valToY(band.value));
      ctx.strokeStyle = band.color || 'rgba(120,123,134,0.3)';
      ctx.lineWidth = Math.max(1, pr);
      ctx.setLineDash(band.dash ? band.dash.map(d => Math.round(d * pr)) : []);
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(paneWidth, y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Band label
      if (band.label) {
        const fs = Math.round(9 * pr);
        ctx.font = `${fs}px Arial`;
        ctx.fillStyle = band.color || 'rgba(120,123,134,0.5)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(band.label, paneWidth - Math.round(4 * pr), y - Math.round(2 * pr));
      }
    }
  }

  // ── Render outputs ──
  for (const output of indicator.outputs) {
    const values = indicator.computed[output.key];
    if (!values) continue;

    if (output.type === 'histogram') {
      // MACD histogram bars
      const barW = Math.max(1, Math.floor(barSpacing * 0.6 * pr));
      const zeroY = Math.round(valToY(0));

      for (let i = startIdx; i <= endIdx && i < values.length; i++) {
        if (isNaN(values[i])) continue;
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(valToY(values[i]));
        const h = Math.abs(y - zeroY);

        const isPos = values[i] >= 0;
        // Color based on direction change
        const prevVal = i > 0 && !isNaN(values[i - 1]) ? values[i - 1] : values[i];
        const growing = isPos ? values[i] > prevVal : values[i] < prevVal;

        if (isPos) {
          ctx.fillStyle = growing ? 'rgba(38, 166, 154, 0.7)' : 'rgba(38, 166, 154, 0.35)';
        } else {
          ctx.fillStyle = growing ? 'rgba(239, 83, 80, 0.35)' : 'rgba(239, 83, 80, 0.7)';
        }

        ctx.fillRect(
          x - Math.floor(barW / 2),
          Math.min(y, zeroY),
          barW,
          Math.max(1, h)
        );
      }
    } else if (output.type === 'line') {
      // Line
      const lineWidth = Math.max(1, Math.round((output.width || 2) * pr));
      ctx.strokeStyle = output.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = 'round';
      ctx.setLineDash(output.dash ? output.dash.map(d => Math.round(d * pr)) : []);

      ctx.beginPath();
      let started = false;

      for (let i = startIdx; i <= endIdx && i < values.length; i++) {
        if (isNaN(values[i])) { started = false; continue; }
        const x = Math.round((i - startIdx + 0.5) * barSpacing * pr);
        const y = Math.round(valToY(values[i]));

        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ── Indicator label ──
  const fs = Math.round(10 * pr);
  ctx.font = `bold ${fs}px Arial`;
  ctx.fillStyle = theme.textSecondary || '#787B86';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(indicator.label, Math.round(8 * pr), paneTop + Math.round(4 * pr));

  // Current values
  if (indicator.computed) {
    let ox = Math.round(8 * pr) + ctx.measureText(indicator.label).width + Math.round(12 * pr);
    ctx.font = `${fs}px Arial`;
    for (const output of indicator.outputs) {
      const values = indicator.computed[output.key];
      if (!values) continue;
      const lastValid = findLastValid(values, endIdx);
      if (lastValid === null) continue;

      ctx.fillStyle = output.color;
      const txt = `${output.label}: ${lastValid.toFixed(2)}`;
      ctx.fillText(txt, ox, paneTop + Math.round(4 * pr));
      ox += ctx.measureText(txt).width + Math.round(12 * pr);
    }
  }

  // ── Pane axis labels ──
  const axisX = paneWidth;
  const axFs = Math.round(9 * pr);
  ctx.font = `${axFs}px Arial`;
  ctx.fillStyle = theme.textSecondary || '#787B86';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const axPad = Math.round(6 * pr);

  // Show min, max, and midpoint
  const ticks = pc.min !== undefined && pc.max !== undefined
    ? [pc.max, (pc.max + pc.min) / 2, pc.min]
    : [dataMax, (dataMax + dataMin) / 2, dataMin];

  for (const tick of ticks) {
    if (isNaN(tick)) continue;
    const y = Math.round(valToY(tick));
    const label = Math.abs(tick) >= 1000 ? tick.toFixed(0) : tick.toFixed(1);
    ctx.fillText(label, axisX + Math.round(50 * pr), y);
  }
}


/**
 * Find the last non-NaN value up to a given index.
 */
function findLastValid(arr, maxIdx) {
  for (let i = Math.min(maxIdx, arr.length - 1); i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return null;
}
