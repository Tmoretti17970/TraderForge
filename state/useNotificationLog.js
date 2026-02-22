// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — NotificationLog
//
// Persistent action log that records all meaningful app events:
//   - Trade CRUD (add, edit, delete, import)
//   - Undo/redo operations
//   - CSV import summaries
//   - Reconciliation results
//   - Errors and warnings
//
// Entries are kept in memory (not persisted to IndexedDB — session only).
// Max 200 entries with auto-eviction of oldest.
//
// Integrates with:
//   - Toast.jsx (auto-logs every toast)
//   - UndoStack.js (logs undo/redo events)
//   - Any component via notificationLog.push()
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const MAX_ENTRIES = 200;

let _logId = 0;

// ─── Store ──────────────────────────────────────────────────────

const useNotificationLog = create((set, get) => ({
  entries: [],
  unreadCount: 0,
  panelOpen: false,

  /**
   * Push a new log entry.
   * @param {Object} entry
   * @param {string} entry.type - 'success' | 'error' | 'warning' | 'info' | 'undo' | 'redo'
   * @param {string} entry.message - Human-readable description
   * @param {string} [entry.category] - 'trade' | 'import' | 'reconcile' | 'system' | 'undo'
   * @param {Object} [entry.meta] - Additional data (trade id, symbol, etc.)
   */
  push: (entry) =>
    set((s) => {
      const record = {
        id: ++_logId,
        type: entry.type || 'info',
        message: entry.message || '',
        category: entry.category || 'system',
        meta: entry.meta || null,
        ts: Date.now(),
      };

      const newEntries = [...s.entries, record];
      // Evict oldest if over max
      while (newEntries.length > MAX_ENTRIES) {
        newEntries.shift();
      }

      return {
        entries: newEntries,
        unreadCount: s.panelOpen ? 0 : s.unreadCount + 1,
      };
    }),

  /**
   * Toggle the notification panel.
   */
  togglePanel: () =>
    set((s) => ({
      panelOpen: !s.panelOpen,
      // Clear unread when opening
      unreadCount: s.panelOpen ? s.unreadCount : 0,
    })),

  openPanel: () => set({ panelOpen: true, unreadCount: 0 }),
  closePanel: () => set({ panelOpen: false }),

  /**
   * Mark all as read (without opening panel).
   */
  markRead: () => set({ unreadCount: 0 }),

  /**
   * Clear all log entries.
   */
  clear: () => set({ entries: [], unreadCount: 0 }),
}));

// ─── Public API (callable from non-React code) ─────────────────

const notificationLog = {
  push: (entry) => useNotificationLog.getState().push(entry),
  clear: () => useNotificationLog.getState().clear(),
  toggle: () => useNotificationLog.getState().togglePanel(),
};

// ─── Exports ────────────────────────────────────────────────────

export { useNotificationLog, notificationLog, MAX_ENTRIES };
export default notificationLog;
