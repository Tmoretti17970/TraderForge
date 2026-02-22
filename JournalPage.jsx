// ═══════════════════════════════════════════════════════════════════
// TradeForge — Journal Page (Redesign)
//
// Narrative layout:
//   1. Session Summary — Today's P&L, trade count, win rate
//   2. Tabs — Trades | Notes
//   3. Streak Timeline — Visual win/loss ribbon
//   4. Filters + Toolbar — Search, date range, bulk ops
//   5. Trade Table — Virtualized, expandable rows
//
// Mobile: swaps to MobileJournal component.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { C, F, M } from '../constants.js';
import { radii } from '../theme/tokens.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { Card, Btn } from '../components/UIKit.jsx';
import { JournalEmptyState } from '../components/EmptyState.jsx';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import { exportCSV } from '../csv.js';
import VirtualList from '../utils/VirtualList.jsx';
import { useHotkeys } from '../utils/useHotkeys.js';
import { undoStack, executeUndo, executeRedo } from '../utils/UndoStack.js';
import { navigateToTrade } from '../utils/navigateToTrade.js';
import { useUIStore } from '../state/useUIStore.js';
import { useChartStore } from '../state/useChartStore.js';
import TradeFormModal from '../components/TradeFormModal.jsx';
import CSVImportModal from '../components/CSVImportModal.jsx';
import toast from '../components/Toast.jsx';

// Journal sub-components
import JournalFilterBar from '../components/journal/JournalFilterBar.jsx';
import JournalTradeRow, { GRID_COLS, GRID_COLS_NO_CHECK } from '../components/journal/JournalTradeRow.jsx';
import JournalQuickAdd from '../components/journal/JournalQuickAdd.jsx';

// Sprint 9 components
import { useBulkSelection, BulkActionBar } from '../components/journal/BulkOperations.jsx';
import { launchTradeReplay } from '../components/journal/TradeReplay.js';
import { StreakTimeline, AdvancedFilters, applyAdvancedFilters } from '../components/journal/JournalEvolution.jsx';
import ContextPerformanceTab from '../components/journal/ContextPerformanceTab.jsx';

// Mobile Journal (Sprint 2 IA — dedicated mobile component)
import MobileJournal from '../components/MobileJournal.jsx';

// Notes (merged into Journal — Sprint 2 IA restructure)
const NotesPage = React.lazy(() => import('./NotesPage.jsx'));

// ─── Sort config ────────────────────────────────────────────────

const COLUMNS = [
  { id: 'date',     label: 'Date',     width: '100px',  sortable: true },
  { id: 'symbol',   label: 'Symbol',   width: '80px',   sortable: true },
  { id: 'side',     label: 'Side',     width: '55px',   sortable: true },
  { id: 'playbook', label: 'Strategy', width: '1fr',    sortable: true },
  { id: 'emotion',  label: 'Emotion',  width: '80px',   sortable: true },
  { id: 'pnl',      label: 'P&L',      width: '100px',  sortable: true, align: 'right' },
];

export default function JournalPage() {
  const trades = useTradeStore((s) => s.trades);
  const deleteTrade = useTradeStore((s) => s.deleteTrade);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addTrades = useTradeStore((s) => s.addTrades);
  const updateTrade = useTradeStore((s) => s.updateTrade);
  const setPage = useUIStore((s) => s.setPage);
  const setChartSymbol = useChartStore((s) => s.setSymbol);
  const setChartTf = useChartStore((s) => s.setTf);
  const { isMobile, isTablet } = useBreakpoints();

  // ─── State ──────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('');
  const [sideFilter, setSideFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [tradeFormOpen, setTradeFormOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [editTrade, setEditTrade] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Sprint 9 state
  const [bulkMode, setBulkMode] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showContextPerf, setShowContextPerf] = useState(false);

  // Journal tab: trades or notes (Sprint 2 IA merge)
  const [journalTab, setJournalTab] = useState('trades');

  // ─── Container height for virtualization ──────────────────
  const containerRef = useRef(null);
  const [containerH, setContainerH] = useState(600);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const available = window.innerHeight - rect.top - 24;
        setContainerH(Math.max(300, available));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Listen for command palette events
  useEffect(() => {
    const onAddTrade = () => { setEditTrade(null); setTradeFormOpen(true); };
    const onImportCSV = () => setCsvModalOpen(true);
    window.addEventListener('tradeforge:add-trade', onAddTrade);
    window.addEventListener('tradeforge:import-csv', onImportCSV);
    return () => {
      window.removeEventListener('tradeforge:add-trade', onAddTrade);
      window.removeEventListener('tradeforge:import-csv', onImportCSV);
    };
  }, []);

  // ─── Filter + Sort ──────────────────────────────────────────
  const filteredTrades = useMemo(() => {
    let list = [...trades];

    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (t) =>
          (t.symbol || '').toLowerCase().includes(q) ||
          (t.playbook || '').toLowerCase().includes(q) ||
          (t.emotion || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
          (t.notes || '').toLowerCase().includes(q)
      );
    }

    if (sideFilter !== 'all') {
      list = list.filter((t) => t.side === sideFilter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      let fromDate = null, toDate = null;

      switch (dateRange) {
        case 'today':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week': {
          const dayOfWeek = now.getDay();
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          break;
        }
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          fromDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          fromDate = new Date(now.getFullYear(), 0, 1);
          break;
        case 'custom':
          if (customDateFrom) fromDate = new Date(customDateFrom);
          if (customDateTo) toDate = new Date(customDateTo + 'T23:59:59');
          break;
        default:
          break;
      }

      if (fromDate) list = list.filter((t) => t.date && new Date(t.date) >= fromDate);
      if (toDate) list = list.filter((t) => t.date && new Date(t.date) <= toDate);
    }

    if (assetClassFilter !== 'all') {
      list = list.filter((t) => (t.assetClass || '').toLowerCase() === assetClassFilter.toLowerCase());
    }

    // Apply advanced filters (Sprint 9)
    list = applyAdvancedFilters(list, advancedFilters);

    list.sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];
      if (sortCol === 'date') {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      } else if (sortCol === 'pnl') {
        va = va || 0;
        vb = vb || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [trades, filter, sideFilter, dateRange, customDateFrom, customDateTo, assetClassFilter, sortCol, sortDir, advancedFilters]);

  // ─── Bulk selection (Sprint 9) ──────────────────────────────
  const bulk = useBulkSelection(filteredTrades);

  // ─── Keyboard shortcuts ──────────────────────────────────────
  useHotkeys([
    {
      key: 'j', description: 'Focus next trade',
      handler: () => setFocusedIdx(i => {
        const next = Math.min(filteredTrades.length - 1, i + 1);
        if (filteredTrades[next]) setExpandedId(filteredTrades[next].id);
        return next;
      }),
    },
    {
      key: 'k', description: 'Focus previous trade',
      handler: () => setFocusedIdx(i => {
        const prev = Math.max(0, i - 1);
        if (filteredTrades[prev]) setExpandedId(filteredTrades[prev].id);
        return prev;
      }),
    },
    {
      key: 'e', description: 'Edit focused trade',
      handler: () => {
        if (expandedId) {
          const trade = trades.find((t) => t.id === expandedId);
          if (trade) { setEditTrade(trade); setTradeFormOpen(true); }
        }
      },
    },
    {
      key: 'd', description: 'Delete focused trade',
      handler: () => { if (expandedId) setDeleteConfirm(expandedId); },
    },
    {
      key: 'Escape', description: 'Clear selection / collapse', allowInInput: true,
      handler: () => {
        if (bulkMode && bulk.hasSelection) { bulk.selectNone(); }
        else if (bulkMode) { setBulkMode(false); }
        else if (expandedId) { setExpandedId(null); }
        else { setFocusedIdx(-1); }
      },
    },
    {
      key: 'Enter', description: 'Toggle expand focused trade',
      handler: () => {
        if (focusedIdx >= 0 && focusedIdx < filteredTrades.length) {
          const trade = filteredTrades[focusedIdx];
          setExpandedId(prev => prev === trade.id ? null : trade.id);
        }
      },
    },
    {
      key: 'b', description: 'Toggle bulk mode',
      handler: () => { setBulkMode(!bulkMode); if (bulkMode) bulk.selectNone(); },
    },
  ], { scope: 'page:journal', enabled: !tradeFormOpen && !csvModalOpen });

  // ─── Global undo/redo ────────────────────────────────────────
  const storeActionsRef = useRef({ addTrade, addTrades, deleteTrade, updateTrade });
  storeActionsRef.current = { addTrade, addTrades, deleteTrade, updateTrade };

  useHotkeys([
    {
      key: 'ctrl+z', description: 'Undo last action', allowInInput: true,
      handler: () => {
        const entry = undoStack.undo();
        if (entry) { toast.success(executeUndo(entry, storeActionsRef.current) || 'Undone'); }
        else { toast.info('Nothing to undo'); }
      },
    },
    {
      key: 'ctrl+shift+z', description: 'Redo last undone action', allowInInput: true,
      handler: () => {
        const entry = undoStack.redo();
        if (entry) { toast.success(executeRedo(entry, storeActionsRef.current) || 'Redone'); }
        else { toast.info('Nothing to redo'); }
      },
    },
  ], { scope: 'global', enabled: true });

  // ─── Handlers ───────────────────────────────────────────────
  const handleSort = useCallback((colId) => {
    if (sortCol === colId) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSortCol(colId); setSortDir(colId === 'date' ? 'desc' : 'asc'); }
  }, [sortCol]);

  const handleEdit = (trade) => { setEditTrade(trade); setTradeFormOpen(true); };

  const handleDelete = (id) => {
    const trade = trades.find((t) => t.id === id);
    if (!trade) return;
    undoStack.push({ type: 'delete', payload: { id, symbol: trade.symbol }, inverse: { trade: { ...trade } }, label: `Delete ${trade.symbol || 'trade'}` });
    deleteTrade(id);
    setDeleteConfirm(null);
    setExpandedId(null);
    const sa = { addTrade, addTrades, deleteTrade, updateTrade };
    toast.action(`${trade.symbol || 'Trade'} deleted`, 'Undo', () => {
      const e = undoStack.undo();
      if (e) toast.success(executeUndo(e, sa) || 'Undone');
    }, { type: 'success', duration: 5000 });
  };

  const handleViewOnChart = useCallback((trade) => {
    navigateToTrade(trade, { setPage, setSymbol: setChartSymbol, setTf: setChartTf });
  }, [setPage, setChartSymbol, setChartTf]);

  const handleReplay = useCallback((trade) => {
    launchTradeReplay(trade, { replayMode: true, highlightTrade: true });
  }, []);

  const handleExportCSV = (tradesToExport) => {
    const list = tradesToExport || trades;
    if (!list.length) return;
    const csv = exportCSV(list);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tradeforge-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${list.length} trades`);
  };

  // ─── Bulk Handlers (Sprint 9) ───────────────────────────────
  const handleBulkDelete = () => {
    if (!bulk.hasSelection) return;
    const count = bulk.count;
    const selected = bulk.selectedTrades;

    for (const t of selected) {
      undoStack.push({
        type: 'delete',
        payload: { id: t.id, symbol: t.symbol },
        inverse: { trade: { ...t } },
        label: `Bulk delete ${t.symbol}`,
      });
      deleteTrade(t.id);
    }

    bulk.selectNone();
    toast.success(`Deleted ${count} trades`);
  };

  const handleBulkTag = (tag) => {
    for (const t of bulk.selectedTrades) {
      const existing = t.tags || [];
      if (!existing.includes(tag)) {
        updateTrade(t.id, { tags: [...existing, tag] });
      }
    }
    toast.success(`Tagged ${bulk.count} trades with "${tag}"`);
  };

  const handleBulkEdit = (field, value) => {
    for (const t of bulk.selectedTrades) {
      updateTrade(t.id, { [field]: value });
    }
    toast.success(`Updated ${field} on ${bulk.count} trades`);
  };

  const handleBulkExport = () => {
    handleExportCSV(bulk.selectedTrades);
  };

  // ─── Summary stats ─────────────────────────────────────────
  const summary = useMemo(() => {
    const pnl = filteredTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = filteredTrades.filter((t) => (t.pnl || 0) > 0).length;
    return { pnl, wins, losses: filteredTrades.length - wins };
  }, [filteredTrades]);

  // ─── Today's session stats ──────────────────────────────────
  const session = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter(t => t.date?.slice(0, 10) === todayStr);
    const pnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = todayTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0;
    return { count: todayTrades.length, pnl, wins, losses: todayTrades.length - wins, winRate };
  }, [trades]);

  const openAddTrade = () => { setEditTrade(null); setTradeFormOpen(true); };
  const isFiltered = filter || sideFilter !== 'all' || dateRange !== 'all' || assetClassFilter !== 'all';

  // ═══════════════════════════════════════════════════════════════
  // MOBILE RENDER
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        <MobileJournal
          trades={trades}
          onEdit={handleEdit}
          onDelete={(id) => handleDelete(id)}
          onAdd={openAddTrade}
        />
        <TradeFormModal isOpen={tradeFormOpen} onClose={() => { setTradeFormOpen(false); setEditTrade(null); }} editTrade={editTrade} />
        <CSVImportModal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: 32, maxWidth: 1200 }}>

      {/* ─── Section 1: Header + Session Summary ──── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0 }}>
            Journal
          </h1>
          <p style={{ fontSize: 12, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
            {trades.length} trade{trades.length !== 1 ? 's' : ''} logged
          </p>
        </div>

        {/* Primary actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => setCsvModalOpen(true)} style={{ fontSize: 12, padding: '8px 14px' }}>
            📁 Import
          </Btn>
          <Btn onClick={openAddTrade} style={{ fontSize: 12, padding: '8px 14px' }}>
            + Add Trade
          </Btn>
        </div>
      </div>

      {/* ─── Session Summary (only when today has trades) ──── */}
      {session.count > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
          gap: 12,
          marginBottom: 20,
        }}>
          <SessionCard
            label="Today's P&L"
            value={`${session.pnl >= 0 ? '+' : ''}$${session.pnl.toFixed(2)}`}
            color={session.pnl >= 0 ? C.g : C.r}
            large
          />
          <SessionCard label="Trades" value={session.count} />
          <SessionCard
            label="Win Rate"
            value={`${session.winRate}%`}
            color={session.winRate >= 50 ? C.g : C.r}
          />
          <SessionCard label="W / L" value={`${session.wins} / ${session.losses}`} />
        </div>
      )}

      {/* ─── Section 2: Tab Switcher ──── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 16,
        borderBottom: `1px solid ${C.bd}`,
      }}>
        {[
          { id: 'trades', label: 'Trades', count: trades.length },
          { id: 'notes', label: 'Notes' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setJournalTab(tab.id)}
            className="tf-btn"
            role="tab"
            aria-selected={journalTab === tab.id}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${journalTab === tab.id ? C.b : 'transparent'}`,
              color: journalTab === tab.id ? C.t1 : C.t3,
              fontSize: 14,
              fontWeight: journalTab === tab.id ? 600 : 500,
              fontFamily: F,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span style={{
                fontSize: 10, fontFamily: M, color: C.t3,
                background: C.bg2, borderRadius: 100, padding: '2px 7px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        {/* Tab-level tools — right-aligned */}
        {journalTab === 'trades' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Btn
              variant={bulkMode ? 'primary' : 'ghost'}
              onClick={() => { setBulkMode(!bulkMode); if (bulkMode) bulk.selectNone(); }}
              style={{ fontSize: 11, padding: '6px 10px' }}
            >
              {bulkMode ? '✓ Bulk' : '☐ Bulk'}
            </Btn>
            <Btn variant="ghost" onClick={() => setShowContextPerf(true)} style={{ fontSize: 11, padding: '6px 10px' }}>
              🧠 Context
            </Btn>
            <Btn variant="ghost" onClick={() => handleExportCSV()} style={{ fontSize: 11, padding: '6px 10px' }} disabled={!trades.length}>
              ↓ Export
            </Btn>
          </div>
        )}
      </div>

      {/* ─── Tab Content ──── */}
      {journalTab === 'notes' ? (
        <React.Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: C.t3 }}>Loading notes...</div>}>
          <NotesPage />
        </React.Suspense>
      ) : (
        <>
          {/* Section 3: Streak Timeline */}
          {filteredTrades.length > 0 && (
            <StreakTimeline
              trades={filteredTrades}
              maxShow={50}
              onTradeClick={(t) => setExpandedId(expandedId === t.id ? null : t.id)}
            />
          )}

          {/* Section 4: Filter Bar */}
          <JournalFilterBar
            filter={filter} setFilter={setFilter}
            sideFilter={sideFilter} setSideFilter={setSideFilter}
            dateRange={dateRange} setDateRange={setDateRange}
            customDateFrom={customDateFrom} setCustomDateFrom={setCustomDateFrom}
            customDateTo={customDateTo} setCustomDateTo={setCustomDateTo}
            assetClassFilter={assetClassFilter} setAssetClassFilter={setAssetClassFilter}
            summary={summary}
          />

          {/* Advanced Filters (Sprint 9) */}
          <AdvancedFilters
            filters={advancedFilters}
            onFiltersChange={setAdvancedFilters}
            trades={trades}
          />

          {/* Bulk Action Bar (Sprint 9) */}
          {bulkMode && (
            <BulkActionBar
              count={bulk.count}
              allSelected={bulk.allSelected}
              onSelectAll={bulk.selectAll}
              onSelectNone={bulk.selectNone}
              onInvert={bulk.invertSelection}
              onBulkDelete={handleBulkDelete}
              onBulkTag={handleBulkTag}
              onBulkEdit={handleBulkEdit}
              onBulkExport={handleBulkExport}
            />
          )}

          {/* Quick-Add */}
          {quickAddOpen ? (
            <JournalQuickAdd
              onSave={(trade) => { addTrade(trade); setQuickAddOpen(false); toast.success('Trade added'); }}
              onCancel={() => setQuickAddOpen(false)}
            />
          ) : (
            <button
              onClick={() => setQuickAddOpen(true)}
              className="tf-btn tf-link"
              style={{
                width: '100%', padding: '10px 12px', marginBottom: 8,
                borderRadius: radii.md, border: `1px dashed ${C.bd}`,
                background: 'transparent', color: C.t3, fontSize: 12,
                fontFamily: F, cursor: 'pointer',
              }}
            >
              ⚡ Quick-add trade
            </button>
          )}

          {/* Section 5: Trade Table */}
          {filteredTrades.length > 0 ? (
            <Card ref={containerRef} style={{ padding: 0, overflow: 'hidden' }}>
              {/* Filter summary bar */}
              {isFiltered && (
                <div style={{
                  padding: '8px 16px',
                  background: C.b + '08',
                  borderBottom: `1px solid ${C.bd}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 11, color: C.t2, fontFamily: M }}>
                    Showing {filteredTrades.length} of {trades.length} trades
                  </span>
                  <button
                    onClick={() => {
                      setFilter('');
                      setSideFilter('all');
                      setDateRange('all');
                      setAssetClassFilter('all');
                      setAdvancedFilters({});
                    }}
                    className="tf-btn tf-link"
                    style={{
                      border: 'none', background: 'transparent',
                      color: C.b, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              <VirtualList
                items={filteredTrades}
                rowHeight={isTablet ? 54 : 44}
                expandedId={expandedId}
                expandedHeight={320}
                containerHeight={containerH}
                overscan={8}
                header={!isTablet ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: bulkMode ? GRID_COLS : GRID_COLS_NO_CHECK,
                    padding: '8px 16px', background: C.bg2,
                    borderBottom: `1px solid ${C.bd}`, position: 'sticky', top: 0, zIndex: 10,
                  }}>
                    {bulkMode && (
                      <div
                        onClick={() => bulk.allSelected ? bulk.selectNone() : bulk.selectAll()}
                        role="checkbox"
                        aria-checked={bulk.allSelected}
                        aria-label="Select all trades"
                        style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: `2px solid ${bulk.allSelected ? C.b : C.bd}`,
                          background: bulk.allSelected ? C.b : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', alignSelf: 'center',
                        }}
                      >
                        {bulk.allSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
                      </div>
                    )}
                    {COLUMNS.map((col) => (
                      <div
                        key={col.id}
                        onClick={() => col.sortable && handleSort(col.id)}
                        role={col.sortable ? 'button' : undefined}
                        aria-label={col.sortable ? `Sort by ${col.label}` : undefined}
                        style={{
                          fontSize: 10, fontWeight: 700,
                          color: sortCol === col.id ? C.b : C.t3,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          fontFamily: M, cursor: col.sortable ? 'pointer' : 'default',
                          userSelect: 'none', textAlign: col.align || 'left',
                          display: 'flex', alignItems: 'center', gap: 4,
                          justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {col.label}
                        {sortCol === col.id && <span style={{ fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    ))}
                  </div>
                ) : null}
                renderRow={(t, index, isExpanded) => (
                  <JournalTradeRow
                    trade={t}
                    isExpanded={isExpanded}
                    isTablet={isTablet}
                    deleteConfirm={deleteConfirm}
                    onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDeleteConfirm={setDeleteConfirm}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    onViewChart={handleViewOnChart}
                    onReplay={handleReplay}
                    bulkMode={bulkMode}
                    isSelected={bulk.isSelected(t.id)}
                    onToggleSelect={bulk.toggle}
                  />
                )}
              />
            </Card>
          ) : (
            trades.length === 0 ? (
              <JournalEmptyState
                onAddTrade={openAddTrade}
                onImportCSV={() => setCsvModalOpen(true)}
              />
            ) : (
              <Card>
                <div style={{
                  padding: 48, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 14, color: C.t2, marginBottom: 8 }}>
                    No trades match your filters
                  </div>
                  <button
                    onClick={() => {
                      setFilter('');
                      setSideFilter('all');
                      setDateRange('all');
                      setAssetClassFilter('all');
                      setAdvancedFilters({});
                    }}
                    className="tf-btn tf-link"
                    style={{
                      border: 'none', background: 'transparent',
                      color: C.b, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              </Card>
            )
          )}
        </>
      )}

      {/* Modals */}
      <TradeFormModal isOpen={tradeFormOpen} onClose={() => { setTradeFormOpen(false); setEditTrade(null); }} editTrade={editTrade} />
      <CSVImportModal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} />

      {/* Context Performance Slide-out (Sprint 9) */}
      <ContextPerformanceTab
        trades={trades}
        isOpen={showContextPerf}
        onClose={() => setShowContextPerf(false)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SESSION CARD
// ═══════════════════════════════════════════════════════════════════

function SessionCard({ label, value, color, large }) {
  return (
    <Card style={{
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </div>
      <div style={{
        fontSize: large ? 24 : 18,
        fontWeight: 800,
        fontFamily: M,
        color: color || C.t1,
      }}>
        {value}
      </div>
    </Card>
  );
}
