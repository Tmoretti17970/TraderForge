// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Error Handling Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeParse, safeStringify, safeClone } from '../utils/safeJSON.js';
import { reportError, getErrorLog, clearErrorLog, safeAsync, safeSync } from '../utils/globalErrorHandler.js';

// ─── SafeJSON ───────────────────────────────────────────────────

describe('safeJSON', () => {
  describe('safeParse', () => {
    it('parses valid JSON', () => {
      expect(safeParse('{"a":1}')).toEqual({ a: 1 });
      expect(safeParse('[1,2,3]')).toEqual([1, 2, 3]);
      expect(safeParse('"hello"')).toBe('hello');
      expect(safeParse('42')).toBe(42);
      expect(safeParse('true')).toBe(true);
      expect(safeParse('null')).toBe(null);
    });

    it('returns fallback for invalid JSON', () => {
      expect(safeParse('{invalid}', 'default')).toBe('default');
      expect(safeParse('undefined', [])).toEqual([]);
      expect(safeParse('{', null)).toBe(null);
    });

    it('returns fallback for null/undefined/empty', () => {
      expect(safeParse(null, 'fb')).toBe('fb');
      expect(safeParse(undefined, 'fb')).toBe('fb');
      expect(safeParse('', 'fb')).toBe('fb');
    });

    it('default fallback is null', () => {
      expect(safeParse('{bad')).toBe(null);
    });

    it('suppresses warnings in silent mode', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      safeParse('{bad}', null, { silent: true });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('logs context in warnings', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      safeParse('{bad}', null, { context: 'test-ctx' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('test-ctx'), expect.any(String));
      spy.mockRestore();
    });
  });

  describe('safeStringify', () => {
    it('stringifies valid values', () => {
      expect(safeStringify({ a: 1 })).toBe('{"a":1}');
      expect(safeStringify([1, 2])).toBe('[1,2]');
      expect(safeStringify('str')).toBe('"str"');
      expect(safeStringify(42)).toBe('42');
    });

    it('returns fallback for circular references', () => {
      const obj = {};
      obj.self = obj;
      expect(safeStringify(obj, 'FAIL')).toBe('FAIL');
    });

    it('default fallback is "null"', () => {
      const obj = {};
      obj.self = obj;
      expect(safeStringify(obj)).toBe('null');
    });
  });

  describe('safeClone', () => {
    it('deep clones objects', () => {
      const orig = { a: { b: [1, 2, 3] }, c: 'hello' };
      const clone = safeClone(orig);
      expect(clone).toEqual(orig);
      expect(clone).not.toBe(orig);
      expect(clone.a).not.toBe(orig.a);
    });

    it('returns fallback for non-serializable', () => {
      const obj = {};
      obj.self = obj;
      expect(safeClone(obj, [])).toEqual([]);
    });
  });
});

// ─── Global Error Handler ───────────────────────────────────────

describe('globalErrorHandler', () => {
  beforeEach(() => {
    clearErrorLog();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('reportError', () => {
    it('adds errors to the log', () => {
      reportError(new Error('test error'), { source: 'test' });
      const log = getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].message).toBe('test error');
      expect(log[0].source).toBe('test');
    });

    it('handles string errors', () => {
      reportError('string error', { source: 'test' });
      const log = getErrorLog();
      expect(log[0].message).toBe('string error');
    });

    it('categorizes network errors', () => {
      reportError(new Error('Failed to fetch'), { source: 'test' });
      expect(getErrorLog()[0].category).toBe('network');
    });

    it('categorizes parse errors', () => {
      reportError(new Error('Unexpected token in JSON'), { source: 'test' });
      expect(getErrorLog()[0].category).toBe('parse');
    });

    it('categorizes storage errors', () => {
      reportError(new Error('QuotaExceededError: storage full'), { source: 'test' });
      expect(getErrorLog()[0].category).toBe('storage');
    });

    it('caps the error log at MAX_ERRORS', () => {
      for (let i = 0; i < 60; i++) {
        reportError(new Error(`error ${i}`), { source: 'flood' });
      }
      expect(getErrorLog().length).toBeLessThanOrEqual(50);
    });
  });

  describe('clearErrorLog', () => {
    it('empties the log', () => {
      reportError(new Error('x'), { source: 'test' });
      expect(getErrorLog()).toHaveLength(1);
      clearErrorLog();
      expect(getErrorLog()).toHaveLength(0);
    });
  });

  describe('safeAsync', () => {
    it('returns result on success', async () => {
      const fn = safeAsync(async () => 42);
      expect(await fn()).toBe(42);
    });

    it('catches errors and returns fallback', async () => {
      const fn = safeAsync(
        async () => { throw new Error('boom'); },
        { fallback: -1 },
      );
      expect(await fn()).toBe(-1);
      expect(getErrorLog()).toHaveLength(1);
    });
  });

  describe('safeSync', () => {
    it('returns result on success', () => {
      const fn = safeSync(() => 99);
      expect(fn()).toBe(99);
    });

    it('catches errors and returns fallback', () => {
      const fn = safeSync(
        () => { throw new Error('sync boom'); },
        { fallback: 0 },
      );
      expect(fn()).toBe(0);
      expect(getErrorLog()).toHaveLength(1);
    });
  });
});
