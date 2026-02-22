// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Psychology Tab
// Emotional state analysis, win rate by emotion, P&L breakdown
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M } from '../../constants.js';
import { Card } from '../UIKit.jsx';
import { fmtD } from '../../utils.js';
import BreakdownBarChart from '../BreakdownBarChart.jsx';
import { SectionLabel, WinRateByCategory, headerRow, dataRow } from './AnalyticsPrimitives.jsx';

function PsychologyTab({ result }) {
  const emotions = useMemo(() =>
    Object.entries(result.byEmo)
      .map(([name, d]) => ({ name, ...d, wr: d.count > 0 ? (d.wins / d.count) * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl),
    [result.byEmo]
  );

  const bestEmo = emotions[0];
  const worstEmo = emotions[emotions.length - 1];

  return (
    <div>
      {/* Quick Insight */}
      {emotions.length >= 2 && (
        <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${C.b}` }}>
          <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.6 }}>
            You trade best when feeling <strong style={{ color: C.g }}>{bestEmo?.name}</strong>
            {' '}({fmtD(bestEmo?.pnl)}, {bestEmo?.wr.toFixed(0)}% win rate)
            and worst when feeling <strong style={{ color: C.r }}>{worstEmo?.name}</strong>
            {' '}({fmtD(worstEmo?.pnl)}, {worstEmo?.wr.toFixed(0)}% win rate).
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="P&L by Emotional State" />
        <BreakdownBarChart data={result.byEmo} height={Math.max(150, emotions.length * 40)} />
      </Card>

      {/* Win Rate by Emotion */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Win Rate by Emotion" />
        <WinRateByCategory data={emotions} />
      </Card>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ ...headerRow, gridTemplateColumns: '1fr 80px 60px 60px 80px' }}>
          <div>Emotion</div>
          <div style={{ textAlign: 'right' }}>P&L</div>
          <div style={{ textAlign: 'right' }}>Trades</div>
          <div style={{ textAlign: 'right' }}>Win %</div>
          <div style={{ textAlign: 'right' }}>Avg P&L</div>
        </div>
        {emotions.map((e) => (
          <div key={e.name} style={{ ...dataRow, gridTemplateColumns: '1fr 80px 60px 60px 80px' }}>
            <div style={{ fontWeight: 700, color: C.t1 }}>{e.name}</div>
            <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: e.pnl >= 0 ? C.g : C.r }}>
              {fmtD(e.pnl)}
            </div>
            <div style={{ textAlign: 'right', fontFamily: M }}>{e.count}</div>
            <div style={{ textAlign: 'right', fontFamily: M, color: e.wr >= 50 ? C.g : C.r }}>
              {e.wr.toFixed(0)}%
            </div>
            <div style={{ textAlign: 'right', fontFamily: M, color: e.count > 0 ? (e.pnl / e.count >= 0 ? C.g : C.r) : C.t3 }}>
              {e.count > 0 ? fmtD(e.pnl / e.count) : '—'}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
export default React.memo(PsychologyTab);
