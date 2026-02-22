// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Symbol Registry (Arch Improvement #7)
//
// Central registry for all supported instruments.
// Replaces scattered symbol definitions across constants.js,
// WebSocketService, FetchService, and FundamentalService.
//
// Usage:
//   import { SymbolRegistry } from './SymbolRegistry.js';
//   const info = SymbolRegistry.lookup('AAPL');
//   const cryptos = SymbolRegistry.byClass('crypto');
//   const provider = SymbolRegistry.getProvider('BTCUSDT');
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} SymbolInfo
 * @property {string} symbol - Canonical symbol (e.g. 'AAPL', 'BTCUSDT')
 * @property {string} displayName - Human-readable name
 * @property {string} assetClass - 'stock'|'etf'|'crypto'|'futures'|'forex'|'options'|'index'
 * @property {string} provider - 'yahoo'|'binance'|'polygon'|'manual'
 * @property {string} [exchange] - Exchange name
 * @property {string} [currency] - Quote currency
 * @property {boolean} [realtime] - Supports WebSocket streaming
 * @property {string} [wsSymbol] - Symbol format for WebSocket subscriptions
 */

// ─── Built-in Symbol Catalog ────────────────────────────────────

const CRYPTO_PAIRS = [
  { symbol: 'BTCUSDT', displayName: 'Bitcoin', exchange: 'Binance', wsSymbol: 'btcusdt' },
  { symbol: 'ETHUSDT', displayName: 'Ethereum', exchange: 'Binance', wsSymbol: 'ethusdt' },
  { symbol: 'SOLUSDT', displayName: 'Solana', exchange: 'Binance', wsSymbol: 'solusdt' },
  { symbol: 'BNBUSDT', displayName: 'BNB', exchange: 'Binance', wsSymbol: 'bnbusdt' },
  { symbol: 'XRPUSDT', displayName: 'XRP', exchange: 'Binance', wsSymbol: 'xrpusdt' },
  { symbol: 'ADAUSDT', displayName: 'Cardano', exchange: 'Binance', wsSymbol: 'adausdt' },
  { symbol: 'DOGEUSDT', displayName: 'Dogecoin', exchange: 'Binance', wsSymbol: 'dogeusdt' },
  { symbol: 'AVAXUSDT', displayName: 'Avalanche', exchange: 'Binance', wsSymbol: 'avaxusdt' },
  { symbol: 'DOTUSDT', displayName: 'Polkadot', exchange: 'Binance', wsSymbol: 'dotusdt' },
  { symbol: 'MATICUSDT', displayName: 'Polygon', exchange: 'Binance', wsSymbol: 'maticusdt' },
  { symbol: 'LINKUSDT', displayName: 'Chainlink', exchange: 'Binance', wsSymbol: 'linkusdt' },
  { symbol: 'LTCUSDT', displayName: 'Litecoin', exchange: 'Binance', wsSymbol: 'ltcusdt' },
].map(c => ({ ...c, assetClass: 'crypto', provider: 'binance', currency: 'USDT', realtime: true }));

const POPULAR_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B',
  'JPM', 'V', 'UNH', 'MA', 'HD', 'PG', 'JNJ', 'BAC', 'XOM', 'ABBV',
  'COST', 'KO', 'MRK', 'PEP', 'AVGO', 'LLY', 'TMO', 'ORCL', 'ADBE',
  'CRM', 'CSCO', 'ACN', 'NFLX', 'AMD', 'INTC', 'QCOM', 'TXN',
].map(s => ({
  symbol: s, displayName: s, assetClass: 'stock', provider: 'yahoo',
  exchange: 'NASDAQ/NYSE', currency: 'USD', realtime: false,
}));

const POPULAR_ETFS = [
  { symbol: 'SPY', displayName: 'S&P 500 ETF' },
  { symbol: 'QQQ', displayName: 'Nasdaq 100 ETF' },
  { symbol: 'IWM', displayName: 'Russell 2000 ETF' },
  { symbol: 'DIA', displayName: 'Dow Jones ETF' },
  { symbol: 'VTI', displayName: 'Total Stock Market' },
  { symbol: 'GLD', displayName: 'Gold ETF' },
  { symbol: 'TLT', displayName: '20+ Year Treasury' },
  { symbol: 'XLF', displayName: 'Financial Sector' },
  { symbol: 'XLK', displayName: 'Tech Sector' },
  { symbol: 'XLE', displayName: 'Energy Sector' },
  { symbol: 'ARKK', displayName: 'ARK Innovation' },
  { symbol: 'VIX', displayName: 'Volatility Index' },
].map(e => ({
  ...e, assetClass: 'etf', provider: 'yahoo',
  exchange: 'NYSE', currency: 'USD', realtime: false,
}));

const FOREX_PAIRS = [
  { symbol: 'EURUSD=X', displayName: 'EUR/USD', wsSymbol: 'eurusd' },
  { symbol: 'GBPUSD=X', displayName: 'GBP/USD', wsSymbol: 'gbpusd' },
  { symbol: 'USDJPY=X', displayName: 'USD/JPY', wsSymbol: 'usdjpy' },
  { symbol: 'AUDUSD=X', displayName: 'AUD/USD', wsSymbol: 'audusd' },
  { symbol: 'USDCAD=X', displayName: 'USD/CAD', wsSymbol: 'usdcad' },
  { symbol: 'USDCHF=X', displayName: 'USD/CHF', wsSymbol: 'usdchf' },
].map(f => ({
  ...f, assetClass: 'forex', provider: 'yahoo',
  exchange: 'FX', currency: 'USD', realtime: false,
}));

const FUTURES = [
  { symbol: 'ES=F', displayName: 'E-mini S&P 500' },
  { symbol: 'NQ=F', displayName: 'E-mini Nasdaq' },
  { symbol: 'YM=F', displayName: 'E-mini Dow' },
  { symbol: 'RTY=F', displayName: 'E-mini Russell' },
  { symbol: 'CL=F', displayName: 'Crude Oil' },
  { symbol: 'GC=F', displayName: 'Gold Futures' },
  { symbol: 'SI=F', displayName: 'Silver Futures' },
  { symbol: 'ZB=F', displayName: 'US Treasury Bond' },
  { symbol: 'ZN=F', displayName: '10-Year T-Note' },
  { symbol: 'NG=F', displayName: 'Natural Gas' },
].map(f => ({
  ...f, assetClass: 'futures', provider: 'yahoo',
  exchange: 'CME', currency: 'USD', realtime: false,
}));

// ─── Registry Class ─────────────────────────────────────────────

class _SymbolRegistry {
  constructor() {
    /** @type {Map<string, SymbolInfo>} */
    this._map = new Map();
    this._aliases = new Map(); // e.g. 'BTC' → 'BTCUSDT'

    // Load built-in catalog
    const all = [...CRYPTO_PAIRS, ...POPULAR_STOCKS, ...POPULAR_ETFS, ...FOREX_PAIRS, ...FUTURES];
    for (const info of all) {
      this._map.set(info.symbol.toUpperCase(), info);
    }

    // Set up aliases
    this._aliases.set('BTC', 'BTCUSDT');
    this._aliases.set('ETH', 'ETHUSDT');
    this._aliases.set('SOL', 'SOLUSDT');
    this._aliases.set('BITCOIN', 'BTCUSDT');
    this._aliases.set('ETHEREUM', 'ETHUSDT');
  }

  /**
   * Look up symbol info. Returns null if unknown.
   * @param {string} symbol
   * @returns {SymbolInfo|null}
   */
  lookup(symbol) {
    if (!symbol) return null;
    const upper = symbol.toUpperCase().trim();
    const resolved = this._aliases.get(upper) || upper;
    return this._map.get(resolved) || null;
  }

  /**
   * Get all symbols for an asset class.
   * @param {'stock'|'etf'|'crypto'|'futures'|'forex'} assetClass
   * @returns {SymbolInfo[]}
   */
  byClass(assetClass) {
    return Array.from(this._map.values()).filter(s => s.assetClass === assetClass);
  }

  /**
   * Get the data provider for a symbol.
   * @param {string} symbol
   * @returns {'yahoo'|'binance'|'polygon'|'manual'|null}
   */
  getProvider(symbol) {
    const info = this.lookup(symbol);
    return info?.provider || null;
  }

  /**
   * Check if a symbol supports real-time streaming.
   * @param {string} symbol
   * @returns {boolean}
   */
  isRealtime(symbol) {
    const info = this.lookup(symbol);
    return info?.realtime || false;
  }

  /**
   * Register a custom symbol (e.g. from broker import).
   * @param {SymbolInfo} info
   */
  register(info) {
    if (!info.symbol) return;
    this._map.set(info.symbol.toUpperCase(), {
      ...info,
      provider: info.provider || 'yahoo',
      assetClass: info.assetClass || 'stock',
      realtime: info.realtime || false,
    });
  }

  /**
   * Search symbols by query string (for autocomplete).
   * @param {string} query
   * @param {number} [limit=10]
   * @returns {SymbolInfo[]}
   */
  search(query, limit = 10) {
    if (!query || query.length < 1) return [];
    const q = query.toUpperCase().trim();
    const results = [];

    for (const [sym, info] of this._map) {
      if (results.length >= limit) break;
      if (sym.includes(q) || info.displayName?.toUpperCase().includes(q)) {
        results.push(info);
      }
    }

    // Sort: exact prefix matches first
    results.sort((a, b) => {
      const aPrefix = a.symbol.toUpperCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.symbol.toUpperCase().startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix;
    });

    return results;
  }

  /**
   * Get total registered symbol count.
   * @returns {number}
   */
  get size() { return this._map.size; }

  /**
   * Get all registered symbols.
   * @returns {SymbolInfo[]}
   */
  all() { return Array.from(this._map.values()); }
}

// Singleton
const SymbolRegistry = new _SymbolRegistry();

export { SymbolRegistry, CRYPTO_PAIRS, POPULAR_STOCKS, POPULAR_ETFS, FOREX_PAIRS, FUTURES };
export default SymbolRegistry;
