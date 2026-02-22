// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — UI Store (Zustand)
// Manages: page navigation, modals, zen mode, command palette
// Transient — not persisted to IndexedDB
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const useUIStore = create((set) => ({
  page: 'dashboard',
  modal: null,
  confirmDialog: null,
  zenMode: false,
  cmdPaletteOpen: false,
  shortcutsOpen: false,
  quickTradeOpen: false,

  setPage: (page) => set({ page }),
  openModal: (data) => set({ modal: data }),
  closeModal: () => set({ modal: null }),
  openConfirm: (data) => set({ confirmDialog: data }),
  closeConfirm: () => set({ confirmDialog: null }),
  toggleZen: () => set((s) => ({ zenMode: !s.zenMode })),
  toggleCmdPalette: () => set((s) => ({ cmdPaletteOpen: !s.cmdPaletteOpen })),
  closeCmdPalette: () => set({ cmdPaletteOpen: false }),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  closeShortcuts: () => set({ shortcutsOpen: false }),
  openQuickTrade: () => set({ quickTradeOpen: true }),
  closeQuickTrade: () => set({ quickTradeOpen: false }),
  closeAll: () =>
    set({
      modal: null,
      confirmDialog: null,
      cmdPaletteOpen: false,
      shortcutsOpen: false,
      quickTradeOpen: false,
    }),
}));

export { useUIStore };
export default useUIStore;
