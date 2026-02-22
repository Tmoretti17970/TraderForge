// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — DataProvider (Sprint 6)
//
// C2.3: Abstract data fetching behind a provider interface.
//       Polygon.io + Alpha Vantage adapters for equities.
// C2.4: Multi-asset WebSocket provider abstraction.
//
// Architecture:
//   DataProvider.fetchOHLC(symbol, tfId, opts) → { data, source }
//   DataProvider.subscribe(symbol, tf, callbacks) → unsubscribe fn
//
// Provider priority (equities):
//   1. Polygon.io (if API key set) — best quality, 5 free req/min
//   2. Alpha Vantage (if API key set) — 25 free req/day
//   3. Yahoo Finance (no key needed) — unreliable 403s
//   4. Simulated fallback
//
// Provider priority (crypto):
//   1. CoinGecko (no key) — 10 req/min
//   2. Binance REST (no key) — high limit
//   3. Simulated fallback
// ═══════════════════════════════════════════════════════════════════

import { isCrypto } from '../constants.js';

// ─── API Key Storage ─────────────────────────────────────────────
// Keys stored in localStorage, read lazily.

const KEY_PREFIX = 'tradeforge-apikey-';

function getApiKey(provider) {
  try { return localStorage.getItem(KEY_PREFIX + provider) || ''; }
  catch { return ''; }
}

function setApiKey(provider, key) {
  try {
    if (key) localStorage.setItem(KEY_PREFIX + provider, key);
    else localStorage.removeItem(KEY_PREFIX + provider);
  } catch { /* SSR or private mode */ }
}

function hasApiKey(provider) {
  return getApiKey(provider).length > 0;
}

// ─── Polygon.io Adapter ─────────────────────────────────────────

const POLYGON_TF_MAP = {
  '1d': { multiplier: 5,  timespan: 'minute', limit: 288 },
  '5d': { multiplier: 15, timespan: 'minute', limit: 480 },
  '1m': { multiplier: 1,  timespan: 'hour',   limit: 720 },
  '3m': { multiplier: 1,  timespan: 'day',    limit: 90 },
  '6m': { multiplier: 1,  timespan: 'day',    limit: 180 },
  '1y': { multiplier: 1,  timespan: 'week',   limit: 52 },
};

/**
 * Fetch OHLCV from Polygon.io Aggregates API.
 * Free tier: 5 req/min, delayed 15min for equities.
 *
 * @param {string} sym - Ticker symbol (e.g., 'AAPL')
 * @param {string} tfId - TradeForge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */
async function fetchPolygon(sym, tfId) {
  const key = getApiKey('polygon');
  if (!key) return null;

  const tf = POLYGON_TF_MAP[tfId];
  if (!tf) return null;

  // Date range
  const to = new Date();
  const from = new Date();
  if (tfId === '1d') from.setDate(from.getDate() - 1);
  else if (tfId === '5d') from.setDate(from.getDate() - 5);
  else if (tfId === '1m') from.setMonth(from.getMonth() - 1);
  else if (tfId === '3m') from.setMonth(from.getMonth() - 3);
  else if (tfId === '6m') from.setMonth(from.getMonth() - 6);
  else from.setFullYear(from.getFullYear() - 1);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(sym)}/range/${tf.multiplier}/${tf.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${tf.limit}&apiKey=${key}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    if (!json.results?.length) return null;

    return json.results.map((bar) => ({
      time: new Date(bar.t).toISOString(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v || 0,
      vwap: bar.vw || null,
      trades: bar.n || 0,
    }));
  } catch {
    return null;
  }
}

// ─── Alpha Vantage Adapter ──────────────────────────────────────

const AV_FUNCTIONS = {
  '1d':  { fn: 'TIME_SERIES_INTRADAY', interval: '5min' },
  '5d':  { fn: 'TIME_SERIES_INTRADAY', interval: '15min' },
  '1m':  { fn: 'TIME_SERIES_INTRADAY', interval: '60min' },
  '3m':  { fn: 'TIME_SERIES_DAILY', interval: null },
  '6m':  { fn: 'TIME_SERIES_DAILY', interval: null },
  '1y':  { fn: 'TIME_SERIES_WEEKLY', interval: null },
};

/**
 * Fetch from Alpha Vantage.
 * Free tier: 25 req/day. Generous intraday data.
 *
 * @param {string} sym - Ticker symbol
 * @param {string} tfId - TradeForge timeframe ID
 * @returns {Array|null} OHLCV array or null
 */
async function fetchAlphaVantage(sym, tfId) {
  const key = getApiKey('alphavantage');
  if (!key) return null;

  const cfg = AV_FUNCTIONS[tfId];
  if (!cfg) return null;

  try {
    let url = `https://www.alphavantage.co/query?function=${cfg.fn}&symbol=${encodeURIComponent(sym)}&apikey=${key}&outputsize=compact`;
    if (cfg.interval) url += `&interval=${cfg.interval}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();

    // Alpha Vantage returns different keys per function
    const seriesKey = Object.keys(json).find(k => k.startsWith('Time Series'));
    if (!seriesKey || !json[seriesKey]) return null;

    const series = json[seriesKey];
    const entries = Object.entries(series).reverse(); // oldest first

    return entries.map(([dateStr, bar]) => ({
      time: new Date(dateStr.includes(':') ? dateStr : dateStr + 'T00:00:00').toISOString(),
      open: parseFloat(bar['1. open']),
      high: parseFloat(bar['2. high']),
      low: parseFloat(bar['3. low']),
      close: parseFloat(bar['4. close']),
      volume: parseInt(bar['5. volume'] || bar['6. volume'] || '0', 10),
    }));
  } catch {
    return null;
  }
}

// ─── Provider Registry ──────────────────────────────────────────

/**
 * Ordered list of equity data providers.
 * First one with data wins.
 */
const EQUITY_PROVIDERS = [
  { id: 'polygon',      name: 'Polygon.io',      fetch: fetchPolygon,      needsKey: true },
  { id: 'alphavantage', name: 'Alpha Vantage',    fetch: fetchAlphaVantage, needsKey: true },
  // Yahoo is handled in FetchService directly as legacy fallback
];

/**
 * Try fetching equity data from premium providers before falling back to Yahoo.
 *
 * @param {string} sym - Ticker symbol
 * @param {string} tfId - TradeForge timeframe ID
 * @returns {{ data: Array|null, source: string }}
 */
async function fetchEquityPremium(sym, tfId) {
  for (const provider of EQUITY_PROVIDERS) {
    if (provider.needsKey && !hasApiKey(provider.id)) continue;

    const data = await provider.fetch(sym, tfId);
    if (data?.length > 1) {
      return { data, source: provider.id };
    }
  }
  return { data: null, source: null };
}

// ─── C2.4: WebSocket Provider Interface ─────────────────────────

/**
 * Abstract WebSocket data provider.
 * Implementations for Binance (crypto) and Polygon (equities) WS.
 *
 * @typedef {Object} WSProvider
 * @property {string} id - Provider identifier
 * @property {Function} isSupported - (symbol) => boolean
 * @property {Function} subscribe - (symbol, tf, callbacks) => void
 * @property {Function} unsubscribe - () => void
 * @property {Function} getStatus - () => string
 */

/**
 * Create a Polygon.io WebSocket adapter for equities.
 * Polygon free tier provides 1 concurrent WS connection for delayed data.
 *
 * NOTE: This is a scaffold — Polygon WS requires auth handshake and
 * their streaming protocol differs from Binance. Implementation will
 * activate when a Polygon API key is set and connection is established.
 *
 * For now, equities fall back to polling (fetchOHLC on interval).
 */
function createPolygonWSAdapter() {
  let _ws = null;
  let _status = 'disconnected';
  let _symbol = null;
  let _onCandle = null;
  let _onTick = null;
  let _onStatus = null;
  let _pollInterval = null;

  return {
    id: 'polygon-ws',

    isSupported(symbol) {
      return !isCrypto(symbol) && hasApiKey('polygon');
    },

    subscribe(symbol, tf, { onCandle, onTick, onStatus } = {}) {
      _symbol = symbol;
      _onCandle = onCandle;
      _onTick = onTick;
      _onStatus = onStatus;

      // For now, use polling as WS adapter scaffold
      // Poll every 15s for delayed equity data
      _status = 'connected';
      if (_onStatus) _onStatus(_status);

      _pollInterval = setInterval(async () => {
        try {
          const result = await fetchPolygon(symbol, tf);
          if (result?.length && _onCandle) {
            const last = result[result.length - 1];
            _onCandle({
              time: last.time,
              open: last.open,
              high: last.high,
              low: last.low,
              close: last.close,
              volume: last.volume,
              isClosed: false,
            });
          }
        } catch { /* silent */ }
      }, 15000);
    },

    unsubscribe() {
      clearInterval(_pollInterval);
      _pollInterval = null;
      _status = 'disconnected';
      if (_onStatus) _onStatus(_status);
      _ws = null;
    },

    getStatus() { return _status; },
  };
}

// ─── Multi-Provider WebSocket Router ────────────────────────────

/**
 * Routes WebSocket subscriptions to the correct provider
 * based on asset class.
 *
 * Usage:
 *   import { wsRouter } from './DataProvider.js';
 *   wsRouter.subscribe('AAPL', '1d', { onCandle, onTick, onStatus });
 *   wsRouter.subscribe('BTC', '1d', { onCandle, onTick, onStatus });
 *
 * Crypto → Binance WS (existing WebSocketService)
 * Equities → Polygon WS adapter (polling fallback)
 */
class WSRouter {
  constructor() {
    this._providers = [];
    this._activeProvider = null;
  }

  registerProvider(provider) {
    this._providers.push(provider);
  }

  subscribe(symbol, tf, callbacks) {
    // Unsubscribe previous
    this.unsubscribe();

    // Find first provider that supports this symbol
    for (const p of this._providers) {
      if (p.isSupported(symbol)) {
        this._activeProvider = p;
        p.subscribe(symbol, tf, callbacks);
        return;
      }
    }

    // No provider found — notify as disconnected
    if (callbacks.onStatus) callbacks.onStatus('disconnected');
  }

  unsubscribe() {
    if (this._activeProvider) {
      this._activeProvider.unsubscribe();
      this._activeProvider = null;
    }
  }

  getStatus() {
    return this._activeProvider ? this._activeProvider.getStatus() : 'disconnected';
  }
}

// Create singleton router with Polygon adapter
// Binance adapter will be registered from WebSocketService on import
const wsRouter = new WSRouter();
const polygonWSAdapter = createPolygonWSAdapter();
wsRouter.registerProvider(polygonWSAdapter);

// ─── API Key Settings Helper ────────────────────────────────────

/**
 * Get status of all configured data providers.
 * Used by Settings page to show which providers are active.
 */
function getProviderStatus() {
  return {
    polygon: {
      name: 'Polygon.io',
      hasKey: hasApiKey('polygon'),
      needsKey: true,
      tier: 'free',
      features: ['Equities OHLCV', 'Options', 'Forex', 'Crypto', 'WebSocket (delayed)'],
      rateLimit: '5 req/min (free)',
    },
    alphavantage: {
      name: 'Alpha Vantage',
      hasKey: hasApiKey('alphavantage'),
      needsKey: true,
      tier: 'free',
      features: ['Equities OHLCV', 'Forex', 'Crypto', 'Fundamentals'],
      rateLimit: '25 req/day (free)',
    },
    coingecko: {
      name: 'CoinGecko',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto OHLC (no volume)'],
      rateLimit: '10 req/min',
    },
    binance: {
      name: 'Binance',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Crypto OHLCV', 'WebSocket (real-time)'],
      rateLimit: '1200 req/min',
    },
    yahoo: {
      name: 'Yahoo Finance',
      hasKey: false,
      needsKey: false,
      tier: 'free',
      features: ['Equities OHLCV (unreliable)'],
      rateLimit: 'unknown (frequent 403s)',
    },
  };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  fetchPolygon,
  fetchAlphaVantage,
  fetchEquityPremium,
  getApiKey,
  setApiKey,
  hasApiKey,
  getProviderStatus,
  wsRouter,
  WSRouter,
  createPolygonWSAdapter,
};
