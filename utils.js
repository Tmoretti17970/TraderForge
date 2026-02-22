// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Utility Functions
// Extracted from v9.3 monolith. Pure functions, no side effects.
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a unique ID
 * @returns {string} Unique string ID
 */
const uid = () =>
  'id_' +
  Date.now().toString(36) +
  '_' +
  Math.random().toString(36).slice(2, 7);

/**
 * Today's date as YYYY-MM-DD string
 * @returns {string}
 */
const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Format a number with compact notation (K, M)
 * @param {number} n
 * @returns {string}
 */
const fmt = (n) => {
  if (n == null || isNaN(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (a >= 1000) return (n / 1e3).toFixed(2) + 'K';
  if (a >= 1) return n.toFixed(2);
  if (a >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
};

/**
 * Format a dollar P&L with sign prefix
 * @param {number} v
 * @returns {string} e.g. "+$1.23K" or "-$456.00"
 */
const fmtD = (v) => (v >= 0 ? '+$' : '-$') + fmt(Math.abs(v));

/**
 * Format a price value for chart display
 * @param {number} v
 * @returns {string}
 */
function fmtPrice(v) {
  if (v == null || isNaN(v)) return '0';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(2);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(4);
  if (a >= 0.0001) return v.toFixed(6);
  return v.toFixed(8);
}

/**
 * Compute a "nice" number for axis scaling (Heckbert's algorithm)
 * @param {number} r - Range value
 * @param {boolean} round - Whether to round (true) or ceil (false)
 * @returns {number}
 */
function niceNum(r, round) {
  if (r <= 0) return 1;
  const e = Math.floor(Math.log10(r));
  const f = r / Math.pow(10, e);
  let n;
  if (round) {
    n = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  } else {
    n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  }
  return n * Math.pow(10, e);
}

/**
 * Compute nice axis scale with min, max, ticks, and spacing
 * @param {number} min - Data minimum
 * @param {number} max - Data maximum
 * @param {number} mt - Desired number of tick marks
 * @returns {{ min: number, max: number, ticks: number[], spacing: number }}
 */
function niceScale(min, max, mt) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 100;
  }
  if (mt < 2) mt = 2;

  const r = niceNum(max - min, false);
  const sp = niceNum(r / (mt - 1), true);
  if (sp <= 0) return { min: min - 1, max: max + 1, ticks: [min, max], spacing: 1 };

  const nMin = Math.floor(min / sp) * sp;
  const nMax = Math.ceil(max / sp) * sp;
  const t = [];
  for (let v = nMin; v <= nMax + sp * 0.5; v += sp) {
    t.push(+(v.toFixed(10)));
  }
  return { min: nMin, max: nMax, ticks: t, spacing: sp };
}

/**
 * Binary search — snap a trade timestamp to the nearest OHLCV bar
 * @param {{ time: string }[]} data - OHLCV bars with time field
 * @param {string} timestamp - ISO timestamp to find
 * @returns {number} Index of nearest bar, or -1 if not found
 */
function findNearestBar(data, timestamp) {
  if (!data?.length || !timestamp) return -1;
  const target = new Date(timestamp).getTime();
  if (isNaN(target)) return -1;

  let lo = 0,
    hi = data.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const barTime = new Date(data[mid].time).getTime();
    if (barTime === target) return mid;
    if (barTime < target) lo = mid + 1;
    else hi = mid - 1;
  }

  // Return closest of lo and hi
  if (lo >= data.length) return data.length - 1;
  if (hi < 0) return 0;
  const loTime = new Date(data[lo].time).getTime();
  const hiTime = new Date(data[hi].time).getTime();
  return Math.abs(loTime - target) <= Math.abs(hiTime - target) ? lo : hi;
}

/**
 * Auto-select chart timeframe based on how old the trade is
 * @param {{ date: string }} trade
 * @returns {string} Timeframe ID (e.g., "1d", "5d", "3m")
 */
function bestTfForTrade(trade) {
  if (!trade?.date) return '3m';
  const days = (Date.now() - new Date(trade.date).getTime()) / 86400000;
  if (days < 1) return '1d';
  if (days < 5) return '5d';
  if (days < 30) return '1m';
  if (days < 90) return '3m';
  if (days < 180) return '6m';
  return '1y';
}

/**
 * Convert OHLCV data to Heikin-Ashi candles
 * @param {{ open: number, high: number, low: number, close: number, time: string, volume?: number }[]} data
 * @returns {Array} Heikin-Ashi candle data with same structure
 */
function toHeikinAshi(data) {
  if (!data?.length) return data;
  const ha = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const prevHa = i > 0 ? ha[i - 1] : null;
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = prevHa
      ? (prevHa.open + prevHa.close) / 2
      : (d.open + d.close) / 2;
    const haHigh = Math.max(d.high, haOpen, haClose);
    const haLow = Math.min(d.low, haOpen, haClose);
    ha.push({
      ...d,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });
  }
  return ha;
}

/**
 * Relative time string ("2h ago", "yesterday", "Mon", etc.)
 * @param {string|Date} date
 * @returns {string}
 */
const timeAgo = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Plain-English metric explanations for dashboard tooltips
 */
const METRIC_TIPS = {
  'Profit Factor': 'Gross profits ÷ gross losses. Above 1.5 is strong, above 2.0 is excellent.',
  'Sharpe': 'Risk-adjusted return. Above 1.0 is good, above 2.0 is very strong.',
  'Max DD': 'Maximum drawdown — the largest peak-to-trough decline in your equity.',
  'Expectancy': 'Average amount you expect to win (or lose) per trade.',
  'Kelly Criterion': 'Optimal position size based on your win rate and risk/reward.',
  'Risk of Ruin': 'Probability of losing your entire account with current strategy.',
  'Sortino': 'Like Sharpe but only penalizes downside volatility. Higher is better.',
  'Win Rate': 'Percentage of trades that are profitable.',
};

export {
  uid,
  todayStr,
  fmt,
  fmtD,
  fmtPrice,
  niceNum,
  niceScale,
  findNearestBar,
  bestTfForTrade,
  toHeikinAshi,
  timeAgo,
  METRIC_TIPS,
};
