// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — AnalyticsBridge
//
// Bridges the analytics Web Worker for main-thread consumers.
// Falls back to synchronous computeFast() when Workers unavailable.
//
// Usage:
//   const bridge = new AnalyticsBridge();
//   await bridge.init();
//   const result = await bridge.compute(trades, settings);
//   bridge.terminate();
//
// The bridge deduplicates rapid calls — only the latest compute()
// resolves; earlier pending calls are discarded (debounce pattern).
// ═══════════════════════════════════════════════════════════════════

import { computeFast } from './analyticsFast.js';

let _idCounter = 0;

class AnalyticsBridge {
  constructor() {
    this._worker = null;
    this._useWorker = false;
    this._pending = null; // { id, resolve, reject }
    this._ready = false;
  }

  /**
   * Initialize the bridge. Attempts to spawn a Web Worker.
   * Falls back to sync mode silently on failure.
   *
   * @returns {Promise<{ mode: 'worker'|'sync' }>}
   */
  async init() {
    if (typeof Worker === 'undefined') {
      this._useWorker = false;
      this._ready = true;
      return { mode: 'sync' };
    }

    try {
      this._worker = new Worker(
        new URL('./analytics.worker.js', import.meta.url),
        { type: 'module' }
      );

      this._worker.onmessage = (e) => this._onMessage(e.data);
      this._worker.onerror = (err) => {
        console.warn('[AnalyticsBridge] Worker error, falling back to sync:', err.message);
        this._useWorker = false;
        this._rejectPending('Worker error');
      };

      // Ping to verify worker is alive
      const alive = await this._ping(2000);
      if (alive) {
        this._useWorker = true;
        this._ready = true;
        return { mode: 'worker' };
      }

      this._worker.terminate();
      this._worker = null;
    } catch (e) {
      // Worker creation failed (CSP, module support, etc.)
    }

    this._useWorker = false;
    this._ready = true;
    return { mode: 'sync' };
  }

  /**
   * Compute analytics. Returns a promise that resolves with the result.
   * If called while a previous compute is pending, the previous call
   * is silently discarded (latest-wins debounce).
   *
   * @param {Object[]} trades
   * @param {Object} [settings={}]
   * @returns {Promise<{ data: Object|null, ms: number, mode: 'worker'|'sync' }>}
   */
  async compute(trades, settings = {}) {
    if (!this._ready) await this.init();

    if (!this._useWorker) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const data = computeFast(trades, settings);
      const ms = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 100) / 100;
      return { data, ms, mode: 'sync' };
    }

    // Worker path — latest-wins pattern
    return new Promise((resolve, reject) => {
      // Discard any previous pending computation
      if (this._pending) {
        this._pending.resolve({
          data: null,
          ms: 0,
          mode: 'worker',
          discarded: true,
        });
      }

      const id = ++_idCounter;
      this._pending = { id, resolve, reject };

      this._worker.postMessage({
        type: 'compute',
        trades,
        settings,
        id,
      });
    });
  }

  /**
   * Terminate the worker. Safe to call multiple times.
   */
  terminate() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._useWorker = false;
    this._ready = false;
    this._rejectPending('Bridge terminated');
  }

  /** @returns {boolean} Whether the bridge is using a Web Worker */
  get isWorker() {
    return this._useWorker;
  }

  /** @returns {boolean} Whether the bridge is ready */
  get isReady() {
    return this._ready;
  }

  // ─── Internal ──────────────────────────────────────────────

  _onMessage(msg) {
    if (msg.type === 'pong') {
      if (this._pongResolve) {
        this._pongResolve(true);
        this._pongResolve = null;
      }
      return;
    }

    if (msg.type === 'result' || msg.type === 'error') {
      if (!this._pending || this._pending.id !== msg.id) return; // stale

      const { resolve, reject } = this._pending;
      this._pending = null;

      if (msg.type === 'error') {
        reject(new Error(msg.error));
      } else {
        resolve({ data: msg.data, ms: msg.ms, mode: 'worker' });
      }
    }
  }

  _rejectPending(reason) {
    if (this._pending) {
      this._pending.reject(new Error(reason));
      this._pending = null;
    }
  }

  _ping(timeoutMs = 2000) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pongResolve = null;
        resolve(false);
      }, timeoutMs);

      this._pongResolve = (val) => {
        clearTimeout(timer);
        resolve(val);
      };

      this._worker.postMessage({ type: 'ping' });
    });
  }
}

export { AnalyticsBridge };
export default AnalyticsBridge;
