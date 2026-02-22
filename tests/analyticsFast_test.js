// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — analyticsFast Tests
// Cross-validates single-pass computeFast() against original compute()
// for deterministic metrics. Monte Carlo is stochastic, so tested separately.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeFast } from '../engine/analyticsFast.js';

const mkTrade = (pnl, overrides = {}) => ({
  id: 'x',
  date: '2025-01-15T10:00:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl,
  fees: Math.abs(pnl) * 0.01,
  playbook: 'Trend',
  emotion: 'Calm',
  rMultiple: pnl / 100,
  followedRules: pnl > 0,
  ...overrides,
});

const sampleTrades = [
  mkTrade(500, { date: '2025-01-13T09:30:00Z', playbook: 'Trend', emotion: 'Confident' }),
  mkTrade(-200, { date: '2025-01-13T14:00:00Z', playbook: 'Reversal', emotion: 'Anxious' }),
  mkTrade(300, { date: '2025-01-14T10:00:00Z', playbook: 'Trend', emotion: 'Focused' }),
  mkTrade(-100, { date: '2025-01-14T14:00:00Z', playbook: 'Trend', emotion: 'Neutral' }),
  mkTrade(700, { date: '2025-01-15T09:00:00Z', playbook: 'Breakout', emotion: 'Confident' }),
  mkTrade(-50, { date: '2025-01-15T11:00:00Z', playbook: 'Breakout', emotion: 'Calm' }),
  mkTrade(400, { date: '2025-01-16T10:00:00Z', playbook: 'Trend', emotion: 'Focused' }),
  mkTrade(-150, { date: '2025-01-16T15:00:00Z', playbook: 'Reversal', emotion: 'Frustrated' }),
  mkTrade(250, { date: '2025-01-17T09:30:00Z', playbook: 'Breakout', emotion: 'Calm' }),
  mkTrade(-80, { date: '2025-01-17T14:00:00Z', playbook: 'Trend', emotion: 'Uncertain' }),
];

// ═══ Null/Empty ═════════════════════════════════════════════════
describe('computeFast edge cases', () => {
  it('returns null for empty trades', () => {
    expect(computeFast(null)).toBeNull();
    expect(computeFast([])).toBeNull();
    expect(computeFast(undefined)).toBeNull();
  });

  it('handles single trade', () => {
    const r = computeFast([mkTrade(100)]);
    expect(r).not.toBeNull();
    expect(r.tradeCount).toBe(1);
    expect(r.winRate).toBe(100);
    expect(r.totalPnl).toBe(100);
  });
});

// ═══ Cross-Validation vs. Original ══════════════════════════════
describe('computeFast vs compute (deterministic metrics)', () => {
  // Use fixed MC seed scenario by setting mcRuns=0 to skip stochastic parts
  const settings = { mcRuns: 0 };

  const fast = computeFast(sampleTrades, settings);
  const orig = compute(sampleTrades, settings);

  it('totalPnl matches', () => {
    expect(fast.totalPnl).toBeCloseTo(orig.totalPnl, 6);
  });

  it('totalFees matches', () => {
    expect(fast.totalFees).toBeCloseTo(orig.totalFees, 6);
  });

  it('winRate matches', () => {
    expect(fast.winRate).toBeCloseTo(orig.winRate, 6);
  });

  it('avgWin matches', () => {
    expect(fast.avgWin).toBeCloseTo(orig.avgWin, 6);
  });

  it('avgLoss matches', () => {
    expect(fast.avgLoss).toBeCloseTo(orig.avgLoss, 6);
  });

  it('reward:risk matches', () => {
    expect(fast.rr).toBeCloseTo(orig.rr, 6);
  });

  it('profitFactor matches', () => {
    expect(fast.pf).toBeCloseTo(orig.pf, 6);
  });

  it('expectancy matches', () => {
    expect(fast.expectancy).toBeCloseTo(orig.expectancy, 6);
  });

  it('expectancyR matches', () => {
    expect(fast.expectancyR).toBeCloseTo(orig.expectancyR, 4);
  });

  it('kelly matches', () => {
    expect(fast.kelly).toBeCloseTo(orig.kelly, 6);
  });

  it('sharpe matches', () => {
    expect(fast.sharpe).toBeCloseTo(orig.sharpe, 4);
  });

  it('sortino matches', () => {
    expect(fast.sortino).toBeCloseTo(orig.sortino, 4);
  });

  it('maxDd matches', () => {
    expect(fast.maxDd).toBeCloseTo(orig.maxDd, 4);
  });

  it('winCount matches', () => {
    expect(fast.winCount).toBe(orig.winCount);
  });

  it('lossCount matches', () => {
    expect(fast.lossCount).toBe(orig.lossCount);
  });

  it('tradeCount matches', () => {
    expect(fast.tradeCount).toBe(orig.tradeCount);
  });

  it('avgR matches', () => {
    expect(fast.avgR).toBeCloseTo(orig.avgR, 6);
  });

  it('lw (largest win) matches', () => {
    expect(fast.lw).toBe(orig.lw);
  });

  it('ll (largest loss) matches', () => {
    expect(fast.ll).toBe(orig.ll);
  });

  it('best streak matches', () => {
    expect(fast.best).toBe(orig.best);
  });

  it('worst streak matches', () => {
    expect(fast.worst).toBe(orig.worst);
  });

  it('ruleBreaks matches', () => {
    expect(fast.ruleBreaks).toBe(orig.ruleBreaks);
  });

  it('consLoss3 matches', () => {
    expect(fast.consLoss3).toBeCloseTo(orig.consLoss3, 6);
  });

  it('consLoss5 matches', () => {
    expect(fast.consLoss5).toBeCloseTo(orig.consLoss5, 6);
  });

  it('equity curve length matches', () => {
    expect(fast.eq.length).toBe(orig.eq.length);
  });

  it('byDay has 7 entries', () => {
    expect(fast.byDay.length).toBe(7);
    expect(orig.byDay.length).toBe(7);
  });

  it('byDay pnl matches', () => {
    for (let i = 0; i < 7; i++) {
      expect(fast.byDay[i].pnl).toBeCloseTo(orig.byDay[i].pnl, 6);
      expect(fast.byDay[i].count).toBe(orig.byDay[i].count);
    }
  });

  it('byH has 24 entries', () => {
    expect(fast.byH.length).toBe(24);
    expect(orig.byH.length).toBe(24);
  });

  it('byH pnl matches', () => {
    for (let i = 0; i < 24; i++) {
      expect(fast.byH[i].pnl).toBeCloseTo(orig.byH[i].pnl, 6);
      expect(fast.byH[i].count).toBe(orig.byH[i].count);
    }
  });

  it('bySt keys match', () => {
    const fastKeys = Object.keys(fast.bySt).sort();
    const origKeys = Object.keys(orig.bySt).sort();
    expect(fastKeys).toEqual(origKeys);
  });

  it('bySt pnl matches per strategy', () => {
    for (const key of Object.keys(fast.bySt)) {
      expect(fast.bySt[key].pnl).toBeCloseTo(orig.bySt[key].pnl, 6);
      expect(fast.bySt[key].count).toBe(orig.bySt[key].count);
    }
  });

  it('byEmo keys match', () => {
    const fastKeys = Object.keys(fast.byEmo).sort();
    const origKeys = Object.keys(orig.byEmo).sort();
    expect(fastKeys).toEqual(origKeys);
  });

  it('warnings array has same metrics flagged', () => {
    const fastMetrics = fast.warnings.map((w) => w.metric).sort();
    const origMetrics = orig.warnings.map((w) => w.metric).sort();
    expect(fastMetrics).toEqual(origMetrics);
  });
});

// ═══ Monte Carlo (stochastic — bounded check) ══════════════════
describe('computeFast Monte Carlo', () => {
  it('ror is between 0 and 100', () => {
    const r = computeFast(sampleTrades, { mcRuns: 1000 });
    expect(r.ror).toBeGreaterThanOrEqual(0);
    expect(r.ror).toBeLessThanOrEqual(100);
  });

  it('ror = 0 with very profitable trades', () => {
    const winners = Array.from({ length: 30 }, () => mkTrade(1000));
    const r = computeFast(winners, { mcRuns: 500 });
    expect(r.ror).toBe(0);
  });
});

// ═══ Settings Passthrough ═══════════════════════════════════════
describe('computeFast settings', () => {
  it('respects riskFreeRate', () => {
    const r0 = computeFast(sampleTrades, { riskFreeRate: 0, mcRuns: 0 });
    const r5 = computeFast(sampleTrades, { riskFreeRate: 5.0, mcRuns: 0 }); // extreme Rf
    // With extreme Rf, Sharpe should decrease measurably
    expect(r0.sharpe).toBeGreaterThan(r5.sharpe);
  });

  it('respects mcRuns=0 (skip MC)', () => {
    const r = computeFast(sampleTrades, { mcRuns: 0 });
    expect(r.ror).toBe(0);
  });
});
