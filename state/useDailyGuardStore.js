// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Daily Loss Guard
//
// Monitors today's realized P&L against the configured daily loss
// limit. When the limit is breached, triggers a soft lockout:
//   - Warning banner displayed across the app
//   - Toast notification fired
//   - Trade form shows confirmation dialog
//   - Trade entry NOT blocked (soft lock, not hard lock)
//
// The guard is purely reactive — it watches trade data and settings,
// never blocks operations, only warns and logs.
//
// States:
//   'ok'      — P&L within limits (or no limit set)
//   'warning' — P&L approaching limit (>75% consumed)
//   'locked'  — Daily loss limit breached
//
// Usage:
//   const { status, todayPnl, remaining, pctUsed } = useDailyGuard();
//   // status === 'locked' → show banner
//   // status === 'warning' → show caution
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

// ─── Pure computation (no store deps) ───────────────────────────

/**
 * Calculate today's realized P&L from trades.
 * @param {Array} trades - All trades
 * @returns {{ todayPnl: number, todayCount: number, todayWins: number, todayLosses: number }}
 */
function computeTodayPnl(trades) {
  const todayKey = new Date().toISOString().slice(0, 10);
  let todayPnl = 0;
  let todayCount = 0;
  let todayWins = 0;
  let todayLosses = 0;

  for (const t of trades) {
    if (!t.date || !t.date.startsWith(todayKey)) continue;
    const pnl = t.pnl || 0;
    todayPnl += pnl;
    todayCount++;
    if (pnl > 0) todayWins++;
    else if (pnl < 0) todayLosses++;
  }

  return { todayPnl, todayCount, todayWins, todayLosses };
}

/**
 * Evaluate guard status against limit.
 * @param {number} todayPnl - Today's realized P&L (negative = loss)
 * @param {number} dailyLossLimit - Configured limit (positive number, e.g. 500 = -$500 max loss)
 * @param {number} warningThreshold - Percentage of limit that triggers warning (0-1, default 0.75)
 * @returns {{ status: 'ok'|'warning'|'locked', remaining: number, pctUsed: number }}
 */
function evaluateGuard(todayPnl, dailyLossLimit, warningThreshold = 0.75) {
  // No limit set → always OK
  if (!dailyLossLimit || dailyLossLimit <= 0) {
    return { status: 'ok', remaining: Infinity, pctUsed: 0 };
  }

  // Loss is negative, limit is positive. Compare absolute values.
  const lossAmount = Math.max(0, -todayPnl); // How much we've lost (positive)
  const remaining = dailyLossLimit - lossAmount;
  const pctUsed = lossAmount / dailyLossLimit;

  if (lossAmount >= dailyLossLimit) {
    return { status: 'locked', remaining: Math.min(0, remaining), pctUsed: Math.min(1, pctUsed) };
  }

  if (pctUsed >= warningThreshold) {
    return { status: 'warning', remaining, pctUsed };
  }

  return { status: 'ok', remaining, pctUsed };
}

/**
 * Format guard status into a human-readable message.
 * @param {{ status, todayPnl, remaining, pctUsed, dailyLossLimit }} guard
 * @returns {{ message: string, severity: 'info'|'warning'|'error' }}
 */
function formatGuardMessage(guard) {
  if (guard.status === 'locked') {
    return {
      message: `Daily loss limit hit — ${fmtMoney(Math.abs(guard.todayPnl))} lost today (limit: ${fmtMoney(guard.dailyLossLimit)})`,
      severity: 'error',
    };
  }

  if (guard.status === 'warning') {
    const pct = Math.round(guard.pctUsed * 100);
    return {
      message: `${pct}% of daily loss limit used — ${fmtMoney(guard.remaining)} remaining`,
      severity: 'warning',
    };
  }

  return { message: '', severity: 'info' };
}

/** Simple money formatter. */
function fmtMoney(v) {
  return '$' + Math.abs(v).toFixed(0);
}

// ─── Guard Store ────────────────────────────────────────────────

const useDailyGuardStore = create((set) => ({
  status: 'ok',
  todayPnl: 0,
  todayCount: 0,
  todayWins: 0,
  todayLosses: 0,
  remaining: Infinity,
  pctUsed: 0,
  dailyLossLimit: 0,
  lastEvaluated: 0,
  overrideActive: false, // user explicitly dismissed the lock for this session

  /**
   * Recalculate guard state from trades + settings.
   * @param {Array} trades
   * @param {number} dailyLossLimit
   */
  evaluate: (trades, dailyLossLimit) => {
    const today = computeTodayPnl(trades);
    const guard = evaluateGuard(today.todayPnl, dailyLossLimit);

    set({
      ...today,
      ...guard,
      dailyLossLimit,
      lastEvaluated: Date.now(),
    });
  },

  /** User explicitly overrides the lockout for this session. */
  override: () => set({ overrideActive: true }),

  /** Reset override (new day or settings change). */
  clearOverride: () => set({ overrideActive: false }),
}));

// ─── DailyGuardBanner Component Props Builder ──────────────────

/**
 * Build props for the daily guard banner display.
 * @param {Object} state - useDailyGuardStore state
 * @returns {{ show: boolean, type: 'warning'|'error', message: string, canOverride: boolean }}
 */
function bannerProps(state) {
  if (state.status === 'ok') {
    return { show: false, type: 'info', message: '', canOverride: false };
  }

  if (state.status === 'locked' && !state.overrideActive) {
    const msg = formatGuardMessage({
      status: state.status,
      todayPnl: state.todayPnl,
      remaining: state.remaining,
      pctUsed: state.pctUsed,
      dailyLossLimit: state.dailyLossLimit,
    });
    return { show: true, type: 'error', message: msg.message, canOverride: true };
  }

  if (state.status === 'warning') {
    const msg = formatGuardMessage({
      status: state.status,
      todayPnl: state.todayPnl,
      remaining: state.remaining,
      pctUsed: state.pctUsed,
      dailyLossLimit: state.dailyLossLimit,
    });
    return { show: true, type: 'warning', message: msg.message, canOverride: false };
  }

  return { show: false, type: 'info', message: '', canOverride: false };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  useDailyGuardStore,
  computeTodayPnl,
  evaluateGuard,
  formatGuardMessage,
  bannerProps,
};
export default useDailyGuardStore;
