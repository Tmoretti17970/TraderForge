// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Overview Tab
// Key metrics, equity curve, daily P&L, strategy/emotion breakdown
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../constants.js';
import { Card, StatCard, AutoGrid } from '../UIKit.jsx';
import { fmtD } from '../../utils.js';
import EquityCurveChart from '../EquityCurveChart.jsx';
import DailyPnlChart from '../DailyPnlChart.jsx';
import BreakdownBarChart from '../BreakdownBarChart.jsx';
import WinRateDonut from '../WinRateDonut.jsx';
import { SectionLabel, MiniStat } from './AnalyticsPrimitives.jsx';

function OverviewTab({ result, trades }) {
  return (
    <div>
      {/* Key Metrics */}
      <AutoGrid minWidth={140} gap={8} style={{ marginBottom: 16 }}>
        <StatCard label="Total P&L" value={fmtD(result.totalPnl)} color={result.totalPnl >= 0 ? C.g : C.r} />
        <StatCard label="Win Rate" value={`${result.winRate.toFixed(1)}%`} color={result.winRate >= 50 ? C.g : C.r} />
        <StatCard label="Profit Factor" value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)} color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r} />
        <StatCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} />
        <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 1 ? C.g : result.sharpe >= 0 ? C.y : C.r} />
        <StatCard label="Sortino" value={result.sortino.toFixed(2)} color={result.sortino >= 1 ? C.g : C.t2} />
        <StatCard label="Max DD" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r} />
        <StatCard label="Avg R" value={result.avgR != null ? `${result.avgR.toFixed(2)}R` : '—'} color={(result.avgR || 0) >= 0 ? C.g : C.r} />
      </AutoGrid>

      {/* Equity Curve */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Equity Curve" />
        <EquityCurveChart eq={result.eq} height={280} />
      </Card>

      {/* Daily P&L + Win Rate Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Daily P&L" />
          <DailyPnlChart eq={result.eq} height={200} />
        </Card>
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 180 }}>
          <SectionLabel text="Win Rate" />
          <WinRateDonut wins={result.winCount} losses={result.lossCount} size={140} />
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 8 }}>
            {result.winCount}W / {result.lossCount}L
          </div>
        </Card>
      </div>

      {/* Strategy + Emotion side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card style={{ padding: 16 }}>
          <SectionLabel text="P&L by Strategy" />
          <BreakdownBarChart data={result.bySt} height={Math.max(120, Object.keys(result.bySt).length * 36)} />
        </Card>
        <Card style={{ padding: 16 }}>
          <SectionLabel text="P&L by Emotion" />
          <BreakdownBarChart data={result.byEmo} height={Math.max(120, Object.keys(result.byEmo).length * 36)} />
        </Card>
      </div>

      {/* Rolling Performance Windows */}
      {result.rolling && (
        <div style={{ marginBottom: 16 }}>
          <SectionLabel text="Rolling Performance" />
          <AutoGrid minWidth={200} gap={8}>
            {Object.entries(result.rolling).map(([period, data]) => (
              <Card key={period} style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.b, fontFamily: M, marginBottom: 8, textTransform: 'uppercase' }}>
                  {period} Rolling
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <MiniStat label="P&L" value={fmtD(data.pnl)} color={data.pnl >= 0 ? C.g : C.r} />
                  <MiniStat label="Win %" value={`${data.winRate.toFixed(0)}%`} color={data.winRate >= 50 ? C.g : C.r} />
                  <MiniStat label="Sharpe" value={data.sharpe.toFixed(2)} color={data.sharpe >= 1 ? C.g : data.sharpe >= 0 ? C.y : C.r} />
                  <MiniStat label="Expectancy" value={fmtD(data.expectancy)} color={data.expectancy >= 0 ? C.g : C.r} />
                </div>
                <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 6 }}>{data.days} trading days</div>
              </Card>
            ))}
          </AutoGrid>
        </div>
      )}

      {/* Symbol + Asset Class side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {result.bySym && Object.keys(result.bySym).length > 0 && (
          <Card style={{ padding: 16 }}>
            <SectionLabel text="P&L by Symbol" />
            <BreakdownBarChart data={result.bySym} height={Math.max(120, Object.keys(result.bySym).length * 36)} />
          </Card>
        )}
        {result.byAC && Object.keys(result.byAC).length > 0 && (
          <Card style={{ padding: 16 }}>
            <SectionLabel text="P&L by Asset Class" />
            <BreakdownBarChart data={result.byAC} height={Math.max(120, Object.keys(result.byAC).length * 36)} />
          </Card>
        )}
      </div>
    </div>
  );
}
export default React.memo(OverviewTab);
