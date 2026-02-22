// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Prop Firm Store (Sprint 5)
//
// P1.1: Configuration store for prop firm evaluation tracking.
// P1.3: Trailing drawdown calculator (prop firm formula).
//
// Presets: FTMO, Topstep, Apex, MyFundedFX
// Persisted via localStorage.
//
// Schema:
//   profile: {
//     id: string,
//     name: string,              // "FTMO 100K Challenge"
//     firmId: string,            // 'ftmo' | 'topstep' | 'apex' | 'myfundedfx' | 'custom'
//     accountSize: number,       // Starting balance ($)
//     dailyLossLimit: number,    // Max daily loss ($ or % based on dailyLossType)
//     dailyLossType: 'pct'|'abs',
//     maxDrawdown: number,       // Max trailing drawdown ($ or %)
//     maxDrawdownType: 'pct'|'abs',
//     profitTarget: number,      // Target to pass ($ or %)
//     profitTargetType: 'pct'|'abs',
//     evaluationDays: number,    // Max calendar days (0 = unlimited)
//     minTradingDays: number,    // Minimum active trading days required
//     startDate: ISO string,     // When evaluation started
//     trailingDD: boolean,       // true = DD trails from equity high (most prop firms)
//     rules: string[],           // Extra rules: 'no_weekend_hold', 'no_news_trading', etc.
//   }
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Prop Firm Presets ────────────────────────────────────────────

const PRESETS = {
  ftmo_100k: {
    name: 'FTMO 100K Challenge',
    firmId: 'ftmo',
    accountSize: 100000,
    dailyLossLimit: 5, dailyLossType: 'pct',
    maxDrawdown: 10, maxDrawdownType: 'pct',
    profitTarget: 10, profitTargetType: 'pct',
    evaluationDays: 30,
    minTradingDays: 4,
    trailingDD: false, // FTMO uses static DD from initial balance
    rules: ['no_weekend_hold'],
  },
  ftmo_100k_v: {
    name: 'FTMO 100K Verification',
    firmId: 'ftmo',
    accountSize: 100000,
    dailyLossLimit: 5, dailyLossType: 'pct',
    maxDrawdown: 10, maxDrawdownType: 'pct',
    profitTarget: 5, profitTargetType: 'pct',
    evaluationDays: 60,
    minTradingDays: 4,
    trailingDD: false,
    rules: ['no_weekend_hold'],
  },
  ftmo_50k: {
    name: 'FTMO 50K Challenge',
    firmId: 'ftmo',
    accountSize: 50000,
    dailyLossLimit: 5, dailyLossType: 'pct',
    maxDrawdown: 10, maxDrawdownType: 'pct',
    profitTarget: 10, profitTargetType: 'pct',
    evaluationDays: 30,
    minTradingDays: 4,
    trailingDD: false,
    rules: ['no_weekend_hold'],
  },
  topstep_50k: {
    name: 'Topstep 50K',
    firmId: 'topstep',
    accountSize: 50000,
    dailyLossLimit: 1000, dailyLossType: 'abs',
    maxDrawdown: 2000, maxDrawdownType: 'abs',
    profitTarget: 3000, profitTargetType: 'abs',
    evaluationDays: 0, // unlimited
    minTradingDays: 5,
    trailingDD: true,  // Topstep uses trailing drawdown
    rules: ['no_news_trading'],
  },
  topstep_100k: {
    name: 'Topstep 100K',
    firmId: 'topstep',
    accountSize: 100000,
    dailyLossLimit: 2000, dailyLossType: 'abs',
    maxDrawdown: 3000, maxDrawdownType: 'abs',
    profitTarget: 6000, profitTargetType: 'abs',
    evaluationDays: 0,
    minTradingDays: 5,
    trailingDD: true,
    rules: ['no_news_trading'],
  },
  topstep_150k: {
    name: 'Topstep 150K',
    firmId: 'topstep',
    accountSize: 150000,
    dailyLossLimit: 3000, dailyLossType: 'abs',
    maxDrawdown: 4500, maxDrawdownType: 'abs',
    profitTarget: 9000, profitTargetType: 'abs',
    evaluationDays: 0,
    minTradingDays: 5,
    trailingDD: true,
    rules: ['no_news_trading'],
  },
  apex_50k: {
    name: 'Apex 50K Eval',
    firmId: 'apex',
    accountSize: 50000,
    dailyLossLimit: 0, dailyLossType: 'abs', // Apex has no daily limit
    maxDrawdown: 2500, maxDrawdownType: 'abs',
    profitTarget: 3000, profitTargetType: 'abs',
    evaluationDays: 0,
    minTradingDays: 7,
    trailingDD: true,
    rules: [],
  },
  apex_100k: {
    name: 'Apex 100K Eval',
    firmId: 'apex',
    accountSize: 100000,
    dailyLossLimit: 0, dailyLossType: 'abs',
    maxDrawdown: 3000, maxDrawdownType: 'abs',
    profitTarget: 6000, profitTargetType: 'abs',
    evaluationDays: 0,
    minTradingDays: 7,
    trailingDD: true,
    rules: [],
  },
  myfundedfx_100k: {
    name: 'MyFundedFX 100K',
    firmId: 'myfundedfx',
    accountSize: 100000,
    dailyLossLimit: 5, dailyLossType: 'pct',
    maxDrawdown: 12, maxDrawdownType: 'pct',
    profitTarget: 8, profitTargetType: 'pct',
    evaluationDays: 30,
    minTradingDays: 5,
    trailingDD: false,
    rules: ['no_weekend_hold'],
  },
};

// ─── P1.3: Trailing Drawdown Calculator ──────────────────────────

/**
 * Compute prop firm evaluation status from trades and profile.
 *
 * @param {Object[]} trades - All trades (sorted by date)
 * @param {Object} profile - Active prop firm profile
 * @returns {Object} Evaluation status
 */
function computeEvaluation(trades, profile) {
  if (!trades?.length || !profile) {
    return {
      cumPnl: 0, dailyPnl: 0, trailingDD: 0, maxTrailingDD: 0,
      equityHigh: profile?.accountSize || 0,
      currentEquity: profile?.accountSize || 0,
      daysTraded: 0, calendarDays: 0,
      dailyBreached: false, drawdownBreached: false, targetReached: false,
      status: 'active', // 'active' | 'passed' | 'failed'
      dailyPnlByDate: {},
      failReason: null,
    };
  }

  const acct = profile.accountSize || 0;
  const startDate = profile.startDate ? new Date(profile.startDate) : null;

  // Resolve limits to absolute dollar amounts
  const dailyLimitAbs = profile.dailyLossType === 'pct'
    ? acct * (profile.dailyLossLimit / 100)
    : profile.dailyLossLimit;

  const maxDDAbs = profile.maxDrawdownType === 'pct'
    ? acct * (profile.maxDrawdown / 100)
    : profile.maxDrawdown;

  const targetAbs = profile.profitTargetType === 'pct'
    ? acct * (profile.profitTarget / 100)
    : profile.profitTarget;

  // Filter trades within evaluation period
  const evalTrades = startDate
    ? trades.filter(t => t.date && new Date(t.date) >= startDate)
    : trades;

  // Daily P&L aggregation
  const dailyMap = {};
  let cumPnl = 0;

  for (const t of evalTrades) {
    const dateKey = t.date.slice(0, 10);
    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + (t.pnl || 0);
    cumPnl += (t.pnl || 0);
  }

  // Sort days chronologically
  const days = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));

  // P1.3: Trailing drawdown — tracks from equity high watermark
  let equity = acct;
  let equityHigh = acct;
  let maxTrailingDD = 0;
  let currentDD = 0;
  let dailyBreached = false;
  let drawdownBreached = false;
  let failReason = null;

  // Today's P&L
  const today = new Date().toISOString().slice(0, 10);
  const todayPnl = dailyMap[today] || 0;

  for (const [date, dayPnl] of days) {
    equity += dayPnl;

    // Trailing drawdown: measure from equity high
    if (profile.trailingDD) {
      if (equity > equityHigh) equityHigh = equity;
      currentDD = equityHigh - equity;
    } else {
      // Static drawdown: measure from account start
      currentDD = acct - equity;
    }

    if (currentDD > maxTrailingDD) maxTrailingDD = currentDD;

    // Check daily loss limit breach
    if (dailyLimitAbs > 0 && dayPnl < 0 && Math.abs(dayPnl) >= dailyLimitAbs) {
      dailyBreached = true;
      if (!failReason) failReason = `Daily loss limit breached on ${date}: ${dayPnl.toFixed(0)} vs -${dailyLimitAbs.toFixed(0)} limit`;
    }

    // Check trailing DD breach
    if (maxDDAbs > 0 && currentDD >= maxDDAbs) {
      drawdownBreached = true;
      if (!failReason) failReason = `Max drawdown breached on ${date}: $${currentDD.toFixed(0)} vs $${maxDDAbs.toFixed(0)} limit`;
    }
  }

  // Calendar days elapsed
  const calendarDays = startDate
    ? Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1
    : days.length > 0
      ? Math.floor((new Date(days[days.length - 1][0]).getTime() - new Date(days[0][0]).getTime()) / 86400000) + 1
      : 0;

  const daysTraded = days.length;
  const targetReached = targetAbs > 0 && cumPnl >= targetAbs;
  const minDaysMet = profile.minTradingDays > 0 ? daysTraded >= profile.minTradingDays : true;
  const periodExpired = profile.evaluationDays > 0 && calendarDays > profile.evaluationDays;

  // Determine status
  let status = 'active';
  if (dailyBreached || drawdownBreached) {
    status = 'failed';
  } else if (targetReached && minDaysMet) {
    status = 'passed';
  } else if (periodExpired && !targetReached) {
    status = 'failed';
    if (!failReason) failReason = `Evaluation period expired (${calendarDays}/${profile.evaluationDays} days) without reaching target`;
  }

  // Progress percentages (clamped 0-100)
  const dailyProgress = dailyLimitAbs > 0
    ? Math.min(100, Math.max(0, (Math.abs(Math.min(0, todayPnl)) / dailyLimitAbs) * 100))
    : 0;
  const ddProgress = maxDDAbs > 0
    ? Math.min(100, Math.max(0, (currentDD / maxDDAbs) * 100))
    : 0;
  const targetProgress = targetAbs > 0
    ? Math.min(100, Math.max(0, (Math.max(0, cumPnl) / targetAbs) * 100))
    : 0;

  return {
    cumPnl,
    dailyPnl: todayPnl,
    trailingDD: currentDD,
    maxTrailingDD,
    equityHigh,
    currentEquity: equity,
    daysTraded,
    calendarDays,
    dailyBreached,
    drawdownBreached,
    targetReached,
    status,
    failReason,
    dailyPnlByDate: dailyMap,
    // Progress bars (0-100)
    dailyProgress,
    ddProgress,
    targetProgress,
    // Resolved absolute limits
    dailyLimitAbs,
    maxDDAbs,
    targetAbs,
    minDaysMet,
    periodExpired,
  };
}

// ─── Store ──────────────────────────────────────────────────────

const usePropFirmStore = create(
  persist(
    (set, get) => ({
      // Active profile (null = no prop firm tracking)
      activeProfile: null,

      // All saved profiles
      profiles: [],

      // ─── Profile CRUD ──────────────────────────────────

      /** Create profile from preset ID */
      createFromPreset(presetId) {
        const preset = PRESETS[presetId];
        if (!preset) return null;

        const profile = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          ...preset,
          startDate: new Date().toISOString(),
        };

        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfile: profile,
        }));

        return profile;
      },

      /** Create custom profile */
      createCustom(config) {
        const profile = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: config.name || 'Custom Evaluation',
          firmId: 'custom',
          accountSize: config.accountSize || 100000,
          dailyLossLimit: config.dailyLossLimit || 5,
          dailyLossType: config.dailyLossType || 'pct',
          maxDrawdown: config.maxDrawdown || 10,
          maxDrawdownType: config.maxDrawdownType || 'pct',
          profitTarget: config.profitTarget || 10,
          profitTargetType: config.profitTargetType || 'pct',
          evaluationDays: config.evaluationDays || 30,
          minTradingDays: config.minTradingDays || 0,
          trailingDD: config.trailingDD ?? false,
          startDate: config.startDate || new Date().toISOString(),
          rules: config.rules || [],
        };

        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfile: profile,
        }));

        return profile;
      },

      setActive(profileId) {
        const profile = get().profiles.find(p => p.id === profileId) || null;
        set({ activeProfile: profile });
      },

      deleteProfile(profileId) {
        set((s) => ({
          profiles: s.profiles.filter(p => p.id !== profileId),
          activeProfile: s.activeProfile?.id === profileId ? null : s.activeProfile,
        }));
      },

      clearActive() {
        set({ activeProfile: null });
      },
    }),
    {
      name: 'tradeforge-propfirm',
      version: 1,
    }
  )
);

export { usePropFirmStore, computeEvaluation, PRESETS };
export default usePropFirmStore;
