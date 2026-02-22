// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Bulk Operations Engine
// Sprint 9 C9.1: Select multiple trades, apply bulk actions.
//
// Features:
//   - Select all / select none / invert selection
//   - Bulk delete with undo
//   - Bulk tag (add/remove tags)
//   - Bulk edit field (emotion, playbook, side)
//   - Bulk export selected
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import { useTradeStore } from '../../state/useTradeStore.js';

/**
 * Hook for managing bulk selection state.
 * @param {Array} trades - filtered trade list
 */
export function useBulkSelection(trades) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggle = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(trades.map(t => t.id)));
  }, [trades]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const invertSelection = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set();
      for (const t of trades) {
        if (!prev.has(t.id)) next.add(t.id);
      }
      return next;
    });
  }, [trades]);

  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);
  const count = selectedIds.size;
  const hasSelection = count > 0;
  const allSelected = count === trades.length && trades.length > 0;

  const selectedTrades = useMemo(() =>
    trades.filter(t => selectedIds.has(t.id)),
    [trades, selectedIds]
  );

  return {
    selectedIds, selectedTrades, count, hasSelection, allSelected,
    toggle, selectAll, selectNone, invertSelection, isSelected,
  };
}

/**
 * Bulk action bar — renders above the trade list when items are selected.
 */
export function BulkActionBar({
  count, allSelected, onSelectAll, onSelectNone, onInvert,
  onBulkDelete, onBulkTag, onBulkEdit, onBulkExport,
}) {
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagValue, setTagValue] = useState('');
  const [showEditMenu, setShowEditMenu] = useState(false);

  if (count === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', marginBottom: 8,
      background: C.b + '10', borderRadius: 8,
      border: `1px solid ${C.b}30`,
      flexWrap: 'wrap',
    }}>
      {/* Selection info */}
      <div style={{
        fontSize: 12, fontWeight: 700, color: C.b,
        fontFamily: M, marginRight: 4,
      }}>
        {count} selected
      </div>

      {/* Selection toggles */}
      <BulkBtn label={allSelected ? 'None' : 'All'} onClick={allSelected ? onSelectNone : onSelectAll} />
      <BulkBtn label="Invert" onClick={onInvert} />

      <div style={{ width: 1, height: 20, background: C.bd, margin: '0 4px' }} />

      {/* Tag action */}
      {showTagInput ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="Tag name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagValue.trim()) {
                onBulkTag(tagValue.trim());
                setTagValue('');
                setShowTagInput(false);
              }
              if (e.key === 'Escape') setShowTagInput(false);
            }}
            style={{
              width: 100, padding: '3px 8px', fontSize: 10,
              borderRadius: 4, border: `1px solid ${C.bd}`,
              background: C.sf, color: C.t1, fontFamily: M,
              outline: 'none',
            }}
          />
          <BulkBtn label="Add" onClick={() => {
            if (tagValue.trim()) { onBulkTag(tagValue.trim()); setTagValue(''); setShowTagInput(false); }
          }} />
          <BulkBtn label="✕" onClick={() => setShowTagInput(false)} />
        </div>
      ) : (
        <BulkBtn label="🏷 Tag" onClick={() => setShowTagInput(true)} />
      )}

      {/* Edit menu */}
      <div style={{ position: 'relative' }}>
        <BulkBtn label="✏️ Edit" onClick={() => setShowEditMenu(!showEditMenu)} />
        {showEditMenu && (
          <>
            <div onClick={() => setShowEditMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: C.bg, border: `1px solid ${C.bd}`,
              borderRadius: 6, padding: 4, zIndex: 99, minWidth: 140,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {[
                { label: 'Set Emotion → Confident', field: 'emotion', value: 'confident' },
                { label: 'Set Emotion → Fearful', field: 'emotion', value: 'fearful' },
                { label: 'Set Emotion → Neutral', field: 'emotion', value: 'neutral' },
                { label: 'Set Emotion → Greedy', field: 'emotion', value: 'greedy' },
                null,
                { label: 'Clear Emotion', field: 'emotion', value: '' },
                { label: 'Clear Playbook', field: 'playbook', value: '' },
                { label: 'Clear Notes', field: 'notes', value: '' },
              ].map((item, i) => item === null ? (
                <div key={i} style={{ height: 1, background: C.bd, margin: '2px 0' }} />
              ) : (
                <button className="tf-btn"
                  key={i}
                  onClick={() => {
                    onBulkEdit(item.field, item.value);
                    setShowEditMenu(false);
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '5px 10px', fontSize: 10, fontFamily: F,
                    background: 'none', border: 'none', color: C.t2,
                    cursor: 'pointer', borderRadius: 4,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.sf}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Export */}
      <BulkBtn label="↓ Export" onClick={onBulkExport} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Delete */}
      <BulkBtn label="🗑 Delete" onClick={onBulkDelete} danger />
    </div>
  );
}

function BulkBtn({ label, onClick, danger }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        padding: '3px 10px', borderRadius: 4,
        border: `1px solid ${danger ? C.r + '40' : C.bd}`,
        background: danger ? C.r + '10' : C.sf,
        color: danger ? C.r : C.t2,
        fontSize: 10, fontWeight: 600, fontFamily: M,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export default BulkActionBar;
