import { describe, it, expect } from 'vitest';
import {
  fmt, fmtD, fmtPrice, niceNum, niceScale,
  findNearestBar, bestTfForTrade, toHeikinAshi,
} from '../utils.js';

// ─── fmt ────────────────────────────────────────────────────────
describe('fmt', () => {
  it('formats millions', () => {
    expect(fmt(1500000)).toBe('1.50M');
    expect(fmt(-2300000)).toBe('-2.30M');
  });
  it('formats tens of thousands', () => {
    expect(fmt(15000)).toBe('15.0K');
  });
  it('formats thousands', () => {
    expect(fmt(1000)).toBe('1.00K');
    expect(fmt(5500)).toBe('5.50K');
  });
  it('formats normal numbers', () => {
    expect(fmt(42.567)).toBe('42.57');
  });
  it('formats small decimals', () => {
    expect(fmt(0.05)).toBe('0.0500');
  });
  it('formats very small decimals', () => {
    expect(fmt(0.005)).toBe('0.005000');
  });
  it('returns "0" for null/undefined/NaN', () => {
    expect(fmt(null)).toBe('0');
    expect(fmt(undefined)).toBe('0');
    expect(fmt(NaN)).toBe('0');
  });
  it('handles zero', () => {
    expect(fmt(0)).toBe('0.000000');
  });
  it('handles negative', () => {
    expect(fmt(-500)).toBe('-500.00');
  });
});

// ─── fmtD ───────────────────────────────────────────────────────
describe('fmtD', () => {
  it('positive gets +$', () => {
    expect(fmtD(100)).toBe('+$100.00');
  });
  it('negative gets -$', () => {
    expect(fmtD(-50)).toBe('-$50.00');
  });
  it('zero gets +$', () => {
    expect(fmtD(0).startsWith('+$')).toBe(true);
  });
  it('large values formatted', () => {
    expect(fmtD(1500000)).toBe('+$1.50M');
    expect(fmtD(-25000)).toBe('-$25.0K');
  });
});

// ─── fmtPrice ───────────────────────────────────────────────────
describe('fmtPrice', () => {
  it('large: 2 decimals', () => {
    expect(fmtPrice(45000.123)).toBe('45000.12');
  });
  it('normal: 2 decimals', () => {
    expect(fmtPrice(100.5)).toBe('100.50');
  });
  it('small: 4 decimals', () => {
    expect(fmtPrice(0.05)).toBe('0.0500');
  });
  it('micro: 6 decimals', () => {
    expect(fmtPrice(0.001)).toBe('0.001000');
  });
  it('nano: 8 decimals', () => {
    expect(fmtPrice(0.00005)).toBe('0.00005000');
  });
  it('returns "0" for null/undefined/NaN', () => {
    expect(fmtPrice(null)).toBe('0');
    expect(fmtPrice(NaN)).toBe('0');
  });
});

// ─── niceNum ────────────────────────────────────────────────────
describe('niceNum', () => {
  it('returns 1 for r <= 0', () => {
    expect(niceNum(0, true)).toBe(1);
    expect(niceNum(-5, true)).toBe(1);
  });
  it('rounds to nice values', () => {
    expect(niceNum(7, true)).toBe(10);
    expect(niceNum(3, true)).toBe(5);
    expect(niceNum(1.2, true)).toBe(1);
  });
  it('ceils to nice values', () => {
    expect(niceNum(7, false)).toBe(10);
    expect(niceNum(1.5, false)).toBe(2);
  });
});

// ─── niceScale ──────────────────────────────────────────────────
describe('niceScale', () => {
  it('normal range', () => {
    const s = niceScale(0, 100, 5);
    expect(s.min).toBeLessThanOrEqual(0);
    expect(s.max).toBeGreaterThanOrEqual(100);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
    expect(s.spacing).toBeGreaterThan(0);
  });
  it('equal min/max expands', () => {
    const s = niceScale(50, 50, 5);
    expect(s.min).toBeLessThan(50);
    expect(s.max).toBeGreaterThan(50);
  });
  it('Infinity inputs fallback', () => {
    const s = niceScale(Infinity, -Infinity, 5);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(100);
  });
  it('negative ranges', () => {
    const s = niceScale(-100, -10, 5);
    expect(s.min).toBeLessThanOrEqual(-100);
    expect(s.max).toBeGreaterThanOrEqual(-10);
  });
  it('micro ranges', () => {
    const s = niceScale(0.00001, 0.00002, 5);
    expect(s.spacing).toBeGreaterThan(0);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });
  it('mt < 2 treated as 2', () => {
    const s = niceScale(0, 100, 1);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });
  it('ticks are evenly spaced', () => {
    const s = niceScale(0, 100, 5);
    for (let i = 2; i < s.ticks.length; i++) {
      const gap1 = s.ticks[i] - s.ticks[i - 1];
      const gap2 = s.ticks[i - 1] - s.ticks[i - 2];
      expect(Math.abs(gap1 - gap2)).toBeLessThan(0.0001);
    }
  });
  it('equal min/max of 0 does not crash', () => {
    const s = niceScale(0, 0, 5);
    expect(s.spacing).toBeGreaterThan(0);
  });
});

// ─── findNearestBar ─────────────────────────────────────────────
describe('findNearestBar', () => {
  const bars = [
    { time: '2025-01-01T10:00:00Z' },
    { time: '2025-01-01T11:00:00Z' },
    { time: '2025-01-01T12:00:00Z' },
    { time: '2025-01-01T13:00:00Z' },
    { time: '2025-01-01T14:00:00Z' },
  ];

  it('exact match', () => {
    expect(findNearestBar(bars, '2025-01-01T12:00:00Z')).toBe(2);
  });
  it('nearest when between bars', () => {
    expect(findNearestBar(bars, '2025-01-01T12:20:00Z')).toBe(2);
  });
  it('before all bars → 0', () => {
    expect(findNearestBar(bars, '2024-01-01T00:00:00Z')).toBe(0);
  });
  it('after all bars → last', () => {
    expect(findNearestBar(bars, '2026-01-01T00:00:00Z')).toBe(4);
  });
  it('empty data → -1', () => {
    expect(findNearestBar([], '2025-01-01T12:00:00Z')).toBe(-1);
  });
  it('null data → -1', () => {
    expect(findNearestBar(null, '2025-01-01T12:00:00Z')).toBe(-1);
  });
  it('null timestamp → -1', () => {
    expect(findNearestBar(bars, null)).toBe(-1);
  });
  it('invalid timestamp → -1', () => {
    expect(findNearestBar(bars, 'not-a-date')).toBe(-1);
  });
  it('single element', () => {
    const single = [{ time: '2025-01-01T12:00:00Z' }];
    expect(findNearestBar(single, '2025-01-01T12:00:00Z')).toBe(0);
    expect(findNearestBar(single, '2025-01-01T15:00:00Z')).toBe(0);
  });
});

// ─── bestTfForTrade ─────────────────────────────────────────────
describe('bestTfForTrade', () => {
  it('today → 1d', () => {
    expect(bestTfForTrade({ date: new Date().toISOString() })).toBe('1d');
  });
  it('3 days ago → 5d', () => {
    const d = new Date(); d.setDate(d.getDate() - 3);
    expect(bestTfForTrade({ date: d.toISOString() })).toBe('5d');
  });
  it('15 days ago → 1m', () => {
    const d = new Date(); d.setDate(d.getDate() - 15);
    expect(bestTfForTrade({ date: d.toISOString() })).toBe('1m');
  });
  it('60 days ago → 3m', () => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    expect(bestTfForTrade({ date: d.toISOString() })).toBe('3m');
  });
  it('200 days ago → 1y', () => {
    const d = new Date(); d.setDate(d.getDate() - 200);
    expect(bestTfForTrade({ date: d.toISOString() })).toBe('1y');
  });
  it('null → 3m', () => {
    expect(bestTfForTrade(null)).toBe('3m');
  });
  it('no date → 3m', () => {
    expect(bestTfForTrade({})).toBe('3m');
  });
});

// ─── toHeikinAshi ───────────────────────────────────────────────
describe('toHeikinAshi', () => {
  it('null → null', () => {
    expect(toHeikinAshi(null)).toBeNull();
  });
  it('empty → empty', () => {
    expect(toHeikinAshi([])).toEqual([]);
  });
  it('first candle HA open = avg(open, close)', () => {
    const data = [{ open: 100, high: 110, low: 90, close: 105, time: 't1' }];
    const ha = toHeikinAshi(data);
    expect(ha[0].open).toBe(102.5);
  });
  it('first candle HA close = avg(OHLC)', () => {
    const data = [{ open: 100, high: 110, low: 90, close: 105, time: 't1' }];
    const ha = toHeikinAshi(data);
    expect(ha[0].close).toBe(101.25);
  });
  it('subsequent open = avg(prev HA open, prev HA close)', () => {
    const data = [
      { open: 100, high: 110, low: 90, close: 105, time: 't1' },
      { open: 106, high: 115, low: 95, close: 112, time: 't2' },
    ];
    const ha = toHeikinAshi(data);
    expect(ha[1].open).toBeCloseTo((ha[0].open + ha[0].close) / 2, 3);
  });
  it('HA high >= max(original high, open, close)', () => {
    const data = [
      { open: 100, high: 110, low: 90, close: 105, time: 't1' },
      { open: 106, high: 120, low: 95, close: 112, time: 't2' },
    ];
    const ha = toHeikinAshi(data);
    ha.forEach((bar) => {
      expect(bar.high).toBeGreaterThanOrEqual(bar.open);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
    });
  });
  it('HA low <= min(original low, open, close)', () => {
    const data = [
      { open: 100, high: 110, low: 90, close: 105, time: 't1' },
      { open: 106, high: 120, low: 85, close: 112, time: 't2' },
    ];
    const ha = toHeikinAshi(data);
    ha.forEach((bar) => {
      expect(bar.low).toBeLessThanOrEqual(bar.open);
      expect(bar.low).toBeLessThanOrEqual(bar.close);
    });
  });
  it('preserves time and volume', () => {
    const data = [{ open: 100, high: 110, low: 90, close: 105, time: 't1', volume: 500 }];
    const ha = toHeikinAshi(data);
    expect(ha[0].time).toBe('t1');
    expect(ha[0].volume).toBe(500);
  });
  it('output length = input length', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      open: 100 + i, high: 105 + i, low: 95 + i, close: 102 + i, time: `t${i}`,
    }));
    expect(toHeikinAshi(data).length).toBe(10);
  });
});
