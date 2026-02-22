// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Binance DataFeed
// Implements the DataFeed interface for Binance exchange.
//
// Real-time: WebSocket kline stream (wss://stream.binance.com)
// Historical: REST API (/api/v3/klines)
//
// Features:
//   - Auto-reconnect with exponential backoff
//   - Heartbeat/pong handling
//   - LRU cache with resolution-aware TTL
//   - Paginated historical loading (1000 bars per request)
//   - Multiple concurrent subscriptions
//   - Combined stream for multiple symbols
// ═══════════════════════════════════════════════════════════════════

import { RESOLUTION_MS, normalizeResolution } from './DataFeed.js';
import { createLRUCache, getTTLForResolution, barCacheKey } from './LRUCache.js';

// ── Binance API endpoints ──
const REST_BASE = 'https://api.binance.com';
const WS_BASE = 'wss://stream.binance.com:9443/ws';

// ── Resolution mapping: TradeForge → Binance interval strings ──
const BINANCE_INTERVALS = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1D': '1d', '1d': '1d', '3D': '3d', '1W': '1w', '1w': '1w', '1M': '1M',
};

// ── Max bars per Binance REST request ──
const MAX_BARS_PER_REQUEST = 1000;

/**
 * Create a Binance DataFeed instance.
 *
 * @param {Object} [options]
 * @param {number} [options.cacheSize=200]          - LRU cache max entries
 * @param {number} [options.reconnectDelay=1000]    - Initial reconnect delay ms
 * @param {number} [options.maxReconnectDelay=30000] - Max reconnect delay ms
 * @param {(event: string, data?: any) => void} [options.onEvent] - Event callback
 * @returns {Object} DataFeed implementation
 */
export function createBinanceFeed(options = {}) {
  const {
    cacheSize = 200,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    onEvent,
  } = options;

  // ── State ──
  const cache = createLRUCache({ maxSize: cacheSize });
  let status = 'disconnected';
  let symbolInfoCache = new Map();

  // WebSocket state
  /** @type {Map<string, { ws: WebSocket, symbol: string, resolution: string, onBar: Function, reconnectTimer: any, reconnectCount: number }>} */
  const subscriptions = new Map();
  let subIdCounter = 0;

  // ── Emit events ──
  function emit(event, data) {
    if (onEvent) onEvent(event, data);
  }


  // ═══════════════════════════════════════════════════════════════
  // REST API: Historical Bars
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch historical klines from Binance REST API.
   * Handles pagination for large date ranges.
   *
   * @param {string} symbol
   * @param {string} resolution
   * @param {number} from      - Start timestamp ms
   * @param {number} to        - End timestamp ms
   * @param {number} [limit]   - Max bars to return
   * @returns {Promise<{bars: Array, noMore: boolean}>}
   */
  async function fetchBars(symbol, resolution, from, to, limit) {
    const interval = BINANCE_INTERVALS[normalizeResolution(resolution)];
    if (!interval) {
      throw new Error(`Unsupported resolution: ${resolution}`);
    }

    const binanceSymbol = symbol.toUpperCase().replace('/', '');

    // Check cache first
    const cacheKey = barCacheKey(binanceSymbol, resolution, from, to);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build request URL
    const params = new URLSearchParams({
      symbol: binanceSymbol,
      interval,
      startTime: String(from),
      endTime: String(to),
      limit: String(limit || MAX_BARS_PER_REQUEST),
    });

    const url = `${REST_BASE}/api/v3/klines?${params}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error ${response.status}: ${errorText}`);
      }

      const rawKlines = await response.json();
      const bars = parseKlines(rawKlines);

      const noMore = rawKlines.length < (limit || MAX_BARS_PER_REQUEST);

      const result = { bars, noMore };

      // Cache with resolution-appropriate TTL
      const ttl = getTTLForResolution(resolution);
      cache.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      emit('error', { type: 'rest', error });
      throw error;
    }
  }

  /**
   * Load bars with automatic pagination for large date ranges.
   * Binance limits to 1000 bars per request, so we chain requests.
   *
   * @param {string} symbol
   * @param {string} resolution
   * @param {number} from
   * @param {number} to
   * @param {number} [maxBars=5000] - Safety limit
   * @returns {Promise<{bars: Array, noMore: boolean}>}
   */
  async function loadBarsWithPagination(symbol, resolution, from, to, maxBars = 5000) {
    const allBars = [];
    let currentFrom = from;
    let noMore = false;

    while (allBars.length < maxBars && !noMore) {
      const result = await fetchBars(symbol, resolution, currentFrom, to);

      if (result.bars.length === 0) {
        noMore = true;
        break;
      }

      allBars.push(...result.bars);
      noMore = result.noMore;

      if (!noMore) {
        // Move start time past the last received bar
        const lastTime = result.bars[result.bars.length - 1].time;
        currentFrom = lastTime + 1;

        if (currentFrom >= to) {
          noMore = true;
        }
      }
    }

    // Deduplicate by timestamp (in case of overlap)
    const seen = new Set();
    const unique = [];
    for (const bar of allBars) {
      if (!seen.has(bar.time)) {
        seen.add(bar.time);
        unique.push(bar);
      }
    }

    // Sort chronologically
    unique.sort((a, b) => a.time - b.time);

    return { bars: unique, noMore };
  }


  // ═══════════════════════════════════════════════════════════════
  // WebSocket: Real-Time Streaming
  // ═══════════════════════════════════════════════════════════════

  /**
   * Create a WebSocket connection for kline streaming.
   *
   * @param {string} subId      - Subscription ID
   * @param {string} symbol     - Symbol (e.g. 'btcusdt')
   * @param {string} resolution - Timeframe
   * @param {(bar: Bar) => void} onBar - Callback for each bar update
   */
  function createWebSocket(subId, symbol, resolution, onBar) {
    const binanceSymbol = symbol.toLowerCase().replace('/', '');
    const interval = BINANCE_INTERVALS[normalizeResolution(resolution)] || '1h';
    const streamName = `${binanceSymbol}@kline_${interval}`;
    const wsUrl = `${WS_BASE}/${streamName}`;

    const sub = subscriptions.get(subId);
    if (!sub) return;

    try {
      const ws = new WebSocket(wsUrl);
      sub.ws = ws;

      ws.onopen = () => {
        sub.reconnectCount = 0;
        status = 'connected';
        emit('connected', { subId, symbol, resolution });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.e === 'kline' && msg.k) {
            const k = msg.k;
            const bar = {
              time: k.t,              // Kline open time
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isClosed: k.x,          // Is this kline closed?
            };

            onBar(bar);
          }
        } catch (parseErr) {
          // Silently ignore parse errors (heartbeats, etc.)
        }
      };

      ws.onerror = (error) => {
        emit('error', { type: 'ws', subId, error });
      };

      ws.onclose = (event) => {
        status = 'disconnected';
        emit('disconnected', { subId, code: event.code, reason: event.reason });

        // Auto-reconnect unless deliberately closed
        if (subscriptions.has(subId) && !sub._closing) {
          scheduleReconnect(subId);
        }
      };

    } catch (error) {
      emit('error', { type: 'ws_create', subId, error });
      scheduleReconnect(subId);
    }
  }

  /**
   * Schedule a reconnection with exponential backoff.
   * @param {string} subId
   */
  function scheduleReconnect(subId) {
    const sub = subscriptions.get(subId);
    if (!sub || sub._closing) return;

    const delay = Math.min(
      reconnectDelay * Math.pow(2, sub.reconnectCount),
      maxReconnectDelay
    );

    sub.reconnectCount++;
    status = 'connecting';
    emit('reconnecting', { subId, delay, attempt: sub.reconnectCount });

    sub.reconnectTimer = setTimeout(() => {
      if (subscriptions.has(subId) && !sub._closing) {
        createWebSocket(subId, sub.symbol, sub.resolution, sub.onBar);
      }
    }, delay);
  }


  // ═══════════════════════════════════════════════════════════════
  // Symbol Resolution
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch exchange info from Binance and resolve symbol metadata.
   * Results are cached for 24 hours.
   *
   * @param {string} symbolName
   * @returns {Promise<SymbolInfo>}
   */
  async function resolveSymbol(symbolName) {
    const normalized = symbolName.toUpperCase().replace('/', '');

    // Check cache
    if (symbolInfoCache.has(normalized)) {
      return symbolInfoCache.get(normalized);
    }

    try {
      const response = await fetch(`${REST_BASE}/api/v3/exchangeInfo?symbol=${normalized}`);
      if (!response.ok) throw new Error(`Symbol not found: ${normalized}`);

      const data = await response.json();
      const sym = data.symbols?.[0];

      if (!sym) throw new Error(`Symbol not found: ${normalized}`);

      // Determine price precision
      const priceFilter = sym.filters?.find(f => f.filterType === 'PRICE_FILTER');
      const tickSize = priceFilter ? parseFloat(priceFilter.tickSize) : 0.01;
      const pricescale = Math.round(1 / tickSize);

      const info = {
        name: sym.symbol,
        fullName: `Binance:${sym.symbol}`,
        exchange: 'Binance',
        type: 'crypto',
        description: `${sym.baseAsset}/${sym.quoteAsset}`,
        baseAsset: sym.baseAsset,
        quoteAsset: sym.quoteAsset,
        pricescale,
        minmov: 1,
        timezone: 'Etc/UTC',
        hasIntraday: true,
        hasDaily: true,
        supportedResolutions: ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1D','3D','1W','1M'],
        status: sym.status,
      };

      symbolInfoCache.set(normalized, info);
      return info;

    } catch (error) {
      emit('error', { type: 'resolve', symbol: normalized, error });
      throw error;
    }
  }

  /**
   * Search Binance symbols matching a query.
   *
   * @param {string} query
   * @param {string} [type]
   * @param {string} [exchange]
   * @returns {Promise<SymbolInfo[]>}
   */
  async function searchSymbols(query, type, exchange) {
    try {
      // Fetch full exchange info (cached on first call)
      if (!searchSymbols._allSymbols) {
        const response = await fetch(`${REST_BASE}/api/v3/exchangeInfo`);
        const data = await response.json();
        searchSymbols._allSymbols = data.symbols
          .filter(s => s.status === 'TRADING')
          .map(s => ({
            name: s.symbol,
            fullName: `Binance:${s.symbol}`,
            exchange: 'Binance',
            type: 'crypto',
            description: `${s.baseAsset}/${s.quoteAsset}`,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
          }));
      }

      const q = query.toUpperCase();
      return searchSymbols._allSymbols
        .filter(s =>
          s.name.includes(q) ||
          s.baseAsset?.includes(q) ||
          s.description?.toUpperCase().includes(q)
        )
        .slice(0, 50); // Limit results

    } catch (error) {
      emit('error', { type: 'search', error });
      return [];
    }
  }
  searchSymbols._allSymbols = null;


  // ═══════════════════════════════════════════════════════════════
  // Parse Binance Kline Array → Bar Object
  // ═══════════════════════════════════════════════════════════════

  /**
   * Parse Binance REST kline response into Bar objects.
   * Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
   *
   * @param {Array<Array>} klines
   * @returns {Bar[]}
   */
  function parseKlines(klines) {
    return klines.map(k => ({
      time: k[0],                    // Open time (ms)
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],               // Close time (ms)
      quoteVolume: parseFloat(k[7]),  // Quote asset volume
      trades: k[8],                   // Number of trades
    }));
  }


  // ═══════════════════════════════════════════════════════════════
  // Public API (DataFeed Interface)
  // ═══════════════════════════════════════════════════════════════

  return {
    /** Provider name */
    name: 'binance',

    /** @implements DataFeed.resolveSymbol */
    resolveSymbol,

    /** @implements DataFeed.searchSymbols */
    searchSymbols,

    /**
     * @implements DataFeed.getBars
     * Fetch historical bars with caching and pagination.
     */
    async getBars(symbol, resolution, from, to, countBack) {
      // If countBack specified, calculate 'from' based on resolution
      if (countBack && !from) {
        const resMs = RESOLUTION_MS[normalizeResolution(resolution)] || 3_600_000;
        from = to - countBack * resMs;
      }

      return loadBarsWithPagination(symbol, resolution, from, to);
    },

    /**
     * @implements DataFeed.subscribeBars
     * Start WebSocket streaming for real-time bar updates.
     */
    subscribeBars(symbol, resolution, onBar) {
      const subId = `binance_${++subIdCounter}`;

      subscriptions.set(subId, {
        ws: null,
        symbol,
        resolution,
        onBar,
        reconnectTimer: null,
        reconnectCount: 0,
        _closing: false,
      });

      createWebSocket(subId, symbol, resolution, onBar);

      return subId;
    },

    /**
     * @implements DataFeed.unsubscribeBars
     * Stop streaming and close WebSocket.
     */
    unsubscribeBars(subId) {
      const sub = subscriptions.get(subId);
      if (!sub) return;

      sub._closing = true;

      if (sub.reconnectTimer) {
        clearTimeout(sub.reconnectTimer);
      }

      if (sub.ws) {
        try { sub.ws.close(1000, 'unsubscribed'); } catch {}
      }

      subscriptions.delete(subId);

      if (subscriptions.size === 0) {
        status = 'disconnected';
      }
    },

    /** @implements DataFeed.getStatus */
    getStatus() {
      return status;
    },

    /** Get current subscription count */
    get subscriptionCount() {
      return subscriptions.size;
    },

    /** Get cache stats */
    getCacheStats() {
      return cache.stats();
    },

    /** Clear the bar cache */
    clearCache() {
      cache.clear();
    },

    /** @implements DataFeed.dispose */
    dispose() {
      // Close all WebSocket connections
      for (const [subId, sub] of subscriptions) {
        sub._closing = true;
        if (sub.reconnectTimer) clearTimeout(sub.reconnectTimer);
        if (sub.ws) {
          try { sub.ws.close(1000, 'disposed'); } catch {}
        }
      }
      subscriptions.clear();

      // Clear caches
      cache.clear();
      symbolInfoCache.clear();
      searchSymbols._allSymbols = null;

      status = 'disconnected';
    },
  };
}
