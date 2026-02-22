// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Timing Tab
// Duration analysis, day-of-week, hour-of-day P&L breakdowns
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M } from '../../constants.js';
import { Card } from '../UIKit.jsx';
import { fmtD } from '../../utils.js';
import TimeBarChart from '../TimeBarChart.jsx';
import { SectionLabel, formatDuration } from './AnalyticsPrimitives.jsx';

function TimingTab({ result }) {
  const hourBuckets = useMemo(() =>
    result.byH.map((h) => ({ name: h.hour || h.name, pnl: h.pnl, count: h.count, wins: h.wins || 0 })),
    [result.byH]
  );

  const dur = result.duration;
  const hasDuration = dur && dur.count > 0;

  return (
    <div>
      {/* Duration Analysis */}
      {hasDuration && (
        <>
          <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${C.b}` }}>
            <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.6 }}>
              Average hold time: <strong>{formatDuration(dur.avgMinutes)}</strong>
              {' · '}Median: <strong>{formatDuration(dur.medianMinutes)}</strong>
              {' · '}Tracked on <strong>{dur.count}</strong> trades
              {dur.correlation !== 0 && (
                <span>
                  {' · '}Duration↔P&L correlation: <strong style={{ color: dur.correlation >= 0 ? C.g : C.r }}>{dur.correlation.toFixed(3)}</strong>
                  {dur.correlation > 0.15 ? ' (longer trades more profitable)' : dur.correlation < -0.15 ? ' (shorter trades more profitable)' : ' (weak correlation)'}
                </span>
              )}
            </div>
          </Card>

          <Card style={{ padding: 16, marginBottom: 16 }}>
            <SectionLabel text="P&L by Hold Duration" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dur.buckets.filter(b => b.count > 0).map((b) => {
                const maxPnl = Math.max(1, ...dur.buckets.map(x => Math.abs(x.avgPnl)));
                const barW = Math.abs(b.avgPnl) / maxPnl * 100;
                return (
                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 60, fontSize: 11, fontWeight: 600, color: C.t2, flexShrink: 0, fontFamily: M }}>{b.label}</div>
                    <div style={{ flex: 1, height: 20, background: C.bg2, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: b.avgPnl >= 0 ? '50%' : `${50 - barW / 2}%`,
                        width: `${barW / 2}%`,
                        height: '100%',
                        background: b.avgPnl >= 0 ? C.g + '60' : C.r + '60',
                        borderRadius: 2,
                      }} />
                    </div>
                    <div style={{ width: 65, fontSize: 11, fontFamily: M, fontWeight: 700, color: b.avgPnl >= 0 ? C.g : C.r, textAlign: 'right' }}>
                      {fmtD(b.avgPnl)}
                    </div>
                    <div style={{ width: 55, fontSize: 10, fontFamily: M, color: C.t3, textAlign: 'right' }}>
                      {b.count}t · {b.winRate.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Day of Week */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="P&L by Day of Week" />
        <TimeBarChart buckets={result.byDay} height={220} valueKey="pnl" />
      </Card>

      {/* Hour of Day */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="P&L by Hour" />
        <TimeBarChart buckets={hourBuckets} height={220} valueKey="pnl" />
      </Card>

      {/* Trade Count by Day + Hour */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Trade Count by Day" />
          <TimeBarChart buckets={result.byDay} height={180} valueKey="count" />
        </Card>
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Trade Count by Hour" />
          <TimeBarChart buckets={hourBuckets} height={180} valueKey="count" />
        </Card>
      </div>
    </div>
  );
}
export default React.memo(TimingTab);
