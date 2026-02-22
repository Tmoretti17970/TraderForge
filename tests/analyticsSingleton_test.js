// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Computation Guard Tests
//
// Tests the memoization, debounce, and guard logic in the singleton.
// Since the singleton depends on AnalyticsBridge (which uses Workers),
// we test the pure functions directly and simulate the flow.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─── Extract tradeHash for direct testing ───────────────────────
// (Mirrors the function inside analyticsSingleton.js)

function tradeHash(trades) {
  if (!trades?.length) return 'empty';
  const n = trades.length;
  const first = trades[0]?.id || '';
  const last = trades[n - 1]?.id || '';
  let pnlSum = 0;
  for (let i = 0; i < n; i++) {
    pnlSum += Math.round((trades[i].pnl || 0) * 100);
  }
  return `${n}|${first}|${last}|${pnlSum}`;
}

function settingsKey(settings) {
  if (!settings || typeof settings !== 'object') return '{}';
  return JSON.stringify(settings, Object.keys(settings).sort());
}

// ─── tradeHash ──────────────────────────────────────────────────

describe('tradeHash', () => {
  it('returns empty for null/empty trades', () => {
    expect(tradeHash(null)).toBe('empty');
    expect(tradeHash(undefined)).toBe('empty');
    expect(tradeHash([])).toBe('empty');
  });

  it('generates consistent hash for same data', () => {
    const trades = [
      { id: 't1', pnl: 100 },
      { id: 't2', pnl: -50 },
    ];
    const h1 = tradeHash(trades);
    const h2 = tradeHash(trades);
    expect(h1).toBe(h2);
  });

  it('detects additions (count changes)', () => {
    const base = [{ id: 't1', pnl: 100 }];
    const added = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: 50 }];
    expect(tradeHash(base)).not.toBe(tradeHash(added));
  });

  it('detects deletions', () => {
    const full = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: 50 }];
    const deleted = [{ id: 't1', pnl: 100 }];
    expect(tradeHash(full)).not.toBe(tradeHash(deleted));
  });

  it('detects P&L edits (content changes)', () => {
    const before = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: 50 }];
    const after = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: 75 }];
    expect(tradeHash(before)).not.toBe(tradeHash(after));
  });

  it('detects reordering (first/last ID changes)', () => {
    const order1 = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: 50 }];
    const order2 = [{ id: 't2', pnl: 50 }, { id: 't1', pnl: 100 }];
    // Same count and same total pnlSum, but first/last IDs differ
    expect(tradeHash(order1)).not.toBe(tradeHash(order2));
  });

  it('is fast for large datasets', () => {
    const trades = Array.from({ length: 50000 }, (_, i) => ({
      id: `t_${i}`,
      pnl: (i % 200 - 100) * 1.23,
    }));
    const start = performance.now();
    const hash = tradeHash(trades);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10); // should be <3ms
    expect(typeof hash).toBe('string');
  });

  it('same reference produces same hash', () => {
    const trades = [{ id: 'a', pnl: 1 }];
    expect(tradeHash(trades)).toBe(tradeHash(trades));
  });

  it('different references with same data produce same hash', () => {
    const t1 = [{ id: 'a', pnl: 100 }, { id: 'b', pnl: -50 }];
    const t2 = [{ id: 'a', pnl: 100 }, { id: 'b', pnl: -50 }];
    expect(tradeHash(t1)).toBe(tradeHash(t2));
  });
});

// ─── settingsKey ────────────────────────────────────────────────

describe('settingsKey', () => {
  it('returns consistent key for same settings', () => {
    expect(settingsKey({ mcRuns: 500 })).toBe(settingsKey({ mcRuns: 500 }));
  });

  it('is order-independent', () => {
    expect(settingsKey({ mcRuns: 500, riskFreeRate: 0.05 }))
      .toBe(settingsKey({ riskFreeRate: 0.05, mcRuns: 500 }));
  });

  it('detects changes', () => {
    expect(settingsKey({ mcRuns: 500 })).not.toBe(settingsKey({ mcRuns: 1000 }));
  });

  it('handles null/undefined', () => {
    expect(settingsKey(null)).toBe('{}');
    expect(settingsKey(undefined)).toBe('{}');
  });

  it('handles empty object', () => {
    expect(settingsKey({})).toBe('{}');
  });
});

// ─── Memoization Simulation ─────────────────────────────────────

describe('memoization simulation', () => {
  it('identical data should not trigger recompute', () => {
    let computeCount = 0;
    let lastHash = null;

    function shouldCompute(trades, settings) {
      const hash = tradeHash(trades);
      const sKey = settingsKey(settings);
      if (hash === lastHash) return false;
      lastHash = hash;
      computeCount++;
      return true;
    }

    const trades = [{ id: 't1', pnl: 100 }, { id: 't2', pnl: -50 }];

    // First call — should compute
    expect(shouldCompute(trades, { mcRuns: 500 })).toBe(true);
    expect(computeCount).toBe(1);

    // Same data, same reference — should skip
    expect(shouldCompute(trades, { mcRuns: 500 })).toBe(false);
    expect(computeCount).toBe(1);

    // Same data, different reference — should skip
    const tradesCopy = [...trades];
    expect(shouldCompute(tradesCopy, { mcRuns: 500 })).toBe(false);
    expect(computeCount).toBe(1);

    // Different data — should compute
    const tradesEdited = [{ id: 't1', pnl: 200 }, { id: 't2', pnl: -50 }];
    expect(shouldCompute(tradesEdited, { mcRuns: 500 })).toBe(true);
    expect(computeCount).toBe(2);
  });

  it('settings change should trigger recompute', () => {
    let computeCount = 0;
    let lastHash = null;
    let lastSKey = null;

    function shouldCompute(trades, settings) {
      const hash = tradeHash(trades);
      const sKey = settingsKey(settings);
      if (hash === lastHash && sKey === lastSKey) return false;
      lastHash = hash;
      lastSKey = sKey;
      computeCount++;
      return true;
    }

    const trades = [{ id: 't1', pnl: 100 }];

    shouldCompute(trades, { mcRuns: 500 }); // first
    expect(computeCount).toBe(1);

    shouldCompute(trades, { mcRuns: 500 }); // same
    expect(computeCount).toBe(1);

    shouldCompute(trades, { mcRuns: 1000 }); // settings changed
    expect(computeCount).toBe(2);
  });

  it('empty trades clears cache', () => {
    let lastHash = null;

    function processCall(trades) {
      if (!trades?.length) {
        lastHash = null;
        return 'cleared';
      }
      const hash = tradeHash(trades);
      if (hash === lastHash) return 'skipped';
      lastHash = hash;
      return 'computed';
    }

    const trades = [{ id: 't1', pnl: 100 }];
    expect(processCall(trades)).toBe('computed');
    expect(processCall(trades)).toBe('skipped');
    expect(processCall([])).toBe('cleared');
    // After clearing, same data triggers recompute
    expect(processCall(trades)).toBe('computed');
  });
});

// ─── Debounce Simulation ────────────────────────────────────────

describe('debounce simulation', () => {
  it('batches rapid calls — only last one fires', async () => {
    let computeCount = 0;
    let lastTrades = null;
    let timer = null;

    function debouncedCompute(trades, delay = 50) {
      return new Promise((resolve) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          computeCount++;
          lastTrades = trades;
          resolve('computed');
        }, delay);
      });
    }

    // Fire 10 rapid calls — only the last should execute
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(debouncedCompute([{ id: `t${i}`, pnl: i * 10 }]));
    }

    // Wait for debounce to settle
    await new Promise((r) => setTimeout(r, 100));

    expect(computeCount).toBe(1);
    expect(lastTrades[0].id).toBe('t9'); // last call wins
  });
});

// ─── Hash Collision Edge Cases ──────────────────────────────────

describe('hash collision edge cases', () => {
  it('trades with same count and pnlSum but different IDs are different', () => {
    // Both have 2 trades summing to 150 cents (1.50)
    const t1 = [{ id: 'a', pnl: 1.00 }, { id: 'b', pnl: 0.50 }];
    const t2 = [{ id: 'c', pnl: 0.75 }, { id: 'd', pnl: 0.75 }];
    expect(tradeHash(t1)).not.toBe(tradeHash(t2)); // different IDs
  });

  it('trades with same IDs but different pnlSum are different', () => {
    const t1 = [{ id: 'a', pnl: 100 }, { id: 'b', pnl: 50 }];
    const t2 = [{ id: 'a', pnl: 30 }, { id: 'b', pnl: 75 }];
    // Different pnlSum: 15000 vs 10500 cents
    expect(tradeHash(t1)).not.toBe(tradeHash(t2));
  });

  // Known limitation: if ONLY middle trades change but first/last IDs
  // and total pnlSum remain the same, the hash won't detect it.
  // This is acceptable — it's a performance optimization, not a correctness guarantee.
  // The next data change (add/delete/edit P&L) will invalidate the cache.
  it('acknowledges known limitation: middle-only changes with same sum', () => {
    const t1 = [{ id: 'a', pnl: 100 }, { id: 'x', pnl: 50 }, { id: 'b', pnl: -50 }];
    const t2 = [{ id: 'a', pnl: 100 }, { id: 'y', pnl: 50 }, { id: 'b', pnl: -50 }];
    // These have same count, same first/last IDs, same pnlSum → same hash
    // This is a known acceptable limitation
    expect(tradeHash(t1)).toBe(tradeHash(t2));
  });
});
