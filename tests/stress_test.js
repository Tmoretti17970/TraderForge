// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Stress Tests + Edge Cases
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeFast } from '../engine/analyticsFast.js';
import { genRandomTrades, genDemoData } from '../data/demoData.js';
import { groupTradesBy, groupTradesByTime } from '../utils/groupTradesBy.js';
import { StorageService } from '../data/StorageService.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { parseCSVRaw, exportCSV, importCSV } from '../csv.js';
import { computeIndicators } from '../engine/compInd.js';
import { LayoutCache } from '../engine/LayoutCache.js';
import { genVolumeProfile } from '../engine/orderFlow.js';
import { fmt, fmtD } from '../utils.js';

// ═══ Scale: 10,000 Trades ═══════════════════════════════════════
describe('Stress: 10,000 trades', () => {
  const trades = genRandomTrades(10000);

  it('computeFast handles 10K trades', () => {
    const t0 = Date.now();
    const result = computeFast(trades, { mcRuns: 500 });
    const elapsed = Date.now() - t0;

    expect(result).not.toBeNull();
    expect(result.tradeCount).toBe(10000);
    expect(result.winRate).toBeGreaterThan(0);
    expect(result.winRate).toBeLessThan(100);
    expect(result.byDay.length).toBe(7);
    expect(result.byH.length).toBe(24);
    expect(elapsed).toBeLessThan(5000);
  });

  it('original compute handles 10K trades', () => {
    const result = compute(trades, { mcRuns: 100 });
    expect(result).not.toBeNull();
    expect(result.tradeCount).toBe(10000);
  });

  it('groupTradesBy handles 10K trades', () => {
    const groups = groupTradesBy(trades, (t) => t.symbol);
    expect(groups.length).toBeGreaterThan(0);
    const totalCount = groups.reduce((s, g) => s + g.count, 0);
    expect(totalCount).toBe(10000);
  });

  it('groupTradesByTime handles 10K trades', () => {
    const byDay = groupTradesByTime(trades, 'dayOfWeek');
    expect(byDay.length).toBe(7);
    const byHour = groupTradesByTime(trades, 'hour');
    expect(byHour.length).toBe(24);
  });

  it('store handles 10K trades', () => {
    useTradeStore.setState({ trades: [] });
    useTradeStore.getState().addTrades(trades);
    expect(useTradeStore.getState().trades.length).toBe(10000);
  });

  it('storage handles 10K trades bulk put', async () => {
    await StorageService.clearAll();
    await StorageService.trades.bulkPut(trades);
    const result = await StorageService.trades.count();
    expect(result.data).toBe(10000);
  });
});

// ═══ Scale: 50,000 Trades ═══════════════════════════════════════
describe('Stress: 50,000 trades', () => {
  const trades = genRandomTrades(50000);

  it('computeFast handles 50K without crash', () => {
    const result = computeFast(trades, { mcRuns: 100 });
    expect(result).not.toBeNull();
    expect(result.tradeCount).toBe(50000);
  });

  it('CSV export at 50K', () => {
    const csv = exportCSV(trades);
    expect(csv.length).toBeGreaterThan(0);
    const firstLines = csv.split('\n').slice(0, 10);
    expect(firstLines.length).toBe(10);
  });
});

// ═══ Scale: Indicator Computation ═══════════════════════════════
describe('Stress: indicators at scale', () => {
  const bars = Array.from({ length: 600 }, (_, i) => ({
    time: new Date(Date.now() - (600 - i) * 60000).toISOString(),
    open: 100 + Math.sin(i * 0.05) * 20,
    high: 100 + Math.sin(i * 0.05) * 20 + 3,
    low: 100 + Math.sin(i * 0.05) * 20 - 3,
    close: 100 + Math.cos(i * 0.05) * 20,
    volume: 1000 + Math.random() * 5000,
  }));

  it('8 indicators on 600 bars', () => {
    const indicators = [
      { type: 'sma', params: { period: 20 } },
      { type: 'ema', params: { period: 21 } },
      { type: 'wma', params: { period: 14 } },
      { type: 'bollinger', params: { period: 20, multiplier: 2 } },
      { type: 'rsi', params: { period: 14 } },
      { type: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
      { type: 'stochastic', params: { kPeriod: 14, dPeriod: 3 } },
      { type: 'atr', params: { period: 14 } },
    ];

    const t0 = Date.now();
    const results = computeIndicators(indicators, bars);
    const elapsed = Date.now() - t0;

    expect(results.length).toBe(8);
    results.forEach((r) => {
      expect(r.result.data.length).toBe(600);
    });
    expect(elapsed).toBeLessThan(1000);
  });

  it('volume profile on 600 bars', () => {
    const t0 = Date.now();
    bars.forEach((bar) => genVolumeProfile(bar, 16));
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1000);
  });
});

// ═══ Scale: LayoutCache thrashing ═══════════════════════════════
describe('Stress: LayoutCache 1000 rapid keys', () => {
  it('handles rapid key changes', () => {
    const cache = new LayoutCache({ maxEntries: 10 });
    for (let i = 0; i < 1000; i++) {
      const key = LayoutCache.buildKey(i, i + 100, 5000, 'candles', 'standard');
      cache.getOrCompute(key, () => ({ w: i }));
    }
    expect(cache.stats.size).toBe(10);
    expect(cache.stats.misses).toBe(1000);
  });
});

// ═══ Edge: empty state ══════════════════════════════════════════
describe('Edge: empty state', () => {
  it('computeFast returns null for empty', () => {
    expect(computeFast([])).toBeNull();
    expect(computeFast(null)).toBeNull();
    expect(computeFast(undefined)).toBeNull();
  });

  it('groupTradesBy returns [] for empty', () => {
    expect(groupTradesBy([], (t) => t.symbol)).toEqual([]);
  });

  it('groupTradesByTime returns [] for empty', () => {
    expect(groupTradesByTime([], 'dayOfWeek')).toEqual([]);
  });

  it('exportCSV of empty trades produces header only', () => {
    const csv = exportCSV([]);
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(1);
  });

  it('parseCSVRaw of empty string returns no rows', () => {
    const { rows } = parseCSVRaw('');
    expect(rows.length).toBe(0);
  });
});

// ═══ Edge: single trade ═════════════════════════════════════════
describe('Edge: single trade', () => {
  const trade = {
    id: 't1', date: '2025-01-15T10:00:00Z', symbol: 'BTC',
    side: 'long', pnl: 500, fees: 5, rMultiple: 2.5,
    playbook: 'Trend', emotion: 'Confident',
  };

  it('computeFast handles single trade', () => {
    const r = computeFast([trade], { mcRuns: 0 });
    expect(r.tradeCount).toBe(1);
    expect(r.winRate).toBe(100);
    expect(r.totalPnl).toBe(500);
    expect(r.avgWin).toBe(500);
    expect(r.avgLoss).toBe(0);
    expect(r.best).toBe(1);
    expect(r.worst).toBe(0);
    expect(r.pf).toBe(Infinity);
    expect(r.eq.length).toBe(1);
  });

  it('warnings fire for small sample', () => {
    const r = computeFast([trade], { mcRuns: 0 });
    expect(r.warnings.length).toBeGreaterThan(0);
    const metrics = r.warnings.map((w) => w.metric);
    expect(metrics).toContain('kelly');
    expect(metrics).toContain('sharpe');
  });
});

// ═══ Edge: all winners ══════════════════════════════════════════
describe('Edge: all winners', () => {
  const trades = Array.from({ length: 20 }, (_, i) => ({
    id: `w${i}`, date: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    symbol: 'BTC', side: 'long', pnl: 100 + i * 10, fees: 2,
  }));

  it('winRate = 100%, pf = Infinity', () => {
    const r = computeFast(trades, { mcRuns: 0 });
    expect(r.winRate).toBe(100);
    expect(r.lossCount).toBe(0);
    expect(r.pf).toBe(Infinity);
    expect(r.worst).toBe(0);
    expect(r.best).toBe(20);
  });
});

// ═══ Edge: all losers ═══════════════════════════════════════════
describe('Edge: all losers', () => {
  const trades = Array.from({ length: 15 }, (_, i) => ({
    id: `l${i}`, date: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    symbol: 'ES', side: 'short', pnl: -(50 + i * 5), fees: 3,
  }));

  it('winRate = 0%, pf = 0', () => {
    const r = computeFast(trades, { mcRuns: 0 });
    expect(r.winRate).toBe(0);
    expect(r.winCount).toBe(0);
    expect(r.pf).toBe(0);
    expect(r.best).toBe(0);
    expect(r.worst).toBe(15);
  });
});

// ═══ Edge: zero P&L ═════════════════════════════════════════════
describe('Edge: zero P&L trades', () => {
  const trades = Array.from({ length: 5 }, (_, i) => ({
    id: `z${i}`, date: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    symbol: 'BTC', side: 'long', pnl: 0, fees: 1,
  }));

  it('handles all-zero P&L', () => {
    const r = computeFast(trades, { mcRuns: 0 });
    expect(r.winRate).toBe(0);
    expect(r.winCount).toBe(0);
    expect(r.lossCount).toBe(0);
    expect(r.totalPnl).toBe(0);
    expect(r.kelly).toBe(0);
  });
});

// ═══ Edge: negative equity ══════════════════════════════════════
describe('Edge: negative equity', () => {
  const trades = [
    { id: 'n1', date: '2025-01-01T10:00:00Z', symbol: 'BTC', side: 'long', pnl: 100 },
    { id: 'n2', date: '2025-01-02T10:00:00Z', symbol: 'BTC', side: 'long', pnl: -500 },
    { id: 'n3', date: '2025-01-03T10:00:00Z', symbol: 'BTC', side: 'long', pnl: -200 },
    { id: 'n4', date: '2025-01-04T10:00:00Z', symbol: 'BTC', side: 'long', pnl: 50 },
  ];

  it('equity curve handles going negative', () => {
    const r = computeFast(trades, { mcRuns: 0 });
    expect(r.eq.length).toBe(4);
    expect(r.eq[0].pnl).toBe(100);
    expect(r.eq[1].pnl).toBe(-400);
    expect(r.totalPnl).toBe(-550);
    expect(r.maxDd).toBeGreaterThan(0);
  });
});

// ═══ Edge: same symbol ══════════════════════════════════════════
describe('Edge: same symbol for all', () => {
  const trades = Array.from({ length: 10 }, (_, i) => ({
    id: `s${i}`, date: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    symbol: 'BTC', side: i % 2 === 0 ? 'long' : 'short',
    pnl: (i % 3 === 0 ? -1 : 1) * (50 + i * 10),
  }));

  it('groupTradesBy returns single group', () => {
    const groups = groupTradesBy(trades, (t) => t.symbol);
    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('BTC');
    expect(groups[0].count).toBe(10);
  });
});

// ═══ Edge: future-dated trades ══════════════════════════════════
describe('Edge: future-dated trades', () => {
  const futureTrades = [
    { id: 'f1', date: '2030-06-15T10:00:00Z', symbol: 'BTC', side: 'long', pnl: 100 },
    { id: 'f2', date: '2030-06-16T10:00:00Z', symbol: 'BTC', side: 'long', pnl: -50 },
  ];

  it('analytics handles future dates', () => {
    const r = computeFast(futureTrades, { mcRuns: 0 });
    expect(r).not.toBeNull();
    expect(r.tradeCount).toBe(2);
    expect(r.eq.length).toBe(2);
  });

  it('groupTradesByTime handles future dates', () => {
    const groups = groupTradesByTime(futureTrades, 'month');
    expect(groups.length).toBe(1);
    expect(groups[0].key).toBe('2030-06');
  });
});

// ═══ Edge: CSV with BOM and tabs ════════════════════════════════
describe('Edge: CSV parsing', () => {
  it('handles BOM in CSV', () => {
    const csv = '\ufeffdate,symbol,pnl\n2025-01-15T10:00:00Z,BTC,100';
    const { headers, rows } = parseCSVRaw(csv);
    expect(rows.length).toBe(1);
    expect(headers[0]).toBe('date');
  });

  it('handles tab-separated values', () => {
    const tsv = 'date\tsymbol\tpnl\n2025-01-15T10:00:00Z\tBTC\t100';
    const { rows, headers } = parseCSVRaw(tsv);
    expect(rows.length).toBe(1);
    expect(headers).toContain('symbol');
  });

  it('handles missing columns', () => {
    const csv = 'date,symbol\n2025-01-15T10:00:00Z,BTC\n2025-01-16T10:00:00Z,ETH';
    const { rows } = parseCSVRaw(csv);
    expect(rows.length).toBe(2);
  });
});

// ═══ Edge: formatter edge cases ═════════════════════════════════
describe('Edge: formatter', () => {
  it('fmtD handles zero', () => {
    const r = fmtD(0);
    expect(r).toContain('$');
  });

  it('fmtD handles large numbers', () => {
    const r = fmtD(1234567.89);
    expect(r.length).toBeGreaterThan(0);
  });

  it('fmt handles small numbers', () => {
    const r = fmt(0.001);
    expect(typeof r).toBe('string');
  });
});
