// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — safeJSON Tests
// Tests for: safeParse, safeStringify, safeClone
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { safeParse, safeStringify, safeClone } from '../utils/safeJSON.js';

// ═══════════════════════════════════════════════════════════════════
// safeParse
// ═══════════════════════════════════════════════════════════════════

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON array', () => {
    expect(safeParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses JSON primitives', () => {
    expect(safeParse('"hello"')).toBe('hello');
    expect(safeParse('42')).toBe(42);
    expect(safeParse('true')).toBe(true);
    expect(safeParse('null')).toBeNull(); // JSON null is valid
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeParse('{broken')).toBeNull();
    expect(safeParse('{broken', 'default')).toBe('default');
  });

  it('returns fallback for null input', () => {
    expect(safeParse(null)).toBeNull();
    expect(safeParse(null, [])).toEqual([]);
  });

  it('returns fallback for undefined input', () => {
    expect(safeParse(undefined, {})).toEqual({});
  });

  it('returns fallback for empty string', () => {
    expect(safeParse('', 'empty')).toBe('empty');
  });

  it('warns by default on parse failure', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    safeParse('{bad}');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('suppresses warning when silent=true', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    safeParse('{bad}', null, { silent: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes context in warning message', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    safeParse('{bad}', null, { context: 'settings-load' });
    expect(spy.mock.calls[0][0]).toContain('settings-load');
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════
// safeStringify
// ═══════════════════════════════════════════════════════════════════

describe('safeStringify', () => {
  it('stringifies objects', () => {
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
  });

  it('stringifies arrays', () => {
    expect(safeStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('stringifies primitives', () => {
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify('hello')).toBe('"hello"');
    expect(safeStringify(null)).toBe('null');
  });

  it('returns fallback for circular reference', () => {
    const obj = {};
    obj.self = obj;
    expect(safeStringify(obj)).toBe('null');
    expect(safeStringify(obj, '{}')).toBe('{}');
  });

  it('returns fallback for BigInt', () => {
    // BigInt cannot be serialized to JSON
    expect(safeStringify(BigInt(42))).toBe('null');
  });

  it('warns by default on failure', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const obj = {};
    obj.self = obj;
    safeStringify(obj);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('suppresses warning when silent=true', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const obj = {};
    obj.self = obj;
    safeStringify(obj, 'null', { silent: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════
// safeClone
// ═══════════════════════════════════════════════════════════════════

describe('safeClone', () => {
  it('deep clones an object', () => {
    const original = { a: 1, b: { c: [2, 3] } };
    const cloned = safeClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.b.c).not.toBe(original.b.c);
  });

  it('clones arrays', () => {
    const arr = [1, { x: 2 }, [3]];
    const cloned = safeClone(arr);
    expect(cloned).toEqual(arr);
    expect(cloned[1]).not.toBe(arr[1]);
  });

  it('returns fallback for circular reference', () => {
    const obj = {};
    obj.self = obj;
    expect(safeClone(obj)).toBeNull();
    expect(safeClone(obj, [])).toEqual([]);
  });

  it('strips undefined values (JSON round-trip behavior)', () => {
    const obj = { a: 1, b: undefined };
    const cloned = safeClone(obj);
    expect(cloned).toEqual({ a: 1 });
    expect('b' in cloned).toBe(false);
  });

  it('strips functions (JSON round-trip behavior)', () => {
    const obj = { a: 1, fn: () => {} };
    const cloned = safeClone(obj);
    expect(cloned).toEqual({ a: 1 });
  });

  it('converts Date to string', () => {
    const obj = { d: new Date('2025-01-01T00:00:00Z') };
    const cloned = safeClone(obj);
    expect(typeof cloned.d).toBe('string');
  });
});
