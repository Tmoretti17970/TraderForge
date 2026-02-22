// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Phase 4 Module Tests
// CanvasBuffer, LayoutCache, AnalyticsBridge (sync), useAnalyticsStore
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { CanvasBuffer, CanvasContextStub } from '../engine/CanvasBuffer.js';
import { LayoutCache } from '../engine/LayoutCache.js';
import { AnalyticsBridge } from '../engine/AnalyticsBridge.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';

// ─── Canvas stub for Node ───────────────────────────────────────
function mkCanvas(w = 800, h = 400) {
  return {
    width: w,
    height: h,
    getContext: () => new CanvasContextStub(),
  };
}

// ═══ CanvasBuffer ═══════════════════════════════════════════════
describe('CanvasBuffer', () => {
  it('creates with default multiplier', () => {
    const buf = new CanvasBuffer(mkCanvas(800, 400), { dpr: 1 });
    expect(buf.stats.bufferWidth).toBe(1600); // 2×
    expect(buf.stats.displayWidth).toBe(800);
    expect(buf.stats.multiplier).toBe(2);
  });

  it('creates with custom multiplier', () => {
    const buf = new CanvasBuffer(mkCanvas(800, 400), { bufferMultiplier: 3, dpr: 1 });
    expect(buf.stats.bufferWidth).toBe(2400);
  });

  it('starts dirty', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    expect(buf.isDirty).toBe(true);
  });

  it('renderToBuffer clears dirty flag', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    buf.renderToBuffer(() => {});
    expect(buf.isDirty).toBe(false);
    expect(buf.stats.renderCount).toBe(1);
  });

  it('renderToBuffer calls renderFn with context', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    let called = false;
    buf.renderToBuffer((ctx, w, h, dpr) => {
      called = true;
      expect(w).toBe(1600);
      expect(h).toBe(400);
      expect(dpr).toBe(1);
      expect(ctx).toBeDefined();
    });
    expect(called).toBe(true);
  });

  it('blitToDisplay returns false when dirty', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    expect(buf.blitToDisplay(0)).toBe(false);
  });

  it('blitToDisplay returns true after render', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    buf.renderToBuffer(() => {});
    expect(buf.blitToDisplay(0)).toBe(true);
    expect(buf.stats.blitCount).toBe(1);
  });

  it('blitToDisplay returns false when offset exceeds bounds', () => {
    const buf = new CanvasBuffer(mkCanvas(800, 400), { dpr: 1 });
    buf.renderToBuffer(() => {});
    // Buffer is 1600 wide, display is 800. Center offset is (1600-800)/2=400
    // Max offset before out of bounds: ±400
    expect(buf.blitToDisplay(0)).toBe(true);
    expect(buf.blitToDisplay(399)).toBe(true);
    expect(buf.blitToDisplay(401)).toBe(false);
    expect(buf.blitToDisplay(-401)).toBe(false);
  });

  it('isWithinBounds checks correctly', () => {
    const buf = new CanvasBuffer(mkCanvas(800, 400), { dpr: 1 });
    buf.renderToBuffer(() => {});
    expect(buf.isWithinBounds(0)).toBe(true);
    expect(buf.isWithinBounds(400)).toBe(true);
    expect(buf.isWithinBounds(401)).toBe(false);
  });

  it('invalidate marks dirty', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    buf.renderToBuffer(() => {});
    expect(buf.isDirty).toBe(false);
    buf.invalidate();
    expect(buf.isDirty).toBe(true);
  });

  it('resize recreates buffer and marks dirty', () => {
    const canvas = mkCanvas(800, 400);
    const buf = new CanvasBuffer(canvas, { dpr: 1 });
    buf.renderToBuffer(() => {});
    expect(buf.isDirty).toBe(false);

    canvas.width = 1200;
    buf.resize();
    expect(buf.isDirty).toBe(true);
    expect(buf.stats.bufferWidth).toBe(2400); // 1200 × 2
  });

  it('dispose nulls buffer', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    buf.dispose();
    expect(buf.bufferCtx).toBeNull();
  });

  it('stats tracks render and blit counts', () => {
    const buf = new CanvasBuffer(mkCanvas(), { dpr: 1 });
    buf.renderToBuffer(() => {});
    buf.blitToDisplay(0);
    buf.blitToDisplay(10);
    buf.blitToDisplay(-10);
    expect(buf.stats.renderCount).toBe(1);
    expect(buf.stats.blitCount).toBe(3);
  });
});

// ═══ LayoutCache ════════════════════════════════════════════════
describe('LayoutCache', () => {
  it('buildKey produces deterministic key', () => {
    const k1 = LayoutCache.buildKey(0, 100, 500, 'candles', 'standard', 800, 400);
    const k2 = LayoutCache.buildKey(0, 100, 500, 'candles', 'standard', 800, 400);
    expect(k1).toBe(k2);
  });

  it('different params produce different keys', () => {
    const k1 = LayoutCache.buildKey(0, 100, 500, 'candles', 'standard');
    const k2 = LayoutCache.buildKey(10, 100, 500, 'candles', 'standard');
    expect(k1).not.toBe(k2);
  });

  it('getOrCompute caches result', () => {
    const cache = new LayoutCache();
    let calls = 0;
    const compute = () => { calls++; return { x: 42 }; };

    const r1 = cache.getOrCompute('key1', compute);
    const r2 = cache.getOrCompute('key1', compute);
    expect(r1).toEqual({ x: 42 });
    expect(r2).toEqual({ x: 42 });
    expect(calls).toBe(1); // computed only once
  });

  it('tracks hits and misses', () => {
    const cache = new LayoutCache();
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('a', () => 2);
    cache.getOrCompute('b', () => 3);
    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(2);
    expect(cache.stats.hitRate).toBe(33);
  });

  it('LRU eviction when full', () => {
    const cache = new LayoutCache({ maxEntries: 3 });
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('b', () => 2);
    cache.getOrCompute('c', () => 3);
    expect(cache.stats.size).toBe(3);

    // Adding 'd' should evict 'a' (oldest)
    cache.getOrCompute('d', () => 4);
    expect(cache.stats.size).toBe(3);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('d')).toBe(true);
  });

  it('LRU promotes recently used', () => {
    const cache = new LayoutCache({ maxEntries: 3 });
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('b', () => 2);
    cache.getOrCompute('c', () => 3);

    // Access 'a' to promote it
    cache.getOrCompute('a', () => 999);

    // Now 'b' is the oldest
    cache.getOrCompute('d', () => 4);
    expect(cache.has('a')).toBe(true); // promoted, survives
    expect(cache.has('b')).toBe(false); // evicted
  });

  it('invalidate clears all', () => {
    const cache = new LayoutCache();
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('b', () => 2);
    cache.invalidate();
    expect(cache.stats.size).toBe(0);
    expect(cache.has('a')).toBe(false);
  });

  it('remove deletes specific key', () => {
    const cache = new LayoutCache();
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('b', () => 2);
    cache.remove('a');
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
  });

  it('resetStats clears counters', () => {
    const cache = new LayoutCache();
    cache.getOrCompute('a', () => 1);
    cache.getOrCompute('a', () => 1);
    cache.resetStats();
    expect(cache.stats.hits).toBe(0);
    expect(cache.stats.misses).toBe(0);
  });
});

// ═══ AnalyticsBridge (sync fallback) ════════════════════════════
describe('AnalyticsBridge (sync mode)', () => {
  const mkTrade = (pnl) => ({
    id: 'x', date: '2025-01-15T10:00:00Z', symbol: 'BTC',
    side: 'long', pnl, fees: 1,
  });

  it('init returns sync mode (no Worker in Node)', async () => {
    const bridge = new AnalyticsBridge();
    const { mode } = await bridge.init();
    expect(mode).toBe('sync');
    expect(bridge.isWorker).toBe(false);
    expect(bridge.isReady).toBe(true);
  });

  it('compute returns result in sync mode', async () => {
    const bridge = new AnalyticsBridge();
    await bridge.init();

    const trades = [mkTrade(100), mkTrade(-50), mkTrade(200)];
    const { data, ms, mode } = await bridge.compute(trades, { mcRuns: 0 });

    expect(mode).toBe('sync');
    expect(data).not.toBeNull();
    expect(data.tradeCount).toBe(3);
    expect(data.totalPnl).toBe(250);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('compute returns null for empty trades', async () => {
    const bridge = new AnalyticsBridge();
    await bridge.init();
    const { data } = await bridge.compute([], {});
    expect(data).toBeNull();
  });

  it('auto-inits if compute called before init', async () => {
    const bridge = new AnalyticsBridge();
    const { data } = await bridge.compute([mkTrade(100)], { mcRuns: 0 });
    expect(data).not.toBeNull();
    expect(bridge.isReady).toBe(true);
  });

  it('terminate resets state', async () => {
    const bridge = new AnalyticsBridge();
    await bridge.init();
    bridge.terminate();
    expect(bridge.isReady).toBe(false);
    expect(bridge.isWorker).toBe(false);
  });
});

// ═══ useAnalyticsStore ══════════════════════════════════════════
describe('useAnalyticsStore', () => {
  it('starts with null result', () => {
    const s = useAnalyticsStore.getState();
    expect(s.result).toBeNull();
    expect(s.computing).toBe(false);
    expect(s.version).toBe(0);
  });

  it('setComputing flags computing', () => {
    useAnalyticsStore.getState().setComputing();
    expect(useAnalyticsStore.getState().computing).toBe(true);
    expect(useAnalyticsStore.getState().error).toBeNull();
  });

  it('setResult stores data and increments version', () => {
    const mockResult = { totalPnl: 500, winRate: 60 };
    useAnalyticsStore.getState().setResult(mockResult, 12.5, 'sync');

    const s = useAnalyticsStore.getState();
    expect(s.result).toEqual(mockResult);
    expect(s.computing).toBe(false);
    expect(s.lastComputeMs).toBe(12.5);
    expect(s.mode).toBe('sync');
    expect(s.version).toBeGreaterThan(0);
  });

  it('setError stores error string', () => {
    useAnalyticsStore.getState().setError('Something failed');
    const s = useAnalyticsStore.getState();
    expect(s.error).toBe('Something failed');
    expect(s.computing).toBe(false);
  });

  it('clear resets everything', () => {
    useAnalyticsStore.getState().setResult({ x: 1 }, 5, 'worker');
    useAnalyticsStore.getState().clear();
    const s = useAnalyticsStore.getState();
    expect(s.result).toBeNull();
    expect(s.computing).toBe(false);
    expect(s.lastComputeMs).toBe(0);
    expect(s.version).toBe(0);
  });

  it('version increments on each setResult', () => {
    useAnalyticsStore.getState().clear();
    useAnalyticsStore.getState().setResult({ a: 1 }, 1, 'sync');
    useAnalyticsStore.getState().setResult({ a: 2 }, 2, 'sync');
    useAnalyticsStore.getState().setResult({ a: 3 }, 3, 'sync');
    expect(useAnalyticsStore.getState().version).toBe(3);
  });
});
