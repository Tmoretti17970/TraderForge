// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — CanvasBuffer.js (Backward Compatibility Shim)
// Canvas management is now in src/chartEngine/FancyCanvas.js
// ═══════════════════════════════════════════════════════════════════

export class CanvasBuffer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
  }
  resize(w, h) {
    if (!this.canvas) return;
    const pr = devicePixelRatio || 1;
    this.canvas.width = Math.round(w * pr);
    this.canvas.height = Math.round(h * pr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }
  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
