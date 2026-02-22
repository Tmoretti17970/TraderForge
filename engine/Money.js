// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Financial Math Precision Module
//
// Eliminates floating-point accumulation errors in monetary calculations.
//
// Problem:  0.1 + 0.2 === 0.30000000000000004 in JavaScript.
//           Summing 10,000 trade P&Ls accumulates rounding drift.
//
// Solution: Convert to integer units at input boundaries, accumulate
//           as integers (zero drift), convert back at output boundaries.
//
// Hybrid precision:
//   - Fiat (stocks, futures, forex, options): scale 100 (cents)
//   - Crypto prices/quantities: scale 1e8 (satoshi precision)
//   - P&L and fees are ALWAYS fiat scale (denominated in dollars)
//
// Design: Non-invasive. Trade objects keep `pnl` as a float field.
//         This module is used at computation boundaries, not storage.
//         No schema changes. No migration headaches.
// ═══════════════════════════════════════════════════════════════════

// ─── Scale Constants ────────────────────────────────────────────

const SCALE = Object.freeze({
  FIAT: 100,            // 2 decimal places: $123.45 → 12345
  CRYPTO: 100_000_000,  // 8 decimal places: 0.00000001 → 1
});

// Maximum safe integer for accumulation checks
// JS Number.MAX_SAFE_INTEGER = 9007199254740991
// At FIAT scale: max ~$90 trillion (safe for any retail trader)
// At CRYPTO scale: max ~90,071,992 BTC (safe for any balance)
const MAX_SAFE_UNITS = Number.MAX_SAFE_INTEGER;

// ─── Scale Selection ────────────────────────────────────────────

/**
 * Get the appropriate scale factor for a field + asset class.
 *
 * P&L and fees are always fiat (denominated in dollars/euros/etc).
 * Prices and quantities use crypto precision for crypto assets.
 *
 * @param {'pnl'|'fees'|'entry'|'exit'|'qty'} field
 * @param {string} [assetClass='futures']
 * @returns {number} Scale factor
 */
function getScale(field, assetClass) {
  // P&L and fees are always in fiat currency
  if (field === 'pnl' || field === 'fees') return SCALE.FIAT;
  // Prices and quantities for crypto need 8-decimal precision
  if (assetClass === 'crypto') return SCALE.CRYPTO;
  // Everything else (stocks, futures, forex, options) uses fiat
  return SCALE.FIAT;
}

// ─── Conversion Functions ───────────────────────────────────────

/**
 * Convert a float to integer units at a given scale.
 * This is used internally during accumulation.
 *
 * @param {number} value - Float value (e.g. 123.45)
 * @param {number} [scale=SCALE.FIAT] - Scale factor
 * @returns {number} Integer units (e.g. 12345)
 */
function toUnits(value, scale = SCALE.FIAT) {
  if (value == null || typeof value !== 'number' || isNaN(value)) return 0;
  return Math.round(value * scale);
}

/**
 * Convert integer units back to a float.
 *
 * @param {number} units - Integer units (e.g. 12345)
 * @param {number} [scale=SCALE.FIAT] - Scale factor
 * @returns {number} Float value (e.g. 123.45)
 */
function fromUnits(units, scale = SCALE.FIAT) {
  return units / scale;
}

// ─── Rounding at Boundaries ─────────────────────────────────────

/**
 * Round a monetary value to the correct precision for its scale.
 * Call this at INPUT boundaries (form submission, CSV import).
 *
 * @param {number} value - Raw float value
 * @param {number} [scale=SCALE.FIAT] - Scale factor
 * @returns {number} Rounded float (e.g. 123.45, not 123.4500000001)
 */
function roundMoney(value, scale = SCALE.FIAT) {
  if (value == null || isNaN(value)) return 0;
  const n = Number(value);
  return Math.round(n * scale) / scale;
}

/**
 * Round a monetary value using field + asset class context.
 * Convenience wrapper around roundMoney + getScale.
 *
 * @param {number} value
 * @param {'pnl'|'fees'|'entry'|'exit'|'qty'} field
 * @param {string} [assetClass='futures']
 * @returns {number}
 */
function roundField(value, field, assetClass = 'futures') {
  return roundMoney(value, getScale(field, assetClass));
}

// ─── Safe Accumulation ──────────────────────────────────────────

/**
 * Sum an array of float values using integer math.
 * Eliminates accumulation drift entirely.
 *
 * @param {number[]} values - Array of float values
 * @param {number} [scale=SCALE.FIAT] - Scale factor
 * @returns {number} Precise sum as a float
 */
function safeSum(values, scale = SCALE.FIAT) {
  if (!values || !values.length) return 0;
  let intSum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && !isNaN(v)) {
      intSum += Math.round(v * scale);
    }
  }
  return intSum / scale;
}

/**
 * Accumulator class for running sums without drift.
 * Use this in loops where you need to += repeatedly.
 *
 * Usage:
 *   const acc = new SafeAccumulator();
 *   for (const trade of trades) acc.add(trade.pnl);
 *   const total = acc.result();
 */
class SafeAccumulator {
  /**
   * @param {number} [scale=SCALE.FIAT]
   */
  constructor(scale = SCALE.FIAT) {
    this._sum = 0;    // integer accumulator
    this._scale = scale;
    this._count = 0;
  }

  /**
   * Add a float value to the accumulator.
   * @param {number} value
   */
  add(value) {
    if (value != null && !isNaN(value)) {
      this._sum += Math.round(value * this._scale);
      this._count++;
    }
  }

  /**
   * Subtract a float value from the accumulator.
   * @param {number} value
   */
  subtract(value) {
    if (value != null && !isNaN(value)) {
      this._sum -= Math.round(value * this._scale);
      this._count++;
    }
  }

  /** Get the precise sum as a float. */
  result() {
    return this._sum / this._scale;
  }

  /** Get the raw integer sum (for further integer operations). */
  rawUnits() {
    return this._sum;
  }

  /** Number of values added. */
  count() {
    return this._count;
  }

  /** Reset to zero. */
  reset() {
    this._sum = 0;
    this._count = 0;
  }
}

// ─── Trade Migration ────────────────────────────────────────────

/**
 * Migrate a single trade's monetary fields to proper precision.
 * Re-rounds all floats to eliminate any stored imprecision.
 *
 * Non-destructive: returns a new object. Does NOT modify the original.
 * Safe to call multiple times (idempotent).
 *
 * @param {Object} trade - Trade object
 * @returns {Object} Trade with rounded monetary fields + _moneyV flag
 */
function migrateTrade(trade) {
  if (!trade || typeof trade !== 'object') return trade;

  // Already migrated — skip (idempotent)
  if (trade._moneyV === 1) return trade;

  const ac = trade.assetClass || 'futures';

  return {
    ...trade,
    pnl: roundField(trade.pnl, 'pnl', ac),
    fees: roundField(trade.fees, 'fees', ac),
    entry: trade.entry != null ? roundField(trade.entry, 'entry', ac) : null,
    exit: trade.exit != null ? roundField(trade.exit, 'exit', ac) : null,
    qty: trade.qty != null ? roundField(trade.qty, 'qty', ac) : null,
    _moneyV: 1,
  };
}

/**
 * Batch-migrate an array of trades.
 *
 * @param {Object[]} trades
 * @returns {Object[]} Migrated trades
 */
function migrateAllTrades(trades) {
  if (!Array.isArray(trades)) return trades;
  let changed = false;
  const result = trades.map((t) => {
    if (t._moneyV === 1) return t;
    changed = true;
    return migrateTrade(t);
  });
  // Return original array reference if nothing changed (avoids unnecessary re-render)
  return changed ? result : trades;
}

// ─── Comparison Helpers ─────────────────────────────────────────

/**
 * Compare two monetary values for equality at the given scale.
 * Avoids floating-point comparison issues.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} [scale=SCALE.FIAT]
 * @returns {boolean}
 */
function moneyEqual(a, b, scale = SCALE.FIAT) {
  return Math.round(a * scale) === Math.round(b * scale);
}

/**
 * Check if a monetary value is effectively zero at the given scale.
 *
 * @param {number} value
 * @param {number} [scale=SCALE.FIAT]
 * @returns {boolean}
 */
function isZero(value, scale = SCALE.FIAT) {
  return Math.round((value || 0) * scale) === 0;
}

// ─── Export ─────────────────────────────────────────────────────

export {
  SCALE,
  MAX_SAFE_UNITS,
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
};

export default {
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
};
