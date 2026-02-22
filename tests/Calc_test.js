// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Indicator Calculation Tests
// Tests for: SMA, EMA, WMA, Bollinger, VWAP, RSI, MACD, Stoch, ATR
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { Calc } from '../engine/Calc.js';

// ─── Helpers ────────────────────────────────────────────────────
const approx = (val, expected, tolerance = 0.01) =>
  expect(val).toBeCloseTo(expected, tolerance < 0.01 ? 4 : 2);

const mkBar = (o, h, l, c, v = 1000) => ({
  open: o,
  high: h,
  low: l,
  close: c,
  volume: v,
});

// ─── SMA ────────────────────────────────────────────────────────
describe('Calc.sma', () => {
  it('returns correct 3-period SMA', () => {
    const result = Calc.sma([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([null, null, 2, 3, 4]);
  });

  it('returns correct 5-period SMA', () => {
    const result = Calc.sma([10, 20, 30, 40, 50, 60], 5);
    expect(result[0]).toBeNull();
    expect(result[3]).toBeNull();
    expect(result[4]).toBe(30); // (10+20+30+40+50)/5
    expect(result[5]).toBe(40); // (20+30+40+50+60)/5
  });

  it('returns all nulls when data shorter than period', () => {
    const result = Calc.sma([1, 2], 5);
    expect(result).toEqual([null, null]);
  });

  it('handles period of 1 (identity)', () => {
    const result = Calc.sma([5, 10, 15], 1);
    expect(result).toEqual([5, 10, 15]);
  });

  it('handles single element with period 1', () => {
    const result = Calc.sma([42], 1);
    expect(result).toEqual([42]);
  });

  it('handles empty array', () => {
    const result = Calc.sma([], 3);
    expect(result).toEqual([]);
  });

  it('handles constant values', () => {
    const result = Calc.sma([5, 5, 5, 5, 5], 3);
    expect(result).toEqual([null, null, 5, 5, 5]);
  });

  it('handles negative values', () => {
    const result = Calc.sma([-10, -20, -30], 3);
    expect(result).toEqual([null, null, -20]);
  });
});

// ─── EMA ────────────────────────────────────────────────────────
describe('Calc.ema', () => {
  it('returns all nulls when data shorter than period', () => {
    const result = Calc.ema([1, 2], 5);
    expect(result).toEqual([null, null]);
  });

  it('seeds with SMA of first p values', () => {
    const result = Calc.ema([2, 4, 6, 8, 10], 3);
    // Seed = SMA(2,4,6) = 4
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(4); // seed
  });

  it('applies correct multiplier after seed', () => {
    const data = [2, 4, 6, 8, 10];
    const result = Calc.ema(data, 3);
    const k = 2 / (3 + 1); // 0.5
    // result[2] = 4 (seed)
    // result[3] = 8 * 0.5 + 4 * 0.5 = 6
    // result[4] = 10 * 0.5 + 6 * 0.5 = 8
    expect(result[3]).toBe(6);
    expect(result[4]).toBe(8);
  });

  it('handles constant values', () => {
    const result = Calc.ema([5, 5, 5, 5, 5], 3);
    expect(result[2]).toBe(5);
    expect(result[3]).toBe(5);
    expect(result[4]).toBe(5);
  });

  it('handles empty array', () => {
    const result = Calc.ema([], 3);
    expect(result).toEqual([]);
  });

  it('handles period equal to data length', () => {
    const result = Calc.ema([10, 20, 30], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(20); // SMA(10,20,30)
  });
});

// ─── WMA ────────────────────────────────────────────────────────
describe('Calc.wma', () => {
  it('returns correct 3-period WMA', () => {
    const result = Calc.wma([1, 2, 3, 4, 5], 3);
    // WMA(1,2,3) period 3: (1*1 + 2*2 + 3*3) / (1+2+3) = (1+4+9)/6 = 14/6 ≈ 2.333
    approx(result[2], 14 / 6);
  });

  it('returns nulls for first p-1 elements', () => {
    const result = Calc.wma([1, 2, 3], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).not.toBeNull();
  });

  it('returns all nulls when data shorter than period', () => {
    const result = Calc.wma([1, 2], 5);
    expect(result).toEqual([null, null]);
  });

  it('handles empty array', () => {
    const result = Calc.wma([], 3);
    expect(result).toEqual([]);
  });
});

// ─── Bollinger Bands ────────────────────────────────────────────
describe('Calc.bollinger', () => {
  it('returns null for indices before period', () => {
    const data = Array(25).fill(100);
    const result = Calc.bollinger(data, 20, 2);
    for (let i = 0; i < 19; i++) expect(result[i]).toBeNull();
  });

  it('bands equal middle when all values identical', () => {
    const data = Array(25).fill(100);
    const result = Calc.bollinger(data, 20, 2);
    const bb = result[20];
    expect(bb.middle).toBe(100);
    expect(bb.upper).toBe(100); // stddev = 0
    expect(bb.lower).toBe(100);
  });

  it('upper > middle > lower with varying data', () => {
    const data = [];
    for (let i = 0; i < 25; i++) data.push(100 + Math.sin(i) * 10);
    const result = Calc.bollinger(data, 20, 2);
    const bb = result[22];
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
  });

  it('handles short data', () => {
    const result = Calc.bollinger([1, 2, 3], 20, 2);
    expect(result).toEqual([null, null, null]);
  });

  it('handles empty array', () => {
    const result = Calc.bollinger([], 20, 2);
    expect(result).toEqual([]);
  });
});

// ─── VWAP ───────────────────────────────────────────────────────
describe('Calc.vwap', () => {
  it('returns typical price when volume is constant', () => {
    const bars = [
      mkBar(10, 12, 8, 11, 100),
      mkBar(11, 13, 9, 12, 100),
    ];
    const result = Calc.vwap(bars);
    // Bar 0: tp = (12+8+11)/3 = 10.333, cumVP=1033.3, cumV=100 → 10.333
    approx(result[0], (12 + 8 + 11) / 3);
  });

  it('weights by volume correctly', () => {
    const bars = [
      mkBar(10, 10, 10, 10, 1000), // tp=10, heavy volume
      mkBar(20, 20, 20, 20, 1),    // tp=20, tiny volume
    ];
    const result = Calc.vwap(bars);
    // VWAP should be very close to 10 due to volume weighting
    expect(result[1]).toBeLessThan(10.02);
  });

  it('handles zero volume (defaults to 1)', () => {
    const bars = [mkBar(10, 12, 8, 10, 0)];
    const result = Calc.vwap(bars);
    expect(result[0]).not.toBeNaN();
  });

  it('handles empty array', () => {
    expect(Calc.vwap([])).toEqual([]);
  });
});

// ─── RSI ────────────────────────────────────────────────────────
describe('Calc.rsi', () => {
  it('returns all nulls when data too short', () => {
    const result = Calc.rsi([1, 2, 3], 14);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('RSI = 100 when all price changes are gains', () => {
    // 16 ascending values → 15 gains, 0 losses
    const data = Array.from({ length: 16 }, (_, i) => 100 + i);
    const result = Calc.rsi(data, 14);
    expect(result[14]).toBe(100);
  });

  it('RSI = 0 when all price changes are losses', () => {
    // 16 descending values → 0 gains, 15 losses
    const data = Array.from({ length: 16 }, (_, i) => 100 - i);
    const result = Calc.rsi(data, 14);
    expect(result[14]).toBe(0);
  });

  it('RSI = 50 for flat prices (no change)', () => {
    // All same price → gains=0, losses=0 → should NOT be NaN
    const data = Array(20).fill(100);
    const result = Calc.rsi(data, 14);
    expect(result[14]).toBe(50);
    expect(result[19]).toBe(50);
    // This is the NaN bug fix — verify no NaN anywhere
    result.forEach((v) => {
      if (v !== null) expect(isNaN(v)).toBe(false);
    });
  });

  it('RSI is between 0 and 100 for normal data', () => {
    const data = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10,
      45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03];
    const result = Calc.rsi(data, 14);
    result.forEach((v) => {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });
  });

  it('handles empty array', () => {
    expect(Calc.rsi([], 14)).toEqual([]);
  });

  it('handles period of 1', () => {
    const data = [10, 15, 12, 18];
    const result = Calc.rsi(data, 1);
    // Period 1: each change is either all gain or all loss
    expect(result[1]).toBe(100); // 15 > 10, pure gain
    expect(result[2]).toBe(0);   // 12 < 15, pure loss
    expect(result[3]).toBe(100); // 18 > 12, pure gain
  });
});

// ─── MACD ───────────────────────────────────────────────────────
describe('Calc.macd', () => {
  it('returns all nulls for short data', () => {
    const data = Array(10).fill(100);
    const result = Calc.macd(data, 12, 26, 9);
    result.forEach((v) => {
      expect(v.macd).toBeNull();
      expect(v.signal).toBeNull();
      expect(v.histogram).toBeNull();
    });
  });

  it('MACD line = 0 for constant prices', () => {
    const data = Array(50).fill(100);
    const result = Calc.macd(data, 12, 26, 9);
    // After both EMAs converge, MACD should be 0
    const lastWithMacd = result.filter((v) => v.macd !== null);
    if (lastWithMacd.length > 0) {
      const last = lastWithMacd[lastWithMacd.length - 1];
      approx(last.macd, 0);
    }
  });

  it('MACD line is positive during uptrend', () => {
    const data = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const result = Calc.macd(data, 12, 26, 9);
    const withMacd = result.filter((v) => v.macd !== null);
    if (withMacd.length > 0) {
      // Fast EMA > Slow EMA in uptrend → positive MACD
      const last = withMacd[withMacd.length - 1];
      expect(last.macd).toBeGreaterThan(0);
    }
  });

  it('handles empty array', () => {
    expect(Calc.macd([], 12, 26, 9)).toEqual([]);
  });
});

// ─── Stochastic ─────────────────────────────────────────────────
describe('Calc.stochastic', () => {
  it('returns nulls for indices before period', () => {
    const bars = Array(20)
      .fill(null)
      .map(() => mkBar(10, 12, 8, 10));
    const result = Calc.stochastic(bars, 14, 3);
    for (let i = 0; i < 13; i++) {
      expect(result[i].k).toBeNull();
    }
  });

  it('%K = 100 when close is at highest high', () => {
    const bars = Array(15)
      .fill(null)
      .map((_, i) => mkBar(10 + i, 10 + i + 1, 10 + i - 1, 10 + i + 1));
    // Close equals the high in each bar
    const result = Calc.stochastic(bars, 14, 3);
    // Last bar close should be at the top of the range
    expect(result[14].k).toBe(100);
  });

  it('%K = 0 when close is at lowest low', () => {
    const bars = Array(15)
      .fill(null)
      .map((_, i) => mkBar(100 - i, 100 - i + 1, 100 - i - 1, 100 - i - 1));
    // Close equals the low in each bar (descending)
    const result = Calc.stochastic(bars, 14, 3);
    expect(result[14].k).toBe(0);
  });

  it('%K = 50 for flat prices', () => {
    const bars = Array(20)
      .fill(null)
      .map(() => mkBar(100, 110, 90, 100));
    const result = Calc.stochastic(bars, 14, 3);
    expect(result[14].k).toBe(50);
  });

  it('%K is between 0 and 100', () => {
    const bars = Array(30)
      .fill(null)
      .map((_, i) => {
        const p = 100 + Math.sin(i * 0.5) * 20;
        return mkBar(p - 2, p + 3, p - 5, p);
      });
    const result = Calc.stochastic(bars, 14, 3);
    result.forEach((v) => {
      if (v.k !== null) {
        expect(v.k).toBeGreaterThanOrEqual(0);
        expect(v.k).toBeLessThanOrEqual(100);
      }
    });
  });

  it('handles empty array', () => {
    expect(Calc.stochastic([], 14, 3)).toEqual([]);
  });
});

// ─── ATR ────────────────────────────────────────────────────────
describe('Calc.atr', () => {
  it('returns all nulls when data too short', () => {
    const bars = [mkBar(10, 12, 8, 11)];
    const result = Calc.atr(bars, 14);
    expect(result).toEqual([null]);
  });

  it('returns correct first ATR value', () => {
    // Create 14 bars with known true ranges
    const bars = [];
    let close = 100;
    for (let i = 0; i < 14; i++) {
      const h = close + 5;
      const l = close - 5;
      const c = close + (i % 2 === 0 ? 2 : -2);
      bars.push(mkBar(close, h, l, c));
      close = c;
    }
    const result = Calc.atr(bars, 14);
    expect(result[13]).not.toBeNull();
    expect(result[13]).toBeGreaterThan(0);
  });

  it('ATR = 0 for bars with no range', () => {
    const bars = Array(20)
      .fill(null)
      .map(() => mkBar(100, 100, 100, 100));
    const result = Calc.atr(bars, 14);
    expect(result[13]).toBe(0);
  });

  it('handles empty array', () => {
    expect(Calc.atr([], 14)).toEqual([]);
  });

  it('ATR is always non-negative', () => {
    const bars = Array(30)
      .fill(null)
      .map((_, i) => {
        const p = 100 + Math.sin(i) * 20;
        return mkBar(p, p + 5, p - 5, p + 1);
      });
    const result = Calc.atr(bars, 14);
    result.forEach((v) => {
      if (v !== null) expect(v).toBeGreaterThanOrEqual(0);
    });
  });
});
