// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — groupTradesBy
// DRY replacement for repeated grouping logic in:
//   TagPerformance, SymbolPerformance, SessionAnalysis,
//   PlaybookPerformance, MonthlyPerformance, EmotionBreakdown
//
// Usage:
//   groupTradesBy(trades, t => t.symbol)
//   groupTradesBy(trades, t => t.playbook || 'untagged', { sort: 'count' })
// ═══════════════════════════════════════════════════════════════════

/**
 * Group trades by a key function and compute aggregate stats per group.
 *
 * @param {Object[]} trades — Array of trade objects with at least { pnl, rMultiple? }
 * @param {Function} keyFn — (trade) => string — the grouping key
 * @param {Object} [opts]
 * @param {'pnl'|'count'|'winRate'|'key'} [opts.sort='pnl'] — sort field
 * @param {'desc'|'asc'} [opts.dir='desc'] — sort direction
 * @param {number} [opts.limit=0] — max groups to return (0 = all)
 * @returns {GroupResult[]}
 */
function groupTradesBy(trades, keyFn, opts = {}) {
  if (!trades?.length || typeof keyFn !== 'function') return [];

  const { sort = 'pnl', dir = 'desc', limit = 0 } = opts;
  const map = {};

  for (const t of trades) {
    const key = keyFn(t);
    if (key == null) continue;
    const k = String(key);

    if (!map[k]) {
      map[k] = {
        key: k,
        pnl: 0,
        count: 0,
        wins: 0,
        losses: 0,
        totalWin: 0,
        totalLoss: 0,
        totalFees: 0,
        rSum: 0,
        rCount: 0,
        bestTrade: -Infinity,
        worstTrade: Infinity,
      };
    }

    const g = map[k];
    g.pnl += t.pnl;
    g.count += 1;

    if (t.pnl > 0) {
      g.wins += 1;
      g.totalWin += t.pnl;
    } else if (t.pnl < 0) {
      g.losses += 1;
      g.totalLoss += Math.abs(t.pnl);
    }

    if (t.fees) g.totalFees += Math.abs(t.fees);

    if (t.rMultiple != null && !isNaN(t.rMultiple)) {
      g.rSum += t.rMultiple;
      g.rCount += 1;
    }

    if (t.pnl > g.bestTrade) g.bestTrade = t.pnl;
    if (t.pnl < g.worstTrade) g.worstTrade = t.pnl;
  }

  // Compute derived metrics
  let groups = Object.values(map).map((g) => ({
    key: g.key,
    pnl: g.pnl,
    count: g.count,
    wins: g.wins,
    losses: g.losses,
    winRate: g.count > 0 ? (g.wins / g.count) * 100 : 0,
    avgWin: g.wins > 0 ? g.totalWin / g.wins : 0,
    avgLoss: g.losses > 0 ? g.totalLoss / g.losses : 0,
    avgPnl: g.count > 0 ? g.pnl / g.count : 0,
    profitFactor: g.totalLoss > 0 ? g.totalWin / g.totalLoss : g.totalWin > 0 ? Infinity : 0,
    totalFees: g.totalFees,
    avgR: g.rCount > 0 ? g.rSum / g.rCount : 0,
    bestTrade: g.bestTrade === -Infinity ? 0 : g.bestTrade,
    worstTrade: g.worstTrade === Infinity ? 0 : g.worstTrade,
  }));

  // Sort
  const mul = dir === 'asc' ? 1 : -1;
  if (sort === 'key') {
    groups.sort((a, b) => mul * a.key.localeCompare(b.key));
  } else {
    groups.sort((a, b) => mul * (a[sort] - b[sort]));
  }

  // Limit
  if (limit > 0) groups = groups.slice(0, limit);

  return groups;
}

/**
 * Group trades by time bucket (day-of-week, hour, month, week).
 *
 * @param {Object[]} trades
 * @param {'dayOfWeek'|'hour'|'month'|'week'} bucket
 * @returns {GroupResult[]}
 */
function groupTradesByTime(trades, bucket) {
  if (!trades?.length) return [];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const keyFn = {
    dayOfWeek: (t) => {
      const d = new Date(t.date).getDay();
      return dayNames[d];
    },
    hour: (t) => {
      const h = new Date(t.date).getHours();
      return String(h).padStart(2, '0') + ':00';
    },
    month: (t) => t.date.slice(0, 7), // YYYY-MM
    week: (t) => {
      const d = new Date(t.date);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    },
  }[bucket];

  if (!keyFn) return [];

  const result = groupTradesBy(trades, keyFn, { sort: 'key', dir: 'asc' });

  // For dayOfWeek, ensure all 7 days present in correct order
  if (bucket === 'dayOfWeek') {
    const map = Object.fromEntries(result.map((g) => [g.key, g]));
    return dayNames.map((name) => map[name] || {
      key: name, pnl: 0, count: 0, wins: 0, losses: 0, winRate: 0,
      avgWin: 0, avgLoss: 0, avgPnl: 0, profitFactor: 0, totalFees: 0,
      avgR: 0, bestTrade: 0, worstTrade: 0,
    });
  }

  // For hour, ensure all 24 hours present
  if (bucket === 'hour') {
    const map = Object.fromEntries(result.map((g) => [g.key, g]));
    return Array.from({ length: 24 }, (_, i) => {
      const key = String(i).padStart(2, '0') + ':00';
      return map[key] || {
        key, pnl: 0, count: 0, wins: 0, losses: 0, winRate: 0,
        avgWin: 0, avgLoss: 0, avgPnl: 0, profitFactor: 0, totalFees: 0,
        avgR: 0, bestTrade: 0, worstTrade: 0,
      };
    });
  }

  return result;
}

export { groupTradesBy, groupTradesByTime };
export default groupTradesBy;
