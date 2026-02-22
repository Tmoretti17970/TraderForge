// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Volume Pane Renderer
// Renders volume as a standalone pane with its own Y-axis scaling.
// Unlike the overlay volume (which shares the main chart area),
// this is a separate pane with full height utilization.
// ═══════════════════════════════════════════════════════════════════

import { positionsBox } from '../CoordinateSystem.js';

/**
 * Create a volume pane renderer.
 *
 * @param {Object} theme - Chart theme colors
 * @returns {Object} Renderer with draw() and drawAxis()
 */
export function createVolumePaneRenderer(theme) {
  let currentTheme = theme;

  return {
    setTheme(t) { currentTheme = t; },

    /**
     * Draw volume histogram filling the entire pane height.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} params
     * @param {Array}  params.bars
     * @param {number} params.startIdx
     * @param {number} params.firstVisibleIdx
     * @param {number} params.barSpacing
     * @param {number} params.pixelRatio
     * @param {number} params.bitmapWidth
     * @param {number} params.bitmapHeight
     */
    draw(ctx, { bars, startIdx, firstVisibleIdx, barSpacing, pixelRatio, bitmapWidth, bitmapHeight }) {
      if (!bars?.length) return;

      // Find max volume for scaling
      let maxVol = 0;
      for (let i = 0; i < bars.length; i++) {
        const v = bars[i].volume || 0;
        if (v > maxVol) maxVol = v;
      }
      if (maxVol === 0) return;

      // Leave 5% padding at top
      const usableHeight = bitmapHeight * 0.95;
      const bodyW = Math.max(1, Math.floor(barSpacing * 0.7));

      // Two-pass rendering (minimize fillStyle changes)
      for (let pass = 0; pass < 2; pass++) {
        const isBull = pass === 0;
        ctx.fillStyle = isBull ? currentTheme.volumeUp : currentTheme.volumeDown;

        for (let i = 0; i < bars.length; i++) {
          const b = bars[i];
          if ((b.close >= b.open) !== isBull) continue;
          const vol = b.volume || 0;
          if (vol === 0) continue;

          const x = (startIdx + i - firstVisibleIdx + 0.5) * barSpacing;
          const heightPct = vol / maxVol;
          const barH = Math.max(1, Math.round(usableHeight * heightPct));

          const box = positionsBox(x, bodyW, pixelRatio);
          ctx.fillRect(box.position, bitmapHeight - barH, box.length, barH);
        }
      }
    },

    /**
     * Draw volume axis labels.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array}  bars - Visible bars
     * @param {number} axisWidth - Axis canvas width in bitmap pixels
     * @param {number} axisHeight - Axis canvas height in bitmap pixels
     * @param {number} pixelRatio
     */
    drawAxis(ctx, bars, axisWidth, axisHeight, pixelRatio) {
      if (!bars?.length) return;

      let maxVol = 0;
      for (const b of bars) if ((b.volume || 0) > maxVol) maxVol = b.volume;
      if (maxVol === 0) return;

      const fontSize = Math.round(10 * pixelRatio);
      ctx.font = `${fontSize}px Arial`;
      ctx.fillStyle = currentTheme.textSecondary;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const padding = Math.round(6 * pixelRatio);

      // Show 2-3 tick marks
      const ticks = [maxVol, maxVol * 0.5];
      const usableHeight = axisHeight * 0.95;

      for (const vol of ticks) {
        const y = axisHeight - (vol / maxVol) * usableHeight;
        ctx.fillText(formatVolume(vol), axisWidth - padding, y);
      }
    },
  };
}

/**
 * Format volume for axis labels.
 * @param {number} vol
 * @returns {string}
 */
function formatVolume(vol) {
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(0) + 'K';
  return Math.round(vol).toString();
}

// Alias for ChartEngineWidget compatibility
export const createVolumeRenderer = createVolumePaneRenderer;
