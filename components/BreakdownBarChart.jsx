// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Breakdown Bar Chart
// Horizontal bar chart for strategy/emotion/symbol breakdowns
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import ChartWrapper from './ChartWrapper.jsx';
import { C, M } from '../constants.js';

/**
 * @param {Object} data - Map of { name: { pnl, count, wins } }
 * @param {string} title - Chart title
 * @param {number} height - Chart height
 */
function BreakdownBarChart({ data = {}, title = '', height = 220 }) {
  const config = useMemo(() => {
    const entries = Object.entries(data)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.pnl - a.pnl);

    if (entries.length === 0) return null;

    const labels = entries.map((e) => e.name);
    const values = entries.map((e) => e.pnl);
    const colors = values.map((v) => (v >= 0 ? C.g : C.r));

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'P&L',
            data: values,
            backgroundColor: colors,
            hoverBackgroundColor: colors.map((c) => c + 'cc'),
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            grid: { color: C.bd + '40', drawTicks: false },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              callback: (v) =>
                Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`,
            },
            border: { display: false },
          },
          y: {
            grid: { display: false },
            ticks: {
              font: { family: "'Outfit', sans-serif", size: 11, weight: 600 },
              color: C.t2,
            },
            border: { display: false },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => {
                const entry = entries[item.dataIndex];
                const sign = entry.pnl >= 0 ? '+' : '';
                const wr = entry.count > 0 ? ((entry.wins / entry.count) * 100).toFixed(0) : 0;
                return `${sign}$${entry.pnl.toFixed(2)} · ${entry.count} trades · ${wr}% win`;
              },
            },
          },
        },
      },
      plugins: [
        {
          id: 'zeroLine',
          beforeDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            const xScale = scales.x;
            if (!xScale) return;
            const zeroX = xScale.getPixelForValue(0);
            if (zeroX < chartArea.left || zeroX > chartArea.right) return;
            ctx.save();
            ctx.strokeStyle = C.t3 + '30';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(zeroX, chartArea.top);
            ctx.lineTo(zeroX, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
    };
  }, [data]);

  if (!config) return null;

  return <ChartWrapper config={config} height={height} />;
}
export default React.memo(BreakdownBarChart);
