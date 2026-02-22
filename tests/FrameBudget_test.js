// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — FrameBudget + IndicatorCache Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { FrameBudget, IndicatorCache, LOD_LEVELS } from '../engine/FrameBudget.js';

describe('LOD_LEVELS', () => {
  it('has 4 levels from bare to full', () => {
    expect(LOD_LEVELS).toHaveLength(4);
    expect(LOD_LEVELS[0].volume).toBe(false);
    expect(LOD_LEVELS[0].maxIndicators).toBe(0);
    expect(LOD_LEVELS[3].volume).toBe(true);
    expect(LOD_LEVELS[3].maxIndicators).toBe(99);
  });
});

describe('FrameBudget', () => {
  it('starts at full LOD (level 3)', () => {
    const fb = new FrameBudget();
    expect(fb.level).toBe(3);
    expect(fb.getLOD().volume).toBe(true);
  });

  it('tracks frame timing', () => {
    const fb = new FrameBudget();
    fb.beginFrame();
    fb.endFrame();
    expect(fb.getStats().totalFrames).toBe(1);
    expect(fb.lastFrameMs).toBeGreaterThanOrEqual(0);
  });

  it('reset restores full LOD', () => {
    const fb = new FrameBudget();
    fb.setLevel(0);
    expect(fb.level).toBe(0);
    fb.reset();
    expect(fb.level).toBe(3);
    expect(fb.avgFrameMs).toBe(0);
  });

  it('setLevel clamps to 0-3', () => {
    const fb = new FrameBudget();
    fb.setLevel(99);
    expect(fb.level).toBe(3);
    fb.setLevel(-5);
    expect(fb.level).toBe(0);
  });

  it('getStats returns all fields', () => {
    const fb = new FrameBudget();
    fb.beginFrame(); fb.endFrame();
    const stats = fb.getStats();
    expect(stats).toHaveProperty('avgMs');
    expect(stats).toHaveProperty('lastMs');
    expect(stats).toHaveProperty('lod');
    expect(stats).toHaveProperty('totalFrames');
    expect(stats).toHaveProperty('droppedFrames');
    expect(stats).toHaveProperty('dropRate');
  });
});

describe('IndicatorCache', () => {
  const mockData = Array.from({ length: 100 }, (_, i) => ({
    open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000,
  }));

  let callCount = 0;
  const mockCompute = (ind, data, closes) => {
    callCount++;
    return { type: 'line', data: closes.map(() => 0) };
  };

  it('starts empty', () => {
    expect(new IndicatorCache().size).toBe(0);
  });

  it('computes all on first call', () => {
    const ic = new IndicatorCache();
    callCount = 0;
    const inds = [{ type: 'sma', params: { period: 20 } }, { type: 'ema', params: { period: 21 } }];
    const result = ic.compute(inds, mockData, mockCompute);
    expect(result).toHaveLength(2);
    expect(callCount).toBe(2);
    expect(ic.size).toBe(2);
  });

  it('returns cached results on repeat call', () => {
    const ic = new IndicatorCache();
    const inds = [{ type: 'sma', params: { period: 20 } }];
    ic.compute(inds, mockData, mockCompute);
    callCount = 0;
    ic.compute(inds, mockData, mockCompute);
    expect(callCount).toBe(0);
  });

  it('only recomputes changed indicator', () => {
    const ic = new IndicatorCache();
    const inds1 = [{ type: 'sma', params: { period: 20 } }, { type: 'ema', params: { period: 21 } }];
    ic.compute(inds1, mockData, mockCompute);

    const inds2 = [{ type: 'sma', params: { period: 50 } }, { type: 'ema', params: { period: 21 } }];
    callCount = 0;
    ic.compute(inds2, mockData, mockCompute);
    expect(callCount).toBe(1); // only SMA changed
  });

  it('recomputes all when data length changes', () => {
    const ic = new IndicatorCache();
    const inds = [{ type: 'sma', params: { period: 20 } }];
    ic.compute(inds, mockData, mockCompute);

    callCount = 0;
    ic.compute(inds, [...mockData, mockData[0]], mockCompute);
    expect(callCount).toBe(1); // data changed
  });

  it('evicts removed indicators', () => {
    const ic = new IndicatorCache();
    const inds = [{ type: 'sma', params: { period: 20 } }, { type: 'ema', params: { period: 21 } }];
    ic.compute(inds, mockData, mockCompute);
    expect(ic.size).toBe(2);

    ic.compute([inds[0]], mockData, mockCompute);
    expect(ic.size).toBe(1);
  });

  it('invalidate forces recompute', () => {
    const ic = new IndicatorCache();
    const inds = [{ type: 'sma', params: { period: 20 } }];
    ic.compute(inds, mockData, mockCompute);
    ic.invalidate();
    callCount = 0;
    ic.compute(inds, mockData, mockCompute);
    expect(callCount).toBe(1);
  });

  it('generates consistent keys', () => {
    const k1 = IndicatorCache.key({ type: 'sma', params: { period: 20 }, color: '#f00' });
    const k2 = IndicatorCache.key({ type: 'sma', params: { period: 20 }, color: '#f00' });
    expect(k1).toBe(k2);
  });
});
