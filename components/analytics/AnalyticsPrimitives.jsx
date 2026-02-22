// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Shared Primitives
// Reusable sub-components shared across all analytics tabs.
// Extracted from AnalyticsPage.jsx for maintainability.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import ChartWrapperInline from '../ChartWrapper.jsx';

// ─── Section Label ──────────────────────────────────────────────

export function SectionLabel({ text }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
      {text}
    </div>
  );
}

// ─── Mini Stat (compact metric for cards & rolling windows) ────

export function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: color || C.t1, fontFamily: M }}>{value}</div>
    </div>
  );
}

// ─── Format Duration ────────────────────────────────────────────

export function formatDuration(minutes) {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.round((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

// ─── Win Rate Horizontal Bars ──────────────────────────────────

export function WinRateByCategory({ data }) {
  if (!data.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d) => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, fontWeight: 600, color: C.t1, flexShrink: 0 }}>
            {d.name}
          </div>
          <div style={{ flex: 1, height: 8, background: C.bg2, borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${d.wr}%`,
                background: d.wr >= 50 ? C.g : C.r,
                borderRadius: 4,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ width: 45, fontSize: 11, fontWeight: 700, fontFamily: M, color: d.wr >= 50 ? C.g : C.r, textAlign: 'right' }}>
            {d.wr.toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Drawdown Chart ─────────────────────────────────────────────

export function DrawdownChart({ eq = [], height = 200 }) {
  const config = useMemo(() => {
    if (!eq.length) return null;

    const labels = eq.map((p) => p.date);
    const ddValues = eq.map((p) => -(p.dd || 0));

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Drawdown',
            data: ddValues,
            borderColor: C.r,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHitRadius: 6,
            tension: 0.2,
            fill: {
              target: 'origin',
              above: 'transparent',
              below: C.r + '20',
            },
          },
        ],
      },
      options: {
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 8, font: { family: M, size: 9 }, color: C.t3 },
            border: { display: false },
          },
          y: {
            grid: { color: C.bd + '40', drawTicks: false },
            ticks: {
              font: { family: M, size: 9 },
              color: C.t3,
              callback: (v) => `${v.toFixed(0)}%`,
            },
            border: { display: false },
            max: 0,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (item) => `Drawdown: ${item.parsed.y.toFixed(1)}%`,
            },
          },
        },
        interaction: { mode: 'index', intersect: false },
      },
    };
  }, [eq]);

  if (!config) return null;

  return <ChartWrapperInline config={config} height={height} />;
}

// ─── Tab Bar Header ─────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'psychology', label: 'Psychology' },
  { id: 'timing', label: 'Timing' },
  { id: 'risk', label: 'Risk' },
];

export { TABS };

export function PageHeader({ tab, setTab, tradeCount, computeMs }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0 }}>
            Analytics
          </h1>
          <p style={{ fontSize: 11, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
            {tradeCount} trades analyzed{computeMs ? ` in ${computeMs}ms` : ''}
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 2, background: C.bg2, borderRadius: 8, padding: 2 }}>
        {TABS.map((t) => (
          <button className="tf-btn"
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              background: tab === t.id ? C.sf : 'transparent',
              color: tab === t.id ? C.t1 : C.t3,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Table Styles ────────────────────────────────────────

export const headerRow = {
  display: 'grid',
  padding: '8px 16px',
  background: C.bg2,
  borderBottom: `1px solid ${C.bd}`,
  fontSize: 10,
  fontWeight: 700,
  color: C.t3,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontFamily: M,
};

export const dataRow = {
  display: 'grid',
  padding: '10px 16px',
  borderBottom: `1px solid ${C.bd}50`,
  fontSize: 12,
  color: C.t2,
};
