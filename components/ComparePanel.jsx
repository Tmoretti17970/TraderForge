// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Compare & Goals Panel (Sprint 4.4 + 4.7)
//
// Two-tab panel:
//   1. Compare — period-over-period performance comparison
//   2. Goals — financial goal progress tracking
//
// Usage:
//   <ComparePanel trades={trades} />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { C, F, M } from '../constants.js';
import { comparePeriods, computeEquityCurve, computeCalendarData } from '../engine/PerformanceCompare.js';
import { useGoalStore } from '../state/useGoalStore.js';

const PERIOD_OPTIONS = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'quarter', label: 'Quarterly' },
  { id: 'year', label: 'Yearly' },
];

function fmtD(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(0); }
function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

export default function ComparePanel({ trades = [] }) {
  const [tab, setTab] = useState('compare');

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: F, color: C.t2, overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
        {[
          { id: 'compare', label: '📊 Compare' },
          { id: 'goals', label: '🎯 Goals' },
          { id: 'equity', label: '📈 Equity' },
        ].map(t => (
          <button className="tf-btn"
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px',
              background: tab === t.id ? C.bg : C.bg2,
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${C.b}` : '2px solid transparent',
              color: tab === t.id ? C.t1 : C.t3,
              fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'compare' && <CompareTab trades={trades} />}
        {tab === 'goals' && <GoalsTab trades={trades} />}
        {tab === 'equity' && <EquityTab trades={trades} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1: Period Comparison
// ═══════════════════════════════════════════════════════════════════

function CompareTab({ trades }) {
  const [period, setPeriod] = useState('week');
  const comparison = useMemo(() => comparePeriods(trades, period), [trades, period]);

  const { current: curr, previous: prev, deltas } = comparison;

  const STATS = [
    { label: 'P&L', curr: fmtD(curr.pnl), prev: fmtD(prev.pnl), delta: deltas.pnl, fmt: fmtD, isPnl: true },
    { label: 'Win Rate', curr: curr.winRate.toFixed(1) + '%', prev: prev.winRate.toFixed(1) + '%', delta: deltas.winRate, fmt: v => v.toFixed(1) + '%' },
    { label: 'Trades', curr: curr.trades, prev: prev.trades, delta: deltas.trades, fmt: v => v > 0 ? '+' + v : v },
    { label: 'Profit Factor', curr: curr.profitFactor === Infinity ? '∞' : curr.profitFactor.toFixed(2), prev: prev.profitFactor === Infinity ? '∞' : prev.profitFactor.toFixed(2), delta: deltas.profitFactor, fmt: v => v.toFixed(2) },
    { label: 'Expectancy', curr: fmtD(curr.expectancy), prev: fmtD(prev.expectancy), delta: deltas.expectancy, fmt: fmtD, isPnl: true },
    { label: 'Best Trade', curr: fmtD(curr.bestTrade), prev: fmtD(prev.bestTrade) },
    { label: 'Worst Trade', curr: fmtD(curr.worstTrade), prev: fmtD(prev.worstTrade) },
    { label: 'Trading Days', curr: curr.tradingDays, prev: prev.tradingDays },
  ];

  return (
    <div style={{ padding: 10 }}>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {PERIOD_OPTIONS.map(p => (
          <button className="tf-btn"
            key={p.id}
            onClick={() => setPeriod(p.id)}
            style={{
              flex: 1, padding: '5px 8px', borderRadius: 4,
              fontSize: 11, fontWeight: 600,
              background: period === p.id ? C.b + '20' : 'transparent',
              border: `1px solid ${period === p.id ? C.b : C.bd}`,
              color: period === p.id ? C.b : C.t3, cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Comparison header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 6, marginBottom: 10,
      }}>
        <div style={{
          padding: '10px 12px', background: C.sf, borderRadius: 8,
          borderLeft: `3px solid ${C.b}`,
        }}>
          <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>{curr.label}</div>
          <div style={{
            fontSize: 18, fontWeight: 800, fontFamily: M, marginTop: 4,
            color: curr.pnl >= 0 ? C.g : C.r,
          }}>
            {fmtD(curr.pnl)}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            {curr.trades} trades · {curr.winRate.toFixed(0)}% WR
          </div>
        </div>

        <div style={{
          padding: '10px 12px', background: C.sf, borderRadius: 8,
          borderLeft: `3px solid ${C.t3}`,
        }}>
          <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>{prev.label}</div>
          <div style={{
            fontSize: 18, fontWeight: 800, fontFamily: M, marginTop: 4,
            color: prev.pnl >= 0 ? C.g : C.r,
          }}>
            {fmtD(prev.pnl)}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            {prev.trades} trades · {prev.winRate.toFixed(0)}% WR
          </div>
        </div>
      </div>

      {/* Delta P&L badge */}
      <div style={{
        padding: '8px 12px', borderRadius: 6, marginBottom: 10,
        background: deltas.pnl >= 0 ? C.g + '10' : C.r + '10',
        borderLeft: `3px solid ${deltas.pnl >= 0 ? C.g : C.r}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>{deltas.pnl >= 0 ? '📈' : '📉'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: deltas.pnl >= 0 ? C.g : C.r }}>
          {fmtD(deltas.pnl)} vs {prev.label.toLowerCase()}
        </span>
      </div>

      {/* Stat comparison table */}
      {STATS.map((stat, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 1fr 60px',
            padding: '5px 0', borderBottom: i < STATS.length - 1 ? `1px solid ${C.bd}20` : 'none',
            alignItems: 'center', fontSize: 11,
          }}
        >
          <span style={{ color: C.t3, fontSize: 10 }}>{stat.label}</span>
          <span style={{ color: stat.isPnl ? (curr.pnl >= 0 ? C.g : C.r) : C.t1, fontFamily: M, fontWeight: 600 }}>
            {stat.curr}
          </span>
          <span style={{ color: C.t3, fontFamily: M }}>{stat.prev}</span>
          {stat.delta !== undefined && (
            <span style={{
              color: stat.delta >= 0 ? C.g : C.r,
              fontFamily: M, fontSize: 10, fontWeight: 600, textAlign: 'right',
            }}>
              {stat.delta >= 0 ? '▲' : '▼'} {typeof stat.fmt === 'function' ? stat.fmt(stat.delta) : stat.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2: Goal Tracking
// ═══════════════════════════════════════════════════════════════════

function GoalsTab({ trades }) {
  const goals = useGoalStore(s => s.goals);
  const setGoal = useGoalStore(s => s.setGoal);
  const toggleGoal = useGoalStore(s => s.toggleGoal);
  const dailyLossLimit = useGoalStore(s => s.dailyLossLimit);
  const dailyLossEnabled = useGoalStore(s => s.dailyLossEnabled);
  const setDailyLossLimit = useGoalStore(s => s.setDailyLossLimit);
  const toggleDailyLoss = useGoalStore(s => s.toggleDailyLoss);
  const getProgress = useGoalStore(s => s.getProgress);

  const progress = useMemo(() => getProgress(trades), [trades, getProgress]);

  const GOAL_ROWS = [
    { key: 'daily', label: 'Daily P&L', emoji: '📅', period: 'daily' },
    { key: 'weekly', label: 'Weekly P&L', emoji: '📆', period: 'weekly' },
    { key: 'monthly', label: 'Monthly P&L', emoji: '🗓️', period: 'monthly' },
    { key: 'yearly', label: 'Yearly P&L', emoji: '📊', period: 'yearly' },
  ];

  return (
    <div style={{ padding: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
      }}>
        P&L Targets
      </div>

      {GOAL_ROWS.map(row => {
        const goal = goals[row.period];
        const prog = progress[row.period];

        return (
          <div key={row.key} style={{
            background: C.sf, borderRadius: 6, padding: '8px 10px',
            marginBottom: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12 }}>{row.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.t1, flex: 1 }}>{row.label}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input aria-label="Compare symbol"
                  type="checkbox"
                  checked={goal.enabled}
                  onChange={() => toggleGoal(row.period)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
              </label>
            </div>

            {goal.enabled && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.t3 }}>Target: $</span>
                  <input
                    type="number"
                    value={goal.target || ''}
                    onChange={e => setGoal(row.period, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{
                      width: 80, padding: '3px 6px',
                      background: C.bg, border: `1px solid ${C.bd}`,
                      borderRadius: 4, color: C.t1, fontFamily: M,
                      fontSize: 11, outline: 'none', textAlign: 'right',
                    }}
                  />
                </div>

                {prog && (
                  <>
                    {/* Progress bar */}
                    <div style={{
                      height: 6, background: C.bd, borderRadius: 3,
                      overflow: 'hidden', marginBottom: 4,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${Math.min(100, Math.max(0, prog.pct))}%`,
                        background: prog.hit ? C.g : prog.pct > 50 ? C.b : C.y,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, fontFamily: M,
                    }}>
                      <span style={{ color: prog.current >= 0 ? C.g : C.r }}>
                        {fmtD(prog.current)}
                      </span>
                      <span style={{ color: C.t3 }}>
                        {prog.pct.toFixed(0)}% of ${prog.target.toLocaleString()}
                      </span>
                      {prog.hit && <span style={{ color: C.g }}>✅ Hit!</span>}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Daily loss limit */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        marginTop: 12, marginBottom: 6,
      }}>
        Risk Limits
      </div>

      <div style={{ background: C.sf, borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 12 }}>🚫</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.t1, flex: 1 }}>Daily Loss Limit</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dailyLossEnabled}
              onChange={toggleDailyLoss}
              style={{ width: 14, height: 14, cursor: 'pointer' }}
            />
          </label>
        </div>
        {dailyLossEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: C.t3 }}>Max loss: $</span>
            <input
              type="number"
              value={dailyLossLimit || ''}
              onChange={e => setDailyLossLimit(parseFloat(e.target.value) || 0)}
              placeholder="0"
              style={{
                width: 80, padding: '3px 6px',
                background: C.bg, border: `1px solid ${C.bd}`,
                borderRadius: 4, color: C.t1, fontFamily: M,
                fontSize: 11, outline: 'none', textAlign: 'right',
              }}
            />
            {progress.dailyLoss && (
              <span style={{
                fontSize: 10, fontFamily: M, fontWeight: 600,
                color: progress.dailyLoss.breached ? C.r : C.t3,
              }}>
                {progress.dailyLoss.breached ? '⚠ BREACHED' : `${progress.dailyLoss.pct.toFixed(0)}% used`}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3: Equity Curve (text-based summary)
// ═══════════════════════════════════════════════════════════════════

function EquityTab({ trades }) {
  const curve = useMemo(() => computeEquityCurve(trades), [trades]);
  const calendar = useMemo(() => computeCalendarData(trades), [trades]);

  if (curve.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.t3 }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
        <div style={{ fontSize: 12 }}>No trades to chart</div>
      </div>
    );
  }

  const last = curve[curve.length - 1];
  const maxDD = Math.min(...curve.map(c => c.drawdown));
  const totalDays = curve.length;
  const greenDays = curve.filter(c => c.dayPnl > 0).length;
  const redDays = curve.filter(c => c.dayPnl < 0).length;

  // Mini sparkline using unicode blocks
  const recentDays = curve.slice(-20);
  const maxPnl = Math.max(1, ...recentDays.map(c => Math.abs(c.dayPnl)));
  const sparkline = recentDays.map(c => {
    const ratio = c.dayPnl / maxPnl;
    if (ratio > 0.5) return '█';
    if (ratio > 0.2) return '▆';
    if (ratio > 0) return '▃';
    if (ratio > -0.2) return '▁';
    if (ratio > -0.5) return '▃';
    return '█';
  });

  return (
    <div style={{ padding: 10 }}>
      {/* Summary stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10,
      }}>
        {[
          { label: 'Final Equity', value: fmtD(last.equity), color: last.equity >= 0 ? C.g : C.r },
          { label: 'Peak Equity', value: fmtD(last.peak), color: C.b },
          { label: 'Max Drawdown', value: maxDD.toFixed(1) + '%', color: C.r },
          { label: 'Trading Days', value: totalDays, color: C.t1 },
          { label: 'Green Days', value: `${greenDays} (${totalDays > 0 ? (greenDays/totalDays*100).toFixed(0) : 0}%)`, color: C.g },
          { label: 'Red Days', value: `${redDays} (${totalDays > 0 ? (redDays/totalDays*100).toFixed(0) : 0}%)`, color: C.r },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '8px 10px', background: C.sf, borderRadius: 6 }}>
            <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase' }}>{stat.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: stat.color, fontFamily: M, marginTop: 2 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Text sparkline */}
      <div style={{
        padding: '8px 10px', background: C.sf, borderRadius: 6, marginBottom: 10,
      }}>
        <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
          Last {recentDays.length} Days
        </div>
        <div style={{ fontFamily: M, fontSize: 14, letterSpacing: 2 }}>
          {recentDays.map((c, i) => (
            <span key={i} style={{ color: c.dayPnl >= 0 ? C.g : C.r }}>
              {sparkline[i]}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.t3, marginTop: 4 }}>
          <span>{recentDays[0]?.date}</span>
          <span>{recentDays[recentDays.length - 1]?.date}</span>
        </div>
      </div>

      {/* Recent day-by-day P&L */}
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>
        Day-by-Day (Last 15)
      </div>
      {curve.slice(-15).reverse().map((day, i) => (
        <div
          key={day.date}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 6px', fontSize: 11, fontFamily: M,
            borderBottom: `1px solid ${C.bd}20`,
          }}
        >
          <span style={{ color: C.t3, fontSize: 10, minWidth: 72 }}>{day.date}</span>
          <span style={{ color: C.t3, fontSize: 10 }}>{day.trades} trade{day.trades !== 1 ? 's' : ''}</span>
          <span style={{
            fontWeight: 600,
            color: day.dayPnl >= 0 ? C.g : C.r,
            minWidth: 60, textAlign: 'right',
          }}>
            {fmtD(day.dayPnl)}
          </span>
          <span style={{ color: C.t3, fontSize: 10, minWidth: 60, textAlign: 'right' }}>
            Eq: {fmtD(day.equity)}
          </span>
        </div>
      ))}
    </div>
  );
}

export { ComparePanel };
