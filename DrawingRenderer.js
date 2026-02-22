// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — DrawingRenderer
// Renders all drawing types pixel-perfectly on canvas.
//
// Committed drawings render on the MAIN canvas.
// Active/selected drawings + anchors render on the TOP canvas.
// This maintains the dual-canvas performance split.
// ═══════════════════════════════════════════════════════════════════

import { mediaToBitmap, positionsLine } from '../CoordinateSystem.js';
import { FIB_LEVELS, FIB_COLORS } from './DrawingModel.js';

const ANCHOR_RADIUS = 4;
const ANCHOR_FILL = '#FFFFFF';
const ANCHOR_STROKE = '#2962FF';
const SELECTED_COLOR = '#2962FF';

/**
 * Create a DrawingRenderer.
 *
 * @param {Object} drawingEngine - DrawingEngine instance
 * @returns {Object} Renderer with drawMain() and drawTop()
 */
export function createDrawingRenderer(drawingEngine) {
  /**
   * Render committed (non-selected) drawings on the main canvas.
   * Called as part of the main canvas render pipeline.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} size - { pixelRatio, bitmapWidth, bitmapHeight, mediaWidth, mediaHeight }
   */
  function drawMain(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state === 'creating') continue; // Creating drawings render on top canvas
      if (d.state === 'selected') continue; // Selected renders on top canvas

      renderDrawing(ctx, d, pr, size);
    }
  }

  /**
   * Render active/selected drawings and anchors on the top canvas.
   * Called as part of the top canvas render pipeline.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} size
   */
  function drawTop(ctx, size) {
    const drawings = drawingEngine.drawings;
    const pr = size.pixelRatio;

    for (const d of drawings) {
      if (!d.visible) continue;
      if (d.state !== 'creating' && d.state !== 'selected') continue;

      renderDrawing(ctx, d, pr, size);

      // Draw anchor points for selected/creating drawings
      if (d.state === 'selected' || d.state === 'creating') {
        for (const point of d.points) {
          const px = drawingEngine.anchorToPixel(point);
          if (!px) continue;

          const bx = Math.round(px.x * pr);
          const by = Math.round(px.y * pr);
          const r = Math.round(ANCHOR_RADIUS * pr);

          // Outer circle (blue)
          ctx.beginPath();
          ctx.arc(bx, by, r + Math.round(pr), 0, Math.PI * 2);
          ctx.fillStyle = ANCHOR_STROKE;
          ctx.fill();

          // Inner circle (white)
          ctx.beginPath();
          ctx.arc(bx, by, r, 0, Math.PI * 2);
          ctx.fillStyle = ANCHOR_FILL;
          ctx.fill();
        }
      }
    }
  }

  /**
   * Render a single drawing on the given context.
   */
  function renderDrawing(ctx, drawing, pr, size) {
    const points = drawing.points.map(p => drawingEngine.anchorToPixel(p)).filter(Boolean);
    if (points.length === 0) return;

    // Convert to bitmap coordinates
    const bPoints = points.map(p => ({
      x: Math.round(p.x * pr),
      y: Math.round(p.y * pr),
    }));

    const style = drawing.style;
    const lineWidth = Math.max(1, Math.round(style.lineWidth * pr));

    switch (drawing.type) {
      case 'trendline':
        renderTrendline(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'hray':
        renderHorizontalRay(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'hline':
        renderHorizontalLine(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'ray':
        renderRay(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'extendedline':
        renderExtendedLine(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'fib':
        renderFibRetracement(ctx, bPoints, drawing.points, style, lineWidth, pr, size);
        break;
      case 'rect':
        renderRectangle(ctx, bPoints, style, lineWidth, pr);
        break;
      case 'channel':
        renderChannel(ctx, bPoints, style, lineWidth, pr, size);
        break;
      case 'crossline':
        renderCrossline(ctx, bPoints, style, lineWidth, pr, size);
        break;
    }
  }


  // ═══ Individual Tool Renderers ═══

  function renderTrendline(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderHorizontalRay(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    const y = pts[0].y;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, y);
    ctx.lineTo(size.bitmapWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    if (style.showLabel) {
      const pricePoint = drawingEngine.drawings.find(d =>
        d.points.some(p => {
          const px = drawingEngine.anchorToPixel(p);
          return px && Math.round(px.y * pr) === y;
        })
      );
      if (pricePoint && pricePoint.points[0]) {
        drawLabel(ctx, pricePoint.points[0].price.toFixed(2), size.bitmapWidth - Math.round(60 * pr), y, style.color, pr);
      }
    }
  }

  function renderHorizontalLine(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    const y = pts[0].y;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.bitmapWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderRay(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);

    // Extend from p0 through p1 to edge of canvas
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const scale = Math.max(size.bitmapWidth, size.bitmapHeight) * 2 / len;
    const endX = pts[0].x + dx * scale;
    const endY = pts[0].y + dy * scale;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderExtendedLine(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);

    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const scale = Math.max(size.bitmapWidth, size.bitmapHeight) * 2 / len;

    ctx.beginPath();
    ctx.moveTo(pts[0].x - dx * scale, pts[0].y - dy * scale);
    ctx.lineTo(pts[0].x + dx * scale, pts[0].y + dy * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderFibRetracement(ctx, pts, pricePoints, style, lw, pr, size) {
    if (pts.length < 2 || pricePoints.length < 2) return;

    const startPrice = pricePoints[0].price;
    const endPrice = pricePoints[1].price;
    const priceRange = endPrice - startPrice;
    const left = Math.min(pts[0].x, pts[1].x);
    const right = size.bitmapWidth;

    const fontSize = Math.round(11 * pr);
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = 'middle';

    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const level = FIB_LEVELS[i];
      const price = startPrice + priceRange * (1 - level);
      const anchorForY = drawingEngine.anchorToPixel({ price, time: pricePoints[0].time });
      if (!anchorForY) continue;
      const y = Math.round(anchorForY.y * pr);

      const levelColor = FIB_COLORS[level] || style.color;

      // Horizontal line
      ctx.strokeStyle = levelColor;
      ctx.lineWidth = lw;
      ctx.globalAlpha = level === 0 || level === 1 ? 0.8 : 0.5;
      ctx.setLineDash(level === 0.5 ? [Math.round(4 * pr), Math.round(4 * pr)] : []);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fill between levels
      if (i < FIB_LEVELS.length - 1 && style.opacity) {
        const nextLevel = FIB_LEVELS[i + 1];
        const nextPrice = startPrice + priceRange * (1 - nextLevel);
        const nextAnchor = drawingEngine.anchorToPixel({ price: nextPrice, time: pricePoints[0].time });
        if (nextAnchor) {
          const nextY = Math.round(nextAnchor.y * pr);
          ctx.fillStyle = levelColor;
          ctx.globalAlpha = style.opacity;
          ctx.fillRect(left, Math.min(y, nextY), right - left, Math.abs(nextY - y));
        }
      }

      // Label
      if (style.showLabel) {
        ctx.globalAlpha = 0.9;
        const labelText = `${(level * 100).toFixed(1)}% (${price.toFixed(2)})`;
        ctx.fillStyle = levelColor;
        ctx.textAlign = 'left';
        ctx.fillText(labelText, left + Math.round(8 * pr), y);
      }

      ctx.globalAlpha = 1;
    }
  }

  function renderRectangle(ctx, pts, style, lw, pr) {
    if (pts.length < 2) return;

    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);

    // Fill
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(x, y, w, h);
    }

    // Stroke
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }

  function renderChannel(ctx, pts, style, lw, pr, size) {
    if (pts.length < 2) return;

    // Draw two parallel lines
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;

    // Main line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();

    if (pts.length >= 3) {
      // Parallel line through third point
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;

      ctx.beginPath();
      ctx.moveTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
      ctx.stroke();

      // Fill between
      if (style.fillColor) {
        ctx.fillStyle = style.fillColor;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x + dx, pts[2].y + dy);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function renderCrossline(ctx, pts, style, lw, pr, size) {
    if (pts.length < 1) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = lw;
    ctx.setLineDash(style.dash ? style.dash.map(d => Math.round(d * pr)) : []);

    // Horizontal
    ctx.beginPath();
    ctx.moveTo(0, pts[0].y);
    ctx.lineTo(size.bitmapWidth, pts[0].y);
    ctx.stroke();

    // Vertical
    ctx.beginPath();
    ctx.moveTo(pts[0].x, 0);
    ctx.lineTo(pts[0].x, size.bitmapHeight);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  /** Draw a small text label */
  function drawLabel(ctx, text, x, y, color, pr) {
    const fontSize = Math.round(10 * pr);
    const padding = Math.round(3 * pr);
    ctx.font = `${fontSize}px Arial`;
    const tw = ctx.measureText(text).width;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x - padding, y - fontSize / 2 - padding, tw + padding * 2, fontSize + padding * 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  return {
    drawMain,
    drawTop,
  };
}
