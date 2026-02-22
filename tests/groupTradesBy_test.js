// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — groupTradesBy Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { groupTradesBy, groupTradesByTime } from '../utils/groupTradesBy.js';

const mkTrade = (overrides = {}) => ({
  id: 'x',
  date: '2025-01-15T10:00:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl: 100,
  fees: 2,
  playbook: 'Trend',
  emotion: 'Calm',
  rMultiple: 1.5,
  ...overrides,
});

const sampleTrades = [
  mkTrade({ symbol: 'BTC', pnl: 500, fees: 5, rMultiple: 2.5, playbook: 'Trend' }),
  mkTrade({ symbol: 'BTC', pnl: -200, fees: 5, rMultiple: -1.0, playbook: 'Reversal' }),
  mkTrade({ symbol: 'ETH', pnl: 300, fees: 3, rMultiple: 1.8, playbook: 'Trend' }),
  mkTrade({ symbol: 'ETH', pnl: -100, fees: 3, rMultiple: -0.5, playbook: 'Trend' }),
  mkTrade({ symbol: 'ES', pnl: 700, fees: 4, rMultiple: 3.5, playbook: 'Breakout' }),
  mkTrade({ symbol: 'ES', pnl: -50, fees: 4, rMultiple: -0.3, playbook: 'Breakout' }),
];

// ═══ groupTradesBy ══════════════════════════════════════════════
describe('groupTradesBy', () => {
  it('returns empty for null/empty input', () => {
    expect(groupTradesBy(null, t => t.symbol)).toEqual([]);
    expect(groupTradesBy([], t => t.symbol)).toEqual([]);
    expect(groupTradesBy(undefined, t => t.symbol)).toEqual([]);
  });

  it('returns empty if keyFn is not a function', () => {
    expect(groupTradesBy(sampleTrades, 'not a function')).toEqual([]);
  });

  it('groups by symbol', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    expect(groups.length).toBe(3);
    const keys = groups.map(g => g.key);
    expect(keys).toContain('BTC');
    expect(keys).toContain('ETH');
    expect(keys).toContain('ES');
  });

  it('counts trades correctly', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.count).toBe(2);
    expect(btc.wins).toBe(1);
    expect(btc.losses).toBe(1);
  });

  it('calculates P&L correctly', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.pnl).toBe(300); // 500 + (-200)
    const es = groups.find(g => g.key === 'ES');
    expect(es.pnl).toBe(650); // 700 + (-50)
  });

  it('calculates winRate', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.winRate).toBe(50);
    const es = groups.find(g => g.key === 'ES');
    expect(es.winRate).toBe(50);
  });

  it('calculates avgWin and avgLoss', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.avgWin).toBe(500);
    expect(btc.avgLoss).toBe(200);
  });

  it('calculates profitFactor', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.profitFactor).toBe(2.5); // 500 / 200
  });

  it('profitFactor = Infinity when no losses', () => {
    const trades = [mkTrade({ pnl: 100 }), mkTrade({ pnl: 200 })];
    const groups = groupTradesBy(trades, t => t.symbol);
    expect(groups[0].profitFactor).toBe(Infinity);
  });

  it('profitFactor = 0 when no wins', () => {
    const trades = [mkTrade({ pnl: -100 }), mkTrade({ pnl: -200 })];
    const groups = groupTradesBy(trades, t => t.symbol);
    expect(groups[0].profitFactor).toBe(0);
  });

  it('calculates avgR from rMultiple', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.avgR).toBeCloseTo(0.75); // (2.5 + -1.0) / 2
  });

  it('avgR = 0 when no rMultiples', () => {
    const trades = [mkTrade({ rMultiple: undefined }), mkTrade({ rMultiple: null })];
    const groups = groupTradesBy(trades, t => t.symbol);
    expect(groups[0].avgR).toBe(0);
  });

  it('tracks totalFees', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.totalFees).toBe(10);
  });

  it('tracks bestTrade and worstTrade', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    const btc = groups.find(g => g.key === 'BTC');
    expect(btc.bestTrade).toBe(500);
    expect(btc.worstTrade).toBe(-200);
  });

  it('sorts by pnl desc by default', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol);
    expect(groups[0].key).toBe('ES'); // highest pnl: 650
    expect(groups[groups.length - 1].key).toBe('ETH'); // lowest: 200
  });

  it('sorts by count', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol, { sort: 'count' });
    // All have count 2, so order is stable but valid
    groups.forEach(g => expect(g.count).toBe(2));
  });

  it('sorts by key ascending', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol, { sort: 'key', dir: 'asc' });
    expect(groups[0].key).toBe('BTC');
    expect(groups[1].key).toBe('ES');
    expect(groups[2].key).toBe('ETH');
  });

  it('respects limit option', () => {
    const groups = groupTradesBy(sampleTrades, t => t.symbol, { limit: 2 });
    expect(groups.length).toBe(2);
  });

  it('groups by playbook', () => {
    const groups = groupTradesBy(sampleTrades, t => t.playbook);
    expect(groups.length).toBe(3);
    const trend = groups.find(g => g.key === 'Trend');
    expect(trend.count).toBe(3);
  });

  it('groups by custom key function', () => {
    const groups = groupTradesBy(sampleTrades, t => t.pnl >= 0 ? 'winner' : 'loser');
    expect(groups.length).toBe(2);
    const winners = groups.find(g => g.key === 'winner');
    expect(winners.count).toBe(3);
  });

  it('skips trades with null key', () => {
    const trades = [
      mkTrade({ playbook: 'A', pnl: 100 }),
      mkTrade({ playbook: null, pnl: 200 }),
    ];
    const groups = groupTradesBy(trades, t => t.playbook);
    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('A');
  });

  it('handles single trade', () => {
    const groups = groupTradesBy([mkTrade({ pnl: 500 })], t => t.symbol);
    expect(groups.length).toBe(1);
    expect(groups[0].count).toBe(1);
    expect(groups[0].winRate).toBe(100);
  });

  it('handles zero P&L trades (neither win nor loss)', () => {
    const trades = [mkTrade({ pnl: 0 })];
    const groups = groupTradesBy(trades, t => t.symbol);
    expect(groups[0].wins).toBe(0);
    expect(groups[0].losses).toBe(0);
    expect(groups[0].winRate).toBe(0);
  });
});

// ═══ groupTradesByTime ══════════════════════════════════════════
describe('groupTradesByTime', () => {
  const weekTrades = [
    mkTrade({ date: '2025-01-13T09:00:00Z', pnl: 100 }), // Monday
    mkTrade({ date: '2025-01-13T14:00:00Z', pnl: 200 }), // Monday
    mkTrade({ date: '2025-01-14T10:00:00Z', pnl: -50 }),  // Tuesday
    mkTrade({ date: '2025-01-15T11:00:00Z', pnl: 300 }),  // Wednesday
    mkTrade({ date: '2025-01-16T15:00:00Z', pnl: -100 }), // Thursday
    mkTrade({ date: '2025-01-17T09:30:00Z', pnl: 150 }),  // Friday
  ];

  it('returns empty for null/empty input', () => {
    expect(groupTradesByTime(null, 'dayOfWeek')).toEqual([]);
    expect(groupTradesByTime([], 'hour')).toEqual([]);
  });

  it('returns empty for unknown bucket', () => {
    expect(groupTradesByTime(weekTrades, 'invalid')).toEqual([]);
  });

  it('groups by dayOfWeek — always 7 entries', () => {
    const groups = groupTradesByTime(weekTrades, 'dayOfWeek');
    expect(groups.length).toBe(7);
    expect(groups[0].key).toBe('Sun');
    expect(groups[6].key).toBe('Sat');
  });

  it('dayOfWeek has correct counts', () => {
    const groups = groupTradesByTime(weekTrades, 'dayOfWeek');
    const mon = groups.find(g => g.key === 'Mon');
    expect(mon.count).toBe(2);
    expect(mon.pnl).toBe(300);
    const sun = groups.find(g => g.key === 'Sun');
    expect(sun.count).toBe(0);
  });

  it('groups by hour — always 24 entries', () => {
    const groups = groupTradesByTime(weekTrades, 'hour');
    expect(groups.length).toBe(24);
    expect(groups[0].key).toBe('00:00');
    expect(groups[23].key).toBe('23:00');
  });

  it('hour has correct aggregates', () => {
    const groups = groupTradesByTime(weekTrades, 'hour');
    const h9 = groups.find(g => g.key === '09:00');
    expect(h9.count).toBe(2); // 09:00 and 09:30
    expect(h9.pnl).toBe(250); // 100 + 150
  });

  it('groups by month', () => {
    const trades = [
      mkTrade({ date: '2025-01-15T10:00:00Z', pnl: 100 }),
      mkTrade({ date: '2025-01-20T10:00:00Z', pnl: 200 }),
      mkTrade({ date: '2025-02-05T10:00:00Z', pnl: -50 }),
    ];
    const groups = groupTradesByTime(trades, 'month');
    expect(groups.length).toBe(2);
    expect(groups[0].key).toBe('2025-01');
    expect(groups[0].pnl).toBe(300);
    expect(groups[1].key).toBe('2025-02');
    expect(groups[1].pnl).toBe(-50);
  });

  it('groups by week', () => {
    const groups = groupTradesByTime(weekTrades, 'week');
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach(g => {
      expect(g.key).toContain('-W');
    });
  });
});
