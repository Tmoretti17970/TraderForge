// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — FetchService
// Extracted from v9.3 monolith. Improvements:
//   - Token bucket rate limiter (10 req/min for CoinGecko)
//   - Tiered TTL per timeframe
//   - Stale-while-revalidate
//   - Deduplication of in-flight requests
// ═══════════════════════════════════════════════════════════════════

import { TFS, CRYPTO_IDS, isCrypto, CACHE_MAX_ENTRIES } from '../constants.js';
import { fetchEquityPremium } from './DataProvider.js';

const TTL = {
  '1d': 15000, '5d': 30000, '1m': 60000,
  '3m': 300000, '6m': 300000, '1y': 1800000,
};

// ─── Token Bucket Rate Limiter ──────────────────────────────────
class TokenBucket {
  constructor(tokensPerMin) {
    this._max = tokensPerMin;
    this._tokens = tokensPerMin;
    this._lastRefill = Date.now();
  }
  _refill() {
    const now = Date.now();
    const elapsed = (now - this._lastRefill) / 60000;
    this._tokens = Math.min(this._max, this._tokens + elapsed * this._max);
    this._lastRefill = now;
  }
  async acquire() {
    this._refill();
    if (this._tokens >= 1) { this._tokens -= 1; return true; }
    const waitMs = ((1 - this._tokens) / this._max) * 60000;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 10000)));
    this._refill();
    if (this._tokens >= 1) { this._tokens -= 1; return true; }
    return false;
  }
}

const cgLimiter = new TokenBucket(10);

// ─── Cache ──────────────────────────────────────────────────────
const _cache = new Map();
const _inflight = new Map();
let _lastWarning = null; // Set by fetchers when they fail

function cacheSet(key, data, source) {
  if (_cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { data, source, t: Date.now() });
}

// ─── Fallback Data Generator ────────────────────────────────────
function genFB(sym, tf) {
  const s = (sym || '').toUpperCase();
  const now = Date.now();
  // Always generate at least 200 bars for a full chart
  const barCount = Math.max(200, tf.fb || 120);
  let bp = s.includes('BTC') ? 97000
    : s.includes('ETH') ? 3400
    : s.includes('SOL') ? 180
    : s.includes('SPY') ? 595
    : s.includes('ES') ? 6050
    : s.includes('NQ') ? 21500
    : s.includes('CL') ? 68
    : s.includes('AAPL') ? 245
    : s.includes('TSLA') ? 350
    : 100 + Math.random() * 200;

  let p = bp * (0.93 + Math.random() * 0.07);
  const v = bp * (tf.fb > 100 ? 0.005 : 0.012);
  const data = [];

  for (let i = barCount; i >= 0; i--) {
    const d = new Date(now);
    if (tf.yhInt.includes('m')) d.setMinutes(d.getMinutes() - i * parseInt(tf.yhInt));
    else if (tf.yhInt.includes('h')) d.setHours(d.getHours() - i);
    else if (tf.yhInt === '1d') d.setDate(d.getDate() - i);
    else if (tf.yhInt === '1wk') d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);

    if (!isCrypto(sym) && (d.getDay() === 0 || d.getDay() === 6)) continue;

    const ch = (Math.random() - 0.48) * v;
    const o = p; p += ch;
    const h = Math.max(o, p) + Math.random() * v * 0.4;
    const l = Math.min(o, p) - Math.random() * v * 0.4;
    data.push({
      time: d.toISOString(), open: o, high: h, low: l, close: p,
      volume: Math.round(Math.random() * 10000 + 1000),
    });
  }
  return data;
}

// ─── API Fetchers ───────────────────────────────────────────────

// C2.2: Binance symbol + interval mapping (same as WebSocketService)
const BINANCE_PAIRS = {
  BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT',
  ADA: 'ADAUSDT', DOGE: 'DOGEUSDT', DOT: 'DOTUSDT',
  AVAX: 'AVAXUSDT', LINK: 'LINKUSDT', MATIC: 'MATICUSDT',
  XRP: 'XRPUSDT', ATOM: 'ATOMUSDT', UNI: 'UNIUSDT',
  LTC: 'LTCUSDT', FIL: 'FILUSDT', NEAR: 'NEARUSDT',
  OP: 'OPUSDT', ARB: 'ARBUSDT', SUI: 'SUIUSDT', APT: 'APTUSDT',
};
const BINANCE_INTERVALS = {
  '1d': '5m', '5d': '15m', '1m': '1h', '3m': '1d', '6m': '1d', '1y': '1w',
};
const BINANCE_LIMITS = {
  '1d': 288, '5d': 480, '1m': 720, '3m': 90, '6m': 180, '1y': 52,
};

async function fetchCoinGecko(sym, tf) {
  const id = CRYPTO_IDS[(sym || '').toUpperCase()];
  if (!id) return null;
  const canAcquire = await cgLimiter.acquire();
  if (!canAcquire) return null;
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${tf.cgDays}`;
    const res = await fetch(url);
    if (res.status === 429 || !res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;
    return raw.map((c) => ({
      time: new Date(c[0]).toISOString(), open: c[1], high: c[2], low: c[3], close: c[4], volume: 0,
    }));
  } catch (e) { return null; }
}

/**
 * C2.2: Binance REST klines — fallback for CoinGecko rate-limiting.
 * Higher rate limits + returns real volume data.
 * @see https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
async function fetchBinance(sym, tfId) {
  const pair = BINANCE_PAIRS[(sym || '').toUpperCase()];
  if (!pair) return null;
  const interval = BINANCE_INTERVALS[tfId];
  if (!interval) return null;
  const limit = BINANCE_LIMITS[tfId] || 200;

  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return null;
    // Binance klines: [openTime, open, high, low, close, volume, closeTime, ...]
    return raw.map((k) => ({
      time: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (e) {
    // CORS or network error — silently fail (common for US users)
    return null;
  }
}

async function fetchYahoo(sym, tf) {
  try {
    // Route through server-side proxy to bypass CORS
    // In SSR context, use absolute URL; in browser, use relative path
    const base = typeof window === 'undefined' ? `http://localhost:${globalThis.__TF_PORT || 3000}` : '';
    const url = `${base}/api/yahoo/chart/${encodeURIComponent(sym)}?interval=${tf.yhInt}&range=${tf.yhRange}`;
    const res = await fetch(url);
    if (!res.ok) {
      _lastWarning = res.status === 429
        ? `Yahoo Finance rate limited for ${sym} — retrying shortly`
        : `Yahoo Finance error (${res.status}) for ${sym} — showing simulated data`;
      return null;
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result?.timestamp) return null;
    const { timestamp, indicators } = result;
    const q = indicators?.quote?.[0];
    if (!q) return null;
    return timestamp.map((t, i) => {
      // Skip null bars (market closed, no data)
      if (q.open[i] == null && q.close[i] == null) return null;
      return {
        time: new Date(t * 1000).toISOString(),
        open: q.open[i] ?? q.close[i], high: q.high[i] ?? q.close[i],
        low: q.low[i] ?? q.close[i], close: q.close[i], volume: q.volume[i] ?? 0,
      };
    }).filter(Boolean);
  } catch (e) {
    _lastWarning = `Yahoo Finance unavailable for ${sym} — showing simulated data`;
    return null;
  }
}

// ─── Main Fetch Function ────────────────────────────────────────
async function fetchOHLC(sym, tfId) {
  const tf = TFS.find((t) => t.id === tfId) || TFS[3];
  const key = `${sym}_${tfId}`;
  const ttl = TTL[tfId] || 60000;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.t < ttl) return { data: cached.data, source: cached.source };
  if (cached) { _bgRefresh(sym, tfId, tf, key); return { data: cached.data, source: cached.source + ':stale' }; }
  if (_inflight.has(key)) return _inflight.get(key);
  const promise = _doFetch(sym, tfId, tf, key);
  _inflight.set(key, promise);
  try { return await promise; } finally { _inflight.delete(key); }
}

async function _doFetch(sym, tfId, tf, key) {
  let data = null, source = 'simulated';
  _lastWarning = null;
  if (isCrypto(sym)) {
    data = await fetchCoinGecko(sym, tf);
    if (data) source = 'coingecko';
    // C2.2: Binance REST fallback when CoinGecko rate-limits or fails
    if (!data) { data = await fetchBinance(sym, tfId); if (data) source = 'binance'; }
  }
  else {
    // C2.3: Try premium equity providers (Polygon.io → Alpha Vantage) before Yahoo
    const premium = await fetchEquityPremium(sym, tfId);
    if (premium.data) {
      data = premium.data;
      source = premium.source;
    }
    // Legacy Yahoo fallback
    if (!data) { data = await fetchYahoo(sym, tf); if (data) source = 'yahoo'; }
  }
  if (!data) {
    data = genFB(sym, tf);
    source = 'simulated';
    // Dispatch warning event so UI can show a toast
    if (_lastWarning && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tradeforge:data-warning', {
        detail: { message: _lastWarning, symbol: sym },
      }));
    }
  }
  cacheSet(key, data, source);
  return { data, source };
}

function _bgRefresh(sym, tfId, tf, key) {
  _doFetch(sym, tfId, tf, key).catch(() => {});
}

function clearCache() { _cache.clear(); }

function cacheStats() {
  return {
    size: _cache.size, maxSize: CACHE_MAX_ENTRIES,
    entries: [..._cache.entries()].map(([k, v]) => ({ key: k, source: v.source, ageMs: Date.now() - v.t })),
  };
}

function getLastWarning() { return _lastWarning; }

/**
 * C2.6: Cache Warming — Pre-fetch adjacent timeframes for a symbol.
 * Called when user switches symbol. Fetches all timeframes in the background
 * so switching TFs after a symbol change is instant.
 *
 * @param {string} sym - Symbol to warm
 * @param {string} currentTfId - Currently active timeframe (skip — already fetched)
 */
function warmCache(sym, currentTfId) {
  const ALL_TF_IDS = ['1d', '5d', '1m', '3m', '6m', '1y'];
  const toWarm = ALL_TF_IDS.filter(id => id !== currentTfId);

  // Stagger fetches 200ms apart to avoid burst
  toWarm.forEach((tfId, i) => {
    setTimeout(() => {
      const key = `${sym}_${tfId}`;
      // Skip if already cached and fresh
      const cached = _cache.get(key);
      const ttl = TTL[tfId] || 60000;
      if (cached && Date.now() - cached.t < ttl) return;
      // Background fetch — errors silently caught
      fetchOHLC(sym, tfId).catch(() => {});
    }, (i + 1) * 200);
  });
}

export { fetchOHLC, clearCache, cacheStats, genFB, getLastWarning, warmCache };
export default fetchOHLC;
