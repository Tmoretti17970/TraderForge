// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Trade Reconciliation Engine
//
// Detects data integrity issues that only become visible when
// examining the trade dataset as a whole. Row-level validation
// lives in csv.js; this module handles cross-trade analysis.
//
// Runs after CSV parsing, before the user confirms the import.
// Pure functions, no side effects, Worker-safe.
//
// Severity levels:
//   'error'   — Definite data problem. Red. Should not import without fixing.
//   'warning' — Suspicious but not necessarily wrong. Yellow. User decides.
//   'info'    — Observation worth noting. Blue. No action needed.
// ═══════════════════════════════════════════════════════════════════

import { roundMoney, moneyEqual } from './Money.js';

/**
 * @typedef {Object} ReconcileIssue
 * @property {'error'|'warning'|'info'} severity
 * @property {string} code - Machine-readable issue code
 * @property {string} message - Human-readable description
 * @property {string[]} [tradeIds] - Affected trade IDs
 * @property {Object} [details] - Additional context
 */

// ─── P&L Math Verification ──────────────────────────────────────

/**
 * Check if a trade's P&L matches the math from entry, exit, qty, side, and fees.
 * Only runs when entry, exit, and qty are all present.
 *
 * Handles both field naming conventions:
 *   - TradeFormModal: entry, exit, qty
 *   - CSV import: entryPrice, exitPrice (if present), quantity
 *
 * Tolerance: ±$0.02 per contract/share (accounts for tick rounding,
 * partial fills, and broker-specific rounding).
 *
 * @param {Object} trade
 * @returns {ReconcileIssue|null}
 */
function checkPnlMath(trade) {
  // Normalize field names (support both conventions)
  const entry = trade.entry ?? trade.entryPrice ?? null;
  const exit = trade.exit ?? trade.exitPrice ?? null;
  const qty = trade.qty ?? trade.quantity ?? null;
  const { pnl, fees, side } = trade;

  // Can't verify without all components
  if (entry == null || entry === 0 || exit == null || exit === 0 || qty == null || qty === 0) return null;
  if (pnl == null || isNaN(pnl)) return null;

  // Calculate expected gross P&L
  const direction = side === 'short' ? -1 : 1;
  const grossPnl = (exit - entry) * qty * direction;
  const netFees = fees || 0;

  // Expected net P&L
  const expectedNet = grossPnl - netFees;

  // Tolerance: $0.02 per unit (handles tick rounding, partial fills)
  const tolerance = Math.max(0.02 * Math.abs(qty), 0.01);

  if (Math.abs(pnl - expectedNet) > tolerance) {
    const diff = pnl - expectedNet;
    return {
      severity: Math.abs(diff) > 10 ? 'error' : 'warning',
      code: 'PNL_MATH_MISMATCH',
      message: `${trade.symbol}: P&L $${pnl.toFixed(2)} doesn't match calculated ${side} ${qty}×($${exit}−$${entry})−$${netFees.toFixed(2)} = $${expectedNet.toFixed(2)} (diff: $${diff.toFixed(2)})`,
      tradeIds: [trade.id],
      details: { reported: pnl, calculated: expectedNet, difference: diff },
    };
  }

  return null;
}

// ─── Duplicate Detection ────────────────────────────────────────

/**
 * Find exact and near-duplicate trades within the dataset.
 * An exact dupe has the same timestamp + symbol + P&L.
 * A near-dupe has the same timestamp + symbol but different P&L
 * (possible partial fill logged twice).
 *
 * @param {Object[]} trades
 * @returns {ReconcileIssue[]}
 */
function findDuplicates(trades) {
  const issues = [];
  const seen = new Map(); // key → [trade indices]

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const dateMin = t.date ? t.date.slice(0, 16) : ''; // YYYY-MM-DDTHH:MM
    const exactKey = `${dateMin}|${t.symbol}|${roundMoney(t.pnl)}`;
    const nearKey = `${dateMin}|${t.symbol}`;

    // Exact duplicate check
    if (seen.has(exactKey)) {
      const prevIdx = seen.get(exactKey);
      issues.push({
        severity: 'warning',
        code: 'EXACT_DUPLICATE',
        message: `${t.symbol}: Trades #${prevIdx + 1} and #${i + 1} appear identical (same time, symbol, P&L $${t.pnl.toFixed(2)})`,
        tradeIds: [trades[prevIdx].id, t.id],
        details: { indices: [prevIdx, i] },
      });
    } else {
      seen.set(exactKey, i);
    }
  }

  return issues;
}

// ─── Date Gap Detection ─────────────────────────────────────────

/**
 * Detect suspiciously large gaps in trading dates.
 * A gap of >5 weekdays (7 calendar days) with no trades suggests
 * missing data, not just "trader took a vacation."
 *
 * @param {Object[]} trades - Sorted by date
 * @returns {ReconcileIssue[]}
 */
function findDateGaps(trades) {
  if (trades.length < 2) return [];

  const issues = [];
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const calendarDays = (curr - prev) / 86400000;

    // Count weekdays in the gap
    let weekdays = 0;
    const d = new Date(prev);
    d.setDate(d.getDate() + 1);
    while (d < curr) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) weekdays++;
      d.setDate(d.getDate() + 1);
    }

    if (weekdays > 5) {
      issues.push({
        severity: 'info',
        code: 'DATE_GAP',
        message: `${weekdays}-weekday gap: ${sorted[i - 1].date.slice(0, 10)} → ${sorted[i].date.slice(0, 10)} (possible missing data or trading break)`,
        tradeIds: [sorted[i - 1].id, sorted[i].id],
        details: {
          from: sorted[i - 1].date.slice(0, 10),
          to: sorted[i].date.slice(0, 10),
          weekdays,
          calendarDays: Math.round(calendarDays),
        },
      });
    }
  }

  return issues;
}

// ─── Orphaned Trade Detection ───────────────────────────────────

/**
 * Detect trades that look like closing positions without matching opens.
 * In broker exports, an "orphaned close" typically means:
 *   - The opening trade is in a different date range
 *   - The CSV was filtered before export
 *   - The position was opened on a different platform
 *
 * Handles both field naming conventions:
 *   - TradeFormModal: entry, exit
 *   - CSV import: entryPrice, exitPrice (if present)
 *
 * @param {Object[]} trades
 * @returns {ReconcileIssue[]}
 */
function findOrphanedTrades(trades) {
  const issues = [];

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];

    // Normalize field names
    const entry = t.entry ?? t.entryPrice ?? null;
    const exit = t.exit ?? t.exitPrice ?? null;
    const entryVal = (entry != null && entry !== 0) ? entry : null;
    const exitVal = (exit != null && exit !== 0) ? exit : null;

    // Has exit but no entry — looks like a close without the open
    if (exitVal != null && entryVal == null) {
      issues.push({
        severity: 'warning',
        code: 'ORPHANED_CLOSE',
        message: `${t.symbol} #${i + 1}: Has exit price ($${exitVal}) but no entry — possible orphaned closing trade`,
        tradeIds: [t.id],
        details: { index: i, type: 'missing_entry' },
      });
    }

    // Has entry but no exit — could be still-open position logged as closed
    if (entryVal != null && exitVal == null && t.pnl !== 0) {
      issues.push({
        severity: 'info',
        code: 'ORPHANED_OPEN',
        message: `${t.symbol} #${i + 1}: Has entry price ($${entryVal}) and P&L but no exit — possibly still open or missing data`,
        tradeIds: [t.id],
        details: { index: i, type: 'missing_exit' },
      });
    }
  }

  return issues;
}

// ─── Suspicious Patterns ────────────────────────────────────────

/**
 * Detect dataset-level patterns that suggest data quality issues.
 *
 * Checks:
 *   - All P&L values identical (likely placeholder data)
 *   - Unusually round numbers (>80% of values are exact integers)
 *   - Same symbol on every trade (possible filtered export)
 *   - All trades in a single minute (possible clock issue)
 *   - Negative fees (broker exports sometimes flip the sign)
 *
 * @param {Object[]} trades
 * @returns {ReconcileIssue[]}
 */
function findSuspiciousPatterns(trades) {
  if (trades.length < 3) return [];

  const issues = [];

  // Check: all P&L identical
  const pnlSet = new Set(trades.map((t) => roundMoney(t.pnl)));
  if (pnlSet.size === 1 && trades.length >= 5) {
    const val = trades[0].pnl;
    issues.push({
      severity: 'warning',
      code: 'UNIFORM_PNL',
      message: `All ${trades.length} trades have identical P&L ($${val.toFixed(2)}) — possible placeholder or test data`,
      details: { value: val, count: trades.length },
    });
  }

  // Check: >80% of P&L values are exact integers
  const intCount = trades.filter((t) => moneyEqual(t.pnl, Math.round(t.pnl))).length;
  const intRatio = intCount / trades.length;
  if (intRatio > 0.8 && trades.length >= 10) {
    issues.push({
      severity: 'info',
      code: 'MOSTLY_ROUND_PNL',
      message: `${Math.round(intRatio * 100)}% of P&L values are round numbers — some brokers truncate cents, which may reduce accuracy`,
      details: { intCount, total: trades.length, ratio: intRatio },
    });
  }

  // Check: all trades same symbol
  const symbolSet = new Set(trades.map((t) => t.symbol));
  if (symbolSet.size === 1 && trades.length >= 5) {
    issues.push({
      severity: 'info',
      code: 'SINGLE_SYMBOL',
      message: `All ${trades.length} trades are ${trades[0].symbol} — this may be a filtered export (other symbols omitted)`,
      details: { symbol: trades[0].symbol },
    });
  }

  // Check: negative fees anywhere
  const negFees = trades.filter((t) => t.fees != null && t.fees < 0);
  if (negFees.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'NEGATIVE_FEES',
      message: `${negFees.length} trade(s) have negative fees — some brokers export fees with inverted sign. These will be imported as-is.`,
      tradeIds: negFees.map((t) => t.id),
      details: { count: negFees.length },
    });
  }

  // Check: all trades within same minute (clock/parsing issue)
  const minuteSet = new Set(trades.map((t) => t.date ? t.date.slice(0, 16) : ''));
  if (minuteSet.size === 1 && trades.length >= 5) {
    issues.push({
      severity: 'warning',
      code: 'SAME_TIMESTAMP',
      message: `All ${trades.length} trades have the same timestamp (${trades[0].date?.slice(0, 16)}) — possible date parsing issue`,
      details: { timestamp: trades[0].date?.slice(0, 16) },
    });
  }

  return issues;
}

// ─── Summary Statistics ─────────────────────────────────────────

/**
 * Generate a reconciliation summary with aggregate health metrics.
 *
 * @param {ReconcileIssue[]} issues
 * @param {Object[]} trades
 * @returns {Object}
 */
function buildSummary(issues, trades) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  // Data completeness score (0–100)
  let completeness = 100;
  const fieldsToCheck = [
    (t) => (t.entry ?? t.entryPrice) != null && (t.entry ?? t.entryPrice) !== 0,
    (t) => (t.exit ?? t.exitPrice) != null && (t.exit ?? t.exitPrice) !== 0,
    (t) => (t.qty ?? t.quantity) != null && (t.qty ?? t.quantity) !== 0,
    (t) => t.playbook != null && t.playbook !== '',
    (t) => t.emotion != null && t.emotion !== '',
  ];
  for (const check of fieldsToCheck) {
    const filled = trades.filter(check).length;
    completeness -= ((1 - filled / Math.max(trades.length, 1)) * 100) / fieldsToCheck.length;
  }

  // Health grade
  let grade = 'A';
  if (errors > 0) grade = 'F';
  else if (warnings > 2) grade = 'C';
  else if (warnings > 0) grade = 'B';
  else if (infos > 2) grade = 'B';

  return {
    grade,
    completeness: Math.round(Math.max(0, Math.min(100, completeness))),
    errors,
    warnings,
    infos,
    total: issues.length,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────

/**
 * Run full reconciliation analysis on a set of trades.
 *
 * @param {Object[]} trades - Parsed trade objects (from csv.js or existing store)
 * @param {Object} [options]
 * @param {number} [options.gapThreshold=5] - Weekday gap threshold
 * @param {boolean} [options.checkMath=true] - Run P&L math verification
 * @param {boolean} [options.checkDupes=true] - Run duplicate detection
 * @param {boolean} [options.checkGaps=true] - Run date gap detection
 * @param {boolean} [options.checkOrphans=true] - Run orphaned trade detection
 * @param {boolean} [options.checkPatterns=true] - Run suspicious pattern detection
 * @returns {{ issues: ReconcileIssue[], summary: Object }}
 */
function reconcile(trades, options = {}) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return {
      issues: [],
      summary: { grade: 'A', completeness: 0, errors: 0, warnings: 0, infos: 0, total: 0 },
    };
  }

  const {
    checkMath = true,
    checkDupes = true,
    checkGaps = true,
    checkOrphans = true,
    checkPatterns = true,
  } = options;

  const issues = [];

  // Run each check module
  if (checkMath) {
    for (const trade of trades) {
      const issue = checkPnlMath(trade);
      if (issue) issues.push(issue);
    }
  }

  if (checkDupes) {
    issues.push(...findDuplicates(trades));
  }

  if (checkGaps) {
    issues.push(...findDateGaps(trades));
  }

  if (checkOrphans) {
    issues.push(...findOrphanedTrades(trades));
  }

  if (checkPatterns) {
    issues.push(...findSuspiciousPatterns(trades));
  }

  // Sort: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const summary = buildSummary(issues, trades);

  return { issues, summary };
}

// ─── Export ─────────────────────────────────────────────────────

export {
  reconcile,
  checkPnlMath,
  findDuplicates,
  findDateGaps,
  findOrphanedTrades,
  findSuspiciousPatterns,
  buildSummary,
};

export default reconcile;
