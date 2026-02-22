// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Settings Store (Zustand)
// Manages: daily loss limit, default symbol/TF, account size, risk
// Persisted to IndexedDB via AppBoot auto-save
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../constants.js';

const useSettingsStore = create((set) => ({
  ...DEFAULT_SETTINGS,

  update: (updates) => set((s) => ({ ...s, ...updates })),

  hydrate: (saved = {}) => set({ ...DEFAULT_SETTINGS, ...saved }),

  reset: () => set({ ...DEFAULT_SETTINGS }),
}));

export { useSettingsStore };
export default useSettingsStore;
