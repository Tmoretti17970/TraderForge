// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Binance Adapter
//
// Crypto market data via Binance REST + WebSocket APIs.
// Supports OHLCV, quotes, real-time streaming, and symbol search.
// ═══════════════════════════════════════════════════════════════════

import { BaseAdapter } from './BaseAdapter.js';

const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';

const INTERVAL_MAP = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
};

export class BinanceAdapter extends BaseAdapter {
  constructor() {
    super('binance');
    this._sockets = new Map(); // symbol → WebSocket
  }

  supports(symbol) {
    const upper = (symbol || '').toUpperCase();
    return upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('BTC') || upper.endsWith('ETH');
  }

  async fetchOHLCV(symbol, interval = '1h', opts = {}) {
    const binanceInterval = INTERVAL_MAP[interval] || '1h';
    const limit = opts.limit || 500;

    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: binanceInterval,
      limit: String(limit),
    });
    if (opts.from) params.set('startTime', String(new Date(opts.from).getTime()));
    if (opts.to) params.set('endTime', String(new Date(opts.to).getTime()));

    const resp = await fetch(`${BINANCE_REST}/klines?${params}`);
    if (!resp.ok) throw new Error(`Binance fetch failed: ${resp.status}`);

    const data = await resp.json();
    return data.map(k => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }

  async fetchQuote(symbol) {
    const resp = await fetch(`${BINANCE_REST}/ticker/24hr?symbol=${symbol.toUpperCase()}`);
    if (!resp.ok) return null;

    const d = await resp.json();
    return {
      price: parseFloat(d.lastPrice),
      change: parseFloat(d.priceChange),
      changePct: parseFloat(d.priceChangePercent),
      volume: parseFloat(d.volume),
      high: parseFloat(d.highPrice),
      low: parseFloat(d.lowPrice),
      open: parseFloat(d.openPrice),
    };
  }

  subscribe(symbol, callback) {
    const stream = symbol.toLowerCase() + '@trade';
    const ws = new WebSocket(`${BINANCE_WS}/${stream}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback({
          price: parseFloat(data.p),
          volume: parseFloat(data.q),
          time: data.T,
          symbol: data.s,
        });
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => { /* silent */ };

    this._sockets.set(symbol, ws);

    return () => {
      ws.close();
      this._sockets.delete(symbol);
    };
  }

  async searchSymbols(query, limit = 10) {
    // Binance doesn't have a search API — filter from exchange info
    try {
      const resp = await fetch(`${BINANCE_REST}/exchangeInfo`);
      if (!resp.ok) return [];
      const data = await resp.json();

      const q = query.toUpperCase();
      return (data.symbols || [])
        .filter(s => s.status === 'TRADING' && s.symbol.includes(q))
        .slice(0, limit)
        .map(s => ({
          symbol: s.symbol,
          name: `${s.baseAsset}/${s.quoteAsset}`,
          type: 'CRYPTO',
          exchange: 'Binance',
        }));
    } catch { return []; }
  }

  /**
   * Close all WebSocket connections.
   */
  dispose() {
    for (const [, ws] of this._sockets) {
      ws.close();
    }
    this._sockets.clear();
  }
}

export default BinanceAdapter;
