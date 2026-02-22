// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Journal Trade Row (Sprint 9 update)
// Added: selection checkbox, context badge, replay button
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../constants.js';
import { Btn } from '../UIKit.jsx';
import { fmtD } from '../../utils.js';
import { ContextBadge } from './JournalEvolution.jsx';

const GRID_COLS = '28px 100px 80px 55px 1fr 80px 100px';
const GRID_COLS_NO_CHECK = '100px 80px 55px 1fr 80px 100px';

// ─── Desktop Grid Row ──────────────────────────────────────────

function DesktopRow({ trade: t, isExpanded, onClick, bulkMode, isSelected, onToggleSelect }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: bulkMode ? GRID_COLS : GRID_COLS_NO_CHECK,
        padding: '10px 16px',
        borderBottom: `1px solid ${isExpanded ? 'transparent' : C.bd}`,
        fontSize: 12,
        color: C.t1,
        cursor: 'pointer',
        transition: 'background 0.1s',
        background: isSelected ? C.b + '08' : isExpanded ? C.sf : 'transparent',
      }}
      onMouseEnter={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = C.sf2; }}
      onMouseLeave={(e) => { if (!isExpanded && !isSelected) e.currentTarget.style.background = isSelected ? C.b + '08' : 'transparent'; }}
    >
      {bulkMode && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(t.id); }}
          style={{
            width: 18, height: 18, borderRadius: 4,
            border: `2px solid ${isSelected ? C.b : C.bd}`,
            background: isSelected ? C.b : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, alignSelf: 'center',
          }}
        >
          {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
        </div>
      )}
      <div style={{ fontFamily: M, fontSize: 11, color: C.t2 }}>
        {t.date ? new Date(t.date).toLocaleDateString() : '—'}
      </div>
      <div style={{ fontWeight: 700 }}>{t.symbol}</div>
      <div style={{ color: t.side === 'long' ? C.g : C.r, fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
        {t.side}
      </div>
      <div style={{ color: C.t2, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
        {t.playbook || '—'}
        {t.context?.tags?.length > 0 && <ContextBadge context={t.context} />}
      </div>
      <div style={{ fontSize: 11 }}>{t.emotion || '—'}</div>
      <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: (t.pnl || 0) >= 0 ? C.g : C.r }}>
        {fmtD(t.pnl)}
      </div>
    </div>
  );
}

// ─── Mobile/Tablet Card Row ────────────────────────────────────

function MobileRow({ trade: t, isExpanded, onClick, bulkMode, isSelected, onToggleSelect }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${C.bd}`,
        cursor: 'pointer',
        background: isSelected ? C.b + '08' : isExpanded ? C.sf : 'transparent',
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}
    >
      {bulkMode && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(t.id); }}
          style={{
            width: 18, height: 18, borderRadius: 4,
            border: `2px solid ${isSelected ? C.b : C.bd}`,
            background: isSelected ? C.b : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, marginTop: 2,
          }}
        >
          {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>✓</span>}
        </div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>{t.symbol}</span>
            <span style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{t.side}</span>
          </div>
          <span style={{ fontFamily: M, fontWeight: 700, fontSize: 13, color: (t.pnl || 0) >= 0 ? C.g : C.r }}>
            {fmtD(t.pnl)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: C.t3, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>{t.date ? new Date(t.date).toLocaleDateString() : '—'}</span>
          {t.playbook && <span>· {t.playbook}</span>}
          {t.emotion && <span>· {t.emotion}</span>}
          {t.context?.tags?.length > 0 && <ContextBadge context={t.context} />}
        </div>
      </div>
    </div>
  );
}

// ─── Expanded Detail Panel ─────────────────────────────────────

function ExpandedDetail({ trade: t, isTablet, deleteConfirm, onEdit, onDelete, onDeleteConfirm, onCancelDelete, onViewChart, onReplay }) {
  return (
    <div style={{
      padding: '12px 16px 16px',
      background: C.sf,
      borderBottom: `1px solid ${C.bd}`,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        <DetailItem label="Entry" value={t.entry != null ? `$${t.entry}` : '—'} />
        <DetailItem label="Exit" value={t.exit != null ? `$${t.exit}` : '—'} />
        <DetailItem label="Qty" value={t.qty ?? '—'} />
        <DetailItem label="Fees" value={t.fees != null ? `$${t.fees}` : '—'} />
        <DetailItem label="R-Multiple" value={t.rMultiple != null ? `${t.rMultiple}R` : '—'} />
        <DetailItem label="Asset Class" value={t.assetClass || '—'} />
        <DetailItem label="Rule Break" value={t.ruleBreak ? '⚠ Yes' : 'No'} color={t.ruleBreak ? C.r : C.t3} />
        <DetailItem label="Time" value={t.date ? new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} />
      </div>

      {/* Context from Intelligence Layer */}
      {t.context && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 4, fontFamily: M }}>Context</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 9, fontWeight: 700, fontFamily: M,
              padding: '2px 6px', borderRadius: 3,
              background: (t.context.confluenceScore ?? 0) >= 60 ? C.g + '15' : C.y + '15',
              color: (t.context.confluenceScore ?? 0) >= 60 ? C.g : C.y,
            }}>
              Confluence: {t.context.confluenceScore ?? 0}
            </span>
            {t.context.summary && (
              <span style={{ fontSize: 9, color: C.t3 }}>{t.context.summary}</span>
            )}
          </div>
        </div>
      )}

      {/* Checklist results */}
      {t.checklist && Object.keys(t.checklist).length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 4, fontFamily: M }}>Checklist</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(t.checklist).map(([key, val]) => (
              <span key={key} style={{
                fontSize: 8, fontFamily: M, padding: '1px 6px',
                borderRadius: 3,
                background: val ? C.g + '10' : C.r + '10',
                color: val ? C.g : C.r,
              }}>
                {val ? '✓' : '✗'} {key}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {t.tags?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 4, fontFamily: M }}>Tags</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {t.tags.map((tag, i) => (
              <span key={i} style={{
                padding: '2px 8px', borderRadius: 4,
                background: C.b + '15', color: C.b,
                fontSize: 10, fontWeight: 600,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {t.notes && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 4, fontFamily: M }}>Notes</div>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.notes}</div>
        </div>
      )}

      {/* Screenshots */}
      {t.screenshots?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 4, fontFamily: M }}>
            Screenshots ({t.screenshots.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {t.screenshots.map((shot, i) => (
              <a key={i} href={shot.data} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', width: 120, height: 80, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.bd}`, cursor: 'zoom-in' }}>
                <img src={shot.data} alt={shot.name || `Screenshot ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {deleteConfirm === t.id ? (
          <>
            <span style={{ fontSize: 11, color: C.r, alignSelf: 'center', marginRight: 4 }}>Delete this trade?</span>
            <Btn variant="ghost" onClick={onCancelDelete} style={{ fontSize: 11, padding: '6px 12px' }}>Cancel</Btn>
            <Btn variant="danger" onClick={() => onDelete(t.id)} style={{ fontSize: 11, padding: '6px 12px' }}>Confirm Delete</Btn>
          </>
        ) : (
          <>
            {onReplay && (
              <Btn variant="ghost" onClick={() => onReplay(t)} style={{ fontSize: 11, padding: '6px 12px' }}>
                ⏪ Replay
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => onViewChart(t)} style={{ fontSize: 11, padding: '6px 12px' }}>📈 Chart</Btn>
            <Btn variant="ghost" onClick={() => onDeleteConfirm(t.id)} style={{ fontSize: 11, padding: '6px 12px' }}>Delete</Btn>
            <Btn onClick={() => onEdit(t)} style={{ fontSize: 11, padding: '6px 12px' }}>Edit</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Detail Item ───────────────────────────────────────────────

function DetailItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 2, fontFamily: M }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: color || C.t1 }}>{value}</div>
    </div>
  );
}

// ─── Composed Trade Row ────────────────────────────────────────

function JournalTradeRow({
  trade, isExpanded, isTablet, deleteConfirm,
  onToggleExpand, onEdit, onDelete, onDeleteConfirm, onCancelDelete, onViewChart, onReplay,
  bulkMode = false, isSelected = false, onToggleSelect,
}) {
  const onClick = () => onToggleExpand(trade.id);
  const RowComponent = isTablet ? MobileRow : DesktopRow;

  return (
    <React.Fragment>
      <RowComponent
        trade={trade} isExpanded={isExpanded} onClick={onClick}
        bulkMode={bulkMode} isSelected={isSelected} onToggleSelect={onToggleSelect}
      />
      {isExpanded && (
        <ExpandedDetail
          trade={trade} isTablet={isTablet} deleteConfirm={deleteConfirm}
          onEdit={onEdit} onDelete={onDelete} onDeleteConfirm={onDeleteConfirm}
          onCancelDelete={onCancelDelete} onViewChart={onViewChart} onReplay={onReplay}
        />
      )}
    </React.Fragment>
  );
}

export { GRID_COLS, GRID_COLS_NO_CHECK, DetailItem };
export default React.memo(JournalTradeRow);
