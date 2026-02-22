// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Integration Tests
// End-to-end pipelines verifying modules work together.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { parseCSVRaw, exportCSV, importCSV } from '../csv.js';
import { StorageService } from '../data/StorageService.js';
import { computeFast as compute, MIN_SAMPLES } from '../engine/analyticsFast.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';
import { useUIStore } from '../state/useUIStore.js';
import { genDemoData, genRandomTrades } from '../data/demoData.js';
import { groupTradesBy, groupTradesByTime } from '../utils/groupTradesBy.js';
import { compInd, computeIndicators } from '../engine/compInd.js';
import { Calc } from '../engine/Calc.js';
import { AnalyticsBridge } from '../engine/AnalyticsBridge.js';
import { RetryQueue } from '../utils/RetryQueue.js';
import { LayoutCache } from '../engine/LayoutCache.js';
import { genVolumeProfile } from '../engine/orderFlow.js';
import { uid, fmtD, fmt } from '../utils.js';

// ═══ Pipeline: CSV Import → Store → Analytics ═══════════════════
describe('CSV → Store → Analytics pipeline', () => {
  const csvText = [
    'date,symbol,side,pnl,fees,playbook,emotion',
    '2025-01-13T09:30:00Z,ES,long,487.50,4.60,Trend Following,Confident',
    '2025-01-13T14:00:00Z,BTC,long,-200.00,8.40,Breakout,Anxious',
    '2025-01-14T10:00:00Z,NQ,short,350.00,4.60,Trend Following,Focused',
    '2025-01-14T14:00:00Z,BTC,long,-120.00,5.20,Reversal,Frustrated',
    '2025-01-15T09:00:00Z,ES,long,625.00,4.60,Breakout,Confident',
    '2025-01-15T11:00:00Z,ETH,long,-95.00,6.20,Breakout,Uncertain',
    '2025-01-16T10:00:00Z,CL,long,340.00,4.60,Trend Following,Calm',
    '2025-01-17T09:30:00Z,SOL,long,145.00,3.80,Trend Following,Neutral',
  ].join('\n');

  it('parses CSV, loads into store, computes analytics', () => {
    // Step 1: Parse CSV
    const { headers, rows } = parseCSVRaw(csvText);
    expect(rows.length).toBe(8);
    expect(headers).toContain('date');
    expect(headers).toContain('pnl');

    // Step 2: Build trade objects
    const trades = rows.map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return {
        id: uid(),
        date: obj.date,
        symbol: obj.symbol,
        side: obj.side,
        pnl: parseFloat(obj.pnl),
        fees: parseFloat(obj.fees),
        playbook: obj.playbook,
        emotion: obj.emotion,
      };
    });

    useTradeStore.setState({ trades: [] });
    useTradeStore.getState().addTrades(trades);
    expect(useTradeStore.getState().trades.length).toBe(8);

    // Step 3: Run analytics
    const result = computeFast(useTradeStore.getState().trades, { mcRuns: 0 });
    expect(result).not.toBeNull();
    expect(result.tradeCount).toBe(8);
    expect(result.totalPnl).toBeCloseTo(1532.50, 2);
    expect(result.winCount).toBe(5);
    expect(result.lossCount).toBe(3);
    expect(result.winRate).toBeCloseTo(62.5, 1);

    // Step 4: Store result
    useAnalyticsStore.getState().setResult(result, 1.0, 'sync');
    expect(useAnalyticsStore.getState().result.totalPnl).toBeCloseTo(1532.50, 2);
    expect(useAnalyticsStore.getState().version).toBeGreaterThan(0);
  });

  it('importCSV returns structured result', () => {
    const result = importCSV(csvText);
    expect(result.valid).toBe(8);
    expect(result.trades.length).toBe(8);
    expect(result.errors).toBe(0);
  });

  it('CSV round-trip: export → re-import → consistent analytics', () => {
    const { trades } = genDemoData();

    // Export to CSV
    const csv = exportCSV(trades);
    expect(csv.length).toBeGreaterThan(100);

    // Re-import
    const reimported = importCSV(csv);
    expect(reimported.trades.length).toBe(trades.length);

    // Analytics should match on deterministic metrics
    const origResult = computeFast(trades, { mcRuns: 0 });
    const reimportedResult = computeFast(reimported.trades, { mcRuns: 0 });

    expect(reimportedResult.tradeCount).toBe(origResult.tradeCount);
    expect(reimportedResult.totalPnl).toBeCloseTo(origResult.totalPnl, 0);
    expect(reimportedResult.winCount).toBe(origResult.winCount);
  });
});

// ═══ Pipeline: Store → Storage → Hydrate ════════════════════════
describe('Store → Storage → Hydrate pipeline', () => {
  it('persists trades and hydrates them back', async () => {
    await StorageService.clearAll();

    const trades = [
      { id: 't1', date: '2025-01-15T10:00:00Z', symbol: 'BTC', side: 'long', pnl: 500 },
      { id: 't2', date: '2025-01-16T10:00:00Z', symbol: 'ETH', side: 'short', pnl: -200 },
    ];
    const playbooks = [{ id: 'pb1', name: 'Trend Following' }];

    await StorageService.trades.bulkPut(trades);
    await StorageService.playbooks.put(playbooks[0]);

    const storedTrades = await StorageService.trades.getAll();
    expect(storedTrades.ok).toBe(true);
    expect(storedTrades.data.length).toBe(2);

    // Hydrate into fresh store
    useTradeStore.setState({ trades: [], playbooks: [], notes: [], tradePlans: [], loaded: false });
    useTradeStore.getState().hydrate({
      trades: storedTrades.data,
      playbooks: (await StorageService.playbooks.getAll()).data,
      notes: [],
      tradePlans: [],
    });

    expect(useTradeStore.getState().trades.length).toBe(2);
    expect(useTradeStore.getState().playbooks.length).toBe(1);
    expect(useTradeStore.getState().loaded).toBe(true);
  });

  it('settings persist and hydrate', async () => {
    await StorageService.clearAll();

    await StorageService.settings.set('dailyLossLimit', 750);
    await StorageService.settings.set('defaultSymbol', 'SOL');

    const saved = await StorageService.settings.getAll();
    useSettingsStore.getState().hydrate(saved.data);

    expect(useSettingsStore.getState().dailyLossLimit).toBe(750);
    expect(useSettingsStore.getState().defaultSymbol).toBe('SOL');
  });

  it('trade plans round-trip through storage', async () => {
    await StorageService.clearAll();

    const plan = { id: 'tp1', date: '2025-01-15', plan: 'Buy BTC dips below 95k', bias: 'bullish' };
    await StorageService.tradePlans.put(plan);

    const result = await StorageService.tradePlans.getAll();
    expect(result.data.length).toBe(1);
    expect(result.data[0].plan).toBe('Buy BTC dips below 95k');
  });
});

// ═══ Pipeline: Analytics → groupTradesBy ════════════════════════
describe('Analytics → groupTradesBy agreement', () => {
  it('groupTradesBy playbook matches computeFast bySt', () => {
    const { trades } = genDemoData();
    const result = computeFast(trades, { mcRuns: 0 });
    const groups = groupTradesBy(trades, (t) => t.playbook);

    const analyticsKeys = Object.keys(result.bySt).sort();
    const groupKeys = groups.map((g) => g.key).sort();
    expect(groupKeys).toEqual(analyticsKeys);

    for (const key of analyticsKeys) {
      const g = groups.find((x) => x.key === key);
      expect(g.count).toBe(result.bySt[key].count);
      expect(g.pnl).toBeCloseTo(result.bySt[key].pnl, 6);
    }
  });

  it('groupTradesByTime dayOfWeek matches computeFast byDay', () => {
    const { trades } = genDemoData();
    const result = computeFast(trades, { mcRuns: 0 });
    const groups = groupTradesByTime(trades, 'dayOfWeek');

    expect(groups.length).toBe(7);
    for (let i = 0; i < 7; i++) {
      expect(groups[i].count).toBe(result.byDay[i].count);
      expect(groups[i].pnl).toBeCloseTo(result.byDay[i].pnl, 4);
    }
  });
});

// ═══ Pipeline: Indicator Computation Chain ══════════════════════
describe('Indicator computation chain', () => {
  const bars = Array.from({ length: 60 }, (_, i) => ({
    time: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    open: 100 + Math.sin(i * 0.2) * 15,
    high: 100 + Math.sin(i * 0.2) * 15 + 5,
    low: 100 + Math.sin(i * 0.2) * 15 - 5,
    close: 100 + Math.cos(i * 0.2) * 15,
    volume: 1000 + i * 50,
  }));

  it('computeIndicators output feeds volume profile', () => {
    const indicators = [
      { type: 'sma', params: { period: 10 } },
      { type: 'rsi', params: { period: 14 } },
      { type: 'bollinger', params: { period: 20, multiplier: 2 } },
    ];

    const results = computeIndicators(indicators, bars);
    expect(results.length).toBe(3);

    bars.forEach((bar) => {
      const vp = genVolumeProfile(bar, 12);
      if (bar.high > bar.low) {
        expect(vp).not.toBeNull();
        expect(vp.levels.length).toBe(12);
      }
    });
  });

  it('Calc functions compose correctly', () => {
    const closes = bars.map((b) => b.close);
    const sma20 = Calc.sma(closes, 20);
    const ema21 = Calc.ema(closes, 21);
    const rsi14 = Calc.rsi(closes, 14);
    const boll = Calc.bollinger(closes, 20, 2);

    expect(sma20.filter((v) => v !== null).length).toBeGreaterThan(30);
    expect(ema21.filter((v) => v !== null).length).toBeGreaterThan(30);

    rsi14.filter((v) => v !== null).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });

    boll.filter((v) => v !== null).forEach((v) => {
      expect(v.upper).toBeGreaterThanOrEqual(v.middle);
      expect(v.lower).toBeLessThanOrEqual(v.middle);
    });
  });
});

// ═══ Pipeline: AnalyticsBridge → Store ══════════════════════════
describe('AnalyticsBridge → AnalyticsStore integration', () => {
  it('bridge compute → store setResult', async () => {
    const bridge = new AnalyticsBridge();
    await bridge.init();

    const trades = genRandomTrades(50);

    useAnalyticsStore.getState().clear();
    useAnalyticsStore.getState().setComputing();
    expect(useAnalyticsStore.getState().computing).toBe(true);

    const { data, ms, mode } = await bridge.compute(trades, { mcRuns: 100 });
    useAnalyticsStore.getState().setResult(data, ms, mode);

    const s = useAnalyticsStore.getState();
    expect(s.computing).toBe(false);
    expect(s.result).not.toBeNull();
    expect(s.result.tradeCount).toBe(50);
    expect(s.lastComputeMs).toBeGreaterThanOrEqual(0);
    expect(s.mode).toBe('sync');

    bridge.terminate();
  });
});

// ═══ Pipeline: RetryQueue → StorageService ══════════════════════
describe('RetryQueue → StorageService integration', () => {
  it('storage operations through RetryQueue', async () => {
    await StorageService.clearAll();
    const q = new RetryQueue({ maxRetries: 2, baseDelay: 1 });

    const result = await q.execSafe(async () => {
      const r = await StorageService.trades.put({ id: 'retry1', pnl: 100, date: '2025-01-15T10:00:00Z', symbol: 'BTC', side: 'long' });
      if (!r.ok) throw new Error(r.error);
      return r;
    });

    expect(result.ok).toBe(true);

    const stored = await StorageService.trades.getAll();
    expect(stored.data.length).toBe(1);
    expect(stored.data[0].id).toBe('retry1');
  });

  it('deferred queue drains successfully', async () => {
    await StorageService.clearAll();
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });

    q.enqueue('save-t1', () => StorageService.trades.put({ id: 'q1', pnl: 100, date: '2025-01-15T10:00:00Z', symbol: 'BTC', side: 'long' }));
    q.enqueue('save-t2', () => StorageService.trades.put({ id: 'q2', pnl: 200, date: '2025-01-16T10:00:00Z', symbol: 'ETH', side: 'short' }));

    const summary = await q.drain();
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(0);

    const stored = await StorageService.trades.getAll();
    expect(stored.data.length).toBe(2);
  });
});

// ═══ Pipeline: LayoutCache + Config Change ══════════════════════
describe('LayoutCache + indicator config change', () => {
  it('cache invalidates on config change, preserves on pan', () => {
    const cache = new LayoutCache({ maxEntries: 4 });
    const mkLayout = () => ({ candleWidth: 8, gap: 2, startX: 50 });

    const k1 = LayoutCache.buildKey(0, 100, 500, 'candles', 'standard', 800, 400);
    const k2 = LayoutCache.buildKey(10, 110, 500, 'candles', 'standard', 800, 400);
    const k3 = LayoutCache.buildKey(0, 100, 500, 'line', 'standard', 800, 400);

    cache.getOrCompute(k1, mkLayout);
    cache.getOrCompute(k2, mkLayout);
    expect(cache.stats.size).toBe(2);

    cache.invalidate();
    expect(cache.stats.size).toBe(0);

    cache.getOrCompute(k3, mkLayout);
    expect(cache.has(k3)).toBe(true);
    expect(cache.has(k1)).toBe(false);
  });
});

// ═══ UI Store Navigation ════════════════════════════════════════
describe('UI Store navigation flow', () => {
  it('simulates full user navigation', () => {
    useUIStore.setState({ page: 'dashboard', modal: null, zenMode: false });

    useUIStore.getState().setPage('charts');
    expect(useUIStore.getState().page).toBe('charts');

    useUIStore.getState().openModal({ id: 't1', pnl: 500, symbol: 'BTC' });
    expect(useUIStore.getState().modal.id).toBe('t1');

    useUIStore.getState().closeModal();
    useUIStore.getState().setPage('journal');
    expect(useUIStore.getState().page).toBe('journal');

    useUIStore.getState().toggleZen();
    expect(useUIStore.getState().zenMode).toBe(true);

    useUIStore.getState().closeAll();
    expect(useUIStore.getState().modal).toBeNull();
  });
});

// ═══ Formatter Integration ══════════════════════════════════════
describe('Formatter integration', () => {
  it('fmtD formats analytics totalPnl', () => {
    const trades = genRandomTrades(20);
    const result = computeFast(trades, { mcRuns: 0 });
    const formatted = fmtD(result.totalPnl);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain('$');
  });

  it('fmt formats numbers', () => {
    expect(fmt(1234.56)).toContain('1');
    expect(fmt(0)).toBeDefined();
  });
});
