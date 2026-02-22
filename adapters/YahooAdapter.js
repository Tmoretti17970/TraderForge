// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Yahoo Finance Adapter
//
// Fetches OHLCV data, quotes, and symbol search via the Yahoo
// proxy (server.js /api/yahoo/*).
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

const INTERVAL_MAP = {
  '1m': '1m', '2m': '2m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '60m', '4h': '60m', // Yahoo doesn't support 4h natively
  '1d': '1d', '1w': '1wk', '1M': '1mo',
};

const RANGE_MAP = {
  '1m': '1d', '2m': '5d', '5m': '5d', '15m': '5d', '30m': '1mo',
  '1h': '6mo', '4h': '6mo', '1d': '1y', '1w': '5y', '1M': 'max',
};

export class YahooAdapter extends BaseAdapter {
  constructor(proxyBase = '/api/yahoo') {
    super('yahoo');
    this.proxyBase = proxyBase;
  }

  supports(symbol) {
    // Yahoo supports most non-crypto symbols
    const upper = (symbol || '').toUpperCase();
    return !upper.endsWith('USDT') && !upper.endsWith('BUSD') && !upper.endsWith('USDC');
  }

  async fetchOHLCV(symbol, interval = '1d', opts = {}) {
    const yahooInterval = INTERVAL_MAP[interval] || '1d';
    const range = opts.range || RANGE_MAP[interval] || '1y';

    const url = `${this.proxyBase}/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&range=${range}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Yahoo fetch failed: ${resp.status}`);

    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const ts = result.timestamp;
    const q = result.indicators?.quote?.[0] || {};

    return ts.map((t, i) => ({
      time: t * 1000,
      open: q.open?.[i] ?? 0,
      high: q.high?.[i] ?? 0,
      low: q.low?.[i] ?? 0,
      close: q.close?.[i] ?? 0,
      volume: q.volume?.[i] ?? 0,
    })).filter(c => c.open > 0); // Filter null candles
  }

  async fetchQuote(symbol) {
    // Use chart endpoint with 1d range for quote
    const candles = await this.fetchOHLCV(symbol, '1d', { range: '2d' });
    if (candles.length === 0) return null;

    const last = candles[candles.length - 1];
    const prev = candles.length > 1 ? candles[candles.length - 2] : last;
    const change = last.close - prev.close;

    return {
      price: last.close,
      change,
      changePct: prev.close > 0 ? (change / prev.close) * 100 : 0,
      volume: last.volume,
      high: last.high,
      low: last.low,
      open: last.open,
    };
  }

  subscribe(_symbol, _callback) {
    // Yahoo doesn't support WebSocket — return noop
    console.warn('[YahooAdapter] Real-time subscriptions not supported');
    return () => {};
  }

  async searchSymbols(query, limit = 10) {
    const url = `${this.proxyBase}/search?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];

    const data = await resp.json();
    return (data?.quotes || []).slice(0, limit).map(q => ({
      symbol: q.symbol,
      name: q.shortname || q.longname || q.symbol,
      type: q.quoteType || 'EQUITY',
      exchange: q.exchange || '',
    }));
  }
}

export default YahooAdapter;
