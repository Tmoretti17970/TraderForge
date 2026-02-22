// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — TradeSchema Tests
// Tests for: validateTrade, normalizeTrade, normalizeBatch
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  TRADE_SCHEMA,
  validateTrade,
  normalizeTrade,
  normalizeBatch,
} from '../engine/TradeSchema.js';

// ─── Helpers ────────────────────────────────────────────────────
const validTrade = (overrides = {}) => ({
  id: 'test-001',
  date: '2025-06-15T10:30:00.000Z',
  symbol: 'ES',
  pnl: 250,
  side: 'long',
  entry: 4500,
  exit: 4510,
  qty: 2,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════
// validateTrade
// ═══════════════════════════════════════════════════════════════════

describe('validateTrade', () => {
  it('accepts a fully valid trade', () => {
    const { valid, errors } = validateTrade(validTrade());
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('accepts a minimal valid trade (required fields only)', () => {
    const { valid } = validateTrade({
      id: 'min-001',
      date: '2025-01-01',
      symbol: 'BTC',
      pnl: -50,
    });
    expect(valid).toBe(true);
  });

  // ─── Required fields ──────────────────────────────────────────

  it('rejects null input', () => {
    const { valid, errors } = validateTrade(null);
    expect(valid).toBe(false);
    expect(errors[0]).toMatch(/non-null object/);
  });

  it('rejects undefined input', () => {
    const { valid } = validateTrade(undefined);
    expect(valid).toBe(false);
  });

  it('rejects missing id', () => {
    const { valid, errors } = validateTrade(validTrade({ id: '' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('id'))).toBe(true);
  });

  it('rejects missing symbol', () => {
    const { valid, errors } = validateTrade(validTrade({ symbol: null }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('symbol'))).toBe(true);
  });

  it('rejects missing date', () => {
    const { valid, errors } = validateTrade(validTrade({ date: '' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('date'))).toBe(true);
  });

  it('rejects missing pnl', () => {
    const { valid, errors } = validateTrade(validTrade({ pnl: null }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('pnl'))).toBe(true);
  });

  // ─── Type checks ──────────────────────────────────────────────

  it('rejects non-coercible string for pnl', () => {
    const { valid, errors } = validateTrade(validTrade({ pnl: 'abc' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('pnl'))).toBe(true);
  });

  it('allows coercible string for pnl', () => {
    const { valid } = validateTrade(validTrade({ pnl: '123.45' }));
    expect(valid).toBe(true);
  });

  it('rejects wrong type for tags', () => {
    const { valid, errors } = validateTrade(validTrade({ tags: 42 }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('tags'))).toBe(true);
  });

  // ─── Enum checks ──────────────────────────────────────────────

  it('rejects invalid side enum', () => {
    const { valid, errors } = validateTrade(validTrade({ side: 'sideways' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('side'))).toBe(true);
  });

  it('accepts valid side "short"', () => {
    const { valid } = validateTrade(validTrade({ side: 'short' }));
    expect(valid).toBe(true);
  });

  it('rejects invalid assetClass', () => {
    const { valid, errors } = validateTrade(validTrade({ assetClass: 'nft' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('assetClass'))).toBe(true);
  });

  it('accepts all valid assetClass values', () => {
    for (const ac of ['futures', 'stocks', 'crypto', 'forex', 'options', 'etf', 'other']) {
      const { valid } = validateTrade(validTrade({ assetClass: ac }));
      expect(valid).toBe(true);
    }
  });

  // ─── Range checks ─────────────────────────────────────────────

  it('rejects rating below minimum', () => {
    const { valid, errors } = validateTrade(validTrade({ rating: 0 }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('rating'))).toBe(true);
  });

  it('rejects rating above maximum', () => {
    const { valid, errors } = validateTrade(validTrade({ rating: 6 }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('rating'))).toBe(true);
  });

  it('accepts boundary ratings 1 and 5', () => {
    expect(validateTrade(validTrade({ rating: 1 })).valid).toBe(true);
    expect(validateTrade(validTrade({ rating: 5 })).valid).toBe(true);
  });

  // ─── Date validation ──────────────────────────────────────────

  it('rejects invalid date string', () => {
    const { valid, errors } = validateTrade(validTrade({ date: 'not-a-date' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('date'))).toBe(true);
  });

  it('rejects invalid closeDate string', () => {
    const { valid, errors } = validateTrade(validTrade({ closeDate: 'nope' }));
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('closeDate'))).toBe(true);
  });

  // ─── Multiple errors ──────────────────────────────────────────

  it('collects all errors at once', () => {
    const { valid, errors } = validateTrade({
      id: '',
      date: '',
      symbol: '',
      pnl: 'abc',
      side: 'invalid',
      rating: 99,
    });
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// normalizeTrade
// ═══════════════════════════════════════════════════════════════════

describe('normalizeTrade', () => {
  it('returns a new object (no mutation)', () => {
    const input = validTrade();
    const output = normalizeTrade(input);
    expect(output).not.toBe(input);
  });

  it('preserves all provided fields', () => {
    const output = normalizeTrade(validTrade());
    expect(output.id).toBe('test-001');
    expect(output.symbol).toBe('ES');
    expect(output.pnl).toBe(250);
    expect(output.side).toBe('long');
  });

  // ─── Default filling ──────────────────────────────────────────

  it('fills default side to "long"', () => {
    const output = normalizeTrade({ id: 'x', date: '2025-01-01', symbol: 'BTC', pnl: 10 });
    expect(output.side).toBe('long');
  });

  it('fills default tags to empty array', () => {
    const output = normalizeTrade(validTrade());
    expect(Array.isArray(output.tags)).toBe(true);
    expect(output.tags).toHaveLength(0);
  });

  it('fills default assetClass to "futures"', () => {
    const output = normalizeTrade(validTrade());
    expect(output.assetClass).toBe('futures');
  });

  it('fills _updatedAt with current ISO timestamp', () => {
    const before = Date.now();
    const output = normalizeTrade(validTrade());
    const ts = new Date(output._updatedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 1000);
  });

  // ─── Type coercion ────────────────────────────────────────────

  it('coerces string pnl to number', () => {
    const output = normalizeTrade(validTrade({ pnl: '123.45' }));
    expect(output.pnl).toBe(123.45);
  });

  it('coerces non-parseable string pnl to 0', () => {
    const output = normalizeTrade(validTrade({ pnl: 'abc' }));
    expect(output.pnl).toBe(0);
  });

  it('coerces string "true" to boolean', () => {
    const output = normalizeTrade(validTrade({ ruleBreak: 'true' }));
    expect(output.ruleBreak).toBe(true);
  });

  it('coerces number to string for symbol', () => {
    const output = normalizeTrade(validTrade({ symbol: 12345 }));
    expect(output.symbol).toBe('12345');
  });

  it('converts comma-separated string to tags array', () => {
    const output = normalizeTrade(validTrade({ tags: 'scalp, momentum, breakout' }));
    expect(output.tags).toEqual(['scalp', 'momentum', 'breakout']);
  });

  // ─── Enum clamping ────────────────────────────────────────────

  it('clamps invalid side to default "long"', () => {
    const output = normalizeTrade(validTrade({ side: 'sideways' }));
    expect(output.side).toBe('long');
  });

  // ─── Range clamping ───────────────────────────────────────────

  it('clamps rating below minimum to 1', () => {
    const output = normalizeTrade(validTrade({ rating: -5 }));
    expect(output.rating).toBe(1);
  });

  it('clamps rating above maximum to 5', () => {
    const output = normalizeTrade(validTrade({ rating: 99 }));
    expect(output.rating).toBe(5);
  });

  // ─── String trimming ─────────────────────────────────────────

  it('trims whitespace from strings', () => {
    const output = normalizeTrade(validTrade({ symbol: '  ES  ', notes: '  good trade  ' }));
    expect(output.symbol).toBe('ES');
    expect(output.notes).toBe('good trade');
  });

  // ─── Date normalization ───────────────────────────────────────

  it('converts short date to ISO string', () => {
    const output = normalizeTrade(validTrade({ date: '2025-06-15' }));
    expect(output.date).toContain('T');
  });

  // ─── Forward-compat: extra fields ─────────────────────────────

  it('passes through unknown fields', () => {
    const output = normalizeTrade(validTrade({ customField: 'custom', _broker: 'TD' }));
    expect(output.customField).toBe('custom');
    expect(output._broker).toBe('TD');
  });

  // ─── ID generation ────────────────────────────────────────────

  it('generates an id if missing', () => {
    const output = normalizeTrade({ date: '2025-01-01', symbol: 'BTC', pnl: 10 });
    expect(output.id).toBeDefined();
    expect(typeof output.id).toBe('string');
    expect(output.id.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// normalizeBatch
// ═══════════════════════════════════════════════════════════════════

describe('normalizeBatch', () => {
  it('normalizes all valid trades', () => {
    const input = [
      validTrade({ id: 'a', pnl: 100 }),
      validTrade({ id: 'b', pnl: -50 }),
      validTrade({ id: 'c', pnl: 200 }),
    ];
    const { trades, errors } = normalizeBatch(input);
    expect(trades).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('skips invalid trades and collects errors', () => {
    const input = [
      validTrade({ id: 'good' }),
      { id: '', date: '', symbol: '', pnl: null },
      validTrade({ id: 'also-good' }),
    ];
    const { trades, errors } = normalizeBatch(input);
    expect(trades).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
  });

  it('returns empty arrays for empty input', () => {
    const { trades, errors } = normalizeBatch([]);
    expect(trades).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('error entries include field-level detail', () => {
    const input = [{ id: '', date: '', symbol: '', pnl: null }];
    const { errors } = normalizeBatch(input);
    expect(errors[0].errors.length).toBeGreaterThan(0);
    expect(errors[0].errors.some(e => e.includes('required'))).toBe(true);
  });
});
