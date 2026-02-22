// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Constants & Theme
// Single source of truth. Extracted from v9.3 monolith.
// ═══════════════════════════════════════════════════════════════════

// ─── Theme Palettes ──────────────────────────────────────────────

export const DARK_COLORS = {
  bg: '#09090b', bg2: '#0f1012', sf: '#151619', sf2: '#1a1c21',
  bd: '#232630', bd2: '#2e3240',
  t1: '#ececef', t2: '#8b8fa2', t3: '#4e5266',
  b: '#e8642c', bH: '#d4551e',
  g: '#2dd4a0', r: '#f25c5c', y: '#f0b64e',
  p: '#c084fc', cyan: '#22d3ee', orange: '#e8642c',
  pink: '#f472b6', lime: '#a3e635',
  info: '#5c9cf5',
  bullish: '#2dd4a0', bearish: '#f25c5c', rS: '#f25c5c20',
};

export const LIGHT_COLORS = {
  bg: '#f8f8fa', bg2: '#eef0f4', sf: '#ffffff', sf2: '#f2f3f6',
  bd: '#d4d7e0', bd2: '#bec3d0',
  t1: '#111318', t2: '#4a5068', t3: '#8890a4',
  b: '#d4551e', bH: '#bf4a18',
  g: '#12a87e', r: '#dc3545', y: '#d4930b',
  p: '#7c3aed', cyan: '#0891b2', orange: '#d4551e',
  pink: '#db2777', lime: '#65a30d',
  info: '#2563eb',
  bullish: '#12a87e', bearish: '#dc3545', rS: '#dc354520',
};

/**
 * Active color palette — mutable object that gets swapped on theme change.
 * All components import C and read its properties at render time.
 * When theme changes, syncThemeColors() updates all keys in-place,
 * and the App re-renders via useThemeStore subscription.
 */
export const C = { ...DARK_COLORS };

/**
 * Sync the C object with the active theme palette.
 * Called by useThemeStore on every theme change.
 * @param {'dark'|'light'} theme
 */
export function syncThemeColors(theme) {
  const palette = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;
  Object.assign(C, palette);
}

export const F = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
export const M = "'JetBrains Mono', 'SF Mono', monospace";

export const AXIS_WIDTH = 68;
export const TIME_AXIS_HEIGHT = 22;
export const DEFAULT_VISIBLE_BARS = 80;
export const RIGHT_PADDING_BARS = 5;
export const MAX_SCROLL_SPEED = 15;
export const MIN_VISIBLE_BARS = 10;
export const CACHE_TTL_MS = 60_000;
export const CACHE_MAX_ENTRIES = 50;

export const CHART_TYPES = [
  { id: 'candles', label: 'Candles', engineId: 'candlestick' },
  { id: 'hollow', label: 'Hollow', engineId: 'hollow' },
  { id: 'ohlc', label: 'OHLC', engineId: 'ohlc' },
  { id: 'line', label: 'Line', engineId: 'line' },
  { id: 'area', label: 'Area', engineId: 'area' },
  { id: 'heikinashi', label: 'Heikin-Ashi', engineId: 'heikinashi' },
  { id: 'baseline', label: 'Baseline', engineId: 'baseline' },
];

export const EMOJIS = [
  { e: '😌', l: 'Calm' },   { e: '💪', l: 'Confident' },
  { e: '😐', l: 'Neutral' }, { e: '🤔', l: 'Uncertain' },
  { e: '😰', l: 'Anxious' }, { e: '😤', l: 'Frustrated' },
  { e: '🎯', l: 'Focused' }, { e: '😴', l: 'Tired' },
];

export const TFS = [
  { id: '1d', label: '1D', cgDays: 1,   yhInt: '5m',  yhRange: '1d',  fb: 80,  binance: '1m' },
  { id: '5d', label: '5D', cgDays: 5,   yhInt: '15m', yhRange: '5d',  fb: 130, binance: '5m' },
  { id: '1m', label: '1M', cgDays: 30,  yhInt: '1h',  yhRange: '1mo', fb: 160, binance: '1h' },
  { id: '3m', label: '3M', cgDays: 90,  yhInt: '1d',  yhRange: '3mo', fb: 65,  binance: '4h' },
  { id: '6m', label: '6M', cgDays: 180, yhInt: '1d',  yhRange: '6mo', fb: 130, binance: '1d' },
  { id: '1y', label: '1Y', cgDays: 365, yhInt: '1wk', yhRange: '1y',  fb: 52,  binance: '1d' },
];

// Binance-native intervals for direct crypto charting
export const CRYPTO_TFS = [
  { id: '1m',  label: '1m' },
  { id: '5m',  label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h',  label: '1H' },
  { id: '4h',  label: '4H' },
  { id: '1d',  label: '1D' },
  { id: '1w',  label: '1W' },
];

export const CRYPTO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  ADA: 'cardano', DOGE: 'dogecoin', DOT: 'polkadot',
  AVAX: 'avalanche-2', LINK: 'chainlink', MATIC: 'matic-network',
  XRP: 'ripple', ATOM: 'cosmos', UNI: 'uniswap',
  LTC: 'litecoin', FIL: 'filecoin', NEAR: 'near',
  OP: 'optimism', ARB: 'arbitrum', SUI: 'sui', APT: 'aptos',
};

export const isCrypto = (sym) => !!CRYPTO_IDS[(sym || '').toUpperCase()];

// Asset class hints for symbol routing + UI badges
export const FUTURES_ROOTS = new Set([
  'ES', 'NQ', 'YM', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', 'ZC', 'ZS', 'ZW',
  'NG', 'HG', '6E', '6J', '6B', '6A', '6C', '6S', 'MES', 'MNQ', 'MYM', 'M2K',
  'MCL', 'MGC', 'HE', 'LE', 'KC', 'SB', 'CT', 'CC',
]);

export const FOREX_PAIRS = new Set([
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'EURAUD', 'EURCHF',
]);

/**
 * Detect asset class from symbol string.
 * Used for data provider routing, UI badges, and import classification.
 * @param {string} sym
 * @returns {'crypto'|'futures'|'forex'|'stock'}
 */
export function getAssetClass(sym) {
  const s = (sym || '').toUpperCase();
  if (isCrypto(s)) return 'crypto';
  // Strip futures contract month/year suffix: ESH5 → ES, ESH25 → ES, MES03-25 → MES
  const root = s.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/\d{2}-\d{2}$/, '');
  if (FUTURES_ROOTS.has(root)) return 'futures';
  if (FOREX_PAIRS.has(s)) return 'forex';
  return 'stock';
}

export const IND_CAT = [
  { id: 'sma', name: 'SMA', full: 'Simple Moving Average', cat: 'trend', pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }] },
  { id: 'ema', name: 'EMA', full: 'Exponential Moving Average', cat: 'trend', pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 21, min: 1, max: 500 }] },
  { id: 'wma', name: 'WMA', full: 'Weighted Moving Average', cat: 'trend', pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }] },
  { id: 'bollinger', name: 'BB', full: 'Bollinger Bands', cat: 'volatility', pane: 'overlay',
    params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 200 },
             { key: 'multiplier', label: 'StdDev', def: 2, min: 0.5, max: 5, step: 0.1 }] },
  { id: 'vwap', name: 'VWAP', full: 'Vol Weighted Avg Price', cat: 'trend', pane: 'overlay', params: [] },
  { id: 'rsi', name: 'RSI', full: 'Relative Strength Index', cat: 'momentum', pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 2, max: 100 }] },
  { id: 'macd', name: 'MACD', full: 'MACD', cat: 'momentum', pane: 'sub',
    params: [{ key: 'fast', label: 'Fast', def: 12, min: 2, max: 100 },
             { key: 'slow', label: 'Slow', def: 26, min: 2, max: 200 },
             { key: 'signal', label: 'Signal', def: 9, min: 2, max: 50 }] },
  { id: 'stochastic', name: 'Stoch', full: 'Stochastic', cat: 'momentum', pane: 'sub',
    params: [{ key: 'kPeriod', label: '%K', def: 14, min: 1, max: 100 },
             { key: 'dPeriod', label: '%D', def: 3, min: 1, max: 50 }] },
  { id: 'atr', name: 'ATR', full: 'Average True Range', cat: 'volatility', pane: 'sub',
    params: [{ key: 'period', label: 'Period', def: 14, min: 1, max: 100 }] },
];

export const ICATS = [
  { id: 'all', l: 'All' }, { id: 'trend', l: 'Trend' },
  { id: 'momentum', l: 'Momentum' }, { id: 'volatility', l: 'Volatility' },
];

export const OV_COLORS = [
  C.y, C.orange, C.p, C.cyan, C.pink, C.lime, '#6c5ce7', '#fd79a8',
];

export const STORAGE_KEY = 'tradeforge-os-v10';

export const DEFAULT_SETTINGS = {
  dailyLossLimit: 0,
  defaultSymbol: 'BTC',
  defaultTf: '3m',
  accountSize: 0,
  riskPerTrade: 0,
  // ─── Risk Presets (Epic 5) ──────────────────────────────────
  riskPerTradePct: 1.0,
  maxDailyTrades: 0,
  maxOpenPositions: 0,
  riskFreeRate: 0.05,
  positionSizing: 'fixed_pct',
  kellyFraction: 0.5,
  activeRiskPreset: null,       // ID of active built-in preset (or null for custom)
};
