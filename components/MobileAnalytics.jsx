// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Mobile Analytics (Mobile Optimization)
//
// Touch-optimized analytics dashboard for phone screens:
//   - Swipeable stat cards (hero metric + sparkline)
//   - Collapsible sections
//   - Performance ring chart
//   - Quick-stat grid (2-col)
//   - Pull-to-refresh
//
// Usage:
//   <MobileAnalytics analytics={result} trades={trades} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { C, M } from '../constants.js';

// ─── Stat Card (swipeable hero) ──────────────────────────────────

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      minWidth: 'calc(100vw - 48px)', padding: '20px 18px',
      background: C.sf, borderRadius: 16,
      border: `1px solid ${C.bd}`,
      scrollSnapAlign: 'center', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 32, fontWeight: 800, fontFamily: M,
        color: color || C.t1, lineHeight: 1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.t3, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Quick Stat Grid Cell ────────────────────────────────────────

function QuickStat({ label, value, color }) {
  return (
    <div style={{
      padding: '14px 12px', background: C.sf,
      borderRadius: 12, border: `1px solid ${C.bd}`,
    }}>
      <div style={{
        fontSize: 10, color: C.t3, fontWeight: 600,
        textTransform: 'uppercase', marginBottom: 4,
        letterSpacing: 0.3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 700, fontFamily: M,
        color: color || C.t1,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <button className="tf-btn"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '10px 0',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>
          {icon} {title}
        </span>
        <span style={{
          fontSize: 12, color: C.t3,
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s',
        }}>
          ▼
        </span>
      </button>
      {open && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Win Rate Ring ───────────────────────────────────────────────

function WinRateRing({ winRate, size = 100 }) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - (winRate / 100));
  const color = winRate >= 55 ? C.g : winRate >= 45 ? C.w : C.r;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={C.bd} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        marginTop: -size / 2 - 16, fontSize: 24, fontWeight: 800,
        fontFamily: M, color, textAlign: 'center',
      }}>
        {winRate.toFixed(1)}%
      </div>
      <div style={{
        fontSize: 10, color: C.t3, marginTop: 20,
        fontWeight: 600, textTransform: 'uppercase',
      }}>
        Win Rate
      </div>
    </div>
  );
}

// ─── Mini Sparkline ──────────────────────────────────────────────

function Sparkline({ data, color = C.b, width = 120, height = 32 }) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ─── Bar Distribution ────────────────────────────────────────────

function MiniBarDist({ data, labels }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(Math.abs));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {data.map((v, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.t3, width: 28, textAlign: 'right', fontFamily: M }}>
            {labels?.[i] || i}
          </span>
          <div style={{
            flex: 1, height: 12, background: C.bd + '40', borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.abs(v) / max * 100}%`, height: '100%',
              background: v >= 0 ? C.g : C.r, borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{
            fontSize: 10, fontFamily: M, fontWeight: 600,
            color: v >= 0 ? C.g : C.r, width: 40, textAlign: 'right',
          }}>
            {v >= 0 ? '+' : ''}{v.toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function MobileAnalytics({ analytics, trades = [] }) {
  const a = analytics || {};
  const basic = a.basic || {};
  const streaks = a.streaks || {};
  const risk = a.risk || {};
  const monthly = a.monthly || {};

  const fmt = (n, prefix = '') => {
    if (n == null || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${prefix}${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const pct = (n) => {
    if (n == null || isNaN(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  };

  // Equity curve from trades
  const equityCurve = useMemo(() => {
    let cum = 0;
    return trades.map(t => (cum += (t.pnl || 0)));
  }, [trades]);

  // PnL by day of week
  const dayPnl = useMemo(() => {
    const days = [0, 0, 0, 0, 0]; // Mon-Fri
    trades.forEach(t => {
      const d = new Date(t.date || t.entryDate);
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) days[dow - 1] += (t.pnl || 0);
    });
    return days;
  }, [trades]);

  // Monthly PnL array
  const monthlyPnl = useMemo(() => {
    if (monthly?.months) return monthly.months.map(m => m.pnl || 0).slice(-6);
    return [];
  }, [monthly]);

  const heroCards = [
    {
      label: 'Total P&L',
      value: fmt(basic.totalPnl),
      color: (basic.totalPnl || 0) >= 0 ? C.g : C.r,
      icon: '💰',
      sub: `${basic.totalTrades || 0} trades`,
    },
    {
      label: 'Win Rate',
      value: `${(basic.winRate || 0).toFixed(1)}%`,
      color: (basic.winRate || 0) >= 50 ? C.g : C.r,
      icon: '🎯',
      sub: `${basic.wins || 0}W / ${basic.losses || 0}L`,
    },
    {
      label: 'Profit Factor',
      value: (basic.profitFactor || 0).toFixed(2),
      color: (basic.profitFactor || 0) >= 1.5 ? C.g : (basic.profitFactor || 0) >= 1 ? C.w : C.r,
      icon: '📐',
      sub: `${fmt(basic.avgWin)} avg win / ${fmt(basic.avgLoss)} avg loss`,
    },
    {
      label: 'Best Streak',
      value: `${streaks.maxWinStreak || 0}W`,
      color: C.g,
      icon: '🔥',
      sub: `Current: ${streaks.currentStreak || 0} | Worst: ${streaks.maxLossStreak || 0}L`,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      paddingBottom: 80, // space for mobile nav
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.t1, margin: 0 }}>
          Analytics
        </h1>
        <span style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
          {basic.totalTrades || 0} trades
        </span>
      </div>

      {/* Hero Cards (horizontal scroll) */}
      <div style={{
        display: 'flex', gap: 10, padding: '8px 16px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
      }}>
        {heroCards.map((c, i) => (
          <StatCard key={i} {...c} />
        ))}
      </div>

      <div style={{ padding: '8px 16px' }}>
        {/* Win Rate Ring + Quick Stats */}
        <Section title="Overview" icon="📊" defaultOpen={true}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <WinRateRing winRate={basic.winRate || 0} size={96} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
              <QuickStat label="Avg Win" value={fmt(basic.avgWin)} color={C.g} />
              <QuickStat label="Avg Loss" value={fmt(basic.avgLoss)} color={C.r} />
            </div>
          </div>

          {/* Quick stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <QuickStat label="Sharpe" value={(risk.sharpe || 0).toFixed(2)} color={(risk.sharpe || 0) >= 1 ? C.g : C.t2} />
            <QuickStat label="Max DD" value={fmt(risk.maxDrawdown)} color={C.r} />
            <QuickStat label="Expectancy" value={fmt(basic.expectancy)} color={(basic.expectancy || 0) >= 0 ? C.g : C.r} />
            <QuickStat label="Avg R:R" value={(basic.avgRR || 0).toFixed(2)} color={(basic.avgRR || 0) >= 1.5 ? C.g : C.t2} />
          </div>
        </Section>

        {/* Equity Curve */}
        <Section title="Equity Curve" icon="📈" defaultOpen={true}>
          <div style={{
            padding: 12, background: C.sf, borderRadius: 12,
            border: `1px solid ${C.bd}`,
          }}>
            <Sparkline
              data={equityCurve}
              color={equityCurve.length && equityCurve[equityCurve.length - 1] >= 0 ? C.g : C.r}
              width={window.innerWidth - 80}
              height={80}
            />
          </div>
        </Section>

        {/* PnL by Day */}
        <Section title="P&L by Day" icon="📅" defaultOpen={false}>
          <div style={{
            padding: 12, background: C.sf, borderRadius: 12,
            border: `1px solid ${C.bd}`,
          }}>
            <MiniBarDist
              data={dayPnl}
              labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
            />
          </div>
        </Section>

        {/* Monthly P&L */}
        {monthlyPnl.length > 0 && (
          <Section title="Monthly P&L" icon="🗓️" defaultOpen={false}>
            <div style={{
              padding: 12, background: C.sf, borderRadius: 12,
              border: `1px solid ${C.bd}`,
            }}>
              <Sparkline
                data={monthlyPnl}
                color={C.b}
                width={window.innerWidth - 80}
                height={60}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 8, fontSize: 10, color: C.t3, fontFamily: M,
              }}>
                {monthlyPnl.map((v, i) => (
                  <span key={i} style={{ color: v >= 0 ? C.g : C.r }}>
                    {v >= 0 ? '+' : ''}{(v / 1000).toFixed(1)}k
                  </span>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Risk Metrics */}
        <Section title="Risk" icon="🛡️" defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <QuickStat label="Kelly %" value={pct(risk.kelly)} color={C.b} />
            <QuickStat label="Max DD" value={fmt(risk.maxDrawdown)} color={C.r} />
            <QuickStat label="Recovery Factor" value={(risk.recoveryFactor || 0).toFixed(2)} color={C.t2} />
            <QuickStat label="Risk/Reward" value={(risk.avgRiskReward || 0).toFixed(2)} color={C.t2} />
          </div>
        </Section>
      </div>
    </div>
  );
}

export { MobileAnalytics, StatCard, QuickStat, WinRateRing, Sparkline };
