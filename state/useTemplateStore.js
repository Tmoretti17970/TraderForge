// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Chart Template Store
//
// Save and load named chart templates (indicator configs + chart type).
// Persisted to localStorage. Templates are global (not per-symbol).
//
// Template format:
//   {
//     id: string,
//     name: string,         // "My Scalping Setup"
//     chartType: string,    // "candle", "line", "area", "heikinashi"
//     indicators: [         // Full indicator configs
//       { type: 'ema', color: '#f59e0b', params: { period: 9 } },
//       { type: 'ema', color: '#3b82f6', params: { period: 21 } },
//       { type: 'rsi', color: '#a855f7', params: { period: 14 } },
//     ],
//     createdAt: string,
//   }
//
// Usage:
//   const templates = useTemplateStore(s => s.templates);
//   const save = useTemplateStore(s => s.saveTemplate);
//   save('My Scalping Setup', indicators, chartType);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeClone } from '../utils/safeJSON.js';

const BUILT_IN_TEMPLATES = [
  {
    id: '_scalping',
    name: 'Scalping',
    builtIn: true,
    chartType: 'candle',
    indicators: [
      { type: 'ema', color: '#f59e0b', params: { period: 9 } },
      { type: 'ema', color: '#3b82f6', params: { period: 21 } },
      { type: 'vwap', color: '#06b6d4', params: {} },
    ],
  },
  {
    id: '_swing',
    name: 'Swing Trading',
    builtIn: true,
    chartType: 'candle',
    indicators: [
      { type: 'sma', color: '#f59e0b', params: { period: 20 } },
      { type: 'sma', color: '#3b82f6', params: { period: 50 } },
      { type: 'sma', color: '#ef4444', params: { period: 200 } },
      { type: 'rsi', color: '#a855f7', params: { period: 14 } },
    ],
  },
  {
    id: '_momentum',
    name: 'Momentum',
    builtIn: true,
    chartType: 'candle',
    indicators: [
      { type: 'ema', color: '#22c55e', params: { period: 12 } },
      { type: 'ema', color: '#ef4444', params: { period: 26 } },
      { type: 'macd', color: '#3b82f6', params: { fast: 12, slow: 26, signal: 9 } },
      { type: 'rsi', color: '#a855f7', params: { period: 14 } },
    ],
  },
  {
    id: '_volatility',
    name: 'Volatility',
    builtIn: true,
    chartType: 'candle',
    indicators: [
      { type: 'bollinger', color: '#3b82f6', params: { period: 20, multiplier: 2 } },
      { type: 'atr', color: '#f97316', params: { period: 14 } },
      { type: 'stochastic', color: '#22c55e', params: { kPeriod: 14, dPeriod: 3 } },
    ],
  },
  {
    id: '_clean',
    name: 'Clean Chart',
    builtIn: true,
    chartType: 'candle',
    indicators: [],
  },
];

const useTemplateStore = create(
  persist(
    (set, get) => ({
      templates: [...BUILT_IN_TEMPLATES],

      /**
       * Save current chart config as a named template.
       * If a user template with the same name exists, it gets overwritten.
       */
      saveTemplate: (name, indicators, chartType = 'candle') => {
        const trimmed = (name || '').trim();
        if (!trimmed) return null;

        const id = 'tpl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const template = {
          id,
          name: trimmed,
          builtIn: false,
          chartType,
          // Deep clone indicators to snapshot current params
          indicators: safeClone(indicators || [], []),
          createdAt: new Date().toISOString(),
        };

        set((s) => {
          // Remove existing user template with same name (overwrite)
          const filtered = s.templates.filter(t =>
            t.builtIn || t.name.toLowerCase() !== trimmed.toLowerCase()
          );
          return { templates: [...filtered, template] };
        });

        return id;
      },

      /**
       * Delete a user template (built-in templates can't be deleted).
       */
      deleteTemplate: (id) => {
        set((s) => ({
          templates: s.templates.filter(t => t.id !== id || t.builtIn),
        }));
      },

      /**
       * Rename a user template.
       */
      renameTemplate: (id, newName) => {
        set((s) => ({
          templates: s.templates.map(t =>
            t.id === id && !t.builtIn ? { ...t, name: newName.trim() } : t
          ),
        }));
      },

      /**
       * Get a template by ID.
       */
      getTemplate: (id) => {
        return get().templates.find(t => t.id === id) || null;
      },

      /**
       * Reset to built-in templates only.
       */
      resetTemplates: () => {
        set({ templates: [...BUILT_IN_TEMPLATES] });
      },
    }),
    {
      name: 'tradeforge-chart-templates',
      // Merge built-ins on rehydrate (in case we add new built-ins in updates)
      merge: (persisted, current) => {
        const stored = persisted?.templates || [];
        const userTemplates = stored.filter(t => !t.builtIn);
        return {
          ...current,
          templates: [...BUILT_IN_TEMPLATES, ...userTemplates],
        };
      },
    }
  )
);

export { useTemplateStore, BUILT_IN_TEMPLATES };
export default useTemplateStore;
