// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — RetryQueue Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { RetryQueue, computeDelay } from '../utils/RetryQueue.js';

// ═══ exec ═══════════════════════════════════════════════════════
describe('RetryQueue.exec', () => {
  it('returns result on first success', async () => {
    const q = new RetryQueue({ maxRetries: 3, baseDelay: 1 });
    const result = await q.exec(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries on failure then succeeds', async () => {
    let calls = 0;
    const q = new RetryQueue({ maxRetries: 3, baseDelay: 1 });
    const result = await q.exec(() => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return Promise.resolve('ok');
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('throws after maxRetries exhausted', async () => {
    const q = new RetryQueue({ maxRetries: 2, baseDelay: 1 });
    let error;
    try {
      await q.exec(() => { throw new Error('always fails'); });
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe('always fails');
  });

  it('calls onRetry callback', async () => {
    const retries = [];
    const q = new RetryQueue({
      maxRetries: 2,
      baseDelay: 1,
      jitter: false,
      onRetry: (attempt, err, delay) => retries.push({ attempt, msg: err.message, delay }),
    });
    let calls = 0;
    await q.exec(() => {
      calls++;
      if (calls <= 2) throw new Error('oops');
      return 'done';
    });
    expect(retries.length).toBe(2);
    expect(retries[0].attempt).toBe(1);
    expect(retries[1].attempt).toBe(2);
  });

  it('respects shouldRetry — skips retry for non-retryable errors', async () => {
    const q = new RetryQueue({
      maxRetries: 3,
      baseDelay: 1,
      shouldRetry: (err) => err.message !== 'fatal',
    });
    let error;
    try {
      await q.exec(() => { throw new Error('fatal'); });
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe('fatal');
  });

  it('handles async functions', async () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    const result = await q.exec(async () => {
      await new Promise(r => setTimeout(r, 1));
      return 'async-result';
    });
    expect(result).toBe('async-result');
  });
});

// ═══ execSafe ═══════════════════════════════════════════════════
describe('RetryQueue.execSafe', () => {
  it('returns { ok: true, data } on success', async () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    const result = await q.execSafe(() => Promise.resolve('val'));
    expect(result.ok).toBe(true);
    expect(result.data).toBe('val');
  });

  it('returns { ok: false, error } after all retries fail', async () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    const result = await q.execSafe(() => { throw new Error('boom'); });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });
});

// ═══ enqueue + drain ════════════════════════════════════════════
describe('RetryQueue enqueue/drain', () => {
  it('enqueue adds pending operations', () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    q.enqueue('op1', () => Promise.resolve());
    q.enqueue('op2', () => Promise.resolve());
    expect(q.pendingCount).toBe(2);
  });

  it('enqueue deduplicates by id', () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    q.enqueue('op1', () => Promise.resolve('a'));
    q.enqueue('op1', () => Promise.resolve('b'));
    expect(q.pendingCount).toBe(1);
  });

  it('drain processes all pending', async () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    const results = [];
    q.enqueue('a', async () => { results.push('a'); });
    q.enqueue('b', async () => { results.push('b'); });
    const summary = await q.drain();
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(0);
    expect(results).toEqual(['a', 'b']);
    expect(q.pendingCount).toBe(0);
  });

  it('drain reports failures', async () => {
    const q = new RetryQueue({ maxRetries: 0, baseDelay: 1 });
    q.enqueue('ok', () => Promise.resolve());
    q.enqueue('fail', () => { throw new Error('nope'); });
    const summary = await q.drain();
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0]).toContain('fail');
  });

  it('clear empties pending queue', () => {
    const q = new RetryQueue({ maxRetries: 1, baseDelay: 1 });
    q.enqueue('a', () => {});
    q.enqueue('b', () => {});
    q.clear();
    expect(q.pendingCount).toBe(0);
  });
});

// ═══ computeDelay ═══════════════════════════════════════════════
describe('computeDelay', () => {
  it('computes exponential backoff', () => {
    expect(computeDelay(0)).toBe(200);
    expect(computeDelay(1)).toBe(400);
    expect(computeDelay(2)).toBe(800);
    expect(computeDelay(3)).toBe(1600);
  });

  it('caps at maxDelay', () => {
    expect(computeDelay(10)).toBe(10000); // 200 * 2^10 = 204800, capped at 10000
  });

  it('respects custom options', () => {
    expect(computeDelay(0, { baseDelay: 100 })).toBe(100);
    expect(computeDelay(1, { baseDelay: 100, factor: 3 })).toBe(300);
    expect(computeDelay(5, { baseDelay: 100, maxDelay: 500 })).toBe(500);
  });
});
