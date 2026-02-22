// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Command Palette (Ctrl+K)
// Fuzzy-search commands for navigation and actions
// Also registers global keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { useUIStore } from '../state/useUIStore.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useChartStore } from '../state/useChartStore.js';
import { useThemeStore } from '../state/useThemeStore.js';
import { exportCSV } from '../csv.js';

// ─── Command Registry ───────────────────────────────────────────

function getCommands(actions) {
  const theme = useThemeStore.getState().theme;
  return [
    // Navigation (Sprint 2: 5-page IA)
    { id: 'nav-dash', label: 'Dashboard', group: 'Navigate', shortcut: '1', icon: '📊', action: () => actions.setPage('dashboard') },
    { id: 'nav-journal', label: 'Journal', group: 'Navigate', shortcut: '2', icon: '📓', action: () => actions.setPage('journal') },
    { id: 'nav-charts', label: 'Charts', group: 'Navigate', shortcut: '3', icon: '📈', action: () => actions.setPage('charts') },
    { id: 'nav-insights', label: 'Insights', group: 'Navigate', shortcut: '4', icon: '📉', action: () => actions.setPage('insights') },
    { id: 'nav-settings', label: 'Settings', group: 'Navigate', shortcut: '5', icon: '⚙️', action: () => actions.setPage('settings') },

    // Actions
    { id: 'add-trade', label: 'Add New Trade', group: 'Actions', shortcut: 'N', icon: '➕', action: actions.addTrade },
    { id: 'import-csv', label: 'Import CSV', group: 'Actions', shortcut: 'I', icon: '📥', action: actions.importCSV },
    { id: 'export-csv', label: 'Export Trades as CSV', group: 'Actions', icon: '📤', action: actions.exportCSV },

    // Appearance
    { id: 'toggle-theme', label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', group: 'Appearance', shortcut: 'T', icon: theme === 'dark' ? '☀️' : '🌙', action: actions.toggleTheme },
    { id: 'toggle-zen', label: 'Toggle Zen Mode', group: 'Appearance', icon: '🧘', action: actions.toggleZen },

    // Chart
    { id: 'chart-candles', label: 'Candle Chart', group: 'Chart Type', icon: '🕯️', action: () => actions.setChartType?.('candles') },
    { id: 'chart-line', label: 'Line Chart', group: 'Chart Type', icon: '📉', action: () => actions.setChartType?.('line') },
    { id: 'chart-area', label: 'Area Chart', group: 'Chart Type', icon: '📊', action: () => actions.setChartType?.('area') },
    { id: 'chart-ha', label: 'Heikin-Ashi', group: 'Chart Type', icon: '🔶', action: () => actions.setChartType?.('heikinashi') },
    { id: 'chart-hollow', label: 'Hollow Candles', group: 'Chart Type', icon: '◻️', action: () => actions.setChartType?.('hollow') },
    { id: 'chart-ohlc', label: 'OHLC Bars', group: 'Chart Type', icon: '📶', action: () => actions.setChartType?.('ohlc') },
  ];
}

// ─── Fuzzy Match ────────────────────────────────────────────────

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;

  // Subsequence match
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─── Component ──────────────────────────────────────────────────

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const setPage = useUIStore((s) => s.setPage);

  // Actions object — passed to command registry
  const actions = useMemo(() => ({
    setPage: (page) => { setPage(page); setOpen(false); },
    addTrade: () => {
      setPage('journal');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('tradeforge:add-trade'));
    },
    importCSV: () => {
      setPage('journal');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('tradeforge:import-csv'));
    },
    exportCSV: () => {
      const trades = useTradeStore.getState().trades;
      if (!trades.length) return;
      const csv = exportCSV(trades);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tradeforge-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    },
    setChartType: (type) => {
      useChartStore.getState().setChartType(type);
      setPage('charts');
      setOpen(false);
    },
    toggleTheme: () => {
      useThemeStore.getState().toggleTheme();
      setOpen(false);
    },
    toggleZen: () => {
      useUIStore.getState().toggleZen();
      setOpen(false);
    },
  }), [setPage]);

  const commands = useMemo(() => getCommands(actions), [actions]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands.filter((c) => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.group));
  }, [commands, query]);

  // Group filtered commands
  const grouped = useMemo(() => {
    const groups = {};
    for (const cmd of filtered) {
      if (!groups[cmd.group]) groups[cmd.group] = [];
      groups[cmd.group].push(cmd);
    }
    return groups;
  }, [filtered]);

  // ─── Keyboard Shortcuts ───────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K → toggle palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelectedIdx(0);
        return;
      }

      // Escape → close
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // Don't intercept shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // Number keys for navigation (when palette is closed)
      if (!open && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pages = { '1': 'dashboard', '2': 'journal', '3': 'charts', '4': 'insights', '5': 'settings' };
        if (pages[e.key]) {
          e.preventDefault();
          setPage(pages[e.key]);
          return;
        }

        // N for new trade
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          actions.addTrade();
          return;
        }

        // T for theme toggle
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          actions.toggleTheme();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setPage, actions]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Arrow key navigation within palette
  const handlePaletteKeys = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        filtered[selectedIdx].action();
      }
    }
  }, [filtered, selectedIdx]);

  // Reset selection when query changes
  useEffect(() => setSelectedIdx(0), [query]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Palette */}
      <div
        style={{
          position: 'relative',
          width: 480,
          maxWidth: '90vw',
          background: C.sf,
          border: `1px solid ${C.bd}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,.4)',
        }}
      >
        {/* Search Input */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.bd}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handlePaletteKeys}
            placeholder="Type a command..."
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              background: 'transparent',
              color: C.t1,
              fontSize: 15,
              fontFamily: F,
              outline: 'none',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontFamily: M,
                }}
              >
                {group}
              </div>
              {cmds.map((cmd) => {
                const thisIdx = flatIdx++;
                const isSelected = thisIdx === selectedIdx;
                return (
                  <div
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIdx(thisIdx)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: isSelected ? C.b + '15' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span style={{ fontSize: 13, color: isSelected ? C.t1 : C.t2, fontWeight: isSelected ? 600 : 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {cmd.icon && <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{cmd.icon}</span>}
                      {cmd.label}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: C.bg2,
                          border: `1px solid ${C.bd}`,
                          fontSize: 10,
                          fontFamily: M,
                          color: C.t3,
                        }}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
              No matching commands
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            gap: 12,
            fontSize: 10,
            color: C.t3,
            fontFamily: M,
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

export { CommandPalette };
