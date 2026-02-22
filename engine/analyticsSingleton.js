// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Singleton
//
// Single shared AnalyticsBridge instance for the entire app.
// Eliminates duplicate Worker spawning across pages.
//
// Both DashboardPage and AnalyticsPage call computeAndStore()
// which routes through one Worker with:
//   1. Trade-hash memoization — skips recompute if data unchanged
//   2. Debounce — batches rapid additions (CSV import, bulk ops)
//   3. Latest-wins — stale results from superseded calls discarded
//
// Usage:
//   import { computeAndStore } from '../engine/analyticsSingleton.js';
//   useEffect(() => { computeAndStore(trades, { mcRuns: 500 }); }, [trades]);
// ═══════════════════════════════════════════════════════════════════

import { AnalyticsBridge } from './AnalyticsBridge.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';

let _instance = null;

// ─── Memoization State ──────────────────────────────────────────
let _lastHash = null;
let _lastSettingsKey = null;

// ─── Debounce State ─────────────────────────────────────────────
let _debounceTimer = null;
let _pendingTrades = null;
let _pendingSettings = null;

const DEBOUNCE_MS = 300; // ms — batch rapid additions (CSV import of 500+ trades) before recomputing

/**
 * Fast fingerprint of the trades array.
 * Uses count + first/last trade IDs + total P&L hash.
 * NOT cryptographic — just needs to detect data changes cheaply.
 *
 * Cost: O(n) on first call for P&L sum, but uses integer accumulation
 * which is very fast even at 50K trades (~2ms).
 *
 * @param {Object[]} trades
 * @returns {string} Hash string
 */
function tradeHash(trades) {
  if (!trades?.length) return 'empty';
  const n = trades.length;
  const first = trades[0]?.id || '';
  const last = trades[n - 1]?.id || '';

  // Sum P&L in integer cents for a content fingerprint.
  // This catches edits (changed P&L) and additions/deletions.
  let pnlSum = 0;
  for (let i = 0; i < n; i++) {
    pnlSum += Math.round((trades[i].pnl || 0) * 100);
  }

  return `${n}|${first}|${last}|${pnlSum}`;
}

/**
 * Serialize settings into a comparable key.
 * @param {Object} settings
 * @returns {string}
 */
function settingsKey(settings) {
  if (!settings || typeof settings !== 'object') return '{}';
  // Sort keys for deterministic comparison
  return JSON.stringify(settings, Object.keys(settings).sort());
}

/**
 * Get or create the singleton AnalyticsBridge.
 * Lazy-initialized on first call.
 * @returns {AnalyticsBridge}
 */
export function getAnalyticsBridge() {
  if (!_instance) {
    _instance = new AnalyticsBridge();
  }
  return _instance;
}

/**
 * Compute analytics via the singleton bridge and update the analytics store.
 *
 * Guards:
 *  - Trade-hash memoization: skips if trades data unchanged
 *  - Settings comparison: recomputes if mcRuns or other settings change
 *  - Debounce: batches rapid calls within 150ms window
 *  - Empty trades → clears store
 *  - Latest-wins: stale results from superseded calls discarded by Bridge
 *  - Error propagation to store
 *
 * @param {Object[]} trades - Array of trade objects
 * @param {Object} [settings={}] - Analytics settings (mcRuns, riskFreeRate, etc.)
 * @returns {Promise<void>}
 */
export async function computeAndStore(trades, settings = {}) {
  const store = useAnalyticsStore.getState();

  // ─── Guard: empty trades ─────────────────────────────────
  if (!trades?.length) {
    _lastHash = null;
    _lastSettingsKey = null;
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
    store.clear();
    return;
  }

  // ─── Guard: memoization — skip if data unchanged ─────────
  const hash = tradeHash(trades);
  const sKey = settingsKey(settings);

  if (hash === _lastHash && sKey === _lastSettingsKey) {
    // Data and settings identical — no recompute needed
    return;
  }

  // ─── Debounce: batch rapid calls ─────────────────────────
  // Store the latest args and reset the timer.
  // Only the last call within the debounce window fires.
  _pendingTrades = trades;
  _pendingSettings = settings;

  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
  }

  return new Promise((resolve) => {
    _debounceTimer = setTimeout(async () => {
      _debounceTimer = null;

      // Re-check hash after debounce (may have changed during wait)
      const currentHash = tradeHash(_pendingTrades);
      const currentSKey = settingsKey(_pendingSettings);

      if (currentHash === _lastHash && currentSKey === _lastSettingsKey) {
        resolve();
        return;
      }

      store.setComputing();
      const bridge = getAnalyticsBridge();

      try {
        const { data, ms, mode, discarded } = await bridge.compute(
          _pendingTrades,
          _pendingSettings
        );

        // latest-wins: if this call was superseded by a newer one, skip
        if (!discarded) {
          _lastHash = currentHash;
          _lastSettingsKey = currentSKey;
          store.setResult(data, ms, mode);
        }
      } catch (err) {
        console.warn('[analyticsSingleton] Compute failed:', err.message);
        store.setError(err.message);
      }

      resolve();
    }, DEBOUNCE_MS);
  });
}

/**
 * Force a recompute, bypassing the memoization cache.
 * Useful after schema migrations or setting changes.
 *
 * @param {Object[]} trades
 * @param {Object} [settings={}]
 * @returns {Promise<void>}
 */
export async function forceRecompute(trades, settings = {}) {
  _lastHash = null;
  _lastSettingsKey = null;
  return computeAndStore(trades, settings);
}

/**
 * Invalidate the memoization cache without triggering a recompute.
 * Next call to computeAndStore will run the computation.
 */
export function invalidateCache() {
  _lastHash = null;
  _lastSettingsKey = null;
}

/**
 * Terminate the singleton bridge. Safe to call if not initialized.
 * Used for cleanup in tests or app unmount.
 */
export function terminateBridge() {
  clearTimeout(_debounceTimer);
  _debounceTimer = null;
  _lastHash = null;
  _lastSettingsKey = null;
  _pendingTrades = null;
  _pendingSettings = null;

  if (_instance) {
    _instance.terminate();
    _instance = null;
  }
}
