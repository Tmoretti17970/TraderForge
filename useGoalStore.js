// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Goal Tracking Store (Sprint 4.7)
//
// Set financial goals (daily, weekly, monthly, yearly) and track
// progress against them. Persisted to localStorage.
//
// Usage:
//   const goals = useGoalStore(s => s.goals);
//   const setGoal = useGoalStore(s => s.setGoal);
//   setGoal('monthly', 5000);
//   const progress = useGoalStore(s => s.getProgress(trades));
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useGoalStore = create(
  persist(
    (set, get) => ({
      goals: {
        daily:   { target: 0, enabled: false },
        weekly:  { target: 0, enabled: false },
        monthly: { target: 0, enabled: false },
        yearly:  { target: 0, enabled: false },
      },

      // Max daily loss limit (risk management)
      dailyLossLimit: 0,
      dailyLossEnabled: false,

      // Win rate target
      winRateTarget: 0,
      winRateEnabled: false,

      // Trade count target (min trades per week for consistency)
      tradeCountTarget: 0,
      tradeCountEnabled: false,

      setGoal: (period, target) => set((s) => ({
        goals: {
          ...s.goals,
          [period]: { ...s.goals[period], target: Math.max(0, target) },
        },
      })),

      toggleGoal: (period) => set((s) => ({
        goals: {
          ...s.goals,
          [period]: { ...s.goals[period], enabled: !s.goals[period].enabled },
        },
      })),

      setDailyLossLimit: (limit) => set({ dailyLossLimit: Math.max(0, limit) }),
      toggleDailyLoss: () => set((s) => ({ dailyLossEnabled: !s.dailyLossEnabled })),

      setWinRateTarget: (target) => set({ winRateTarget: Math.max(0, Math.min(100, target)) }),
      toggleWinRate: () => set((s) => ({ winRateEnabled: !s.winRateEnabled })),

      setTradeCountTarget: (target) => set({ tradeCountTarget: Math.max(0, target) }),
      toggleTradeCount: () => set((s) => ({ tradeCountEnabled: !s.tradeCountEnabled })),

      /**
       * Compute progress for all enabled goals against current trades.
       * @param {Object[]} trades - All trades from useTradeStore
       * @returns {Object} Progress object with current values + percentages
       */
      getProgress: (trades) => {
        const state = get();
        const now = new Date();
        const progress = {};

        // Helper: filter trades by date range
        const filterTrades = (start, end) =>
          (trades || []).filter(t => {
            try { const d = new Date(t.date); return d >= start && d <= end; }
            catch { return false; }
          });

        // Daily
        if (state.goals.daily.enabled && state.goals.daily.target > 0) {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const end = new Date(start); end.setHours(23, 59, 59, 999);
          const dayTrades = filterTrades(start, end);
          const pnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
          progress.daily = {
            current: pnl,
            target: state.goals.daily.target,
            pct: Math.min(100, Math.max(0, (pnl / state.goals.daily.target) * 100)),
            trades: dayTrades.length,
            hit: pnl >= state.goals.daily.target,
          };
        }

        // Weekly (Mon-Sun)
        if (state.goals.weekly.enabled && state.goals.weekly.target > 0) {
          const dayOfWeek = now.getDay();
          const start = new Date(now);
          start.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday
          start.setHours(0, 0, 0, 0);
          const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
          const weekTrades = filterTrades(start, end);
          const pnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
          progress.weekly = {
            current: pnl,
            target: state.goals.weekly.target,
            pct: Math.min(100, Math.max(0, (pnl / state.goals.weekly.target) * 100)),
            trades: weekTrades.length,
            hit: pnl >= state.goals.weekly.target,
          };
        }

        // Monthly
        if (state.goals.monthly.enabled && state.goals.monthly.target > 0) {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          const monthTrades = filterTrades(start, end);
          const pnl = monthTrades.reduce((s, t) => s + (t.pnl || 0), 0);
          progress.monthly = {
            current: pnl,
            target: state.goals.monthly.target,
            pct: Math.min(100, Math.max(0, (pnl / state.goals.monthly.target) * 100)),
            trades: monthTrades.length,
            hit: pnl >= state.goals.monthly.target,
          };
        }

        // Yearly
        if (state.goals.yearly.enabled && state.goals.yearly.target > 0) {
          const start = new Date(now.getFullYear(), 0, 1);
          const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          const yearTrades = filterTrades(start, end);
          const pnl = yearTrades.reduce((s, t) => s + (t.pnl || 0), 0);
          progress.yearly = {
            current: pnl,
            target: state.goals.yearly.target,
            pct: Math.min(100, Math.max(0, (pnl / state.goals.yearly.target) * 100)),
            trades: yearTrades.length,
            hit: pnl >= state.goals.yearly.target,
          };
        }

        // Daily loss limit
        if (state.dailyLossEnabled && state.dailyLossLimit > 0) {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const end = new Date(start); end.setHours(23, 59, 59, 999);
          const dayTrades = filterTrades(start, end);
          const pnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
          progress.dailyLoss = {
            current: Math.min(0, pnl),
            limit: -state.dailyLossLimit,
            pct: pnl < 0 ? Math.min(100, (Math.abs(pnl) / state.dailyLossLimit) * 100) : 0,
            breached: pnl <= -state.dailyLossLimit,
          };
        }

        // Win rate
        if (state.winRateEnabled && state.winRateTarget > 0) {
          const recentTrades = (trades || []).slice(-50); // Last 50 trades
          const wins = recentTrades.filter(t => (t.pnl || 0) > 0).length;
          const wr = recentTrades.length > 0 ? (wins / recentTrades.length) * 100 : 0;
          progress.winRate = {
            current: wr,
            target: state.winRateTarget,
            pct: Math.min(100, (wr / state.winRateTarget) * 100),
            hit: wr >= state.winRateTarget,
            sampleSize: recentTrades.length,
          };
        }

        return progress;
      },
    }),
    { name: 'tradeforge-goals' }
  )
);

export { useGoalStore };
export default useGoalStore;
