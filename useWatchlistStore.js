// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Watchlist Store
//
// Manages user's symbol watchlist:
//   - Add/remove symbols
//   - Group by asset class
//   - Sort by name, change, P&L
//   - Persist to IndexedDB alongside trade data
//
// Usage:
//   watchlist.add({ symbol: 'ES', assetClass: 'futures' })
//   watchlist.remove('ES')
//   watchlist.list()
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const MAX_WATCHLIST = 50;

const DEFAULT_WATCHLIST = [
  { symbol: 'ES', name: 'E-mini S&P 500', assetClass: 'futures' },
  { symbol: 'NQ', name: 'E-mini Nasdaq', assetClass: 'futures' },
  { symbol: 'BTC', name: 'Bitcoin', assetClass: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', assetClass: 'crypto' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'stocks' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'etf' },
];

const useWatchlistStore = create((set, get) => ({
  items: [],
  loaded: false,

  /**
   * Add a symbol to the watchlist.
   * @param {Object} item - { symbol, name?, assetClass? }
   * @returns {boolean} true if added
   */
  add: (item) => {
    const s = get();
    const symbol = (item.symbol || '').toUpperCase().trim();
    if (!symbol) return false;
    if (s.items.some(i => i.symbol === symbol)) return false;
    if (s.items.length >= MAX_WATCHLIST) return false;

    set({
      items: [...s.items, {
        symbol,
        name: item.name || symbol,
        assetClass: item.assetClass || 'other',
        addedAt: Date.now(),
      }],
    });
    return true;
  },

  /**
   * Remove a symbol from the watchlist.
   * @param {string} symbol
   */
  remove: (symbol) => {
    const upper = (symbol || '').toUpperCase();
    set(s => ({
      items: s.items.filter(i => i.symbol !== upper),
    }));
  },

  /**
   * Move a symbol to a new position (for drag-and-drop reorder).
   * @param {number} fromIdx
   * @param {number} toIdx
   */
  reorder: (fromIdx, toIdx) => {
    set(s => {
      const items = [...s.items];
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return { items };
    });
  },

  /**
   * Update metadata for a symbol.
   * @param {string} symbol
   * @param {Object} updates - { name?, assetClass? }
   */
  update: (symbol, updates) => {
    const upper = (symbol || '').toUpperCase();
    set(s => ({
      items: s.items.map(i =>
        i.symbol === upper ? { ...i, ...updates } : i
      ),
    }));
  },

  /**
   * Check if a symbol is in the watchlist.
   * @param {string} symbol
   * @returns {boolean}
   */
  has: (symbol) => {
    return get().items.some(i => i.symbol === (symbol || '').toUpperCase());
  },

  /**
   * Clear the watchlist.
   */
  clear: () => set({ items: [] }),

  /**
   * Reset to default watchlist.
   */
  resetDefaults: () => set({ items: [...DEFAULT_WATCHLIST] }),

  /**
   * Hydrate from IndexedDB.
   * @param {Array} data
   */
  hydrate: (data) => {
    set({
      items: Array.isArray(data) && data.length > 0 ? data : [...DEFAULT_WATCHLIST],
      loaded: true,
    });
  },
}));

// ─── Utility: group by asset class ──────────────────────────────

/**
 * Group watchlist items by asset class.
 * @param {Array} items
 * @returns {Map<string, Array>}
 */
function groupByAssetClass(items) {
  const groups = new Map();
  const order = ['futures', 'stocks', 'crypto', 'etf', 'forex', 'options', 'other'];

  for (const cl of order) groups.set(cl, []);
  for (const item of items) {
    const cl = item.assetClass || 'other';
    if (!groups.has(cl)) groups.set(cl, []);
    groups.get(cl).push(item);
  }

  // Remove empty groups
  for (const [key, val] of groups) {
    if (val.length === 0) groups.delete(key);
  }

  return groups;
}

/**
 * Enrich watchlist items with trade stats from the journal.
 * @param {Array} watchlistItems
 * @param {Array} trades
 * @returns {Array} Items with { totalPnl, tradeCount, lastTraded }
 */
function enrichWithTradeStats(watchlistItems, trades) {
  // Build symbol → stats map once
  const statsMap = new Map();
  for (const t of trades) {
    if (!t.symbol) continue;
    const sym = t.symbol.toUpperCase();
    const stats = statsMap.get(sym) || { totalPnl: 0, tradeCount: 0, lastTraded: null };
    stats.totalPnl += (t.pnl || 0);
    stats.tradeCount += 1;
    if (!stats.lastTraded || t.date > stats.lastTraded) stats.lastTraded = t.date;
    statsMap.set(sym, stats);
  }

  return watchlistItems.map(item => ({
    ...item,
    ...( statsMap.get(item.symbol) || { totalPnl: 0, tradeCount: 0, lastTraded: null }),
  }));
}

// ─── Public API ─────────────────────────────────────────────────

const watchlist = {
  add: (item) => useWatchlistStore.getState().add(item),
  remove: (sym) => useWatchlistStore.getState().remove(sym),
  has: (sym) => useWatchlistStore.getState().has(sym),
  list: () => useWatchlistStore.getState().items,
  clear: () => useWatchlistStore.getState().clear(),
};

// ─── Exports ────────────────────────────────────────────────────

export {
  useWatchlistStore,
  watchlist,
  groupByAssetClass,
  enrichWithTradeStats,
  DEFAULT_WATCHLIST,
  MAX_WATCHLIST,
};
export default watchlist;
