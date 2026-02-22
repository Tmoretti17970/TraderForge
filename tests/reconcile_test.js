// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Reconciliation Engine Tests
//
// Validates all reconciliation checks with synthetic trade datasets
// that trigger each detection pattern.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  reconcile,
  checkPnlMath,
  findDuplicates,
  findDateGaps,
  findOrphanedTrades,
  findSuspiciousPatterns,
} from '../engine/reconcile.js';

// ─── Helper: build a trade ──────────────────────────────────────

function mkTrade(overrides = {}) {
  return {
    id: overrides.id || 't_' + Math.random().toString(36).slice(2, 8),
    date: '2025-01-15T10:00:00Z',
    symbol: 'ES',
    side: 'long',
    qty: 2,
    entry: 6045.25,
    exit: 6050.00,
    pnl: 9.50,       // (6050 - 6045.25) * 2 = 9.50
    fees: 0,
    playbook: 'Trend',
    emotion: 'Confident',
    assetClass: 'futures',
    ...overrides,
  };
}

// ─── P&L Math Verification ──────────────────────────────────────

describe('checkPnlMath', () => {
  it('passes when P&L matches entry/exit/qty math', () => {
    const trade = mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 10, fees: 0, side: 'long' });
    expect(checkPnlMath(trade)).toBeNull();
  });

  it('passes with fees accounted for', () => {
    // gross = (110 - 100) * 1 = 10, net = 10 - 2 = 8
    const trade = mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 8, fees: 2, side: 'long' });
    expect(checkPnlMath(trade)).toBeNull();
  });

  it('passes for short trades', () => {
    // short: gross = (100 - 95) * 3 * -1 = ... wait, short means we profit when price drops
    // gross = (entry - exit) * qty = (100 - 95) * 3 = 15 → direction = -1 → (exit - entry) * qty * -1 = (95-100)*3*-1 = 15
    const trade = mkTrade({ entry: 100, exit: 95, qty: 3, pnl: 15, fees: 0, side: 'short' });
    expect(checkPnlMath(trade)).toBeNull();
  });

  it('detects P&L mismatch (warning for small diff)', () => {
    // Expected: (110-100)*1 = 10, reported: 12
    const trade = mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 12, fees: 0, side: 'long' });
    const issue = checkPnlMath(trade);
    expect(issue).not.toBeNull();
    expect(issue.code).toBe('PNL_MATH_MISMATCH');
    expect(issue.severity).toBe('warning'); // diff = $2
  });

  it('detects P&L mismatch (error for large diff)', () => {
    // Expected: (110-100)*1 = 10, reported: 50 (diff = $40)
    const trade = mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 50, fees: 0, side: 'long' });
    const issue = checkPnlMath(trade);
    expect(issue).not.toBeNull();
    expect(issue.severity).toBe('error'); // diff > $10
  });

  it('skips when entry is missing', () => {
    const trade = mkTrade({ entry: null, exit: 110, qty: 1, pnl: 10, side: 'long' });
    expect(checkPnlMath(trade)).toBeNull();
  });

  it('skips when exit is missing', () => {
    const trade = mkTrade({ entry: 100, exit: null, qty: 1, pnl: 10, side: 'long' });
    expect(checkPnlMath(trade)).toBeNull();
  });

  it('skips when qty is missing or zero', () => {
    expect(checkPnlMath(mkTrade({ qty: null }))).toBeNull();
    expect(checkPnlMath(mkTrade({ qty: 0 }))).toBeNull();
  });

  it('allows small rounding tolerance per unit', () => {
    // Expected: (100.01 - 100.00) * 100 = 1.00, report 1.01 (diff = $0.01 per unit = ok)
    const trade = mkTrade({ entry: 100.00, exit: 100.01, qty: 100, pnl: 1.01, fees: 0, side: 'long' });
    // Tolerance: 0.02 * 100 = $2.00. Diff is $0.01. Should pass.
    expect(checkPnlMath(trade)).toBeNull();
  });
});

// ─── Duplicate Detection ────────────────────────────────────────

describe('findDuplicates', () => {
  it('detects exact duplicate trades', () => {
    const trades = [
      mkTrade({ id: 't1', date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: 100 }),
      mkTrade({ id: 't2', date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: 100 }),
    ];
    const issues = findDuplicates(trades);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('EXACT_DUPLICATE');
    expect(issues[0].tradeIds).toContain('t1');
    expect(issues[0].tradeIds).toContain('t2');
  });

  it('ignores trades with different symbols', () => {
    const trades = [
      mkTrade({ date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: 100 }),
      mkTrade({ date: '2025-01-15T10:30:00Z', symbol: 'NQ', pnl: 100 }),
    ];
    expect(findDuplicates(trades)).toHaveLength(0);
  });

  it('ignores trades with different P&L (same time/symbol)', () => {
    const trades = [
      mkTrade({ date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: 100 }),
      mkTrade({ date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: -50 }),
    ];
    expect(findDuplicates(trades)).toHaveLength(0);
  });

  it('ignores trades with different timestamps', () => {
    const trades = [
      mkTrade({ date: '2025-01-15T10:30:00Z', symbol: 'ES', pnl: 100 }),
      mkTrade({ date: '2025-01-15T10:31:00Z', symbol: 'ES', pnl: 100 }),
    ];
    expect(findDuplicates(trades)).toHaveLength(0);
  });

  it('handles empty array', () => {
    expect(findDuplicates([])).toHaveLength(0);
  });
});

// ─── Date Gap Detection ─────────────────────────────────────────

describe('findDateGaps', () => {
  it('detects gaps > 5 weekdays', () => {
    const trades = [
      mkTrade({ date: '2025-01-06T10:00:00Z' }), // Monday
      mkTrade({ date: '2025-01-20T10:00:00Z' }), // Monday, 2 weeks later (10 weekdays)
    ];
    const issues = findDateGaps(trades);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('DATE_GAP');
    expect(issues[0].details.weekdays).toBeGreaterThan(5);
  });

  it('ignores gaps <= 5 weekdays', () => {
    const trades = [
      mkTrade({ date: '2025-01-06T10:00:00Z' }), // Monday
      mkTrade({ date: '2025-01-10T10:00:00Z' }), // Friday (4 weekdays gap)
    ];
    expect(findDateGaps(trades)).toHaveLength(0);
  });

  it('handles weekend gaps correctly (not counted as weekdays)', () => {
    const trades = [
      mkTrade({ date: '2025-01-10T10:00:00Z' }), // Friday
      mkTrade({ date: '2025-01-13T10:00:00Z' }), // Monday (0 weekday gap — just a weekend)
    ];
    expect(findDateGaps(trades)).toHaveLength(0);
  });

  it('sorts trades by date before checking', () => {
    // Out-of-order input
    const trades = [
      mkTrade({ date: '2025-01-20T10:00:00Z' }),
      mkTrade({ date: '2025-01-06T10:00:00Z' }),
    ];
    const issues = findDateGaps(trades);
    expect(issues.length).toBe(1); // Still detects the gap
  });

  it('handles single trade', () => {
    expect(findDateGaps([mkTrade()])).toHaveLength(0);
  });

  it('handles empty array', () => {
    expect(findDateGaps([])).toHaveLength(0);
  });
});

// ─── Orphaned Trade Detection ───────────────────────────────────

describe('findOrphanedTrades', () => {
  it('detects closing trade without entry', () => {
    const trade = mkTrade({ entry: 0, exit: 110, pnl: 50 });
    const issues = findOrphanedTrades([trade]);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('ORPHANED_CLOSE');
  });

  it('detects null entry with exit present', () => {
    const trade = mkTrade({ entry: null, exit: 110, pnl: 50 });
    const issues = findOrphanedTrades([trade]);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('ORPHANED_CLOSE');
  });

  it('detects open trade without exit (with non-zero P&L)', () => {
    const trade = mkTrade({ entry: 100, exit: null, pnl: 25 });
    const issues = findOrphanedTrades([trade]);
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe('ORPHANED_OPEN');
    expect(issues[0].severity).toBe('info'); // less severe
  });

  it('ignores trade with both entry and exit', () => {
    const trade = mkTrade({ entry: 100, exit: 110, pnl: 10 });
    expect(findOrphanedTrades([trade])).toHaveLength(0);
  });

  it('ignores open trade with zero P&L (still open, no P&L)', () => {
    const trade = mkTrade({ entry: 100, exit: null, pnl: 0 });
    expect(findOrphanedTrades([trade])).toHaveLength(0);
  });

  it('ignores trade with neither entry nor exit (P&L only)', () => {
    const trade = mkTrade({ entry: null, exit: null, pnl: 50 });
    expect(findOrphanedTrades([trade])).toHaveLength(0);
  });
});

// ─── Suspicious Patterns ────────────────────────────────────────

describe('findSuspiciousPatterns', () => {
  it('detects uniform P&L across all trades', () => {
    const trades = Array.from({ length: 10 }, () => mkTrade({ pnl: 100 }));
    const issues = findSuspiciousPatterns(trades);
    const uniform = issues.find((i) => i.code === 'UNIFORM_PNL');
    expect(uniform).toBeDefined();
    expect(uniform.severity).toBe('warning');
  });

  it('does not flag uniform P&L for small datasets', () => {
    const trades = [mkTrade({ pnl: 100 }), mkTrade({ pnl: 100 })];
    const issues = findSuspiciousPatterns(trades);
    expect(issues.find((i) => i.code === 'UNIFORM_PNL')).toBeUndefined();
  });

  it('detects mostly round P&L values', () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mkTrade({ pnl: i % 5 === 0 ? 100.50 : Math.round(i * 10) })
    );
    const issues = findSuspiciousPatterns(trades);
    const round = issues.find((i) => i.code === 'MOSTLY_ROUND_PNL');
    expect(round).toBeDefined();
  });

  it('detects single-symbol datasets', () => {
    const trades = Array.from({ length: 10 }, () => mkTrade({ symbol: 'AAPL', pnl: Math.random() * 100 }));
    const issues = findSuspiciousPatterns(trades);
    const single = issues.find((i) => i.code === 'SINGLE_SYMBOL');
    expect(single).toBeDefined();
  });

  it('detects negative fees', () => {
    const trades = [
      mkTrade({ fees: -4.60 }),
      mkTrade({ fees: 4.60 }),
      mkTrade({ fees: -2.30 }),
    ];
    const issues = findSuspiciousPatterns(trades);
    const negFees = issues.find((i) => i.code === 'NEGATIVE_FEES');
    expect(negFees).toBeDefined();
    expect(negFees.details.count).toBe(2);
  });

  it('detects all-same-timestamp trades', () => {
    const trades = Array.from({ length: 10 }, () =>
      mkTrade({ date: '2025-01-15T10:00:00Z', pnl: Math.random() * 100 })
    );
    const issues = findSuspiciousPatterns(trades);
    const same = issues.find((i) => i.code === 'SAME_TIMESTAMP');
    expect(same).toBeDefined();
  });

  it('returns empty for clean diverse data', () => {
    const symbols = ['ES', 'NQ', 'BTC', 'AAPL', 'TSLA'];
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkTrade({
        symbol: symbols[i % 5],
        pnl: (i * 17.3) - 50.25,
        fees: 4.60,
        date: `2025-01-${(15 + i).toString().padStart(2, '0')}T${(9 + i % 5).toString().padStart(2, '0')}:30:00Z`,
      })
    );
    const issues = findSuspiciousPatterns(trades);
    expect(issues).toHaveLength(0);
  });
});

// ─── Full Reconcile Pipeline ────────────────────────────────────

describe('reconcile (full pipeline)', () => {
  it('returns clean result for valid dataset', () => {
    const trades = [
      mkTrade({ id: 't1', date: '2025-01-15T10:00:00Z', symbol: 'ES', entry: 100, exit: 110, qty: 1, pnl: 10, fees: 0, side: 'long' }),
      mkTrade({ id: 't2', date: '2025-01-16T11:00:00Z', symbol: 'NQ', entry: 200, exit: 195, qty: 2, pnl: 10, fees: 0, side: 'short' }),
    ];
    const { issues, summary } = reconcile(trades);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(summary.grade).toMatch(/^[AB]$/);
  });

  it('catches multiple issue types simultaneously', () => {
    const trades = [
      // P&L mismatch
      mkTrade({ id: 't1', date: '2025-01-15T10:00:00Z', entry: 100, exit: 110, qty: 1, pnl: 50, fees: 0, side: 'long' }),
      // Exact duplicate of t3
      mkTrade({ id: 't2', date: '2025-01-15T10:30:00Z', symbol: 'NQ', pnl: 200 }),
      mkTrade({ id: 't3', date: '2025-01-15T10:30:00Z', symbol: 'NQ', pnl: 200 }),
      // Orphaned close
      mkTrade({ id: 't4', date: '2025-01-16T10:00:00Z', entry: 0, exit: 150, pnl: 30 }),
    ];
    const { issues, summary } = reconcile(trades);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('PNL_MATH_MISMATCH');
    expect(codes).toContain('EXACT_DUPLICATE');
    expect(codes).toContain('ORPHANED_CLOSE');
    expect(summary.errors).toBeGreaterThan(0);
  });

  it('sorts issues by severity (errors first)', () => {
    const trades = [
      mkTrade({ id: 't1', entry: 100, exit: 110, qty: 1, pnl: 500, fees: 0, side: 'long' }), // error: big mismatch
      mkTrade({ id: 't2', entry: 0, exit: 150, pnl: 30 }), // warning: orphan
    ];
    const { issues } = reconcile(trades);
    expect(issues.length).toBeGreaterThan(0);
    // First issue should be error, later ones should be warning or info
    const severities = issues.map((i) => i.severity);
    const errorIdx = severities.indexOf('error');
    const warningIdx = severities.indexOf('warning');
    if (errorIdx >= 0 && warningIdx >= 0) {
      expect(errorIdx).toBeLessThan(warningIdx);
    }
  });

  it('handles empty trades array', () => {
    const { issues, summary } = reconcile([]);
    expect(issues).toHaveLength(0);
    expect(summary.grade).toBe('A');
  });

  it('handles null/undefined', () => {
    expect(reconcile(null).issues).toHaveLength(0);
    expect(reconcile(undefined).issues).toHaveLength(0);
  });

  it('respects options to disable specific checks', () => {
    const trades = [
      mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 500, side: 'long' }), // would trigger math check
    ];
    const { issues: withMath } = reconcile(trades, { checkMath: true });
    const { issues: noMath } = reconcile(trades, { checkMath: false });
    expect(withMath.length).toBeGreaterThan(noMath.length);
  });

  it('summary completeness reflects data quality', () => {
    // Trades with all fields filled
    const complete = [
      mkTrade({ entry: 100, exit: 110, qty: 1, playbook: 'Trend', emotion: 'Focused' }),
    ];
    const { summary: s1 } = reconcile(complete);

    // Trades with missing fields
    const sparse = [
      mkTrade({ entry: null, exit: null, qty: null, playbook: '', emotion: '' }),
    ];
    const { summary: s2 } = reconcile(sparse);

    expect(s1.completeness).toBeGreaterThan(s2.completeness);
  });

  it('grades correctly: F for errors, C for many warnings, B for few, A for clean', () => {
    // Clean
    const clean = [mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 10, fees: 0, side: 'long' })];
    expect(reconcile(clean).summary.grade).toMatch(/^[AB]$/);

    // Error (big math mismatch)
    const errData = [mkTrade({ entry: 100, exit: 110, qty: 1, pnl: 500, fees: 0, side: 'long' })];
    expect(reconcile(errData).summary.grade).toBe('F');
  });
});
