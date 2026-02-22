// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Sync Service (Sprint 5.2)
//
// Bidirectional sync between IndexedDB (client) and server.
//
// Architecture:
//   1. Every mutation (add/update/delete trade) is logged to a
//      change queue with timestamps.
//   2. On sync, changes since last sync are sent to server.
//   3. Server returns changes from other devices since last sync.
//   4. Conflict resolution: last-write-wins based on _updatedAt.
//   5. Encryption: trade data encrypted client-side before upload
//      using a key derived from user's password (future).
//
// Sync states:
//   'idle' → 'syncing' → 'idle'
//   'idle' → 'syncing' → 'conflict' → 'idle' (if conflicts found)
//   'idle' → 'syncing' → 'error' → 'idle'
//
// Usage:
//   import { useSyncStore } from '../state/useSyncStore.js';
//   const sync = useSyncStore(s => s.sync);
//   await sync(); // manual sync
//   // Auto-sync runs every 5 minutes when authenticated
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyRemoteChanges, getClientId } from '../services/SyncUtils.js';

// ─── Change Queue ───────────────────────────────────────────────
// Tracks local mutations that haven't been synced yet.
// Each entry: { id, type: 'trade'|'note'|'playbook', action: 'upsert'|'delete', timestamp, data }

const useSyncStore = create(
  persist(
    (set, get) => ({
      // ─── State ────────────────────────────────────────────
      status: 'idle', // 'idle' | 'syncing' | 'error'
      lastSyncAt: null, // ISO string of last successful sync
      pendingChanges: 0,
      error: null,
      enabled: false, // Only enable when authenticated + pro
      autoSyncInterval: 5 * 60 * 1000, // 5 minutes

      // Change queue (persisted)
      _changeQueue: [],

      // ─── Queue Mutations ──────────────────────────────────
      /**
       * Log a local mutation to the sync queue.
       * Call this from store actions (addTrade, updateTrade, deleteTrade).
       */
      queueChange: (type, action, id, data = null) => {
        set((s) => {
          const change = {
            id,
            type, // 'trade', 'note', 'playbook', 'settings'
            action, // 'upsert', 'delete'
            timestamp: new Date().toISOString(),
            data: action === 'delete' ? null : data,
          };

          // Dedup: if same id+type already queued, replace it
          const filtered = s._changeQueue.filter(
            c => !(c.id === id && c.type === type)
          );

          return {
            _changeQueue: [...filtered, change],
            pendingChanges: filtered.length + 1,
          };
        });
      },

      // ─── Sync ─────────────────────────────────────────────
      /**
       * Execute a sync cycle.
       * 1. Send pending local changes to server
       * 2. Receive remote changes since lastSyncAt
       * 3. Apply remote changes locally (conflict resolution)
       * 4. Clear synced items from queue
       */
      sync: async (getToken, tradeStore) => {
        const state = get();
        if (state.status === 'syncing') return; // prevent double-sync
        if (!state.enabled) return;

        set({ status: 'syncing', error: null });

        try {
          const token = await getToken();
          if (!token || token === 'local-token') {
            set({ status: 'idle' });
            return;
          }

          const baseUrl = import.meta.env?.VITE_SYNC_URL || '/api/sync';

          // ── Step 1: Push local changes ────────────────────
          const localChanges = state._changeQueue;
          if (localChanges.length > 0) {
            const resp = await fetch(`${baseUrl}/push`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                changes: localChanges,
                clientId: getClientId(),
              }),
            });

            if (!resp.ok) {
              throw new Error(`Push failed: ${resp.status}`);
            }
          }

          // ── Step 2: Pull remote changes ───────────────────
          const since = state.lastSyncAt || '1970-01-01T00:00:00Z';
          const pullResp = await fetch(
            `${baseUrl}/pull?since=${encodeURIComponent(since)}&clientId=${getClientId()}`,
            {
              headers: { 'Authorization': `Bearer ${token}` },
            }
          );

          if (!pullResp.ok) {
            throw new Error(`Pull failed: ${pullResp.status}`);
          }

          const { changes: remoteChanges } = await pullResp.json();

          // ── Step 3: Apply remote changes ──────────────────
          if (remoteChanges?.length > 0 && tradeStore) {
            applyRemoteChanges(remoteChanges, tradeStore);
          }

          // ── Step 4: Clear queue and update timestamp ──────
          set({
            _changeQueue: [],
            pendingChanges: 0,
            lastSyncAt: new Date().toISOString(),
            status: 'idle',
            error: null,
          });

        } catch (err) {
          console.warn('[Sync] Failed:', err.message);
          set({ status: 'error', error: err.message });

          // Auto-recover: reset to idle after 30s
          setTimeout(() => {
            if (get().status === 'error') {
              set({ status: 'idle' });
            }
          }, 30000);
        }
      },

      // ─── Enable/Disable ───────────────────────────────────
      setEnabled: (enabled) => set({ enabled }),

      clearQueue: () => set({ _changeQueue: [], pendingChanges: 0 }),

      resetSync: () => set({
        _changeQueue: [],
        pendingChanges: 0,
        lastSyncAt: null,
        status: 'idle',
        error: null,
      }),
    }),
    {
      name: 'tradeforge-sync',
      partialize: (state) => ({
        _changeQueue: state._changeQueue,
        lastSyncAt: state.lastSyncAt,
        pendingChanges: state.pendingChanges,
        enabled: state.enabled,
      }),
    }
  )
);

// ─── Conflict Resolution ────────────────────────────────────────

// ─── Auto-Sync Hook ─────────────────────────────────────────────

/**
 * Start auto-sync interval. Returns cleanup function.
 * @param {Function} getToken - async function returning auth token
 * @param {Object} tradeStore - useTradeStore instance
 * @returns {Function} cleanup
 */
export function startAutoSync(getToken, tradeStore) {
  const state = useSyncStore.getState();
  if (!state.enabled) return () => {};

  const interval = setInterval(() => {
    const current = useSyncStore.getState();
    if (current.enabled && current.status === 'idle') {
      current.sync(getToken, tradeStore);
    }
  }, state.autoSyncInterval);

  // Initial sync
  setTimeout(() => {
    const current = useSyncStore.getState();
    if (current.enabled) current.sync(getToken, tradeStore);
  }, 3000);

  return () => clearInterval(interval);
}

export { useSyncStore, getClientId, applyRemoteChanges };
export default useSyncStore;
