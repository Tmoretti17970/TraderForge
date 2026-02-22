// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Script Store (Zustand)
//
// Manages user scripts + built-in library. CRUD operations,
// enable/disable toggle, parameter overrides. Persisted to
// IndexedDB via AppBoot alongside other stores.
//
// Data shape per script:
//   { id, name, description, category, builtin, enabled,
//     code, params: {}, createdAt, updatedAt }
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { BUILTIN_SCRIPTS } from '../engine/scriptLibrary.js';

const useScriptStore = create((set, get) => ({
  scripts: [],  // Combined: built-ins + user scripts
  loaded: false,

  // ─── Hydrate from IndexedDB ─────────────────────────────
  hydrate: (savedScripts = []) => {
    // Merge built-ins with saved state (preserve user enable/param overrides)
    const savedMap = new Map(savedScripts.map((s) => [s.id, s]));

    // Start with built-ins, applying any saved overrides
    const builtins = BUILTIN_SCRIPTS.map((b) => {
      const saved = savedMap.get(b.id);
      return {
        ...b,
        // Preserve user's enable/disable and param overrides
        enabled: saved ? saved.enabled : b.enabled,
        params: saved?.params || b.params || {},
      };
    });

    // Add user scripts (anything not a builtin)
    const builtinIds = new Set(BUILTIN_SCRIPTS.map((b) => b.id));
    const userScripts = savedScripts.filter((s) => !builtinIds.has(s.id));

    set({ scripts: [...builtins, ...userScripts], loaded: true });
  },

  // ─── Create ─────────────────────────────────────────────
  createScript: (partial = {}) => {
    const id = `script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const script = {
      id,
      name: partial.name || 'Untitled Script',
      description: partial.description || '',
      category: partial.category || 'custom',
      builtin: false,
      enabled: false,
      code: partial.code || defaultTemplate(),
      params: {},
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ scripts: [...s.scripts, script] }));
    return id;
  },

  // ─── Update ─────────────────────────────────────────────
  updateScript: (id, updates) => {
    set((s) => ({
      scripts: s.scripts.map((sc) =>
        sc.id === id
          ? { ...sc, ...updates, updatedAt: new Date().toISOString() }
          : sc
      ),
    }));
  },

  // ─── Delete (user scripts only) ─────────────────────────
  deleteScript: (id) => {
    const script = get().scripts.find((s) => s.id === id);
    if (script?.builtin) return false; // Can't delete built-ins
    set((s) => ({ scripts: s.scripts.filter((sc) => sc.id !== id) }));
    return true;
  },

  // ─── Toggle Enable/Disable ──────────────────────────────
  toggleScript: (id) => {
    set((s) => ({
      scripts: s.scripts.map((sc) =>
        sc.id === id ? { ...sc, enabled: !sc.enabled } : sc
      ),
    }));
  },

  // ─── Update Script Parameters ───────────────────────────
  setScriptParam: (id, paramName, value) => {
    set((s) => ({
      scripts: s.scripts.map((sc) =>
        sc.id === id
          ? { ...sc, params: { ...sc.params, [paramName]: value } }
          : sc
      ),
    }));
  },

  // ─── Duplicate (for customizing built-ins) ──────────────
  duplicateScript: (id) => {
    const source = get().scripts.find((s) => s.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const newId = `script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const copy = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      builtin: false,
      enabled: false,
      params: { ...source.params },
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ scripts: [...s.scripts, copy] }));
    return newId;
  },

  // ─── Getters ────────────────────────────────────────────
  getScript: (id) => get().scripts.find((s) => s.id === id),
  getEnabled: () => get().scripts.filter((s) => s.enabled),
  getByCategory: (cat) => get().scripts.filter((s) => s.category === cat),
  getUserScripts: () => get().scripts.filter((s) => !s.builtin),
  getBuiltinScripts: () => get().scripts.filter((s) => s.builtin),

  // ─── Serialization (for IndexedDB) ──────────────────────
  toJSON: () => {
    // Save everything — built-in overrides + user scripts
    return get().scripts.map(({ id, name, description, category, builtin, enabled, code, params, createdAt, updatedAt }) => ({
      id, name, description, category, builtin, enabled, code, params, createdAt, updatedAt,
    }));
  },
}));

// ─── Default Template ─────────────────────────────────────────

function defaultTemplate() {
  return `// TradeForge Custom Indicator
// Available: close[], open[], high[], low[], volume[], bars[], barCount
// Math: sma(), ema(), rsi(), atr(), bollinger(), stdev(), crossover()
// Output: plot(), band(), histogram(), hline(), marker()
// Config: param(name, default, { min, max, label })

const period = param('period', 20, { min: 2, max: 200, label: 'Period' });

const values = sma(close, period);
plot(values, { color: '#f59e0b', label: 'Custom SMA' });
`;
}

export { useScriptStore };
export default useScriptStore;
