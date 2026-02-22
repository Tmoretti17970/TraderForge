// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.4 — Dashboard Layout Store
// Sprint 8 C8.12: Persists active widgets, order, edit mode, preset.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WIDGET_REGISTRY, DASHBOARD_PRESETS } from '../components/DashboardWidgets.jsx';

const defaultWidgets = Object.values(WIDGET_REGISTRY)
  .filter(w => w.default)
  .map(w => w.id);

export const useDashboardStore = create(
  persist(
    (set, get) => ({
      // Active widget IDs in display order
      activeWidgets: [...defaultWidgets],

      // Current preset key (null = custom)
      activePreset: 'default',

      // Edit mode toggle
      editMode: false,

      // ─── Actions ────────────────────────────────────────

      setActiveWidgets: (widgets) => set({
        activeWidgets: widgets,
        activePreset: null, // custom layout
      }),

      toggleWidget: (id) => set((s) => {
        const next = s.activeWidgets.includes(id)
          ? s.activeWidgets.filter(w => w !== id)
          : [...s.activeWidgets, id];
        return { activeWidgets: next, activePreset: null };
      }),

      reorderWidgets: (fromIdx, toIdx) => set((s) => {
        const next = [...s.activeWidgets];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return { activeWidgets: next, activePreset: null };
      }),

      applyPreset: (presetKey) => {
        const preset = DASHBOARD_PRESETS[presetKey];
        if (!preset) return;
        set({ activeWidgets: [...preset.widgets], activePreset: presetKey });
      },

      resetToDefault: () => set({
        activeWidgets: [...defaultWidgets],
        activePreset: 'default',
      }),

      setEditMode: (val) => set({ editMode: val }),
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),
    }),
    {
      name: 'tradeforge-dashboard-layout',
      version: 1,
    }
  )
);
