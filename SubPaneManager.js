// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — SubPaneManager.js (Backward Compatibility Shim)
// Pane layout is now in src/chartEngine/PaneLayout.js
// ═══════════════════════════════════════════════════════════════════

export class SubPaneManager {
  constructor() { this.panes = []; }
  addPane(config) { this.panes.push(config); return this.panes.length - 1; }
  removePane(idx) { this.panes.splice(idx, 1); }
  getPanes() { return this.panes; }
  clear() { this.panes = []; }
}
