// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Result Store (Zustand)
// Holds the computed analytics result from AnalyticsBridge.
// Dashboard and Analytics pages both consume this single result.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const useAnalyticsStore = create((set) => ({
  // Computed result (output of computeFast)
  result: null,

  // Computation metadata
  computing: false,
  lastComputeMs: 0,
  mode: 'sync', // 'sync' | 'worker'
  error: null,

  // Version counter — increments on each new result
  version: 0,

  // Actions
  setComputing: () => set({ computing: true, error: null }),

  setResult: (data, ms, mode) =>
    set((s) => ({
      result: data,
      computing: false,
      lastComputeMs: ms,
      mode,
      error: null,
      version: s.version + 1,
    })),

  setError: (error) => set({ error, computing: false }),

  clear: () =>
    set({
      result: null,
      computing: false,
      lastComputeMs: 0,
      error: null,
      version: 0,
    }),
}));

export { useAnalyticsStore };
export default useAnalyticsStore;
