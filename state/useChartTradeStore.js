// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.6 — Chart Trade Store
// Sprint 10 C10.1: State for chart-based trade entry workflow.
//
// Manages: pending trade (entry/SL/TP), risk params, position sizing,
// active trade mode, R:R calculation.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useChartTradeStore = create(
  persist(
    (set, get) => ({
      // ─── Trade Entry Mode ─────────────────────────────────
      tradeMode: false,        // Whether trade entry tool is active
      tradeStep: 'idle',       // 'idle' | 'entry' | 'sl' | 'tp' | 'ready'
      tradeSide: 'long',       // 'long' | 'short'

      // ─── Pending Trade Levels ─────────────────────────────
      pendingEntry: null,      // { price, barIdx }
      pendingSL: null,         // { price, barIdx }
      pendingTP: null,         // { price, barIdx }

      // ─── Risk Parameters (persisted) ──────────────────────
      accountSize: 25000,
      riskPercent: 1,          // % of account per trade
      riskAmount: 250,         // $ risk (auto-calculated or manual)
      riskMode: 'percent',     // 'percent' | 'fixed'

      // ─── Position Sizer ───────────────────────────────────
      showPositionSizer: false,

      // ─── Quick Journal ────────────────────────────────────
      showQuickJournal: false,

      // ─── Context Menu ─────────────────────────────────────
      contextMenu: null,       // { x, y, price, barIdx } or null

      // ═══ Actions ══════════════════════════════════════════

      // ─── Trade Mode ───────────────────────────────────────
      enterTradeMode: (side = 'long') => set({
        tradeMode: true,
        tradeStep: 'entry',
        tradeSide: side,
        pendingEntry: null,
        pendingSL: null,
        pendingTP: null,
      }),

      exitTradeMode: () => set({
        tradeMode: false,
        tradeStep: 'idle',
        pendingEntry: null,
        pendingSL: null,
        pendingTP: null,
        contextMenu: null,
      }),

      setTradeSide: (side) => set({ tradeSide: side }),

      // ─── Level Setting ────────────────────────────────────
      setEntry: (price, barIdx) => set((s) => ({
        pendingEntry: { price, barIdx },
        tradeStep: 'sl',
      })),

      setSL: (price, barIdx) => set((s) => ({
        pendingSL: { price, barIdx },
        tradeStep: 'tp',
      })),

      setTP: (price, barIdx) => set((s) => ({
        pendingTP: { price, barIdx },
        tradeStep: 'ready',
      })),

      updateLevel: (level, price) => set((s) => {
        if (level === 'entry') return { pendingEntry: { ...s.pendingEntry, price } };
        if (level === 'sl') return { pendingSL: { ...s.pendingSL, price } };
        if (level === 'tp') return { pendingTP: { ...s.pendingTP, price } };
        return {};
      }),

      // ─── Risk Params ──────────────────────────────────────
      setAccountSize: (v) => set((s) => {
        const riskAmount = s.riskMode === 'percent' ? (v * s.riskPercent) / 100 : s.riskAmount;
        return { accountSize: v, riskAmount };
      }),

      setRiskPercent: (v) => set((s) => ({
        riskPercent: v,
        riskAmount: (s.accountSize * v) / 100,
        riskMode: 'percent',
      })),

      setRiskAmount: (v) => set((s) => ({
        riskAmount: v,
        riskPercent: s.accountSize > 0 ? (v / s.accountSize) * 100 : 1,
        riskMode: 'fixed',
      })),

      setRiskMode: (mode) => set({ riskMode: mode }),

      // ─── UI Toggles ──────────────────────────────────────
      togglePositionSizer: () => set((s) => ({ showPositionSizer: !s.showPositionSizer })),
      toggleQuickJournal: () => set((s) => ({ showQuickJournal: !s.showQuickJournal })),
      setContextMenu: (menu) => set({ contextMenu: menu }),
      closeContextMenu: () => set({ contextMenu: null }),
    }),
    {
      name: 'tradeforge-chart-trade',
      version: 1,
      partialize: (state) => ({
        accountSize: state.accountSize,
        riskPercent: state.riskPercent,
        riskAmount: state.riskAmount,
        riskMode: state.riskMode,
      }),
    }
  )
);

// ═══════════════════════════════════════════════════════════════════
// Pure calculation helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate risk/reward metrics from pending trade levels.
 */
export function calcRiskReward(entry, sl, tp, side) {
  if (!entry || !sl) return null;

  const riskPerShare = Math.abs(entry - sl);
  if (riskPerShare === 0) return null;

  const rewardPerShare = tp ? Math.abs(tp - entry) : 0;
  const rr = rewardPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  // Validate: SL should be below entry for long, above for short
  const slValid = side === 'long' ? sl < entry : sl > entry;
  const tpValid = !tp || (side === 'long' ? tp > entry : tp < entry);

  return {
    riskPerShare,
    rewardPerShare,
    rr: Math.round(rr * 100) / 100,
    slValid,
    tpValid,
    breakeven: entry,
  };
}

/**
 * Calculate position size from risk parameters.
 */
export function calcPositionSize(riskAmount, entry, sl) {
  if (!riskAmount || !entry || !sl) return null;
  const riskPerShare = Math.abs(entry - sl);
  if (riskPerShare === 0) return null;

  const shares = Math.floor(riskAmount / riskPerShare);
  const actualRisk = shares * riskPerShare;
  const notional = shares * entry;

  return {
    shares,
    actualRisk: Math.round(actualRisk * 100) / 100,
    notional: Math.round(notional * 100) / 100,
    riskPerShare: Math.round(riskPerShare * 100) / 100,
  };
}
