// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Insights Panel (Sprint 4)
//
// Three-tab panel combining:
//   1. Patterns — behavioral pattern detection results
//   2. Debrief — daily/weekly trade summary
//   3. Checklist — pre-trade discipline checklist
//
// Designed for the Dashboard or as a standalone sidebar panel.
//
// Usage:
//   <InsightsPanel trades={trades} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../constants.js';
import { detectPatterns, gradePatterns } from '../engine/PatternDetector.js';
import { generateDebrief, generateWeeklyDebrief } from '../engine/DailyDebrief.js';
import { useChecklistStore } from '../state/useChecklistStore.js';

const TABS = [
  { id: 'patterns', label: '🔍 Patterns' },
  { id: 'debrief',  label: '📊 Debrief' },
  { id: 'checklist', label: '✅ Checklist' },
];

const SEV_COLORS = {
  danger:  C.r,
  warning: C.y || C.y,
  positive: C.g,
  info:    C.b,
};

const SEV_EMOJI = {
  danger:  '🔴',
  warning: '🟡',
  positive: '🟢',
  info:    '🔵',
};

export default function InsightsPanel({ trades = [] }) {
  const [tab, setTab] = useState('patterns');

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: F, color: C.t2,
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `1px solid ${C.bd}`,
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button className="tf-btn"
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px',
              background: tab === t.id ? C.bg : C.bg2,
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${C.b}` : '2px solid transparent',
              color: tab === t.id ? C.t1 : C.t3,
              fontSize: 12, fontWeight: 600, fontFamily: F,
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'patterns' && <PatternsTab trades={trades} />}
        {tab === 'debrief' && <DebriefTab trades={trades} />}
        {tab === 'checklist' && <ChecklistTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: Patterns
// ═══════════════════════════════════════════════════════════════════

function PatternsTab({ trades }) {
  const insights = useMemo(() => detectPatterns(trades), [trades]);
  const grade = useMemo(() => gradePatterns(insights), [insights]);

  if (insights.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
        <div style={{ fontSize: 13 }}>Not enough data for pattern detection</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Add more trades to unlock behavioral insights</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      {/* Grade badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', background: C.sf, borderRadius: 8,
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 28 }}>{grade.emoji}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, fontFamily: M }}>
            Grade {grade.grade}
          </div>
          <div style={{ fontSize: 11, color: C.t3 }}>{grade.summary}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: C.t3, fontFamily: M }}>
          {insights.length} insight{insights.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Insight cards */}
      {insights.map((ins) => (
        <div
          key={ins.id}
          style={{
            padding: '8px 10px',
            background: C.sf,
            borderRadius: 6,
            marginBottom: 4,
            borderLeft: `3px solid ${SEV_COLORS[ins.severity] || C.b}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 12 }}>{SEV_EMOJI[ins.severity]}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, flex: 1 }}>
              {ins.title}
            </span>
            <span style={{
              fontSize: 8, padding: '1px 5px', borderRadius: 3,
              background: SEV_COLORS[ins.severity] + '15',
              color: SEV_COLORS[ins.severity],
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {ins.category}
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>
            {ins.body}
          </div>
          <div style={{
            display: 'flex', gap: 8, marginTop: 4,
            fontSize: 9, color: C.t3, fontFamily: M,
          }}>
            <span>{ins.sampleSize} trades</span>
            <span>{Math.round(ins.confidence * 100)}% confidence</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: Debrief
// ═══════════════════════════════════════════════════════════════════

function DebriefTab({ trades }) {
  const [mode, setMode] = useState('daily'); // 'daily' | 'weekly'
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, -1 = yesterday, etc.

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d.toISOString().slice(0, 10);
  }, [dateOffset]);

  const debrief = useMemo(() =>
    mode === 'daily'
      ? generateDebrief(trades, targetDate)
      : generateWeeklyDebrief(trades),
    [trades, targetDate, mode]
  );

  return (
    <div style={{ padding: 10 }}>
      {/* Mode + date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <button className="tf-btn"
          onClick={() => setMode('daily')}
          style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: mode === 'daily' ? C.b + '20' : 'transparent',
            border: `1px solid ${mode === 'daily' ? C.b : C.bd}`,
            color: mode === 'daily' ? C.b : C.t3, cursor: 'pointer',
          }}
        >Daily</button>
        <button className="tf-btn"
          onClick={() => setMode('weekly')}
          style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: mode === 'weekly' ? C.b + '20' : 'transparent',
            border: `1px solid ${mode === 'weekly' ? C.b : C.bd}`,
            color: mode === 'weekly' ? C.b : C.t3, cursor: 'pointer',
          }}
        >Weekly</button>

        {mode === 'daily' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="tf-btn" onClick={() => setDateOffset(d => d - 1)}
              style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14 }}>◀</button>
            <span style={{ fontSize: 11, color: C.t1, fontFamily: M, minWidth: 80, textAlign: 'center' }}>
              {dateOffset === 0 ? 'Today' : dateOffset === -1 ? 'Yesterday' : targetDate}
            </span>
            <button className="tf-btn" onClick={() => setDateOffset(d => Math.min(d + 1, 0))}
              disabled={dateOffset >= 0}
              style={{ background: 'none', border: 'none', color: dateOffset >= 0 ? C.bd : C.t3, cursor: 'pointer', fontSize: 14 }}>▶</button>
          </div>
        )}
      </div>

      {mode === 'daily' && debrief && (
        <DailyContent debrief={debrief} />
      )}

      {mode === 'weekly' && debrief && (
        <WeeklyContent summary={debrief} />
      )}
    </div>
  );
}

function DailyContent({ debrief }) {
  if (debrief.totalTrades === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 12 }}>{debrief.headline}</div>
      </div>
    );
  }

  return (
    <>
      {/* Headline */}
      <div style={{
        padding: '10px 12px', background: C.sf, borderRadius: 8,
        marginBottom: 10, fontSize: 13, fontWeight: 600, color: C.t1,
      }}>
        {debrief.headline}
        {debrief.grade && (
          <span style={{
            float: 'right', fontSize: 12, fontFamily: M, fontWeight: 800,
            color: debrief.grade.startsWith('A') ? C.g : debrief.grade.startsWith('D') ? C.r : C.y,
          }}>
            Grade {debrief.grade}
          </span>
        )}
      </div>

      {/* Sections */}
      {debrief.sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.t3,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
          }}>
            {sec.title}
          </div>
          {sec.items.map((item, j) => (
            <div key={j} style={{ fontSize: 11, color: C.t2, padding: '2px 0', lineHeight: 1.5 }}>
              {item}
            </div>
          ))}
        </div>
      ))}

      {/* Observations */}
      {debrief.observations.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: C.t3,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
          }}>
            Observations
          </div>
          {debrief.observations.map((obs, i) => (
            <div
              key={i}
              style={{
                fontSize: 11, padding: '5px 8px', marginBottom: 3,
                background: (obs.type === 'warning' ? C.y : obs.type === 'positive' ? C.g : C.b) + '10',
                borderRadius: 4, color: C.t2, lineHeight: 1.4,
                borderLeft: `3px solid ${obs.type === 'warning' ? C.y : obs.type === 'positive' ? C.g : C.b}`,
              }}
            >
              {obs.text}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function WeeklyContent({ summary }) {
  if (summary.totalTrades === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
        <div style={{ fontSize: 12 }}>No trades this week</div>
      </div>
    );
  }

  const fmtD = (n) => (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(0);

  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10,
      }}>
        {[
          { label: 'Total P&L', value: fmtD(summary.totalPnl), color: summary.totalPnl >= 0 ? C.g : C.r },
          { label: 'Win Rate', value: summary.winRate.toFixed(0) + '%', color: summary.winRate >= 50 ? C.g : C.r },
          { label: 'Trades', value: summary.totalTrades, color: C.t1 },
          { label: 'Trading Days', value: summary.tradingDays, color: C.t1 },
          { label: 'Avg P&L/Day', value: fmtD(summary.avgPnlPerDay), color: summary.avgPnlPerDay >= 0 ? C.g : C.r },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '8px 10px', background: C.sf, borderRadius: 6,
          }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stat.color, fontFamily: M, marginTop: 2 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {summary.bestDay && (
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          Best day: {summary.bestDay.date} ({fmtD(summary.bestDay.pnl)}, {summary.bestDay.trades} trades)
        </div>
      )}
      {summary.worstDay && (
        <div style={{ fontSize: 11, color: C.t2, marginBottom: 4 }}>
          Worst day: {summary.worstDay.date} ({fmtD(summary.worstDay.pnl)}, {summary.worstDay.trades} trades)
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: Pre-Trade Checklist
// ═══════════════════════════════════════════════════════════════════

function ChecklistTab() {
  const items = useChecklistStore(s => s.items);
  const checked = useChecklistStore(s => s.checked);
  const toggleCheck = useChecklistStore(s => s.toggleCheck);
  const resetChecks = useChecklistStore(s => s.resetChecks);
  const checkAll = useChecklistStore(s => s.checkAll);
  const addItem = useChecklistStore(s => s.addItem);
  const removeItem = useChecklistStore(s => s.removeItem);
  const enabled = useChecklistStore(s => s.enabled);
  const toggleEnabled = useChecklistStore(s => s.toggleEnabled);

  const [newLabel, setNewLabel] = useState('');
  const [showCustomize, setShowCustomize] = useState(false);

  const requiredItems = items.filter(i => i.required);
  const optionalItems = items.filter(i => !i.required);
  const passedCount = requiredItems.filter(i => checked[i.id]).length;
  const allPassed = passedCount === requiredItems.length;

  const handleAddItem = useCallback(() => {
    if (!newLabel.trim()) return;
    addItem(newLabel.trim());
    setNewLabel('');
  }, [newLabel, addItem]);

  return (
    <div style={{ padding: 10 }}>
      {/* Header + progress */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
            {allPassed ? '✅ Ready to trade' : `${passedCount}/${requiredItems.length} required`}
          </div>
          <div style={{ fontSize: 10, color: C.t3 }}>
            Complete all required items before entering
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="tf-btn" onClick={checkAll} style={miniBtn}>All ✓</button>
          <button className="tf-btn" onClick={resetChecks} style={miniBtn}>Reset</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, background: C.bd, borderRadius: 2, marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${requiredItems.length > 0 ? (passedCount / requiredItems.length) * 100 : 0}%`,
          background: allPassed ? C.g : C.b,
          borderRadius: 2,
          transition: 'width 0.3s, background 0.3s',
        }} />
      </div>

      {/* Required items */}
      {requiredItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.t3,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
          }}>
            Required
          </div>
          {requiredItems.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleCheck(item.id)}
              onRemove={showCustomize ? () => removeItem(item.id) : null}
            />
          ))}
        </div>
      )}

      {/* Optional items */}
      {optionalItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.t3,
            textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
          }}>
            Optional
          </div>
          {optionalItems.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              onToggle={() => toggleCheck(item.id)}
              onRemove={showCustomize ? () => removeItem(item.id) : null}
            />
          ))}
        </div>
      )}

      {/* Customize toggle */}
      <div style={{ borderTop: `1px solid ${C.bd}`, paddingTop: 8 }}>
        <button className="tf-btn"
          onClick={() => setShowCustomize(!showCustomize)}
          style={{
            ...miniBtn,
            width: '100%',
            fontSize: 11,
            padding: '6px 0',
            marginBottom: showCustomize ? 8 : 0,
          }}
        >
          {showCustomize ? '✓ Done Customizing' : '⚙ Customize Checklist'}
        </button>

        {showCustomize && (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
              placeholder="Add checklist item..."
              style={{
                flex: 1, padding: '5px 8px',
                background: C.sf, border: `1px solid ${C.bd}`,
                borderRadius: 4, color: C.t1, fontFamily: F,
                fontSize: 11, outline: 'none',
              }}
            />
            <button className="tf-btn"
              onClick={handleAddItem}
              disabled={!newLabel.trim()}
              style={{
                padding: '5px 12px', background: C.b,
                border: 'none', borderRadius: 4,
                color: '#fff', fontSize: 11, fontWeight: 600,
                cursor: newLabel.trim() ? 'pointer' : 'default',
                opacity: newLabel.trim() ? 1 : 0.4,
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const miniBtn = {
  padding: '3px 8px',
  background: C.sf,
  border: `1px solid ${C.bd}`,
  borderRadius: 4,
  color: C.t3,
  fontSize: 10,
  cursor: 'pointer',
  fontFamily: F,
};

function ChecklistItem({ item, checked, onToggle, onRemove }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', cursor: 'pointer',
        background: checked ? C.g + '08' : 'transparent',
        borderRadius: 5, marginBottom: 2,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: `2px solid ${checked ? C.g : C.bd}`,
        background: checked ? C.g : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: '#fff', fontWeight: 700,
        transition: 'all 0.15s',
      }}>
        {checked ? '✓' : ''}
      </div>
      <span style={{ fontSize: 10, flexShrink: 0 }}>{item.emoji}</span>
      <span style={{
        fontSize: 12, color: checked ? C.t3 : C.t1, flex: 1,
        textDecoration: checked ? 'line-through' : 'none',
        transition: 'all 0.15s',
      }}>
        {item.label}
      </span>
      {item.required && !checked && (
        <span style={{ fontSize: 8, color: C.r, fontWeight: 700 }}>REQ</span>
      )}
      {onRemove && (
        <button className="tf-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: 'none', border: 'none', color: C.t3,
            fontSize: 12, cursor: 'pointer', padding: '0 2px',
          }}
        >×</button>
      )}
    </div>
  );
}

export { InsightsPanel };
