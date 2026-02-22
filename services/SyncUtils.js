// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Sync Utilities (Sprint 5.2)
//
// Pure utility functions for sync operations.
// Separated from useSyncStore to avoid Zustand dependency in tests.
// ═══════════════════════════════════════════════════════════════════

/**
 * Apply remote changes to local stores.
 * Uses last-write-wins based on _updatedAt timestamps.
 *
 * @param {Object[]} changes - Array of { id, type, action, data }
 * @param {Object} tradeStore - Object with getState() returning { trades, addTrade, updateTrade, deleteTrade }
 */
export function applyRemoteChanges(changes, tradeStore) {
  const state = tradeStore.getState();

  for (const change of changes) {
    if (change.type !== 'trade') continue;

    if (change.action === 'delete') {
      const exists = state.trades.find(t => t.id === change.id);
      if (exists) {
        tradeStore.getState().deleteTrade(change.id);
      }
      continue;
    }

    if (change.action === 'upsert' && change.data) {
      const local = state.trades.find(t => t.id === change.id);

      if (!local) {
        tradeStore.getState().addTrade(change.data);
      } else {
        const localTime = new Date(local._updatedAt || 0).getTime();
        const remoteTime = new Date(change.data._updatedAt || 0).getTime();

        if (remoteTime > localTime) {
          tradeStore.getState().updateTrade(change.id, change.data);
        }
      }
    }
  }
}

/**
 * Generate a stable client ID (persisted to localStorage).
 * @returns {string}
 */
export function getClientId() {
  try {
    if (typeof localStorage === 'undefined') return 'test-client';
    let id = localStorage.getItem('tradeforge-client-id');
    if (!id) {
      id = 'tf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('tradeforge-client-id', id);
    }
    return id;
  } catch {
    // Safari private browsing or storage disabled
    return 'tf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/**
 * Deduplicate a change queue — keep latest change per id+type.
 * @param {Object[]} queue
 * @param {Object} newChange
 * @returns {Object[]}
 */
export function deduplicateQueue(queue, newChange) {
  const filtered = queue.filter(
    c => !(c.id === newChange.id && c.type === newChange.type)
  );
  return [...filtered, newChange];
}

export default applyRemoteChanges;
