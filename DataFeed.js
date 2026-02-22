// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — DataFeed Interface
// Abstract contract for all market data providers.
//
// Modeled after TradingView's JS Datafeed API so we can swap
// providers (Binance → Polygon → Cboe) without touching chart code.
//
// Any DataFeed implementation must provide:
//   - resolveSymbol()    → symbol metadata
//   - getBars()          → historical OHLCV bars
//   - subscribeBars()    → real-time streaming
//   - unsubscribeBars()  → stop streaming
//   - searchSymbols()    → symbol search
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SymbolInfo
 * @property {string}  name           - Display name (e.g. "BTCUSDT")
 * @property {string}  fullName       - Full name (e.g. "Binance:BTCUSDT")
 * @property {string}  exchange       - Exchange name
 * @property {string}  type           - 'crypto' | 'stock' | 'forex' | 'futures'
 * @property {string}  description    - Human-readable description
 * @property {number}  pricescale     - Price precision (100 = 2 decimals, 100000000 = 8)
 * @property {number}  minmov         - Minimum price movement (usually 1)
 * @property {string}  timezone       - Timezone identifier
 * @property {boolean} hasIntraday    - Supports intraday timeframes
 * @property {boolean} hasDaily       - Supports daily timeframes
 * @property {string[]} supportedResolutions - Available timeframes
 */

/**
 * @typedef {Object} Bar
 * @property {number} time   - Unix timestamp in milliseconds
 * @property {number} open   - Open price
 * @property {number} high   - High price
 * @property {number} low    - Low price
 * @property {number} close  - Close price
 * @property {number} volume - Volume
 */

/**
 * @typedef {Object} GetBarsResult
 * @property {Bar[]}   bars    - Array of OHLCV bars
 * @property {boolean} noMore  - True if no more historical data available
 */

/**
 * @typedef {Object} DataFeedEvents
 * @property {(bar: Bar) => void}  onBar         - New/updated bar
 * @property {(error: Error) => void} onError    - Connection error
 * @property {() => void}         onConnected    - Connected to feed
 * @property {() => void}         onDisconnected - Disconnected from feed
 */

/**
 * Abstract DataFeed interface.
 * All data providers must implement these methods.
 *
 * @interface DataFeed
 */
export const DataFeedInterface = {
  /**
   * Resolve a symbol string to full symbol metadata.
   * @param {string} symbolName
   * @returns {Promise<SymbolInfo>}
   */
  async resolveSymbol(symbolName) {},

  /**
   * Fetch historical OHLCV bars.
   * @param {string} symbol      - Symbol name
   * @param {string} resolution  - Timeframe ('1m','5m','15m','1h','4h','1D','1W')
   * @param {number} from        - Start timestamp (ms)
   * @param {number} to          - End timestamp (ms)
   * @param {number} [countBack] - Number of bars to load (alternative to from/to)
   * @returns {Promise<GetBarsResult>}
   */
  async getBars(symbol, resolution, from, to, countBack) {},

  /**
   * Subscribe to real-time bar updates.
   * @param {string}   symbol     - Symbol name
   * @param {string}   resolution - Timeframe
   * @param {(bar: Bar) => void} onBar - Callback for each bar update
   * @returns {string} subscriptionId - Used to unsubscribe
   */
  subscribeBars(symbol, resolution, onBar) {},

  /**
   * Unsubscribe from real-time updates.
   * @param {string} subscriptionId
   */
  unsubscribeBars(subscriptionId) {},

  /**
   * Search for symbols matching a query.
   * @param {string} query       - Search text
   * @param {string} [type]      - Filter by type ('crypto','stock',etc)
   * @param {string} [exchange]  - Filter by exchange
   * @returns {Promise<SymbolInfo[]>}
   */
  async searchSymbols(query, type, exchange) {},

  /**
   * Get connection status.
   * @returns {'connected'|'connecting'|'disconnected'|'error'}
   */
  getStatus() {},

  /**
   * Dispose: close connections, clear caches.
   */
  dispose() {},
};


// ═══════════════════════════════════════════════════════════════════
// Resolution Helpers
// ═══════════════════════════════════════════════════════════════════

/** Map user-facing timeframe strings to millisecond intervals */
export const RESOLUTION_MS = {
  '1m':  60_000,
  '3m':  180_000,
  '5m':  300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h':  3_600_000,
  '2h':  7_200_000,
  '4h':  14_400_000,
  '6h':  21_600_000,
  '8h':  28_800_000,
  '12h': 43_200_000,
  '1D':  86_400_000,
  '1d':  86_400_000,
  '3D':  259_200_000,
  '1W':  604_800_000,
  '1w':  604_800_000,
  '1M':  2_592_000_000,
};

/** Normalize resolution string to canonical form */
export function normalizeResolution(res) {
  const map = {
    '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m',
    '60': '1h', '120': '2h', '240': '4h', '360': '6h', '480': '8h',
    '720': '12h', 'D': '1D', 'W': '1W', 'M': '1M',
    '1min': '1m', '5min': '5m', '15min': '15m', '1hour': '1h', '4hour': '4h',
    '1day': '1D', '1week': '1W',
  };
  return map[res] || res;
}
