// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — navigateToTrade
//
// Cross-store coordination utility:
//   1. Sets chart symbol to match the trade
//   2. Switches to the Charts page
//   3. Emits a scroll event so ChartCanvas centers on the trade's bar
//
// Uses a lightweight event bus (no external deps) for decoupled
// communication between JournalPage → ChartsPage/ChartCanvas.
//
// Usage:
//   navigateToTrade(trade)           // from journal row click
//   navigateToTrade(trade, { tf })   // override timeframe
//
//   // In ChartCanvas:
//   tradeNav.on('navigate', ({ barTimestamp, tradeId }) => { ... })
// ═══════════════════════════════════════════════════════════════════

// ─── Event Bus (singleton) ──────────────────────────────────────

const _listeners = new Map();

const tradeNav = {
  /**
   * Subscribe to a navigation event.
   * @param {string} event - Event name ('navigate', 'highlight', 'clear')
   * @param {Function} fn - Handler
   * @returns {Function} Unsubscribe
   */
  on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event).add(fn);
    return () => _listeners.get(event)?.delete(fn);
  },

  /**
   * Emit a navigation event.
   * @param {string} event
   * @param {Object} payload
   */
  emit(event, payload) {
    const handlers = _listeners.get(event);
    if (!handlers) return;
    for (const fn of handlers) {
      try { fn(payload); } catch (_) { /* swallow */ }
    }
  },

  /** Remove all listeners (for testing). */
  clear() {
    _listeners.clear();
  },
};

// ─── Navigate To Trade ──────────────────────────────────────────

/**
 * Navigate the chart to display a specific trade.
 *
 * @param {Object} trade - Trade object from the journal
 * @param {string} trade.date - ISO datetime string
 * @param {string} trade.symbol - Instrument symbol
 * @param {string} trade.id - Trade ID
 * @param {number} [trade.entry] - Entry price
 * @param {number} [trade.exit] - Exit price
 * @param {string} [trade.side] - 'long' | 'short'
 * @param {Object} [opts]
 * @param {string} [opts.tf] - Override timeframe
 * @param {Function} [opts.setPage] - UI store setPage (injected to avoid import cycle)
 * @param {Function} [opts.setSymbol] - Chart store setSymbol
 * @param {Function} [opts.setTf] - Chart store setTf
 * @returns {{ success: boolean, symbol: string, timestamp: number }}
 */
function navigateToTrade(trade, opts = {}) {
  if (!trade?.date) {
    return { success: false, symbol: '', timestamp: 0 };
  }

  const symbol = (trade.symbol || '').toUpperCase();
  const timestamp = new Date(trade.date).getTime();

  if (!symbol || isNaN(timestamp)) {
    return { success: false, symbol, timestamp };
  }

  // 1. Set chart symbol (if store action provided)
  if (opts.setSymbol) {
    opts.setSymbol(symbol);
  }

  // 2. Set timeframe (if override provided)
  if (opts.tf && opts.setTf) {
    opts.setTf(opts.tf);
  }

  // 3. Switch to Charts page
  if (opts.setPage) {
    opts.setPage('charts');
  }

  // 4. Emit navigation event for ChartCanvas to scroll
  //    Delay slightly to allow React state updates to propagate
  setTimeout(() => {
    tradeNav.emit('navigate', {
      tradeId: trade.id,
      symbol,
      timestamp,
      entry: trade.entry || null,
      exit: trade.exit || null,
      side: trade.side || null,
      pnl: trade.pnl || 0,
    });
  }, 50);

  return { success: true, symbol, timestamp };
}

// ─── Scroll To Timestamp (for ChartCanvas) ──────────────────────

/**
 * Given OHLCV data and a target timestamp, return the bar index
 * to scroll to (binary search).
 *
 * @param {Array} data - OHLCV data array (each item has .time in ms)
 * @param {number} timestamp - Target timestamp in ms
 * @returns {number} Bar index (-1 if not found)
 */
function findBarByTimestamp(data, timestamp) {
  if (!data?.length || !timestamp) return -1;

  let lo = 0;
  let hi = data.length - 1;
  let best = -1;
  let bestDiff = Infinity;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const barTime = data[mid].time || new Date(data[mid].date).getTime();
    const diff = Math.abs(barTime - timestamp);

    if (diff < bestDiff) {
      bestDiff = diff;
      best = mid;
    }

    if (barTime < timestamp) lo = mid + 1;
    else if (barTime > timestamp) hi = mid - 1;
    else return mid; // exact match
  }

  return best;
}

/**
 * Calculate the scroll offset to center a bar in the chart viewport.
 *
 * @param {number} barIdx - Target bar index
 * @param {number} totalBars - Total number of bars in data
 * @param {number} visibleBars - Number of visible bars in viewport
 * @returns {number} startIdx for the viewport
 */
function centerBarInViewport(barIdx, totalBars, visibleBars) {
  const halfVisible = Math.floor(visibleBars / 2);
  const idealStart = barIdx - halfVisible;
  return Math.max(0, Math.min(idealStart, totalBars - visibleBars));
}

// ─── useTradeNavigation Hook (for ChartCanvas) ─────────────────

/**
 * React hook that listens for trade navigation events and
 * provides the target bar index for ChartCanvas to scroll to.
 *
 * Usage in ChartCanvas:
 *   const { targetBarIdx, highlightedTradeId, clearHighlight } = useTradeNavigation(data);
 *
 *   useEffect(() => {
 *     if (targetBarIdx >= 0) scrollTo(targetBarIdx);
 *   }, [targetBarIdx]);
 *
 * @param {Array} data - OHLCV data array
 * @param {number} visibleBars - Number of visible bars in viewport
 * @returns {{ targetBarIdx: number, highlightedTradeId: string|null, activeNav: Object|null, clearHighlight: Function }}
 */
function useTradeNavigation(data, visibleBars = 60) {
  // This is a pure JS function that returns state management helpers.
  // React integration is handled by the consumer (ChartCanvas).
  // We export this as a factory that ChartCanvas can use with useEffect.

  let _targetBarIdx = -1;
  let _highlightedTradeId = null;
  let _activeNav = null;

  const state = {
    get targetBarIdx() { return _targetBarIdx; },
    get highlightedTradeId() { return _highlightedTradeId; },
    get activeNav() { return _activeNav; },

    handleNavigate(payload) {
      if (!data?.length) return null;

      const barIdx = findBarByTimestamp(data, payload.timestamp);
      if (barIdx < 0) return null;

      _targetBarIdx = barIdx;
      _highlightedTradeId = payload.tradeId;
      _activeNav = payload;

      const startIdx = centerBarInViewport(barIdx, data.length, visibleBars);
      return { barIdx, startIdx };
    },

    clearHighlight() {
      _targetBarIdx = -1;
      _highlightedTradeId = null;
      _activeNav = null;
    },
  };

  return state;
}

// ─── Exports ────────────────────────────────────────────────────

export {
  tradeNav,
  navigateToTrade,
  findBarByTimestamp,
  centerBarInViewport,
  useTradeNavigation,
};
export default navigateToTrade;
