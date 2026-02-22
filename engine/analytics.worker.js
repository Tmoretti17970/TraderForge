// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Web Worker
//
// Runs computeFast() off the main thread.
// Protocol:
//   Main → Worker: { type: 'compute', trades: [...], settings: {...}, id }
//   Worker → Main: { type: 'result', data: {...}, id, ms }
//   Main → Worker: { type: 'ping' }
//   Worker → Main: { type: 'pong' }
//
// In production, this file is loaded via:
//   new Worker(new URL('./analytics.worker.js', import.meta.url), { type: 'module' })
//
// For environments without Worker support (SSR, tests), use AnalyticsBridge
// which falls back to synchronous computation on the main thread.
// ═══════════════════════════════════════════════════════════════════

import { computeFast } from './analyticsFast.js';

// Worker global scope handler
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => {
    const { type, trades, settings, id } = e.data || {};

    if (type === 'ping') {
      self.postMessage({ type: 'pong' });
      return;
    }

    if (type === 'compute') {
      const t0 = performance.now();
      try {
        const data = computeFast(trades, settings);
        const ms = Math.round((performance.now() - t0) * 100) / 100;
        self.postMessage({ type: 'result', data, id, ms });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message, id });
      }
      return;
    }
  };
}
