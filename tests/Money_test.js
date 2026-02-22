// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Money Module Tests
//
// Validates:
//   - Integer conversion eliminates float drift
//   - Hybrid precision (fiat vs crypto)
//   - Safe accumulation over large datasets
//   - Trade migration is idempotent
//   - Edge cases (NaN, null, zero, negative, Infinity)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  SCALE,
  getScale,
  toUnits,
  fromUnits,
  roundMoney,
  roundField,
  safeSum,
  SafeAccumulator,
  migrateTrade,
  migrateAllTrades,
  moneyEqual,
  isZero,
} from '../engine/Money.js';

// ─── Scale Constants ────────────────────────────────────────────

describe('SCALE constants', () => {
  it('FIAT scale is 100 (cents)', () => {
    expect(SCALE.FIAT).toBe(100);
  });

  it('CRYPTO scale is 1e8 (satoshi precision)', () => {
    expect(SCALE.CRYPTO).toBe(100_000_000);
  });

  it('scales are frozen', () => {
    expect(() => { SCALE.FIAT = 1000; }).toThrow();
  });
});

// ─── getScale ───────────────────────────────────────────────────

describe('getScale', () => {
  it('pnl is always FIAT regardless of asset class', () => {
    expect(getScale('pnl', 'crypto')).toBe(SCALE.FIAT);
    expect(getScale('pnl', 'futures')).toBe(SCALE.FIAT);
    expect(getScale('pnl', 'stocks')).toBe(SCALE.FIAT);
  });

  it('fees are always FIAT', () => {
    expect(getScale('fees', 'crypto')).toBe(SCALE.FIAT);
    expect(getScale('fees', 'futures')).toBe(SCALE.FIAT);
  });

  it('entry/exit use CRYPTO scale for crypto assets', () => {
    expect(getScale('entry', 'crypto')).toBe(SCALE.CRYPTO);
    expect(getScale('exit', 'crypto')).toBe(SCALE.CRYPTO);
  });

  it('entry/exit use FIAT scale for non-crypto', () => {
    expect(getScale('entry', 'futures')).toBe(SCALE.FIAT);
    expect(getScale('exit', 'stocks')).toBe(SCALE.FIAT);
    expect(getScale('entry', 'forex')).toBe(SCALE.FIAT);
    expect(getScale('exit', 'options')).toBe(SCALE.FIAT);
  });

  it('qty uses CRYPTO scale for crypto', () => {
    expect(getScale('qty', 'crypto')).toBe(SCALE.CRYPTO);
  });

  it('qty uses FIAT scale for non-crypto', () => {
    expect(getScale('qty', 'futures')).toBe(SCALE.FIAT);
  });
});

// ─── toUnits / fromUnits ────────────────────────────────────────

describe('toUnits', () => {
  it('converts dollars to cents', () => {
    expect(toUnits(123.45)).toBe(12345);
    expect(toUnits(0.01)).toBe(1);
    expect(toUnits(1000.00)).toBe(100000);
  });

  it('rounds to nearest cent', () => {
    expect(toUnits(123.456)).toBe(12346);
    expect(toUnits(123.454)).toBe(12345);
    expect(toUnits(0.005)).toBe(1); // rounds up (banker's rounding edge)
  });

  it('handles negative values', () => {
    expect(toUnits(-50.25)).toBe(-5025);
    expect(toUnits(-0.01)).toBe(-1);
  });

  it('handles zero', () => {
    expect(toUnits(0)).toBe(0);
    expect(toUnits(-0)).toBe(0);
  });

  it('handles null/undefined/NaN gracefully', () => {
    expect(toUnits(null)).toBe(0);
    expect(toUnits(undefined)).toBe(0);
    expect(toUnits(NaN)).toBe(0);
    expect(toUnits('not a number')).toBe(0);
  });

  it('converts crypto values to satoshi units', () => {
    expect(toUnits(0.00000001, SCALE.CRYPTO)).toBe(1);
    expect(toUnits(1.5, SCALE.CRYPTO)).toBe(150_000_000);
    expect(toUnits(0.00125, SCALE.CRYPTO)).toBe(125_000);
  });

  it('handles large fiat values safely', () => {
    // $1M in cents = 100,000,000 — well within safe integer range
    expect(toUnits(1_000_000.00)).toBe(100_000_000);
    // $1B in cents = 100,000,000,000 — still safe
    expect(toUnits(1_000_000_000.00)).toBe(100_000_000_000);
  });
});

describe('fromUnits', () => {
  it('converts cents back to dollars', () => {
    expect(fromUnits(12345)).toBe(123.45);
    expect(fromUnits(1)).toBe(0.01);
    expect(fromUnits(0)).toBe(0);
  });

  it('converts satoshi units back to BTC', () => {
    expect(fromUnits(1, SCALE.CRYPTO)).toBe(0.00000001);
    expect(fromUnits(150_000_000, SCALE.CRYPTO)).toBe(1.5);
  });

  it('roundtrips are exact for clean values', () => {
    const values = [0.01, 0.99, 1.00, 123.45, -50.00, 999999.99];
    for (const v of values) {
      expect(fromUnits(toUnits(v))).toBe(v);
    }
  });

  it('roundtrips crypto values exactly', () => {
    const values = [0.00000001, 0.00125, 1.5, 97250.12345678];
    for (const v of values) {
      expect(fromUnits(toUnits(v, SCALE.CRYPTO), SCALE.CRYPTO)).toBe(v);
    }
  });
});

// ─── roundMoney ─────────────────────────────────────────────────

describe('roundMoney', () => {
  it('rounds to 2 decimal places for fiat', () => {
    expect(roundMoney(123.456)).toBe(123.46);
    expect(roundMoney(123.454)).toBe(123.45);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3); // THE classic float bug — fixed
  });

  it('rounds to 8 decimal places for crypto', () => {
    expect(roundMoney(0.000000015, SCALE.CRYPTO)).toBe(0.00000002);
    expect(roundMoney(0.123456789, SCALE.CRYPTO)).toBe(0.12345679);
  });

  it('handles null/NaN', () => {
    expect(roundMoney(null)).toBe(0);
    expect(roundMoney(NaN)).toBe(0);
    expect(roundMoney(undefined)).toBe(0);
  });

  it('preserves exact values', () => {
    expect(roundMoney(100.00)).toBe(100);
    expect(roundMoney(-50.25)).toBe(-50.25);
  });
});

describe('roundField', () => {
  it('always rounds P&L as fiat', () => {
    expect(roundField(123.456, 'pnl', 'crypto')).toBe(123.46);
    expect(roundField(123.456, 'pnl', 'futures')).toBe(123.46);
  });

  it('rounds crypto entry to 8 decimals', () => {
    expect(roundField(0.00000812, 'entry', 'crypto')).toBe(0.00000812);
  });

  it('rounds stock entry to 2 decimals', () => {
    expect(roundField(156.789, 'entry', 'stocks')).toBe(156.79);
  });

  it('defaults to futures when no asset class', () => {
    expect(roundField(123.456, 'entry')).toBe(123.46);
  });
});

// ─── safeSum ────────────────────────────────────────────────────

describe('safeSum', () => {
  it('sums simple values exactly', () => {
    expect(safeSum([0.1, 0.2])).toBe(0.3);
    expect(safeSum([1.01, 2.02, 3.03])).toBe(6.06);
  });

  it('sums negative values correctly', () => {
    expect(safeSum([100, -50, -25])).toBe(25);
    expect(safeSum([-0.01, -0.02, -0.03])).toBe(-0.06);
  });

  it('handles empty array', () => {
    expect(safeSum([])).toBe(0);
  });

  it('handles null/undefined array', () => {
    expect(safeSum(null)).toBe(0);
    expect(safeSum(undefined)).toBe(0);
  });

  it('skips NaN values in the array', () => {
    expect(safeSum([1, NaN, 2, null, 3])).toBe(6);
  });

  it('eliminates drift over 10,000 values', () => {
    // Classic float test: sum 0.01 ten thousand times
    // Naive: let sum = 0; for (...) sum += 0.01; → 99.99999999999857
    // safeSum: should be exactly 100.00
    const arr = new Array(10000).fill(0.01);
    expect(safeSum(arr)).toBe(100);
  });

  it('eliminates drift over mixed positive/negative values', () => {
    // Generate 5000 wins and 5000 losses that should net to zero
    const arr = [];
    for (let i = 0; i < 5000; i++) {
      arr.push(123.45);
      arr.push(-123.45);
    }
    expect(safeSum(arr)).toBe(0);
  });

  it('handles large dataset with realistic P&L values', () => {
    // Simulate 10K trades with random-ish but predictable P&L
    const arr = [];
    let expectedSum = 0;
    for (let i = 0; i < 10000; i++) {
      // Use values that are exact in cents
      const val = ((i % 200) - 100) * 0.01; // -1.00 to 0.99, stepping by 0.01
      arr.push(val);
      expectedSum += Math.round(val * 100); // accumulate in cents
    }
    expect(safeSum(arr)).toBe(expectedSum / 100);
  });

  it('works with crypto scale', () => {
    const arr = [0.00000001, 0.00000002, 0.00000003];
    expect(safeSum(arr, SCALE.CRYPTO)).toBe(0.00000006);
  });
});

// ─── SafeAccumulator ────────────────────────────────────────────

describe('SafeAccumulator', () => {
  it('accumulates without drift', () => {
    const acc = new SafeAccumulator();
    for (let i = 0; i < 10000; i++) acc.add(0.01);
    expect(acc.result()).toBe(100);
  });

  it('handles mixed add/subtract', () => {
    const acc = new SafeAccumulator();
    acc.add(100.50);
    acc.add(200.25);
    acc.subtract(50.75);
    expect(acc.result()).toBe(250);
  });

  it('tracks count', () => {
    const acc = new SafeAccumulator();
    acc.add(1);
    acc.add(2);
    acc.add(NaN); // skipped
    acc.add(3);
    expect(acc.count()).toBe(3);
  });

  it('provides raw integer units', () => {
    const acc = new SafeAccumulator();
    acc.add(1.50);
    acc.add(2.50);
    expect(acc.rawUnits()).toBe(400); // 150 + 250 cents
    expect(acc.result()).toBe(4);
  });

  it('resets correctly', () => {
    const acc = new SafeAccumulator();
    acc.add(100);
    acc.reset();
    expect(acc.result()).toBe(0);
    expect(acc.count()).toBe(0);
  });

  it('works with crypto scale', () => {
    const acc = new SafeAccumulator(SCALE.CRYPTO);
    acc.add(0.00000001);
    acc.add(0.00000002);
    expect(acc.result()).toBe(0.00000003);
  });

  it('handles null/NaN values gracefully', () => {
    const acc = new SafeAccumulator();
    acc.add(null);
    acc.add(undefined);
    acc.add(NaN);
    expect(acc.result()).toBe(0);
    expect(acc.count()).toBe(0);
  });
});

// ─── Trade Migration ────────────────────────────────────────────

describe('migrateTrade', () => {
  it('rounds monetary fields on a futures trade', () => {
    const trade = {
      id: 'test1',
      pnl: 487.5000000001,  // imprecise float
      fees: 4.5999999999,
      entry: 6045.25,
      exit: 6050.00,
      qty: 2,
      assetClass: 'futures',
    };
    const result = migrateTrade(trade);
    expect(result.pnl).toBe(487.50);
    expect(result.fees).toBe(4.60);
    expect(result.entry).toBe(6045.25);
    expect(result.exit).toBe(6050);
    expect(result.qty).toBe(2);
    expect(result._moneyV).toBe(1);
  });

  it('uses crypto precision for crypto trades', () => {
    const trade = {
      id: 'test2',
      pnl: 312.00,           // P&L still fiat
      fees: 8.40,
      entry: 0.00000812,     // crypto price — needs 8 decimals
      exit: 0.00000825,
      qty: 1000000,
      assetClass: 'crypto',
    };
    const result = migrateTrade(trade);
    expect(result.pnl).toBe(312);         // fiat precision
    expect(result.entry).toBe(0.00000812); // crypto precision preserved
    expect(result.exit).toBe(0.00000825);
    expect(result._moneyV).toBe(1);
  });

  it('is idempotent — re-migrating returns same object', () => {
    const trade = { id: 't1', pnl: 100, assetClass: 'futures' };
    const first = migrateTrade(trade);
    const second = migrateTrade(first);
    expect(second).toBe(first); // same reference — no re-processing
  });

  it('preserves non-monetary fields', () => {
    const trade = {
      id: 'test3', date: '2025-01-15T10:00:00Z', symbol: 'ES',
      side: 'long', playbook: 'Trend Following', emotion: 'Confident',
      tags: ['A+setup'], notes: 'Good trade', pnl: 100, assetClass: 'futures',
    };
    const result = migrateTrade(trade);
    expect(result.id).toBe('test3');
    expect(result.date).toBe('2025-01-15T10:00:00Z');
    expect(result.symbol).toBe('ES');
    expect(result.side).toBe('long');
    expect(result.playbook).toBe('Trend Following');
    expect(result.tags).toEqual(['A+setup']);
  });

  it('handles null entry/exit/qty (optional fields)', () => {
    const trade = { id: 't4', pnl: 50, entry: null, exit: null, qty: null, assetClass: 'futures' };
    const result = migrateTrade(trade);
    expect(result.entry).toBeNull();
    expect(result.exit).toBeNull();
    expect(result.qty).toBeNull();
  });

  it('handles missing assetClass (defaults to futures)', () => {
    const trade = { id: 't5', pnl: 99.999 };
    const result = migrateTrade(trade);
    expect(result.pnl).toBe(100);
  });

  it('handles null/undefined trade input', () => {
    expect(migrateTrade(null)).toBeNull();
    expect(migrateTrade(undefined)).toBeUndefined();
  });
});

describe('migrateAllTrades', () => {
  it('migrates all trades in an array', () => {
    const trades = [
      { id: 't1', pnl: 100.001, assetClass: 'futures' },
      { id: 't2', pnl: -50.009, assetClass: 'crypto' },
    ];
    const result = migrateAllTrades(trades);
    expect(result[0].pnl).toBe(100);
    expect(result[1].pnl).toBe(-50.01);
    expect(result[0]._moneyV).toBe(1);
    expect(result[1]._moneyV).toBe(1);
  });

  it('returns original array reference if nothing changed', () => {
    const trades = [
      { id: 't1', pnl: 100, _moneyV: 1 },
      { id: 't2', pnl: -50, _moneyV: 1 },
    ];
    const result = migrateAllTrades(trades);
    expect(result).toBe(trades); // same reference — no unnecessary re-render
  });

  it('handles empty array', () => {
    expect(migrateAllTrades([])).toEqual([]);
  });

  it('handles non-array input', () => {
    expect(migrateAllTrades(null)).toBeNull();
    expect(migrateAllTrades(undefined)).toBeUndefined();
  });
});

// ─── Comparison Helpers ─────────────────────────────────────────

describe('moneyEqual', () => {
  it('treats 0.1 + 0.2 as equal to 0.3', () => {
    expect(moneyEqual(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('detects actual differences', () => {
    expect(moneyEqual(100.01, 100.02)).toBe(false);
  });

  it('treats sub-cent differences as equal', () => {
    expect(moneyEqual(100.001, 100.009)).toBe(true); // both round to 100.00 cents
  });

  it('works at crypto precision', () => {
    expect(moneyEqual(0.00000001, 0.00000001, SCALE.CRYPTO)).toBe(true);
    expect(moneyEqual(0.00000001, 0.00000002, SCALE.CRYPTO)).toBe(false);
  });
});

describe('isZero', () => {
  it('detects zero', () => {
    expect(isZero(0)).toBe(true);
    expect(isZero(-0)).toBe(true);
    expect(isZero(null)).toBe(true);
    expect(isZero(undefined)).toBe(true);
  });

  it('treats sub-cent values as zero', () => {
    expect(isZero(0.001)).toBe(true);   // less than half a cent
    expect(isZero(0.004)).toBe(true);
  });

  it('does not treat a full cent as zero', () => {
    expect(isZero(0.01)).toBe(false);
    expect(isZero(-0.01)).toBe(false);
    expect(isZero(0.005)).toBe(false); // rounds to 1 cent
  });

  it('works at crypto precision', () => {
    expect(isZero(0.000000001, SCALE.CRYPTO)).toBe(true);  // below 1 satoshi
    expect(isZero(0.00000001, SCALE.CRYPTO)).toBe(false);  // exactly 1 satoshi
  });
});

// ─── Integration: Realistic Scenarios ───────────────────────────

describe('integration: realistic trading scenarios', () => {
  it('day trader: 50 trades summing to exact P&L', () => {
    // Build trades that should sum to exactly $1,234.56
    const trades = [];
    for (let i = 0; i < 49; i++) {
      trades.push(25.19); // 49 × $25.19 = $1,234.31
    }
    trades.push(0.25); // + $0.25 = $1,234.56

    const acc = new SafeAccumulator();
    trades.forEach((pnl) => acc.add(pnl));

    expect(acc.result()).toBe(1234.56);
    expect(safeSum(trades)).toBe(1234.56);
  });

  it('prop firm: verify daily loss limit is not breached', () => {
    // Prop firm daily loss limit: -$500.00
    const DAILY_LIMIT = -500;
    const dayTrades = [-125.50, -87.25, -150.00, -137.24];

    const acc = new SafeAccumulator();
    dayTrades.forEach((pnl) => acc.add(pnl));

    // Total: -499.99 (just barely within limit)
    expect(acc.result()).toBe(-499.99);
    expect(acc.result() >= DAILY_LIMIT).toBe(true);

    // One more penny loss would breach
    acc.add(-0.01);
    expect(acc.result()).toBe(-500);
    expect(acc.result() >= DAILY_LIMIT).toBe(true); // still equal, not breached

    acc.add(-0.01);
    expect(acc.result()).toBe(-500.01);
    expect(acc.result() >= DAILY_LIMIT).toBe(false); // now breached
  });

  it('crypto trader: tiny P&L values accumulate correctly', () => {
    // Trading SHIB with tiny per-trade P&L
    const pnls = [];
    for (let i = 0; i < 1000; i++) {
      pnls.push(0.01); // $0.01 per trade
    }
    // Should be exactly $10.00
    expect(safeSum(pnls)).toBe(10);
  });

  it('mixed portfolio: futures + crypto trades', () => {
    const futureTrades = [
      { pnl: 487.50, assetClass: 'futures' },
      { pnl: -225.00, assetClass: 'futures' },
    ];
    const cryptoTrades = [
      { pnl: 312.00, assetClass: 'crypto' },
      { pnl: -89.75, assetClass: 'crypto' },
    ];
    const allTrades = [...futureTrades, ...cryptoTrades];

    // P&L is always fiat — so we sum at fiat scale regardless of asset class
    const total = safeSum(allTrades.map((t) => t.pnl));
    expect(total).toBe(484.75);
  });
});
