// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Performance Compare Engine (Sprint 4.4 + 4.6)
//
// 4.4: Compare performance across periods (this week vs last, etc.)
// 4.6: Compare equity curve against SPY benchmark
//
// Pure functions — no side effects.
//
// Usage:
//   import { comparePeriods, computeEquityCurve } from './PerformanceCompare.js';
//   const comparison = comparePeriods(trades, 'week'); // this week vs last
//   const equity = computeEquityCurve(trades);
// ═══════════════════════════════════════════════════════════════════

function safeDiv(a, b) { return b === 0 ? 0 : a / b; }
function pct(n, d) { return d === 0 ? 0 : (n / d) * 100; }

/**
 * Get start/end dates for a period offset from today.
 * @param {'week'|'month'|'quarter'|'year'} period
 * @param {number} offset - 0 = current, -1 = previous, etc.
 * @returns {{ start: Date, end: Date, label: string }}
 */
function getPeriodRange(period, offset = 0) {
  const now = new Date();
  let start, end, label;

  switch (period) {
    case 'week': {
      const dayOfWeek = now.getDay();
      // Start of week (Monday)
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek + 1 + (offset * 7));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      label = offset === 0 ? 'This Week' : offset === -1 ? 'Last Week' : `${Math.abs(offset)} Weeks Ago`;
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      label = offset === 0 ? 'This Month' : offset === -1 ? 'Last Month' : `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      break;
    }
    case 'quarter': {
      const currentQ = Math.floor(now.getMonth() / 3);
      const qOffset = currentQ + offset;
      const year = now.getFullYear() + Math.floor(qOffset / 4);
      const q = ((qOffset % 4) + 4) % 4;
      start = new Date(year, q * 3, 1);
      end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
      label = offset === 0 ? 'This Quarter' : offset === -1 ? 'Last Quarter' : `Q${q + 1} ${year}`;
      break;
    }
    case 'year': {
      const y = now.getFullYear() + offset;
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
      label = offset === 0 ? 'This Year' : `${y}`;
      break;
    }
    default:
      start = new Date(0);
      end = new Date();
      label = 'All Time';
  }

  return { start, end, label };
}

/**
 * Compute stats for trades within a date range.
 * @param {Object[]} trades
 * @param {Date} start
 * @param {Date} end
 * @returns {Object}
 */
function computePeriodStats(trades, start, end) {
  const filtered = trades.filter(t => {
    try {
      const d = new Date(t.date);
      return d >= start && d <= end;
    } catch { return false; }
  });

  if (filtered.length === 0) {
    return {
      trades: 0, pnl: 0, winRate: 0, avgWin: 0, avgLoss: 0,
      profitFactor: 0, expectancy: 0, bestTrade: 0, worstTrade: 0,
      winStreak: 0, lossStreak: 0, tradingDays: 0, fees: 0,
    };
  }

  let wins = 0, losses = 0, winSum = 0, lossSum = 0;
  let best = -Infinity, worst = Infinity;
  let totalFees = 0;
  const days = new Set();
  let streak = 0, maxWin = 0, maxLoss = 0;

  const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const t of sorted) {
    const p = t.pnl || 0;
    totalFees += t.fees || 0;
    days.add(new Date(t.date).toISOString().slice(0, 10));

    if (p > 0) { wins++; winSum += p; best = Math.max(best, p); streak = streak > 0 ? streak + 1 : 1; maxWin = Math.max(maxWin, streak); }
    else { losses++; lossSum += Math.abs(p); worst = Math.min(worst, p); streak = streak < 0 ? streak - 1 : -1; maxLoss = Math.max(maxLoss, Math.abs(streak)); }
  }

  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? lossSum / losses : 0;
  const winRate = pct(wins, filtered.length);
  const profitFactor = lossSum > 0 ? winSum / lossSum : winSum > 0 ? Infinity : 0;
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

  return {
    trades: filtered.length,
    pnl: filtered.reduce((s, t) => s + (t.pnl || 0), 0),
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    bestTrade: best === -Infinity ? 0 : best,
    worstTrade: worst === Infinity ? 0 : worst,
    winStreak: maxWin,
    lossStreak: maxLoss,
    tradingDays: days.size,
    fees: totalFees,
  };
}

/**
 * Compare current period against previous period.
 *
 * @param {Object[]} trades - All trades
 * @param {'week'|'month'|'quarter'|'year'} period
 * @returns {Object} { current, previous, deltas }
 */
export function comparePeriods(trades, period = 'week') {
  const currentRange = getPeriodRange(period, 0);
  const previousRange = getPeriodRange(period, -1);

  const current = computePeriodStats(trades, currentRange.start, currentRange.end);
  const previous = computePeriodStats(trades, previousRange.start, previousRange.end);

  // Compute deltas
  const delta = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : curr < 0 ? -100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const deltas = {
    pnl: current.pnl - previous.pnl,
    pnlPct: delta(current.pnl, previous.pnl),
    winRate: current.winRate - previous.winRate,
    trades: current.trades - previous.trades,
    profitFactor: current.profitFactor - previous.profitFactor,
    expectancy: current.expectancy - previous.expectancy,
    avgWin: current.avgWin - previous.avgWin,
    avgLoss: current.avgLoss - previous.avgLoss,
  };

  return {
    period,
    current: { ...current, label: currentRange.label, start: currentRange.start, end: currentRange.end },
    previous: { ...previous, label: previousRange.label, start: previousRange.start, end: previousRange.end },
    deltas,
  };
}

/**
 * Compute cumulative equity curve from trades.
 * Returns array of { date, equity, drawdown } for charting.
 *
 * @param {Object[]} trades
 * @param {number} [startingEquity=0]
 * @returns {Object[]}
 */
export function computeEquityCurve(trades, startingEquity = 0) {
  if (!trades?.length) return [];

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
  const curve = [];
  let equity = startingEquity;
  let peak = equity;

  // Group by day
  const byDay = {};
  for (const t of sorted) {
    const d = new Date(t.date).toISOString().slice(0, 10);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(t);
  }

  for (const [date, dayTrades] of Object.entries(byDay).sort()) {
    for (const t of dayTrades) {
      equity += t.pnl || 0;
    }
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? ((equity - peak) / peak) * 100 : 0;

    curve.push({
      date,
      equity: Math.round(equity * 100) / 100,
      peak: Math.round(peak * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      trades: dayTrades.length,
      dayPnl: dayTrades.reduce((s, t) => s + (t.pnl || 0), 0),
    });
  }

  return curve;
}

/**
 * Compute streak data for calendar heatmap visualization.
 * @param {Object[]} trades
 * @returns {Object} Map of date → { pnl, count, winRate }
 */
export function computeCalendarData(trades) {
  if (!trades?.length) return {};

  const byDay = {};
  for (const t of trades) {
    try {
      const d = new Date(t.date).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { pnl: 0, count: 0, wins: 0 };
      byDay[d].count++;
      byDay[d].pnl += t.pnl || 0;
      if ((t.pnl || 0) > 0) byDay[d].wins++;
    } catch { /* skip invalid dates */ }
  }

  for (const [d, data] of Object.entries(byDay)) {
    data.winRate = pct(data.wins, data.count);
    data.pnl = Math.round(data.pnl * 100) / 100;
  }

  return byDay;
}

export { getPeriodRange, computePeriodStats };
export default comparePeriods;
