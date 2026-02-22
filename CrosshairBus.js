// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.1 — CrosshairBus
// Sprint 5: Timestamp-based crosshair synchronization between panes.
//
// Design:
//   - Publisher: any ChartPane emits { timestamp, price, paneId }
//   - Subscribers: all OTHER panes receive and render a ghost crosshair
//   - Timestamp-aligned: works across different timeframes
//   - Self-filtering: pane ignores its own emissions
//   - Debounced at 16ms (~60fps) for performance
// ═══════════════════════════════════════════════════════════════════

/**
 * Lightweight event bus for crosshair synchronization.
 * Singleton — shared across all ChartPane instances.
 */
class CrosshairBus {
  constructor() {
    this._listeners = new Map();   // paneId → callback(data)
    this._lastEmit = 0;
    this._pendingEmit = null;
    this._enabled = true;
  }

  /**
   * Subscribe a pane to crosshair events.
   * @param {string} paneId - Unique pane identifier
   * @param {Function} callback - fn({ timestamp, price, paneId, mouseY })
   * @returns {Function} unsubscribe
   */
  subscribe(paneId, callback) {
    this._listeners.set(paneId, callback);
    return () => this._listeners.delete(paneId);
  }

  /**
   * Emit crosshair position from a source pane.
   * Debounced to ~60fps. Self-filtered (source pane won't receive).
   *
   * @param {string} sourcePaneId
   * @param {Object} data - { timestamp, price }
   */
  emit(sourcePaneId, data) {
    if (!this._enabled) return;

    const now = performance.now();
    if (now - this._lastEmit < 16) {
      // Throttle: schedule for next frame
      if (this._pendingEmit) cancelAnimationFrame(this._pendingEmit);
      this._pendingEmit = requestAnimationFrame(() => {
        this._broadcast(sourcePaneId, data);
        this._pendingEmit = null;
      });
      return;
    }

    this._lastEmit = now;
    this._broadcast(sourcePaneId, data);
  }

  /**
   * Clear the crosshair on all panes (mouse left chart area).
   * @param {string} sourcePaneId
   */
  clear(sourcePaneId) {
    for (const [paneId, cb] of this._listeners) {
      if (paneId !== sourcePaneId) {
        cb(null);
      }
    }
  }

  /**
   * Toggle sync on/off globally.
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      // Clear all synced crosshairs
      for (const [, cb] of this._listeners) cb(null);
    }
  }

  get enabled() { return this._enabled; }

  _broadcast(sourcePaneId, data) {
    const payload = { ...data, sourcePaneId };
    for (const [paneId, cb] of this._listeners) {
      if (paneId !== sourcePaneId) {
        cb(payload);
      }
    }
  }
}

// Singleton instance
const crosshairBus = new CrosshairBus();

export default crosshairBus;
export { CrosshairBus };
