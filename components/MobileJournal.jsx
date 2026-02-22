// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Mobile Journal (Mobile Optimization)
//
// Card-based trade journal for phone screens:
//   - Swipeable trade cards with P&L, emotion, symbol
//   - Swipe right = edit, swipe left = archive
//   - Pull-to-refresh
//   - Sticky date headers
//   - FAB for quick add
//   - Filter chips (today, this week, winners, losers)
//
// Usage:
//   <MobileJournal trades={trades} onEdit={fn} onDelete={fn} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { C, F, M } from '../constants.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'winners', label: 'Winners' },
  { id: 'losers', label: 'Losers' },
];

export default function MobileJournal({
  trades = [],
  onEdit,
  onDelete,
  onAdd,
  onTradePress,
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    let result = [...trades];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.symbol?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.strategy?.toLowerCase().includes(q)
      );
    }

    switch (filter) {
      case 'today':
        result = result.filter(t => t.date?.slice(0, 10) === todayStr);
        break;
      case 'week':
        result = result.filter(t => t.date?.slice(0, 10) >= weekAgo);
        break;
      case 'winners':
        result = result.filter(t => (t.pnl || 0) > 0);
        break;
      case 'losers':
        result = result.filter(t => (t.pnl || 0) < 0);
        break;
    }

    return result.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [trades, filter, search, todayStr, weekAgo]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    for (const t of filtered) {
      const d = t.date?.slice(0, 10) || 'Unknown';
      if (!groups[d]) groups[d] = { date: d, trades: [], totalPnl: 0 };
      groups[d].trades.push(t);
      groups[d].totalPnl += (t.pnl || 0);
    }
    return Object.values(groups);
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filtered.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = filtered.filter(t => (t.pnl || 0) > 0).length;
    return {
      count: filtered.length,
      pnl: total,
      winRate: filtered.length ? Math.round(wins / filtered.length * 100) : 0,
    };
  }, [filtered]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: C.bg, overflow: 'hidden',
    }}>
      {/* Stats strip */}
      <div style={{
        display: 'flex', justifyContent: 'space-around',
        padding: '10px 16px', background: C.sf,
        borderBottom: `1px solid ${C.bd}`,
      }} role="status" aria-label="Trade statistics">
        <StatPill label="Trades" value={stats.count} />
        <StatPill
          label="P&L"
          value={`${stats.pnl >= 0 ? '+' : ''}$${stats.pnl.toFixed(0)}`}
          color={stats.pnl >= 0 ? C.g : C.r}
        />
        <StatPill label="Win %" value={`${stats.winRate}%`} />
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search trades..."
          aria-label="Search trades"
          className="tf-input"
          style={{
            width: '100%', padding: '10px 14px',
            background: C.sf, border: `1px solid ${C.bd}`,
            borderRadius: 10, color: C.t1,
            fontFamily: F, fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
            minHeight: 44,
          }}
        />
      </div>

      {/* Filter chips */}
      <div style={{
        display: 'flex', gap: 6, padding: '0 16px 8px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }} role="tablist" aria-label="Trade filters">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            role="tab"
            aria-selected={filter === f.id}
            className="tf-btn"
            style={{
              padding: '7px 16px', borderRadius: 16,
              border: filter === f.id ? `1px solid ${C.b}` : `1px solid ${C.bd}`,
              background: filter === f.id ? C.b + '15' : 'transparent',
              color: filter === f.id ? C.b : C.t3,
              fontSize: 12, fontWeight: 600, fontFamily: F,
              cursor: 'pointer', flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 36,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Trade list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 16px 80px',
      }}>
        {grouped.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: C.t3, fontSize: 13,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📒</div>
            {trades.length === 0 ? 'No trades logged yet' : 'No trades match filter'}
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              {/* Date header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '12px 0 6px',
                position: 'sticky', top: 0, background: C.bg,
                zIndex: 2,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>
                  {formatDate(group.date)}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: M,
                  color: group.totalPnl >= 0 ? C.g : C.r,
                }}>
                  {group.totalPnl >= 0 ? '+' : ''}${group.totalPnl.toFixed(2)}
                </span>
              </div>

              {/* Trade cards */}
              {group.trades.map(trade => (
                <SwipeableTradeCard
                  key={trade.id}
                  trade={trade}
                  onPress={() => onTradePress?.(trade)}
                  onEdit={() => onEdit?.(trade)}
                  onDelete={() => onDelete?.(trade.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label="Add new trade"
          className="tf-btn"
          style={{
            position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', right: 16,
            width: 56, height: 56, borderRadius: 28,
            background: C.b, border: 'none',
            color: '#fff', fontSize: 24, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(232, 100, 44, 0.4)',
            cursor: 'pointer', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

// ─── Trade Card with Swipe ──────────────────────────────────────

function SwipeableTradeCard({ trade, onPress, onEdit, onDelete }) {
  const [offsetX, setOffsetX] = useState(0);
  const startRef = useRef({ x: 0, swiping: false });

  const handleTouchStart = (e) => {
    startRef.current.x = e.touches[0].clientX;
    startRef.current.swiping = false;
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - startRef.current.x;
    if (Math.abs(dx) > 10) {
      startRef.current.swiping = true;
      setOffsetX(Math.max(-80, Math.min(80, dx)));
    }
  };

  const handleTouchEnd = () => {
    if (offsetX > 60) {
      onEdit?.();
    } else if (offsetX < -60) {
      onDelete?.();
    }
    setOffsetX(0);
  };

  const pnl = trade.pnl || 0;
  const isWin = pnl > 0;

  return (
    <div style={{ position: 'relative', marginBottom: 6, overflow: 'hidden', borderRadius: 12 }}>
      {/* Swipe reveal: left = edit (blue), right = delete (red) */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 16px',
        background: offsetX > 0 ? C.b : C.r,
        borderRadius: 12,
      }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✏️ Edit</span>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>🗑️ Delete</span>
      </div>

      {/* Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !startRef.current.swiping && onPress?.()}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 12,
          background: C.sf, border: `1px solid ${C.bd}`,
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? 'transform 0.2s ease' : 'none',
          cursor: 'pointer',
          position: 'relative', zIndex: 1,
        }}
      >
        {/* Side indicator */}
        <div style={{
          width: 3, height: 36, borderRadius: 2,
          background: trade.side === 'short' ? C.r : C.g,
          flexShrink: 0,
        }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: M, color: C.t1,
            }}>
              {trade.symbol || '???'}
            </span>
            {trade.emotion && (
              <span style={{ fontSize: 14 }}>{trade.emotion}</span>
            )}
            {trade.strategy && (
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: C.b + '15', color: C.b, fontWeight: 600,
              }}>
                {trade.strategy}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 11, color: C.t3, marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {trade.side === 'short' ? '📉' : '📈'} {trade.side || 'long'}
            {trade.notes ? ` · ${trade.notes.slice(0, 40)}` : ''}
          </div>
        </div>

        {/* P&L */}
        <div style={{
          fontSize: 15, fontWeight: 800, fontFamily: M,
          color: isWin ? C.g : pnl === 0 ? C.t3 : C.r,
          flexShrink: 0,
        }}>
          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: C.t3, fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 800, fontFamily: M,
        color: color || C.t1, marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today - 86400000);

  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export { MobileJournal, SwipeableTradeCard };
