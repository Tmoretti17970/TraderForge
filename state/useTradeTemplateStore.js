// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Trade Entry Templates
// Sprint 9 C9.3: Pre-filled trade form templates with checklists.
// Separate from chart templates (useTemplateStore.js).
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTradeTemplateStore = create(
  persist(
    (set) => ({
      templates: [
        {
          id: 'tt-breakout',
          name: 'Breakout',
          icon: '🚀',
          fields: { playbook: 'Breakout', tags: ['breakout', 'momentum'], emotion: '', notes: '' },
          checklist: [
            { id: 'c1', text: 'Volume above average', required: true },
            { id: 'c2', text: 'Clean break of level', required: true },
            { id: 'c3', text: 'No major resistance above', required: false },
            { id: 'c4', text: 'Risk/reward >= 2:1', required: true },
          ],
        },
        {
          id: 'tt-pullback',
          name: 'Pullback',
          icon: '🔄',
          fields: { playbook: 'Pullback', tags: ['pullback', 'support'], emotion: '', notes: '' },
          checklist: [
            { id: 'c1', text: 'Price at key support level', required: true },
            { id: 'c2', text: 'Bullish rejection candle', required: true },
            { id: 'c3', text: 'HTF trend aligned', required: false },
            { id: 'c4', text: 'Stop below support', required: true },
          ],
        },
        {
          id: 'tt-reversal',
          name: 'Reversal',
          icon: '↩️',
          fields: { playbook: 'Reversal', tags: ['reversal', 'counter-trend'], emotion: '', notes: '' },
          checklist: [
            { id: 'c1', text: 'Extended move (3+ ATR)', required: true },
            { id: 'c2', text: 'RSI/MACD divergence', required: false },
            { id: 'c3', text: 'Reversal candle pattern', required: true },
            { id: 'c4', text: 'Reduced position size', required: true },
          ],
        },
      ],

      addTemplate: (t) => set((s) => ({
        templates: [...s.templates, { ...t, id: t.id || `tt-${Date.now()}` }],
      })),

      updateTemplate: (id, u) => set((s) => ({
        templates: s.templates.map(t => t.id === id ? { ...t, ...u } : t),
      })),

      deleteTemplate: (id) => set((s) => ({
        templates: s.templates.filter(t => t.id !== id),
      })),
    }),
    { name: 'tradeforge-trade-templates', version: 1 }
  )
);

/** Apply template fields to trade form state. */
export function applyTradeTemplate(template) {
  if (!template?.fields) return {};
  return {
    playbook: template.fields.playbook || '',
    tags: Array.isArray(template.fields.tags) ? template.fields.tags.join(', ') : '',
    emotion: template.fields.emotion || '',
    notes: template.fields.notes || '',
  };
}
