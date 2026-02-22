// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — UndoStack
//
// Bounded undo/redo history for destructive trade operations.
// Pure JS — no React dependency — fully testable in Node.
//
// Stores lightweight inverse-operation descriptors, not full snapshots.
// Each entry: { type, payload, inverse, label, ts }
//   type:    'delete' | 'update' | 'bulkDelete' | 'bulkAdd'
//   payload: data needed to execute the redo
//   inverse: data needed to execute the undo
//   label:   human-readable description
//   ts:      timestamp (for TTL expiry)
//
// Design decisions:
//   - Max 50 entries (bounded memory)
//   - 5-minute TTL per entry (stale entries auto-evict)
//   - Pushing a new action clears the redo stack (standard behavior)
//   - Thread-safe: single consumer (UI thread only)
//
// Usage:
//   const stack = new UndoStack();
//   stack.push({ type: 'delete', payload: { id }, inverse: { trade }, label: 'Delete ES trade' });
//   const entry = stack.undo(); // returns the inverse data
//   const entry = stack.redo(); // returns the forward data
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_MAX = 50;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

class UndoStack {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.max=50] - Maximum history entries
   * @param {number} [opts.ttlMs=300000] - Time-to-live per entry (ms)
   */
  constructor(opts = {}) {
    this._max = opts.max ?? DEFAULT_MAX;
    this._ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this._past = [];    // undo stack (most recent at end)
    this._future = [];  // redo stack (most recent at end)
    this._listeners = new Set();
  }

  // ─── Core API ────────────────────────────────────────────────

  /**
   * Push a new undoable action onto the stack.
   * Clears the redo stack (standard undo behavior).
   *
   * @param {Object} entry
   * @param {string} entry.type - Action type ('delete', 'update', 'bulkDelete', 'bulkAdd')
   * @param {Object} entry.payload - Forward operation data
   * @param {Object} entry.inverse - Inverse operation data (for undo)
   * @param {string} entry.label - Human-readable description
   * @returns {Object} The pushed entry (with timestamp added)
   */
  push(entry) {
    this._evictStale();

    const record = {
      type: entry.type,
      payload: entry.payload,
      inverse: entry.inverse,
      label: entry.label || '',
      ts: Date.now(),
    };

    this._past.push(record);

    // Enforce max size
    while (this._past.length > this._max) {
      this._past.shift();
    }

    // Clear redo stack (new action invalidates future)
    this._future.length = 0;

    this._notify();
    return record;
  }

  /**
   * Undo the most recent action.
   * @returns {Object|null} The entry that was undone (with inverse data), or null if nothing to undo.
   */
  undo() {
    this._evictStale();

    if (this._past.length === 0) return null;

    const entry = this._past.pop();
    this._future.push(entry);
    this._notify();
    return entry;
  }

  /**
   * Redo the most recently undone action.
   * @returns {Object|null} The entry that was redone (with payload data), or null if nothing to redo.
   */
  redo() {
    if (this._future.length === 0) return null;

    const entry = this._future.pop();
    // Refresh timestamp on redo
    entry.ts = Date.now();
    this._past.push(entry);
    this._notify();
    return entry;
  }

  // ─── State Queries ──────────────────────────────────────────

  /** Can undo? */
  get canUndo() {
    this._evictStale();
    return this._past.length > 0;
  }

  /** Can redo? */
  get canRedo() {
    return this._future.length > 0;
  }

  /** Number of undoable entries */
  get undoCount() {
    this._evictStale();
    return this._past.length;
  }

  /** Number of redoable entries */
  get redoCount() {
    return this._future.length;
  }

  /** Peek at the next undoable entry (without popping) */
  peekUndo() {
    this._evictStale();
    return this._past.length > 0 ? this._past[this._past.length - 1] : null;
  }

  /** Peek at the next redoable entry (without popping) */
  peekRedo() {
    return this._future.length > 0 ? this._future[this._future.length - 1] : null;
  }

  /**
   * Get full history (for debug panel / notification log).
   * Returns past entries in reverse chronological order.
   * @returns {Array<Object>}
   */
  history() {
    this._evictStale();
    return [...this._past].reverse();
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  /** Clear all undo/redo history. */
  clear() {
    this._past.length = 0;
    this._future.length = 0;
    this._notify();
  }

  // ─── Subscription (for Zustand bridge) ──────────────────────

  /**
   * Subscribe to state changes.
   * @param {Function} fn - Called on every push/undo/redo/clear
   * @returns {Function} Unsubscribe function
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** @private */
  _notify() {
    for (const fn of this._listeners) {
      try { fn(); } catch (_) { /* swallow listener errors */ }
    }
  }

  // ─── TTL Eviction ──────────────────────────────────────────

  /** @private Remove stale entries from the past stack. */
  _evictStale() {
    if (this._ttlMs <= 0) return; // TTL disabled
    const cutoff = Date.now() - this._ttlMs;
    // Evict from the front (oldest entries)
    while (this._past.length > 0 && this._past[0].ts < cutoff) {
      this._past.shift();
    }
  }

  // ─── Snapshot (for testing) ─────────────────────────────────

  /** Get internal state for testing. */
  _snapshot() {
    return {
      past: [...this._past],
      future: [...this._future],
    };
  }
}

// ─── Singleton instance ─────────────────────────────────────────

const undoStack = new UndoStack();

// ─── Executor: applies undo/redo entries to the trade store ────

/**
 * Execute an undo entry against the trade store.
 * Called by the global undo handler (Ctrl+Z).
 *
 * @param {Object} entry - The entry returned by undoStack.undo()
 * @param {Object} store - Zustand store actions (addTrade, deleteTrade, updateTrade, addTrades)
 * @returns {string} Description of what was undone
 */
function executeUndo(entry, store) {
  if (!entry) return '';

  switch (entry.type) {
    case 'delete':
      // Inverse of delete = re-add the trade
      store.addTrade(entry.inverse.trade);
      return `Restored "${entry.inverse.trade.symbol || 'trade'}"`;

    case 'update':
      // Inverse of update = restore previous state
      store.updateTrade(entry.inverse.id, entry.inverse.prev);
      return `Reverted "${entry.inverse.prev.symbol || 'trade'}" edit`;

    case 'bulkDelete':
      // Inverse of bulk delete = re-add all trades
      store.addTrades(entry.inverse.trades);
      return `Restored ${entry.inverse.trades.length} trades`;

    case 'bulkAdd':
      // Inverse of bulk add = delete all added trades
      for (const id of entry.inverse.ids) {
        store.deleteTrade(id);
      }
      return `Removed ${entry.inverse.ids.length} trades`;

    default:
      return '';
  }
}

/**
 * Execute a redo entry against the trade store.
 * Called by the global redo handler (Ctrl+Shift+Z).
 *
 * @param {Object} entry - The entry returned by undoStack.redo()
 * @param {Object} store - Zustand store actions
 * @returns {string} Description of what was redone
 */
function executeRedo(entry, store) {
  if (!entry) return '';

  switch (entry.type) {
    case 'delete':
      // Forward of delete = delete the trade again
      store.deleteTrade(entry.payload.id);
      return `Deleted "${entry.payload.symbol || 'trade'}" again`;

    case 'update':
      // Forward of update = apply the updates again
      store.updateTrade(entry.payload.id, entry.payload.updates);
      return `Re-applied "${entry.payload.symbol || 'trade'}" edit`;

    case 'bulkDelete':
      // Forward of bulk delete = delete all again
      for (const id of entry.payload.ids) {
        store.deleteTrade(id);
      }
      return `Deleted ${entry.payload.ids.length} trades again`;

    case 'bulkAdd':
      // Forward of bulk add = re-add all trades
      store.addTrades(entry.payload.trades);
      return `Re-imported ${entry.payload.trades.length} trades`;

    default:
      return '';
  }
}

// ─── Exports ────────────────────────────────────────────────────

export { UndoStack, undoStack, executeUndo, executeRedo };
export default undoStack;
