// ═══════════════════════════════════════════════════════════════════
// TradeForge — Shallow Equality Tests
// Verifies the shallow comparison utility used by Zustand selectors.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { shallow } from '../utils/shallow.js';

describe('shallow', () => {
  // ─── Primitives ────────────────────────────────────────────────
  it('returns true for identical primitives', () => {
    expect(shallow(1, 1)).toBe(true);
    expect(shallow('a', 'a')).toBe(true);
    expect(shallow(true, true)).toBe(true);
    expect(shallow(null, null)).toBe(true);
    expect(shallow(undefined, undefined)).toBe(true);
  });

  it('returns false for different primitives', () => {
    expect(shallow(1, 2)).toBe(false);
    expect(shallow('a', 'b')).toBe(false);
    expect(shallow(true, false)).toBe(false);
    expect(shallow(null, undefined)).toBe(false);
  });

  // ─── Object identity ──────────────────────────────────────────
  it('returns true for the same reference', () => {
    const obj = { a: 1 };
    expect(shallow(obj, obj)).toBe(true);
  });

  // ─── Shallow object equality ───────────────────────────────────
  it('returns true for objects with same values', () => {
    expect(shallow({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
  });

  it('returns false when values differ', () => {
    expect(shallow({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false when key counts differ', () => {
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallow({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('does NOT deep-compare nested objects', () => {
    expect(shallow({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
  });

  // ─── Edge cases ────────────────────────────────────────────────
  it('handles NaN correctly (Object.is semantics)', () => {
    expect(shallow(NaN, NaN)).toBe(true);
    expect(shallow({ a: NaN }, { a: NaN })).toBe(true);
  });

  it('distinguishes +0 and -0', () => {
    expect(shallow(+0, -0)).toBe(false);
  });

  it('returns false for null vs object', () => {
    expect(shallow(null, { a: 1 })).toBe(false);
    expect(shallow({ a: 1 }, null)).toBe(false);
  });

  it('returns false for object vs primitive', () => {
    expect(shallow({ a: 1 }, 1)).toBe(false);
    expect(shallow(1, { a: 1 })).toBe(false);
  });

  // ─── Zustand selector pattern ──────────────────────────────────
  it('works for typical Zustand selector output', () => {
    const prev = { accountSize: 25000, riskPerTrade: 1, dailyLossLimit: 500 };
    const same = { accountSize: 25000, riskPerTrade: 1, dailyLossLimit: 500 };
    const changed = { accountSize: 25000, riskPerTrade: 2, dailyLossLimit: 500 };

    expect(shallow(prev, same)).toBe(true);   // No re-render
    expect(shallow(prev, changed)).toBe(false); // Should re-render
  });
});
