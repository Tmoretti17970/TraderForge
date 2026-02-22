// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — DataManager
// Orchestrates the connection between DataFeed and ChartEngine.
//
// Responsibilities:
//   - Load initial bars when symbol/timeframe changes
//   - Subscribe to real-time updates and push to engine
//   - Lazy-load older bars when user scrolls left
//   - Track loading state for UI feedback
//   - Handle feed errors and reconnection
// ═══════════════════════════════════════════════════════════════════

import { RESOLUTION_MS, normalizeResolution } from './DataFeed.js';

/**
 * @typedef {Object} DataManagerOptions
 * @property {number} [initialBars=300]   - Bars to load initially
 * @property {number} [loadMoreBars=500]  - Bars to load on scroll-left
 * @property {number} [scrollThreshold=20] - Bars from left edge to trigger load
 */

/**
 * Create a DataManager that connects a DataFeed to a ChartEngine.
 *
 * @param {Object} engine   - ChartEngine instance
 * @param {Object} dataFeed - DataFeed instance (e.g., BinanceFeed)
 * @param {DataManagerOptions} [options]
 * @returns {Object} DataManager instance
 */
export function createDataManager(engine, dataFeed, options = {}) {
  const {
    initialBars = 300,
    loadMoreBars = 500,
    scrollThreshold = 20,
  } = options;

  // ── State ──
  let currentSymbol = '';
  let currentResolution = '1h';
  let subscriptionId = null;
  let isLoading = false;
  let hasMoreHistory = true;
  let oldestTimestamp = Infinity;
  let disposed = false;

  /** @type {((state: {loading: boolean, status: string, error?: string}) => void)|null} */
  let onStateChange = null;

  // ── State notifications ──
  function notifyState(loading, statusStr, error) {
    isLoading = loading;
    if (onStateChange) {
      onStateChange({ loading, status: statusStr, error });
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // Symbol / Timeframe Switching
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load a new symbol + timeframe. Clears existing data,
   * fetches initial history, subscribes to real-time stream.
   *
   * @param {string} symbol
   * @param {string} resolution
   */
  async function loadSymbol(symbol, resolution) {
    if (disposed) return;

    const normalizedRes = normalizeResolution(resolution);

    // Unsubscribe from previous stream
    if (subscriptionId) {
      dataFeed.unsubscribeBars(subscriptionId);
      subscriptionId = null;
    }

    currentSymbol = symbol;
    currentResolution = normalizedRes;
    hasMoreHistory = true;
    oldestTimestamp = Infinity;

    // Update engine metadata
    engine.setSymbol(symbol);
    engine.setTimeframe(normalizedRes);

    // Clear existing data
    engine.setData([]);
    notifyState(true, 'loading');

    try {
      // ── Resolve symbol info ──
      let symbolInfo;
      try {
        symbolInfo = await dataFeed.resolveSymbol(symbol);
      } catch {
        // Non-fatal: continue without symbol info
      }

      // ── Load initial historical bars ──
      const now = Date.now();
      const resMs = RESOLUTION_MS[normalizedRes] || 3_600_000;
      const from = now - initialBars * resMs;

      const result = await dataFeed.getBars(symbol, normalizedRes, from, now);

      if (disposed || currentSymbol !== symbol || currentResolution !== normalizedRes) {
        return; // Symbol changed during load — discard
      }

      if (result.bars.length > 0) {
        engine.setData(result.bars);
        oldestTimestamp = result.bars[0].time;
        hasMoreHistory = !result.noMore;
      }

      notifyState(false, 'ready');

      // ── Subscribe to real-time stream ──
      subscriptionId = dataFeed.subscribeBars(symbol, normalizedRes, (bar) => {
        if (disposed || currentSymbol !== symbol) return;
        engine.updateBar(bar);
      });

    } catch (error) {
      notifyState(false, 'error', error.message);
      console.error(`[DataManager] Failed to load ${symbol}:`, error);
    }
  }

  /**
   * Change timeframe for the current symbol.
   * Reloads all data.
   *
   * @param {string} resolution
   */
  async function setResolution(resolution) {
    if (!currentSymbol) return;
    await loadSymbol(currentSymbol, resolution);
  }


  // ═══════════════════════════════════════════════════════════════
  // Lazy Loading (scroll-left triggers history fetch)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load older bars. Called when user scrolls near the left edge.
   * Prepends data to the engine.
   */
  async function loadMoreHistory() {
    if (disposed || isLoading || !hasMoreHistory || !currentSymbol) return;

    notifyState(true, 'loading_more');

    try {
      const resMs = RESOLUTION_MS[currentResolution] || 3_600_000;
      const to = oldestTimestamp - 1;
      const from = to - loadMoreBars * resMs;

      const result = await dataFeed.getBars(currentSymbol, currentResolution, from, to);

      if (disposed) return;

      if (result.bars.length > 0) {
        engine.prependBars(result.bars);
        oldestTimestamp = result.bars[0].time;
        hasMoreHistory = !result.noMore;
      } else {
        hasMoreHistory = false;
      }

      notifyState(false, 'ready');

    } catch (error) {
      notifyState(false, 'error', error.message);
      console.error('[DataManager] Failed to load history:', error);
    }
  }

  /**
   * Check if we need to load more history based on scroll position.
   * Call this from the chart's scroll handler.
   */
  function checkScrollPosition() {
    if (!hasMoreHistory || isLoading) return;

    const range = engine.visibleRange;
    if (range.start <= scrollThreshold) {
      loadMoreHistory();
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  const manager = {
    /**
     * Load a symbol with the specified timeframe.
     * @param {string} symbol
     * @param {string} [resolution='1h']
     */
    async load(symbol, resolution = '1h') {
      await loadSymbol(symbol, resolution);
    },

    /**
     * Switch timeframe.
     * @param {string} resolution
     */
    async switchTimeframe(resolution) {
      await setResolution(resolution);
    },

    /**
     * Switch symbol.
     * @param {string} symbol
     */
    async switchSymbol(symbol) {
      await loadSymbol(symbol, currentResolution);
    },

    /** Trigger history loading (call from scroll handler) */
    checkScroll: checkScrollPosition,

    /** Manually load more history */
    loadMore: loadMoreHistory,

    /** Register state change callback */
    onStateChange(callback) {
      onStateChange = callback;
    },

    // ── Getters ──

    get symbol() { return currentSymbol; },
    get resolution() { return currentResolution; },
    get isLoading() { return isLoading; },
    get hasMoreHistory() { return hasMoreHistory; },
    get feedStatus() { return dataFeed.getStatus(); },

    /** Get the underlying DataFeed */
    get feed() { return dataFeed; },

    /**
     * Search symbols via the data feed.
     * @param {string} query
     * @returns {Promise<Array>}
     */
    async searchSymbols(query) {
      return dataFeed.searchSymbols(query);
    },

    /** Dispose: unsubscribe and cleanup */
    dispose() {
      if (disposed) return;
      disposed = true;

      if (subscriptionId) {
        dataFeed.unsubscribeBars(subscriptionId);
        subscriptionId = null;
      }

      onStateChange = null;
    },
  };

  return manager;
}
