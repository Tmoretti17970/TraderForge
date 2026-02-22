// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Equity Curve Chart
// Cumulative P&L line chart with gradient fill
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import ChartWrapper from './ChartWrapper.jsx';
import { C, M } from '../constants.js';

/**
 * @param {Array} eq - Equity curve array from computeFast: [{ date, pnl, daily, dd }]
 * @param {number} height - Chart height (default 280)
 */
function EquityCurveChart({ eq = [], height = 280 }) {
  const config = useMemo(() => {
    if (!eq.length) return null;

    const labels = eq.map((p) => p.date);
    const values = eq.map((p) => p.pnl);
    const isPositive = values[values.length - 1] >= 0;

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Equity',
            data: values,
            borderColor: isPositive ? C.g : C.r,
            borderWidth: 2,
            pointRadius: 0,
            pointHitRadius: 8,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: isPositive ? C.g : C.r,
            tension: 0.3,
            fill: {
              target: 'origin',
              above: isPositive ? C.g + '18' : C.r + '08',
              below: C.r + '18',
            },
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 8,
              font: { family: M, size: 9 },
              color: C.t3,
            },
            border: { display: false },
          },
          y: {
            position: 'right',
            grid: {
              color: C.bd + '60',
              drawTicks: false,
            },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              callback: (v) =>
                v >= 1000
                  ? `$${(v / 1000).toFixed(1)}k`
                  : v <= -1000
                    ? `-$${(Math.abs(v) / 1000).toFixed(1)}k`
                    : `$${v.toFixed(0)}`,
            },
            border: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label || '',
              label: (item) => {
                const val = item.parsed.y;
                const sign = val >= 0 ? '+' : '';
                return `P&L: ${sign}$${val.toFixed(2)}`;
              },
            },
          },
          // Zero line annotation
          annotation: undefined,
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
      },
      plugins: [
        {
          // Custom plugin to draw zero line
          id: 'zeroLine',
          beforeDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            const yScale = scales.y;
            if (!yScale) return;
            const zeroY = yScale.getPixelForValue(0);
            if (zeroY < chartArea.top || zeroY > chartArea.bottom) return;

            ctx.save();
            ctx.strokeStyle = C.t3 + '40';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, zeroY);
            ctx.lineTo(chartArea.right, zeroY);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
    };
  }, [eq]);

  if (!config) return null;

  return <ChartWrapper config={config} height={height} />;
}
export default React.memo(EquityCurveChart);
