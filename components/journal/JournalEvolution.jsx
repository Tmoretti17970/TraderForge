// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Journal Evolution Components
// Sprint 9 C9.4-C9.9
//
// C9.4 — StreakTimeline: Visual W/L timeline strip
// C9.5 — TradeNotesEditor: Rich notes with markdown preview
// C9.6 — AdvancedFilters: Multi-criteria filter panel
// C9.7 — ContextBadge: Shows trade intelligence context inline
// C9.8 — TemplatePicker: Select template when adding trade
// C9.9 — TradeChecklistPanel: Interactive checklist from template
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../../constants.js';
import { fmtD } from '../../utils.js';

// ═══════════════════════════════════════════════════════════════════
// C9.4 — STREAK TIMELINE
// ═══════════════════════════════════════════════════════════════════

/**
 * Horizontal strip showing W/L pattern of recent trades.
 * @param {Array} trades - Sorted trades (newest first)
 * @param {number} maxShow - Max trades to show (default 50)
 * @param {Function} onTradeClick - Click handler for a trade dot
 */
export function StreakTimeline({ trades, maxShow = 50, onTradeClick }) {
  const recent = trades.slice(0, maxShow).reverse(); // oldest→newest left→right
  if (!recent.length) return null;

  const totalPnl = recent.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = recent.filter(t => (t.pnl ?? 0) > 0).length;

  return (
    <div style={{
      padding: '8px 14px', marginBottom: 8,
      background: C.sf, borderRadius: 8,
      border: `1px solid ${C.bd}`,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 6,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M }}>
          Last {recent.length} trades
        </span>
        <span style={{
          fontSize: 10, fontFamily: M, fontWeight: 700,
          color: totalPnl >= 0 ? C.g : C.r,
        }}>
          {fmtD(totalPnl)} · {wins}W/{recent.length - wins}L
        </span>
      </div>

      <div style={{
        display: 'flex', gap: 2, alignItems: 'flex-end',
        height: 24, overflow: 'hidden',
      }}>
        {recent.map((t, i) => {
          const pnl = t.pnl ?? 0;
          const isWin = pnl > 0;
          const maxPnl = Math.max(...recent.map(r => Math.abs(r.pnl ?? 0)), 1);
          const h = Math.max(4, Math.round((Math.abs(pnl) / maxPnl) * 22));

          return (
            <div
              key={t.id || i}
              onClick={() => onTradeClick?.(t)}
              title={`${t.symbol} ${fmtD(pnl)}`}
              style={{
                flex: 1, maxWidth: 8, minWidth: 3,
                height: h,
                borderRadius: 1.5,
                background: isWin ? C.g + '80' : pnl < 0 ? C.r + '80' : C.t3 + '40',
                cursor: onTradeClick ? 'pointer' : 'default',
                alignSelf: 'flex-end',
                transition: 'opacity 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            />
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// C9.5 — TRADE NOTES EDITOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Notes field with markdown preview toggle.
 * @param {string} value
 * @param {Function} onChange
 */
export function TradeNotesEditor({ value, onChange }) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4,
      }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: M }}>
          Notes
        </label>
        <button className="tf-btn"
          onClick={() => setPreview(!preview)}
          style={{
            background: 'none', border: 'none',
            fontSize: 9, color: C.b, cursor: 'pointer',
            fontFamily: M, fontWeight: 600,
          }}
        >
          {preview ? '✏️ Edit' : '👁 Preview'}
        </button>
      </div>

      {preview ? (
        <div style={{
          minHeight: 80, padding: '8px 10px',
          borderRadius: 6, border: `1px solid ${C.bd}`,
          background: C.sf, fontSize: 11, color: C.t2,
          lineHeight: 1.6, fontFamily: F,
          whiteSpace: 'pre-wrap',
        }}>
          {renderMarkdown(value || 'No notes yet.')}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Trade notes... (supports **bold**, *italic*, - lists)"
          rows={4}
          style={{
            width: '100%', padding: '8px 10px',
            borderRadius: 6, border: `1px solid ${C.bd}`,
            background: C.sf, color: C.t1,
            fontSize: 11, fontFamily: M,
            resize: 'vertical', outline: 'none',
            lineHeight: 1.5,
          }}
        />
      )}
    </div>
  );
}

/** Simple markdown-like rendering (bold, italic, lists) */
function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <div key={i} style={{ paddingLeft: 12 }}>• {formatInline(line.slice(2))}</div>;
    }
    // Headers
    if (line.startsWith('# ')) {
      return <div key={i} style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{formatInline(line.slice(2))}</div>;
    }
    if (line.startsWith('## ')) {
      return <div key={i} style={{ fontWeight: 700, fontSize: 12, marginTop: 2 }}>{formatInline(line.slice(3))}</div>;
    }
    return <div key={i}>{formatInline(line) || '\u00A0'}</div>;
  });
}

function formatInline(text) {
  // Bold: **text**
  return text.replace(/\*\*(.+?)\*\*/g, (_, m) => m)
             .replace(/\*(.+?)\*/g, (_, m) => m);
}

// ═══════════════════════════════════════════════════════════════════
// C9.6 — ADVANCED FILTERS PANEL
// ═══════════════════════════════════════════════════════════════════

/**
 * Multi-criteria filter expansion panel.
 * @param {Object} filters - Current filter state
 * @param {Function} onFiltersChange - Update filters
 * @param {Array} trades - All trades (for extracting unique values)
 */
export function AdvancedFilters({ filters, onFiltersChange, trades }) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract unique values for filter options
  const options = useMemo(() => {
    const playbooks = [...new Set(trades.map(t => t.playbook).filter(Boolean))];
    const emotions = [...new Set(trades.map(t => t.emotion).filter(Boolean))];
    const symbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))].sort();
    const tags = [...new Set(trades.flatMap(t => t.tags || []))].sort();
    const contextTags = [...new Set(trades.flatMap(t => t.context?.tags || []))].sort();
    return { playbooks, emotions, symbols, tags, contextTags };
  }, [trades]);

  const updateFilter = (key, val) => {
    onFiltersChange({ ...filters, [key]: val });
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <button className="tf-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none',
          fontSize: 10, fontWeight: 600, color: C.b,
          cursor: 'pointer', fontFamily: M, padding: '4px 0',
        }}
      >
        {isOpen ? '▼' : '▶'} Advanced Filters
        {countActiveFilters(filters) > 0 && (
          <span style={{
            marginLeft: 6, padding: '1px 6px', borderRadius: 10,
            background: C.b + '20', color: C.b, fontSize: 9,
          }}>
            {countActiveFilters(filters)}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8, padding: '8px 0',
        }}>
          {/* Playbook filter */}
          <FilterChipGroup
            label="Strategy"
            options={options.playbooks}
            selected={filters.playbooks || []}
            onChange={(val) => updateFilter('playbooks', val)}
          />

          {/* Emotion filter */}
          <FilterChipGroup
            label="Emotion"
            options={options.emotions}
            selected={filters.emotions || []}
            onChange={(val) => updateFilter('emotions', val)}
          />

          {/* Symbol filter */}
          <FilterChipGroup
            label="Symbol"
            options={options.symbols.slice(0, 10)}
            selected={filters.symbols || []}
            onChange={(val) => updateFilter('symbols', val)}
          />

          {/* Tags filter */}
          <FilterChipGroup
            label="Tags"
            options={options.tags.slice(0, 10)}
            selected={filters.tags || []}
            onChange={(val) => updateFilter('tags', val)}
          />

          {/* Context tags (from intelligence layer) */}
          {options.contextTags.length > 0 && (
            <FilterChipGroup
              label="Context Tags"
              options={options.contextTags.slice(0, 10)}
              selected={filters.contextTags || []}
              onChange={(val) => updateFilter('contextTags', val)}
            />
          )}

          {/* P&L range */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 4 }}>
              P&L Range
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="number"
                placeholder="Min"
                value={filters.pnlMin ?? ''}
                onChange={(e) => updateFilter('pnlMin', e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.pnlMax ?? ''}
                onChange={(e) => updateFilter('pnlMax', e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Outcome filter */}
          <FilterChipGroup
            label="Outcome"
            options={['Win', 'Loss', 'Breakeven']}
            selected={filters.outcomes || []}
            onChange={(val) => updateFilter('outcomes', val)}
          />

          {/* Confluence score range */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 4 }}>
              Confluence Score
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <ChipBtn
                label="Low (0-30)"
                active={(filters.confluenceRange || []).includes('low')}
                onClick={() => toggleInArray('confluenceRange', 'low', filters, updateFilter)}
              />
              <ChipBtn
                label="Med (30-60)"
                active={(filters.confluenceRange || []).includes('medium')}
                onClick={() => toggleInArray('confluenceRange', 'medium', filters, updateFilter)}
              />
              <ChipBtn
                label="High (60+)"
                active={(filters.confluenceRange || []).includes('high')}
                onClick={() => toggleInArray('confluenceRange', 'high', filters, updateFilter)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChipGroup({ label, options, selected, onChange }) {
  if (!options.length) return null;

  const toggle = (opt) => {
    const next = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt];
    onChange(next);
  };

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {options.map(opt => (
          <ChipBtn
            key={opt}
            label={opt}
            active={selected.includes(opt)}
            onClick={() => toggle(opt)}
          />
        ))}
      </div>
    </div>
  );
}

function ChipBtn({ label, active, onClick }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        padding: '2px 8px', borderRadius: 4,
        border: `1px solid ${active ? C.b + '60' : C.bd}`,
        background: active ? C.b + '15' : 'transparent',
        color: active ? C.b : C.t3,
        fontSize: 9, fontWeight: 600, fontFamily: M,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function toggleInArray(key, val, filters, updateFilter) {
  const arr = filters[key] || [];
  const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  updateFilter(key, next);
}

const inputStyle = {
  width: '100%', padding: '4px 8px', fontSize: 10,
  borderRadius: 4, border: `1px solid ${C.bd}`,
  background: C.sf, color: C.t1, fontFamily: M,
  outline: 'none',
};

function countActiveFilters(filters) {
  if (!filters) return 0;
  let count = 0;
  if (filters.playbooks?.length) count++;
  if (filters.emotions?.length) count++;
  if (filters.symbols?.length) count++;
  if (filters.tags?.length) count++;
  if (filters.contextTags?.length) count++;
  if (filters.outcomes?.length) count++;
  if (filters.pnlMin != null) count++;
  if (filters.pnlMax != null) count++;
  if (filters.confluenceRange?.length) count++;
  return count;
}

/**
 * Apply advanced filters to trade list.
 * @param {Array} trades
 * @param {Object} filters
 * @returns {Array}
 */
export function applyAdvancedFilters(trades, filters) {
  if (!filters) return trades;
  let list = trades;

  if (filters.playbooks?.length) {
    list = list.filter(t => filters.playbooks.includes(t.playbook));
  }
  if (filters.emotions?.length) {
    list = list.filter(t => filters.emotions.includes(t.emotion));
  }
  if (filters.symbols?.length) {
    list = list.filter(t => filters.symbols.includes(t.symbol));
  }
  if (filters.tags?.length) {
    list = list.filter(t => (t.tags || []).some(tag => filters.tags.includes(tag)));
  }
  if (filters.contextTags?.length) {
    list = list.filter(t =>
      (t.context?.tags || []).some(tag => filters.contextTags.includes(tag))
    );
  }
  if (filters.outcomes?.length) {
    list = list.filter(t => {
      const pnl = t.pnl ?? 0;
      if (filters.outcomes.includes('Win') && pnl > 0) return true;
      if (filters.outcomes.includes('Loss') && pnl < 0) return true;
      if (filters.outcomes.includes('Breakeven') && pnl === 0) return true;
      return false;
    });
  }
  if (filters.pnlMin != null) {
    list = list.filter(t => (t.pnl ?? 0) >= filters.pnlMin);
  }
  if (filters.pnlMax != null) {
    list = list.filter(t => (t.pnl ?? 0) <= filters.pnlMax);
  }
  if (filters.confluenceRange?.length) {
    list = list.filter(t => {
      const score = t.context?.confluenceScore ?? 0;
      if (filters.confluenceRange.includes('low') && score < 30) return true;
      if (filters.confluenceRange.includes('medium') && score >= 30 && score < 60) return true;
      if (filters.confluenceRange.includes('high') && score >= 60) return true;
      return false;
    });
  }

  return list;
}

// ═══════════════════════════════════════════════════════════════════
// C9.7 — CONTEXT BADGE
// ═══════════════════════════════════════════════════════════════════

/**
 * Inline badge showing trade context from intelligence layer.
 * @param {Object} context - trade.context from PatternJournalLinker
 */
export function ContextBadge({ context }) {
  if (!context?.tags?.length) return null;

  const score = context.confluenceScore ?? 0;
  const color = score >= 60 ? C.g : score >= 30 ? C.y : C.t3;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <span style={{
        fontSize: 8, fontWeight: 800, fontFamily: M,
        padding: '1px 5px', borderRadius: 3,
        background: color + '15', color,
      }}>
        C:{score}
      </span>
      {context.tags.slice(0, 3).map((tag, i) => (
        <span key={i} style={{
          fontSize: 7, fontWeight: 600, fontFamily: M,
          padding: '1px 4px', borderRadius: 2,
          background: C.b + '10', color: C.t3,
        }}>
          {tag}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// C9.8 — TEMPLATE PICKER
// ═══════════════════════════════════════════════════════════════════

/**
 * Horizontal strip of template buttons for the trade form.
 * @param {Array} templates
 * @param {string} activeId - Currently selected template
 * @param {Function} onSelect
 */
export function TemplatePicker({ templates, activeId, onSelect }) {
  if (!templates?.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.t3,
        fontFamily: M, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        Templates
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {templates.map(tpl => (
          <button className="tf-btn"
            key={tpl.id}
            onClick={() => onSelect(tpl)}
            style={{
              padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${activeId === tpl.id ? C.b : C.bd}`,
              background: activeId === tpl.id ? C.b + '15' : C.sf,
              color: activeId === tpl.id ? C.b : C.t2,
              fontSize: 10, fontWeight: 600, fontFamily: F,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span>{tpl.icon || '📋'}</span>
            {tpl.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// C9.9 — TRADE CHECKLIST PANEL
// ═══════════════════════════════════════════════════════════════════

/**
 * Interactive checklist from a trade template.
 * @param {Array} items - Checklist items from template
 * @param {Object} checked - { itemId: boolean }
 * @param {Function} onToggle - (itemId) => void
 */
export function TradeChecklistPanel({ items, checked, onToggle }) {
  if (!items?.length) return null;

  const completedCount = items.filter(it => checked[it.id]).length;
  const requiredItems = items.filter(it => it.required);
  const requiredDone = requiredItems.filter(it => checked[it.id]).length;
  const allRequiredDone = requiredItems.length === 0 || requiredDone === requiredItems.length;

  return (
    <div style={{
      padding: '8px 0', marginBottom: 8,
      borderRadius: 6, border: `1px solid ${C.bd}`,
      background: C.sf,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 10px 6px', borderBottom: `1px solid ${C.bd}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.t1, fontFamily: M }}>
          Pre-Trade Checklist
        </span>
        <span style={{
          fontSize: 9, fontFamily: M, fontWeight: 700,
          color: allRequiredDone ? C.g : C.y,
        }}>
          {completedCount}/{items.length}
        </span>
      </div>

      {items.map(item => (
        <div
          key={item.id}
          onClick={() => onToggle(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', cursor: 'pointer',
            opacity: checked[item.id] ? 0.6 : 1,
          }}
        >
          <div style={{
            width: 16, height: 16, borderRadius: 3,
            border: `2px solid ${checked[item.id] ? C.g : C.bd}`,
            background: checked[item.id] ? C.g : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {checked[item.id] && (
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>
            )}
          </div>
          <span style={{
            fontSize: 10, color: C.t1, fontFamily: F,
            textDecoration: checked[item.id] ? 'line-through' : 'none',
          }}>
            {item.text}
          </span>
          {item.required && (
            <span style={{ fontSize: 7, color: C.r, fontWeight: 800, fontFamily: M }}>
              REQ
            </span>
          )}
        </div>
      ))}

      {!allRequiredDone && (
        <div style={{
          padding: '4px 10px', fontSize: 9, color: C.y,
          fontFamily: M, fontWeight: 600,
        }}>
          ⚠ {requiredItems.length - requiredDone} required item{requiredItems.length - requiredDone > 1 ? 's' : ''} unchecked
        </div>
      )}
    </div>
  );
}
