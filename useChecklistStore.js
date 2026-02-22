// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Pre-Trade Checklist Store (Sprint 4.3)
//
// Configurable pre-trade checklist. Before entering a trade, traders
// must check off required items. Gamifies discipline.
//
// Default checklist:
//   ✅ Identified setup in playbook?
//   ✅ Risk defined (stop loss set)?
//   ✅ R:R ≥ 2:1?
//   ✅ Not revenge trading?
//   ✅ Within daily loss limit?
//
// Users can customize items, reorder, and toggle required/optional.
// Checklist state resets after each trade entry.
//
// Usage:
//   const items = useChecklistStore(s => s.items);
//   const checked = useChecklistStore(s => s.checked);
//   const toggle = useChecklistStore(s => s.toggleCheck);
//   const allPassed = useChecklistStore(s => s.allRequiredPassed());
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_ITEMS = [
  { id: 'setup',    label: 'Identified setup in playbook',  required: true,  emoji: '📋' },
  { id: 'risk',     label: 'Risk defined (stop loss set)',   required: true,  emoji: '🛡️' },
  { id: 'rr',       label: 'R:R ≥ 2:1',                     required: true,  emoji: '⚖️' },
  { id: 'revenge',  label: 'Not revenge trading',            required: true,  emoji: '🧘' },
  { id: 'limit',    label: 'Within daily loss limit',        required: true,  emoji: '🚫' },
  { id: 'bias',     label: 'Confirmed market bias/direction',required: false, emoji: '🧭' },
  { id: 'news',     label: 'No major news imminent',         required: false, emoji: '📰' },
];

const useChecklistStore = create(
  persist(
    (set, get) => ({
      // Template items (persist across sessions)
      items: [...DEFAULT_ITEMS],

      // Current check state (resets each trade)
      checked: {}, // { itemId: boolean }

      // Whether the checklist popup is enabled
      enabled: true,

      // ─── Check Management ─────────────────────────────
      toggleCheck: (id) => set((s) => ({
        checked: { ...s.checked, [id]: !s.checked[id] },
      })),

      checkAll: () => set((s) => {
        const newChecked = {};
        s.items.forEach(item => { newChecked[item.id] = true; });
        return { checked: newChecked };
      }),

      resetChecks: () => set({ checked: {} }),

      allRequiredPassed: () => {
        const s = get();
        return s.items
          .filter(i => i.required)
          .every(i => s.checked[i.id]);
      },

      getPassCount: () => {
        const s = get();
        const required = s.items.filter(i => i.required);
        const passed = required.filter(i => s.checked[i.id]);
        return { passed: passed.length, total: required.length };
      },

      // ─── Item Management (customize template) ─────────
      addItem: (label, required = false, emoji = '✅') => {
        const id = 'custom_' + Date.now().toString(36);
        set((s) => ({
          items: [...s.items, { id, label, required, emoji }],
        }));
      },

      removeItem: (id) => {
        set((s) => ({
          items: s.items.filter(i => i.id !== id),
          checked: { ...s.checked, [id]: undefined },
        }));
      },

      updateItem: (id, updates) => {
        set((s) => ({
          items: s.items.map(i => i.id === id ? { ...i, ...updates } : i),
        }));
      },

      reorderItems: (fromIdx, toIdx) => {
        set((s) => {
          const items = [...s.items];
          const [moved] = items.splice(fromIdx, 1);
          items.splice(toIdx, 0, moved);
          return { items };
        });
      },

      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),

      resetToDefaults: () => set({
        items: [...DEFAULT_ITEMS],
        checked: {},
      }),
    }),
    {
      name: 'tradeforge-checklist',
      partialize: (state) => ({
        items: state.items,
        enabled: state.enabled,
        // Don't persist checked state — resets each session
      }),
    }
  )
);

export { useChecklistStore, DEFAULT_ITEMS };
export default useChecklistStore;
