// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Workspace Manager
//
// Save and restore named workspace configurations:
//   - Active page
//   - Chart settings (symbol, timeframe, chart type, indicators)
//   - Drawing visibility
//   - Sidebar state
//   - Journal filters
//
// Persisted to IndexedDB alongside trade data.
// Supports: save, load, rename, delete, duplicate, export/import.
//
// Usage:
//   workspaceManager.save('Day Trading', currentState)
//   workspaceManager.load('Day Trading')  // → restores all settings
//   workspaceManager.list()               // → all saved workspaces
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { safeClone } from '../utils/safeJSON.js';

// ─── Default workspace template ─────────────────────────────────

function defaultWorkspace(name) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    state: {
      page: 'dashboard',
      chart: {
        symbol: 'ES',
        tf: '5m',
        chartType: 'candles',
        logScale: false,
        orderFlow: false,
        indicators: [
          { type: 'sma', params: { period: 20 }, color: '#f59e0b' },
          { type: 'ema', params: { period: 50 }, color: '#a855f7' },
        ],
      },
      journal: {
        sortCol: 'date',
        sortDir: 'desc',
        search: '',
        filterSide: 'all',
      },
      zen: false,
    },
  };
}

// ─── Snapshot: capture current app state for workspace ──────────

/**
 * Capture current state from Zustand stores.
 * @param {Object} stores - { uiStore, chartStore }
 * @returns {Object} Workspace state snapshot
 */
function captureState(stores) {
  const ui = stores.uiStore?.getState?.() || {};
  const chart = stores.chartStore?.getState?.() || {};

  return {
    page: ui.page || 'dashboard',
    chart: {
      symbol: chart.symbol || 'ES',
      tf: chart.tf || '5m',
      chartType: chart.chartType || 'candles',
      logScale: chart.logScale || false,
      orderFlow: chart.orderFlow || false,
      indicators: (chart.indicators || []).map(ind => ({
        type: ind.type,
        params: { ...ind.params },
        color: ind.color,
      })),
    },
    zen: ui.zenMode || false,
  };
}

/**
 * Restore a workspace state snapshot to Zustand stores.
 * @param {Object} state - Workspace state snapshot
 * @param {Object} stores - { uiStore, chartStore }
 */
function restoreState(state, stores) {
  if (!state) return;

  const ui = stores.uiStore?.getState?.();
  const chart = stores.chartStore?.getState?.();

  if (ui) {
    if (state.page) ui.setPage(state.page);
    if (state.zen != null && ui.zenMode !== state.zen) ui.toggleZen();
  }

  if (chart && state.chart) {
    if (state.chart.symbol) chart.setSymbol(state.chart.symbol);
    if (state.chart.tf) chart.setTf(state.chart.tf);
    if (state.chart.chartType) chart.setChartType(state.chart.chartType);

    // Restore indicators: clear existing, add saved
    if (state.chart.indicators) {
      // Remove all existing
      const existing = chart.indicators || [];
      for (let i = existing.length - 1; i >= 0; i--) {
        chart.removeIndicator(i);
      }
      // Add saved indicators
      for (const ind of state.chart.indicators) {
        chart.addIndicator(ind);
      }
    }
  }
}

// ─── Workspace Store ────────────────────────────────────────────

const MAX_WORKSPACES = 20;

const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeId: null,
  loaded: false,

  /**
   * Save or update a workspace.
   * @param {string} name - Workspace name
   * @param {Object} state - State snapshot (from captureState)
   * @returns {Object} The saved workspace
   */
  save: (name, state) => {
    const s = get();
    const trimmedName = (name || 'Untitled').trim().slice(0, 50);

    // Check if workspace with this name already exists → update
    const existing = s.workspaces.find(w => w.name === trimmedName);

    if (existing) {
      const updated = {
        ...existing,
        state: { ...state },
        updatedAt: Date.now(),
      };
      set({
        workspaces: s.workspaces.map(w => w.id === existing.id ? updated : w),
        activeId: existing.id,
      });
      return updated;
    }

    // New workspace
    const ws = {
      ...defaultWorkspace(trimmedName),
      state: { ...state },
    };

    const newList = [ws, ...s.workspaces];
    // Enforce max
    while (newList.length > MAX_WORKSPACES) newList.pop();

    set({ workspaces: newList, activeId: ws.id });
    return ws;
  },

  /**
   * Load a workspace by ID.
   * @param {string} id
   * @returns {Object|null} The workspace state, or null if not found
   */
  load: (id) => {
    const ws = get().workspaces.find(w => w.id === id);
    if (!ws) return null;
    set({ activeId: id });
    return ws.state;
  },

  /**
   * Delete a workspace by ID.
   * @param {string} id
   */
  remove: (id) => {
    set(s => ({
      workspaces: s.workspaces.filter(w => w.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
  },

  /**
   * Rename a workspace.
   * @param {string} id
   * @param {string} newName
   */
  rename: (id, newName) => {
    set(s => ({
      workspaces: s.workspaces.map(w =>
        w.id === id ? { ...w, name: (newName || 'Untitled').trim().slice(0, 50), updatedAt: Date.now() } : w
      ),
    }));
  },

  /**
   * Duplicate a workspace.
   * @param {string} id
   * @returns {Object|null}
   */
  duplicate: (id) => {
    const ws = get().workspaces.find(w => w.id === id);
    if (!ws) return null;

    const copy = {
      ...defaultWorkspace(`${ws.name} (Copy)`),
      state: safeClone(ws.state, {}),
    };

    set(s => ({
      workspaces: [copy, ...s.workspaces].slice(0, MAX_WORKSPACES),
    }));
    return copy;
  },

  /**
   * Hydrate workspaces from IndexedDB data.
   * @param {Array} data
   */
  hydrate: (data) => {
    set({ workspaces: Array.isArray(data) ? data : [], loaded: true });
  },

  /**
   * Export all workspaces as JSON string.
   * @returns {string}
   */
  exportAll: () => {
    return JSON.stringify(get().workspaces, null, 2);
  },

  /**
   * Import workspaces from JSON string (merges, deduplicates by name).
   * @param {string} json
   * @returns {number} Number of workspaces imported
   */
  importAll: (json) => {
    try {
      const imported = JSON.parse(json);
      if (!Array.isArray(imported)) return 0;

      const existing = get().workspaces;
      const existingNames = new Set(existing.map(w => w.name));
      const newOnes = imported.filter(w => w.name && !existingNames.has(w.name));

      set({ workspaces: [...existing, ...newOnes].slice(0, MAX_WORKSPACES) });
      return newOnes.length;
    } catch {
      return 0;
    }
  },
}));

// ─── Public API (non-React) ─────────────────────────────────────

const workspaceManager = {
  save: (name, state) => useWorkspaceStore.getState().save(name, state),
  load: (id) => useWorkspaceStore.getState().load(id),
  remove: (id) => useWorkspaceStore.getState().remove(id),
  rename: (id, name) => useWorkspaceStore.getState().rename(id, name),
  duplicate: (id) => useWorkspaceStore.getState().duplicate(id),
  list: () => useWorkspaceStore.getState().workspaces,
  exportAll: () => useWorkspaceStore.getState().exportAll(),
  importAll: (json) => useWorkspaceStore.getState().importAll(json),
};

// ─── Exports ────────────────────────────────────────────────────

export {
  useWorkspaceStore,
  workspaceManager,
  captureState,
  restoreState,
  defaultWorkspace,
  MAX_WORKSPACES,
};
export default workspaceManager;
