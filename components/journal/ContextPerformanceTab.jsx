// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Context Performance Tab
// Sprint 9 C9.10: Analytics panel showing performance by context tag,
// confluence score ranges, and pattern-based trade outcomes.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import { Card } from '../../components/UIKit.jsx';
import { fmtD } from '../../utils.js';

/**
 * @param {Array} trades - All trades
 * @param {boolean} isOpen
 * @param {Function} onClose
 */
export default function ContextPerformanceTab({ trades, isOpen, onClose }) {
  const analysis = useMemo(() => {
    const withContext = trades.filter(t => t.context?.tags?.length > 0);
    if (!withContext.length) return null;

    // ─── By Tag ───────────────────────────────────────────
    const byTag = {};
    for (const t of withContext) {
      const pnl = t.pnl ?? 0;
      for (const tag of t.context.tags) {
        if (!byTag[tag]) byTag[tag] = { tag, count: 0, wins: 0, totalPnl: 0, pnls: [] };
        byTag[tag].count++;
        if (pnl > 0) byTag[tag].wins++;
        byTag[tag].totalPnl += pnl;
        byTag[tag].pnls.push(pnl);
      }
    }

    const tagStats = Object.values(byTag)
      .map(b => ({
        ...b,
        winRate: Math.round((b.wins / b.count) * 100),
        avgPnl: Math.round(b.totalPnl / b.count),
        expectancy: b.count > 0 ? b.totalPnl / b.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // ─── By Confluence Score ──────────────────────────────
    const ranges = [
      { label: 'Low (0-29)', min: 0, max: 29 },
      { label: 'Medium (30-59)', min: 30, max: 59 },
      { label: 'High (60-100)', min: 60, max: 100 },
    ];

    const byConfluence = ranges.map(r => {
      const filtered = withContext.filter(t => {
        const s = t.context?.confluenceScore ?? 0;
        return s >= r.min && s <= r.max;
      });
      const pnls = filtered.map(t => t.pnl ?? 0);
      const wins = pnls.filter(p => p > 0).length;
      const totalPnl = pnls.reduce((a, b) => a + b, 0);
      return {
        label: r.label,
        count: filtered.length,
        wins,
        winRate: filtered.length ? Math.round((wins / filtered.length) * 100) : 0,
        totalPnl,
        avgPnl: filtered.length ? Math.round(totalPnl / filtered.length) : 0,
      };
    });

    // ─── Best / Worst Tags ────────────────────────────────
    const bestTag = tagStats.length
      ? tagStats.filter(t => t.count >= 3).sort((a, b) => b.winRate - a.winRate)[0]
      : null;
    const worstTag = tagStats.length
      ? tagStats.filter(t => t.count >= 3).sort((a, b) => a.winRate - b.winRate)[0]
      : null;

    return {
      totalWithContext: withContext.length,
      totalTrades: trades.length,
      tagStats,
      byConfluence,
      bestTag,
      worstTag,
    };
  }, [trades]);

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, maxWidth: '90vw',
        background: C.bg, zIndex: 1000,
        borderLeft: `1px solid ${C.bd}`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${C.bd}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>
            🧠 Context Performance
          </div>
          <button className="tf-btn" onClick={onClose} style={{
            background: 'none', border: 'none', color: C.t3, fontSize: 16, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!analysis ? (
            <div style={{ padding: 32, textAlign: 'center', color: C.t3, fontSize: 12 }}>
              No trades with intelligence context yet. Enable the Intelligence Layer on Charts, then add trades to capture context automatically.
            </div>
          ) : (
            <>
              {/* Coverage */}
              <div style={{
                padding: '8px 12px', borderRadius: 6,
                background: C.sf, marginBottom: 16, fontSize: 11, color: C.t2,
              }}>
                {analysis.totalWithContext} of {analysis.totalTrades} trades have context data
                ({Math.round((analysis.totalWithContext / analysis.totalTrades) * 100)}%)
              </div>

              {/* Hero: Best / Worst */}
              {(analysis.bestTag || analysis.worstTag) && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 8, marginBottom: 16,
                }}>
                  {analysis.bestTag && (
                    <Card style={{ padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginBottom: 2 }}>Best Context</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.g }}>{analysis.bestTag.tag}</div>
                      <div style={{ fontSize: 10, fontFamily: M, color: C.g }}>
                        {analysis.bestTag.winRate}% · {analysis.bestTag.count} trades
                      </div>
                    </Card>
                  )}
                  {analysis.worstTag && (
                    <Card style={{ padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginBottom: 2 }}>Worst Context</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.r }}>{analysis.worstTag.tag}</div>
                      <div style={{ fontSize: 10, fontFamily: M, color: C.r }}>
                        {analysis.worstTag.winRate}% · {analysis.worstTag.count} trades
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Confluence Score Breakdown */}
              <SectionLabel text="By Confluence Score" />
              <div style={{ marginBottom: 16 }}>
                {analysis.byConfluence.map((r, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '110px 50px 60px 60px 60px',
                    padding: '6px 0', fontSize: 10, alignItems: 'center',
                    borderBottom: `1px solid ${C.bd}10`,
                  }}>
                    <span style={{ fontWeight: 600, color: C.t1 }}>{r.label}</span>
                    <span style={{ fontFamily: M, color: C.t3, textAlign: 'right' }}>{r.count}</span>
                    <span style={{
                      fontFamily: M, fontWeight: 700, textAlign: 'right',
                      color: r.winRate >= 50 ? C.g : C.r,
                    }}>
                      {r.winRate}%
                    </span>
                    <span style={{
                      fontFamily: M, fontWeight: 700, textAlign: 'right',
                      color: r.totalPnl >= 0 ? C.g : C.r,
                    }}>
                      {fmtD(r.totalPnl)}
                    </span>
                    <span style={{
                      fontFamily: M, fontSize: 9, textAlign: 'right',
                      color: r.avgPnl >= 0 ? C.g : C.r,
                    }}>
                      avg {fmtD(r.avgPnl)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tag Performance Table */}
              <SectionLabel text="By Context Tag" />
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px',
                padding: '4px 0', fontSize: 8, color: C.t3,
                fontFamily: M, fontWeight: 700, textTransform: 'uppercase',
                borderBottom: `1px solid ${C.bd}`,
              }}>
                <span>Tag</span>
                <span style={{ textAlign: 'right' }}>N</span>
                <span style={{ textAlign: 'right' }}>Win%</span>
                <span style={{ textAlign: 'right' }}>Avg P&L</span>
              </div>

              {analysis.tagStats.map((s, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 40px 50px 60px',
                  padding: '5px 0', fontSize: 10, alignItems: 'center',
                  borderBottom: `1px solid ${C.bd}08`,
                }}>
                  <span style={{
                    fontWeight: 600, color: C.t1,
                    background: C.b + '08', borderRadius: 3,
                    padding: '1px 6px', fontSize: 9,
                    display: 'inline-block', maxWidth: 'fit-content',
                  }}>
                    {s.tag}
                  </span>
                  <span style={{ textAlign: 'right', fontFamily: M, color: C.t3, fontSize: 9 }}>
                    {s.count}
                  </span>
                  <span style={{
                    textAlign: 'right', fontFamily: M, fontWeight: 700,
                    color: s.winRate >= 50 ? C.g : C.r,
                  }}>
                    {s.winRate}%
                  </span>
                  <span style={{
                    textAlign: 'right', fontFamily: M, fontWeight: 700,
                    color: s.avgPnl >= 0 ? C.g : C.r, fontSize: 9,
                  }}>
                    {fmtD(s.avgPnl)}
                  </span>
                </div>
              ))}

              {/* Insight callout */}
              {analysis.bestTag && analysis.bestTag.winRate > 60 && (
                <div style={{
                  marginTop: 16, padding: '8px 12px',
                  background: C.g + '08',
                  borderLeft: `3px solid ${C.g}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: 10, color: C.t2, lineHeight: 1.5,
                }}>
                  💡 Your best edge: trades with <strong>{analysis.bestTag.tag}</strong> context
                  have a {analysis.bestTag.winRate}% win rate across {analysis.bestTag.count} trades.
                  Consider prioritizing these setups.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ text }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: C.t1,
      fontFamily: F, marginBottom: 6,
    }}>
      {text}
    </div>
  );
}
