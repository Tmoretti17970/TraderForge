// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Risk Tab
// Risk metrics, R-multiple distribution, drawdown curve, warnings
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../constants.js';
import { Card, StatCard, AutoGrid } from '../UIKit.jsx';
import RDistributionChart from '../RDistributionChart.jsx';
import { SectionLabel, DrawdownChart } from './AnalyticsPrimitives.jsx';

function RiskTab({ result, trades }) {
  return (
    <div>
      {/* Risk Metrics */}
      <AutoGrid minWidth={150} gap={8} style={{ marginBottom: 16 }}>
        <StatCard label="Max Drawdown" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r} />
        <StatCard label="Kelly Criterion" value={`${(result.kelly * 100).toFixed(1)}%`} color={C.b} />
        <StatCard label="Risk of Ruin" value={`${result.ror.toFixed(1)}%`} color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r} />
        <StatCard label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={result.rr >= 1.5 ? C.g : result.rr >= 1 ? C.y : C.r} />
        <StatCard label="Best Streak" value={`${result.best} wins`} color={C.g} />
        <StatCard label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
        <StatCard label="Consec 3+ Loss" value={`${result.consLoss3}x`} color={result.consLoss3 > 3 ? C.r : C.t2} />
        <StatCard label="Consec 5+ Loss" value={`${result.consLoss5}x`} color={result.consLoss5 > 0 ? C.r : C.g} />
      </AutoGrid>

      {/* R-Multiple Distribution */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="R-Multiple Distribution" />
        <RDistributionChart trades={trades} height={220} />
      </Card>

      {/* Drawdown Curve */}
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel text="Drawdown Curve" />
        <DrawdownChart eq={result.eq} height={200} />
      </Card>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel text="Metric Warnings" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  background: C.y + '0c',
                  borderLeft: `3px solid ${C.y}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: 11,
                  color: C.y,
                  fontFamily: M,
                }}
              >
                ⚠ {w.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
export default React.memo(RiskTab);
