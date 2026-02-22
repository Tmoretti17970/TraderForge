// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Engine Tests
// Tests for: compute(), Kelly, Sharpe, Sortino, Monte Carlo, streaks,
//            edge cases, warnings system
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeFast as compute, MIN_SAMPLES } from '../engine/analyticsFast.js';

// ─── Test Data Factories ────────────────────────────────────────
const mkTrade = (overrides = {}) => ({
  id: 'test_' + Math.random().toString(36).slice(2),
  date: '2025-01-15T10:30:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl: 100,
  fees: 2,
  quantity: 1,
  emotion: '',
  playbook: '',
  tags: [],
  followedRules: true,
  rMultiple: null,
  ...overrides,
});

const mkWinner = (pnl = 100, date = '2025-01-15T10:00:00Z') =>
  mkTrade({ pnl, date });

const mkLoser = (pnl = -50, date = '2025-01-15T11:00:00Z') =>
  mkTrade({ pnl, date });

function generateTrades(n, winRate = 0.5, avgWin = 100, avgLoss = 50) {
  const trades = [];
  for (let i = 0; i < n; i++) {
    const day = Math.floor(i / 5);
    const date = new Date(2025, 0, 1 + day, 10 + (i % 5));
    const isWin = i / n < winRate;
    trades.push(
      mkTrade({
        pnl: isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random()),
        date: date.toISOString(),
        symbol: ['BTC', 'ETH', 'SOL'][i % 3],
        playbook: ['breakout', 'reversal', ''][i % 3],
        emotion: ['calm', 'confident', 'anxious'][i % 3],
      })
    );
  }
  return trades;
}

// ═══ NULL / EMPTY INPUTS ════════════════════════════════════════
describe('compute() — null/empty inputs', () => {
  it('returns null for empty array', () => {
    expect(compute([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(compute(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(compute(undefined)).toBeNull();
  });

  it('handles missing settings gracefully', () => {
    const result = compute([mkWinner()]);
    expect(result).not.toBeNull();
    expect(result.warnings).toBeDefined();
  });

  it('handles null settings', () => {
    const result = compute([mkWinner()], null);
    expect(result).not.toBeNull();
  });

  it('handles invalid settings type', () => {
    const result = compute([mkWinner()], 'invalid');
    expect(result).not.toBeNull();
  });
});

// ═══ SINGLE TRADE ═══════════════════════════════════════════════
describe('compute() — single trade', () => {
  it('single winner', () => {
    const result = compute([mkWinner(500)]);
    expect(result.totalPnl).toBe(500);
    expect(result.winRate).toBe(100);
    expect(result.avgWin).toBe(500);
    expect(result.avgLoss).toBe(0);
    expect(result.tradeCount).toBe(1);
    expect(result.winCount).toBe(1);
    expect(result.lossCount).toBe(0);
  });

  it('single loser', () => {
    const result = compute([mkLoser(-200)]);
    expect(result.totalPnl).toBe(-200);
    expect(result.winRate).toBe(0);
    expect(result.avgWin).toBe(0);
    expect(result.avgLoss).toBe(200);
    expect(result.tradeCount).toBe(1);
    expect(result.lossCount).toBe(1);
  });

  it('single breakeven trade (pnl = 0)', () => {
    const result = compute([mkTrade({ pnl: 0 })]);
    expect(result.totalPnl).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.avgWin).toBe(0);
    expect(result.avgLoss).toBe(0);
  });

  it('single trade generates sample-size warnings', () => {
    const result = compute([mkWinner()]);
    const metricWarnings = result.warnings.map((w) => w.metric);
    expect(metricWarnings).toContain('kelly');
    expect(metricWarnings).toContain('monteCarlo');
    expect(metricWarnings).toContain('sharpe');
    expect(metricWarnings).toContain('sortino');
  });
});

// ═══ ALL WINNERS / ALL LOSERS ═══════════════════════════════════
describe('compute() — all winners', () => {
  it('100% win rate', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.winRate).toBe(100);
    expect(result.lossCount).toBe(0);
    expect(result.avgLoss).toBe(0);
  });

  it('profit factor = Infinity when no losers', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.pf).toBe(Infinity);
  });

  it('best streak equals total count', () => {
    const trades = Array.from({ length: 7 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.best).toBe(7);
    expect(result.worst).toBe(0);
  });
});

describe('compute() — all losers', () => {
  it('0% win rate', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkLoser(-50, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.winRate).toBe(0);
    expect(result.winCount).toBe(0);
  });

  it('profit factor = 0 when no winners', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      mkLoser(-50, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.pf).toBe(0);
  });

  it('worst streak equals total count', () => {
    const trades = Array.from({ length: 7 }, (_, i) =>
      mkLoser(-50, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.worst).toBe(7);
    expect(result.best).toBe(0);
  });

  it('negative expectancy', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkLoser(-100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.expectancy).toBeLessThan(0);
  });
});

// ═══ KELLY CRITERION ════════════════════════════════════════════
describe('compute() — Kelly Criterion', () => {
  it('Kelly is between 0 and 1', () => {
    const trades = generateTrades(100, 0.55, 150, 100);
    const result = compute(trades);
    expect(result.kelly).toBeGreaterThanOrEqual(0);
    expect(result.kelly).toBeLessThanOrEqual(1);
  });

  it('Kelly = 0 for all losers', () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mkLoser(-50, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.kelly).toBe(0);
  });

  it('Kelly = 0 for negative mean P&L', () => {
    const trades = [
      ...Array.from({ length: 3 }, (_, i) =>
        mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        mkLoser(-100, `2025-01-${String(i + 4).padStart(2, '0')}T10:00:00Z`)
      ),
    ];
    const result = compute(trades);
    expect(result.kelly).toBe(0);
  });

  it('Kelly capped at 1', () => {
    const trades = [
      ...Array.from({ length: 9 }, (_, i) =>
        mkWinner(10000, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      ),
      mkLoser(-1, '2025-01-10T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.kelly).toBeLessThanOrEqual(1);
  });

  it('warns when trades < MIN_SAMPLES.kelly', () => {
    const trades = Array.from({ length: MIN_SAMPLES.kelly - 1 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.warnings.some((w) => w.metric === 'kelly')).toBe(true);
  });

  it('no Kelly warning when trades >= MIN_SAMPLES.kelly', () => {
    const trades = Array.from({ length: MIN_SAMPLES.kelly + 5 }, (_, i) =>
      mkWinner(100, `2025-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.warnings.some((w) => w.metric === 'kelly')).toBe(false);
  });
});

// ═══ SHARPE & SORTINO ═══════════════════════════════════════════
describe('compute() — Sharpe & Sortino', () => {
  it('Sharpe = 0 when std = 0', () => {
    const trades = Array.from({ length: 5 }, () =>
      mkWinner(100, '2025-01-15T10:00:00Z')
    );
    const result = compute(trades);
    expect(result.sharpe).toBe(0);
  });

  it('Sharpe is positive for consistently profitable trading', () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      mkWinner(
        100 + (i % 5) * 10,
        `2025-01-${String((i % 28) + 1).padStart(2, '0')}T${String(10 + (i % 3)).padStart(2, '0')}:00:00Z`
      )
    );
    const result = compute(trades);
    expect(result.sharpe).toBeGreaterThan(0);
  });

  it('Sortino = 0 when no downside deviation', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.sortino).toBe(0);
  });

  it('warns for few trading days', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkLoser(-50, '2025-01-02T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.warnings.some((w) => w.metric === 'sharpe')).toBe(true);
    expect(result.warnings.some((w) => w.metric === 'sortino')).toBe(true);
  });

  it('higher Rf reduces Sharpe', () => {
    const trades = generateTrades(50, 0.55, 100, 80);
    const r1 = compute(trades, { riskFreeRate: 0 });
    const r2 = compute(trades, { riskFreeRate: 0.05 });
    if (r1.sharpe > 0 && r2.sharpe > 0) {
      expect(r2.sharpe).toBeLessThan(r1.sharpe);
    }
  });
});

// ═══ MONTE CARLO ROR ════════════════════════════════════════════
describe('compute() — Monte Carlo RoR', () => {
  it('RoR is between 0 and 100', () => {
    const trades = generateTrades(50, 0.5, 100, 100);
    const result = compute(trades);
    expect(result.ror).toBeGreaterThanOrEqual(0);
    expect(result.ror).toBeLessThanOrEqual(100);
  });

  it('RoR is low for highly profitable system', () => {
    const trades = generateTrades(100, 0.9, 300, 100);
    const result = compute(trades, { mcRuns: 5000 });
    expect(result.ror).toBeLessThan(20);
  });

  it('RoR is high for losing system', () => {
    const trades = generateTrades(100, 0.3, 100, 100);
    const result = compute(trades, { mcRuns: 5000 });
    expect(result.ror).toBeGreaterThan(30);
  });

  it('warns when trades < MIN_SAMPLES.monteCarlo', () => {
    const trades = Array.from({ length: 5 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.warnings.some((w) => w.metric === 'monteCarlo')).toBe(true);
  });
});

// ═══ STREAKS ════════════════════════════════════════════════════
describe('compute() — Win/Loss Streaks', () => {
  it('detects correct winning streak', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkWinner(100, '2025-01-02T10:00:00Z'),
      mkWinner(100, '2025-01-03T10:00:00Z'),
      mkLoser(-50, '2025-01-04T10:00:00Z'),
      mkWinner(100, '2025-01-05T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.best).toBe(3);
  });

  it('detects correct losing streak', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkLoser(-50, '2025-01-02T10:00:00Z'),
      mkLoser(-50, '2025-01-03T10:00:00Z'),
      mkLoser(-50, '2025-01-04T10:00:00Z'),
      mkLoser(-50, '2025-01-05T10:00:00Z'),
      mkWinner(100, '2025-01-06T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.worst).toBe(4);
  });

  it('sorts by date before computing streaks', () => {
    const trades = [
      mkLoser(-50, '2025-01-05T10:00:00Z'),
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkWinner(100, '2025-01-02T10:00:00Z'),
      mkWinner(100, '2025-01-03T10:00:00Z'),
      mkLoser(-50, '2025-01-04T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.best).toBe(3);
  });
});

// ═══ MAX DRAWDOWN & EQUITY CURVE ════════════════════════════════
describe('compute() — Max Drawdown & Equity Curve', () => {
  it('maxDd = 0 for monotonically increasing equity', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
    );
    const result = compute(trades);
    expect(result.maxDd).toBe(0);
  });

  it('calculates correct drawdown percentage', () => {
    const trades = [
      mkWinner(1000, '2025-01-01T10:00:00Z'),
      mkLoser(-500, '2025-01-02T10:00:00Z'),
      mkWinner(200, '2025-01-03T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.maxDd).toBeCloseTo(50, 0);
  });

  it('equity curve aggregates by day', () => {
    const trades = [
      mkWinner(100, '2025-01-01T10:00:00Z'),
      mkWinner(200, '2025-01-01T11:00:00Z'),
      mkLoser(-50, '2025-01-02T10:00:00Z'),
    ];
    const result = compute(trades);
    expect(result.eq.length).toBe(2); // 2 unique days
    expect(result.eq[0].pnl).toBe(300); // day 1 total
  });

  it('equity curve is date-sorted', () => {
    const trades = generateTrades(20, 0.5, 100, 100);
    const result = compute(trades);
    for (let i = 1; i < result.eq.length; i++) {
      expect(result.eq[i].date >= result.eq[i - 1].date).toBe(true);
    }
  });
});

// ═══ BREAKDOWNS ═════════════════════════════════════════════════
describe('compute() — Breakdowns', () => {
  it('byDay has 7 entries', () => {
    const trades = generateTrades(50, 0.5, 100, 100);
    const result = compute(trades);
    expect(result.byDay.length).toBe(7);
    expect(result.byDay[0].name).toBe('Sun');
    expect(result.byDay[6].name).toBe('Sat');
  });

  it('byH has 24 entries', () => {
    const trades = generateTrades(50, 0.5, 100, 100);
    const result = compute(trades);
    expect(result.byH.length).toBe(24);
  });

  it('bySt groups by playbook', () => {
    const trades = [
      mkTrade({ pnl: 100, playbook: 'breakout', date: '2025-01-01T10:00:00Z' }),
      mkTrade({ pnl: -50, playbook: 'breakout', date: '2025-01-02T10:00:00Z' }),
      mkTrade({ pnl: 200, playbook: 'reversal', date: '2025-01-03T10:00:00Z' }),
    ];
    const result = compute(trades);
    expect(result.bySt.breakout.count).toBe(2);
    expect(result.bySt.breakout.pnl).toBe(50);
    expect(result.bySt.reversal.count).toBe(1);
  });

  it('missing playbook/emotion tagged as "untagged"', () => {
    const trades = [mkTrade({ pnl: 100, playbook: '', emotion: '', date: '2025-01-01T10:00:00Z' })];
    const result = compute(trades);
    expect(result.bySt.untagged).toBeDefined();
    expect(result.byEmo.untagged).toBeDefined();
  });
});

// ═══ FEES & R-MULTIPLES ═════════════════════════════════════════
describe('compute() — Fees & R-Multiples', () => {
  it('sums fees correctly', () => {
    const trades = [
      mkTrade({ pnl: 100, fees: 5, date: '2025-01-01T10:00:00Z' }),
      mkTrade({ pnl: -50, fees: 3, date: '2025-01-02T10:00:00Z' }),
    ];
    const result = compute(trades);
    expect(result.totalFees).toBe(8);
  });

  it('handles missing fees', () => {
    const t = mkTrade({ pnl: 100, date: '2025-01-01T10:00:00Z' });
    delete t.fees;
    const result = compute([t]);
    expect(result.totalFees).toBe(0);
  });

  it('calculates avgR from trades with rMultiple', () => {
    const trades = [
      mkTrade({ pnl: 100, rMultiple: 2, date: '2025-01-01T10:00:00Z' }),
      mkTrade({ pnl: -50, rMultiple: -1, date: '2025-01-02T10:00:00Z' }),
      mkTrade({ pnl: 150, rMultiple: 3, date: '2025-01-03T10:00:00Z' }),
    ];
    const result = compute(trades);
    expect(result.avgR).toBeCloseTo((2 + -1 + 3) / 3, 2);
  });

  it('avgR = 0 when no trades have rMultiple', () => {
    const result = compute([mkTrade({ pnl: 100, rMultiple: null, date: '2025-01-01T10:00:00Z' })]);
    expect(result.avgR).toBe(0);
  });
});

// ═══ EXPECTANCY ═════════════════════════════════════════════════
describe('compute() — Expectancy', () => {
  it('positive expectancy for winning system', () => {
    const trades = [
      ...Array.from({ length: 6 }, (_, i) =>
        mkWinner(200, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        mkLoser(-100, `2025-01-${String(i + 7).padStart(2, '0')}T10:00:00Z`)
      ),
    ];
    const result = compute(trades);
    expect(result.expectancy).toBeCloseTo(80, 0);
  });

  it('negative expectancy for losing system', () => {
    const trades = [
      ...Array.from({ length: 3 }, (_, i) =>
        mkWinner(100, `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        mkLoser(-100, `2025-01-${String(i + 4).padStart(2, '0')}T10:00:00Z`)
      ),
    ];
    const result = compute(trades);
    expect(result.expectancy).toBeCloseTo(-40, 0);
  });
});

// ═══ RETURN SHAPE ═══════════════════════════════════════════════
describe('compute() — Return Shape', () => {
  it('returns all expected fields', () => {
    const trades = generateTrades(20, 0.5, 100, 100);
    const result = compute(trades);
    const expectedFields = [
      'totalPnl', 'totalFees', 'winRate', 'avgWin', 'avgLoss', 'rr', 'pf',
      'sharpe', 'sortino', 'maxDd', 'expectancy', 'expectancyR', 'kelly',
      'ror', 'eq', 'byDay', 'byH', 'bySt', 'byEmo', 'best', 'worst',
      'lw', 'll', 'avgR', 'ruleBreaks', 'consLoss3', 'consLoss5',
      'insights', 'warnings', 'tradeCount', 'winCount', 'lossCount',
    ];
    expectedFields.forEach((field) => {
      expect(result).toHaveProperty(field);
    });
  });

  it('no NaN in numeric fields', () => {
    const trades = generateTrades(30, 0.5, 100, 100);
    const result = compute(trades);
    const numericFields = [
      'totalPnl', 'totalFees', 'winRate', 'avgWin', 'avgLoss', 'pf',
      'sharpe', 'sortino', 'maxDd', 'expectancy', 'kelly', 'ror',
      'best', 'worst', 'lw', 'll', 'avgR', 'ruleBreaks',
      'consLoss3', 'consLoss5', 'tradeCount', 'winCount', 'lossCount',
    ];
    numericFields.forEach((field) => {
      const val = result[field];
      if (val !== Infinity && val !== -Infinity) {
        expect(isNaN(val)).toBe(false);
      }
    });
  });

  it('warnings is always an array with metric + message', () => {
    const result = compute([mkWinner()]);
    expect(Array.isArray(result.warnings)).toBe(true);
    result.warnings.forEach((w) => {
      expect(w).toHaveProperty('metric');
      expect(w).toHaveProperty('message');
    });
  });

  it('insights always has at least one entry', () => {
    const result = compute([mkWinner()]);
    expect(result.insights.length).toBeGreaterThanOrEqual(1);
  });
});
