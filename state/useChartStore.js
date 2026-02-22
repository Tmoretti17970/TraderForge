// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — Chart Store (Zustand)
// Updated for Sprint 1-5 chart engine integration.
//
// Changes from v10:
//   - chartType values match engine: 'candlestick'|'hollow'|'heikinashi'|'ohlc'|'line'|'area'|'baseline'
//   - indicators use registry format: { indicatorId, params, color, visible }
//   - drawings managed by DrawingEngine (removed from store)
//   - added: theme sync, scaleMode, volumeRatio
//   - backward compat: old indicator format {type, params, color} still works
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const useChartStore = create((set, get) => ({
  // ─── Core ──────────────────────────────────────────────────
  symbol: 'BTC',
  tf: '1h',
  chartType: 'candlestick', // 'candlestick'|'hollow'|'heikinashi'|'ohlc'|'line'|'area'|'baseline'
  scaleMode: 'linear',      // 'linear'|'log'|'percentage'
  logScale: false,           // Legacy compat — synced with scaleMode

  // ─── Data ──────────────────────────────────────────────────
  data: null,
  source: null,
  loading: false,

  // ─── Indicators ────────────────────────────────────────────
  // Format: { indicatorId: string, params: {}, color?: string, visible: boolean }
  // Also accepts legacy: { type: string, params: {}, color: string }
  indicators: [
    { indicatorId: 'sma', params: { period: 20 }, color: '#f59e0b', visible: true },
    { indicatorId: 'ema', params: { period: 50 }, color: '#a855f7', visible: true },
  ],

  // ─── Drawing Tools ─────────────────────────────────────────
  // Drawing state is now managed by DrawingEngine (Sprint 4).
  // These fields remain for toolbar state only.
  activeTool: null,
  magnetMode: false,
  selectedDrawingId: null,

  // ─── Multi-Chart ───────────────────────────────────────────
  quadMode: false,
  quadSymbols: ['BTC', 'ETH', 'SOL', 'BNB'],

  // ─── Replay ────────────────────────────────────────────────
  replayMode: false,
  replayIdx: 0,
  replayPlaying: false,
  backtestTrades: [],

  // ─── Comparison ────────────────────────────────────────────
  comparisonSymbol: null,
  comparisonData: null,

  // ─── Intelligence Layer ────────────────────────────────────
  intelligence: {
    enabled: true,
    showSR: true,
    showPatterns: true,
    showDivergences: true,
    showAutoFib: false,
  },

  // ─── Volume ────────────────────────────────────────────────
  showVolume: true,
  showVolumeProfile: false,

  // ─── Display ───────────────────────────────────────────────
  orderFlow: false,
  multiTfOverlay: null,
  activeGhost: null,

  // ═══ Actions ════════════════════════════════════════════════

  setSymbol: (symbol) => set({ symbol: symbol.toUpperCase() }),
  setTf: (tf) => set({ tf }),
  setChartType: (chartType) => set({ chartType }),
  setScaleMode: (mode) => set({ scaleMode: mode, logScale: mode === 'log' }),

  // Legacy compat
  setCandleMode: (mode) => {
    const map = { standard: 'candlestick', hollow: 'hollow', heikinashi: 'heikinashi' };
    set({ chartType: map[mode] || 'candlestick' });
  },
  toggleLogScale: () => set((s) => {
    const newLog = !s.logScale;
    return { logScale: newLog, scaleMode: newLog ? 'log' : 'linear' };
  }),

  // ─── Indicators ────────────────────────────────────────────
  addIndicator: (ind) => {
    // Normalize: accept both {type, params, color} and {indicatorId, params}
    const normalized = {
      indicatorId: ind.indicatorId || ind.type,
      params: ind.params || {},
      color: ind.color,
      visible: ind.visible !== false,
    };
    set((s) => ({ indicators: [...s.indicators, normalized] }));
  },

  removeIndicator: (idx) =>
    set((s) => ({ indicators: s.indicators.filter((_, i) => i !== idx) })),

  updateIndicator: (idx, updates) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) => (i === idx ? { ...ind, ...updates } : ind)),
    })),

  toggleIndicatorVisibility: (idx) =>
    set((s) => ({
      indicators: s.indicators.map((ind, i) =>
        i === idx ? { ...ind, visible: !ind.visible } : ind
      ),
    })),

  setIndicators: (indicators) => set({ indicators: indicators || [] }),

  // ─── Data ──────────────────────────────────────────────────
  setData: (data, source) => set({ data, source, loading: false }),
  setLoading: (loading) => set({ loading }),

  // ─── Drawing Tools ─────────────────────────────────────────
  setActiveTool: (tool) => set({ activeTool: tool }),
  toggleMagnetMode: () => set((s) => ({ magnetMode: !s.magnetMode })),
  setSelectedDrawing: (id) => set({ selectedDrawingId: id }),

  // ─── Multi-Chart ───────────────────────────────────────────
  toggleQuadMode: () => set((s) => ({ quadMode: !s.quadMode })),
  setQuadSymbols: (syms) => set({ quadSymbols: syms }),
  toggleOrderFlow: () => set((s) => ({ orderFlow: !s.orderFlow })),

  // ─── Replay ────────────────────────────────────────────────
  toggleReplay: () => set((s) => ({ replayMode: !s.replayMode, replayIdx: 0, replayPlaying: false })),
  setReplayIdx: (idx) => set({ replayIdx: idx }),
  setReplayPlaying: (v) => set({ replayPlaying: v }),
  addBacktestTrade: (t) => set((s) => ({ backtestTrades: [...s.backtestTrades, t] })),
  clearBacktestTrades: () => set({ backtestTrades: [] }),

  // ─── Intelligence ──────────────────────────────────────────
  setIntelligence: (key, val) =>
    set((s) => ({ intelligence: { ...s.intelligence, [key]: val } })),
  toggleIntelligence: (key) =>
    set((s) => ({ intelligence: { ...s.intelligence, [key]: !s.intelligence[key] } })),
  toggleIntelligenceMaster: () =>
    set((s) => ({ intelligence: { ...s.intelligence, enabled: !s.intelligence.enabled } })),

  // ─── Volume ────────────────────────────────────────────────
  toggleVolume: () => set((s) => ({ showVolume: !s.showVolume })),
  toggleVolumeProfile: () => set((s) => ({ showVolumeProfile: !s.showVolumeProfile })),

  // ─── Comparison ────────────────────────────────────────────
  setComparison: (symbol, data) => set({ comparisonSymbol: symbol, comparisonData: data }),
  clearComparison: () => set({ comparisonSymbol: null, comparisonData: null }),
}));

export { useChartStore };
export default useChartStore;
