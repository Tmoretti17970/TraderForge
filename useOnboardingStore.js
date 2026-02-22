// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Onboarding Store (Zustand)
//
// Tracks: wizard completion, dismissed tooltip IDs, feature discovery.
// Persisted to IndexedDB via AppBoot alongside other stores.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const DEFAULTS = {
  wizardComplete: false,
  wizardStep: 0,
  dismissedTips: [],  // array of tip IDs the user has closed
  discoveredFeatures: [], // features the user has interacted with
};

const useOnboardingStore = create((set, get) => ({
  ...DEFAULTS,

  // Wizard
  setWizardStep: (step) => set({ wizardStep: step }),
  completeWizard: () => set({ wizardComplete: true, wizardStep: -1 }),
  resetWizard: () => set({ wizardComplete: false, wizardStep: 0 }),

  // Tips
  dismissTip: (tipId) => set((s) => ({
    dismissedTips: [...new Set([...s.dismissedTips, tipId])],
  })),
  isTipDismissed: (tipId) => get().dismissedTips.includes(tipId),
  resetTips: () => set({ dismissedTips: [] }),

  // Feature discovery
  markDiscovered: (featureId) => set((s) => ({
    discoveredFeatures: [...new Set([...s.discoveredFeatures, featureId])],
  })),
  isDiscovered: (featureId) => get().discoveredFeatures.includes(featureId),

  // Persistence
  hydrate: (saved = {}) => set({ ...DEFAULTS, ...saved }),
  toJSON: () => {
    const { wizardComplete, dismissedTips, discoveredFeatures } = get();
    return { wizardComplete, dismissedTips, discoveredFeatures };
  },
}));

export { useOnboardingStore };
export default useOnboardingStore;
