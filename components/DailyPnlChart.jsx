// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Daily P&L Bar Chart
// Green bars for winning days, red for losing
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import ChartWrapper from './ChartWrapper.jsx';
import { C, M } from '../constants.js';

/**
 * @param {Array} eq - Equity curve array from computeFast: [{ date, pnl, daily, dd }]
 * @param {number} height - Chart height (default 200)
 */
function DailyPnlChart({ eq = [], height = 200 }) {
  const config = useMemo(() => {
    if (!eq.length) return null;

    const labels = eq.map((p) => p.date);
    const dailyPnl = eq.map((p) => p.daily);
    const colors = dailyPnl.map((v) => (v >= 0 ? C.g : C.r));
    const hoverColors = dailyPnl.map((v) => (v >= 0 ? C.g + 'cc' : C.r + 'cc'));

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Daily P&L',
            data: dailyPnl,
            backgroundColor: colors,
            hoverBackgroundColor: hoverColors,
            borderRadius: 2,
            borderSkipped: false,
            maxBarThickness: 16,
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
              callback: (v) => `$${v.toFixed(0)}`,
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
                return `${sign}$${val.toFixed(2)}`;
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
export default React.memo(DailyPnlChart);
