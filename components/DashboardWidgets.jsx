// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.4 — Dashboard Widgets
// Sprint 8: New widget components + registry for the widget grid.
//
// C8.2 — Widget Registry (metadata + presets)
// C8.3 — StreakWidget
// C8.4 — RollingMetricsWidget
// C8.5 — GoalProgressWidget
// C8.6 — SmartAlertFeedWidget
// C8.7 — ContextPerformanceWidget
// C8.8 — DailyDebriefWidget
// C8.11 — QuickStatsBar
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { Card } from '../components/UIKit.jsx';
import { fmtD } from '../utils.js';
import { safeSum } from '../engine/Money.js';

// ─── Shared styles ──────────────────────────────────────────────
const hdr = (label, icon) => ({
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F,
  marginBottom: 10, padding: '12px 14px 0',
});

const metricRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '5px 14px', fontSize: 11,
};

const metricLabel = { color: C.t2, fontFamily: F };
const metricValue = (color) => ({ fontFamily: M, fontWeight: 700, color: color || C.t1 });

// ═══════════════════════════════════════════════════════════════════
// C8.3 — STREAK WIDGET
// ═══════════════════════════════════════════════════════════════════

export const StreakWidget = React.memo(function StreakWidget({ trades }) {
  const streakData = useMemo(() => {
    if (!trades?.length) return { current: 0, type: 'none', best: 0, worst: 0, history: [] };

    let current = 0, currentType = 'none';
    let best = 0, worst = 0;
    const history = [];
    let streak = 0, streakType = null;

    for (let i = trades.length - 1; i >= 0; i--) {
      const win = (trades[i].pnl ?? 0) > 0;
      const type = win ? 'win' : 'loss';

      if (i === trades.length - 1 || type === streakType) {
        streak++;
        streakType = type;
      } else {
        history.push({ count: streak, type: streakType });
        streak = 1;
        streakType = type;
      }
    }
    if (streak > 0) history.push({ count: streak, type: streakType });

    // Current streak from most recent trades
    const sorted = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    let cStreak = 0;
    const firstType = (sorted[0]?.pnl ?? 0) > 0 ? 'win' : 'loss';
    for (const t of sorted) {
      const isWin = (t.pnl ?? 0) > 0;
      if ((isWin && firstType === 'win') || (!isWin && firstType === 'loss')) cStreak++;
      else break;
    }

    // Best/worst from history
    const wins = history.filter(h => h.type === 'win');
    const losses = history.filter(h => h.type === 'loss');
    best = wins.length ? Math.max(...wins.map(h => h.count)) : 0;
    worst = losses.length ? Math.max(...losses.map(h => h.count)) : 0;

    return { current: cStreak, type: firstType, best, worst, history: history.slice(0, 10) };
  }, [trades]);

  const { current, type, best, worst, history } = streakData;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={hdr()}>🔥 Current Streak</div>

      {/* Big number */}
      <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
        <div style={{
          fontSize: 36, fontWeight: 800, fontFamily: M,
          color: type === 'win' ? C.g : type === 'loss' ? C.r : C.t3,
        }}>
          {current}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.t3,
          textTransform: 'uppercase', letterSpacing: 1,
        }}>
          {type === 'win' ? 'Wins in a row' : type === 'loss' ? 'Losses in a row' : 'No trades'}
        </div>
      </div>

      {/* Best / Worst */}
      <div style={metricRow}>
        <span style={metricLabel}>Best Win Streak</span>
        <span style={metricValue(C.g)}>{best}</span>
      </div>
      <div style={metricRow}>
        <span style={metricLabel}>Worst Loss Streak</span>
        <span style={metricValue(C.r)}>{worst}</span>
      </div>

      {/* Mini streak history bar */}
      <div style={{ display: 'flex', gap: 1, padding: '8px 14px 12px', height: 20 }}>
        {history.slice(0, 20).reverse().map((h, i) => (
          <div key={i} style={{
            flex: 1, maxWidth: 12,
            height: Math.min(20, h.count * 5),
            background: h.type === 'win' ? C.g + '60' : C.r + '60',
            borderRadius: 2,
            alignSelf: 'flex-end',
          }} />
        ))}
      </div>
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.4 — ROLLING METRICS WIDGET
// ═══════════════════════════════════════════════════════════════════

export const RollingMetricsWidget = React.memo(function RollingMetricsWidget({ trades }) {
  const rolling = useMemo(() => {
    const now = new Date();
    const periods = [
      { label: '7 Days', days: 7 },
      { label: '30 Days', days: 30 },
      { label: '90 Days', days: 90 },
    ];

    return periods.map(p => {
      const cutoff = new Date(now - p.days * 86400000);
      const filtered = trades.filter(t => new Date(t.date) >= cutoff);
      const pnls = filtered.map(t => t.pnl ?? 0);
      const wins = pnls.filter(p => p > 0).length;
      const totalPnl = safeSum(pnls);
      const avgPnl = pnls.length ? totalPnl / pnls.length : 0;

      return {
        label: p.label,
        count: filtered.length,
        totalPnl,
        avgPnl,
        winRate: pnls.length ? Math.round((wins / pnls.length) * 100) : 0,
        avgPerDay: p.days > 0 ? totalPnl / p.days : 0,
      };
    });
  }, [trades]);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={hdr()}>📈 Rolling Performance</div>

      {/* Header row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '80px repeat(4, 1fr)',
        padding: '6px 14px', fontSize: 9, color: C.t3, fontWeight: 700,
        fontFamily: M, textTransform: 'uppercase', letterSpacing: 0.5,
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <span>Period</span>
        <span style={{ textAlign: 'right' }}>Trades</span>
        <span style={{ textAlign: 'right' }}>P&L</span>
        <span style={{ textAlign: 'right' }}>Win%</span>
        <span style={{ textAlign: 'right' }}>Avg/Day</span>
      </div>

      {rolling.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '80px repeat(4, 1fr)',
          padding: '7px 14px', fontSize: 11,
          borderBottom: i < rolling.length - 1 ? `1px solid ${C.bd}15` : 'none',
        }}>
          <span style={{ fontWeight: 600, color: C.t1 }}>{r.label}</span>
          <span style={{ textAlign: 'right', fontFamily: M, color: C.t2 }}>{r.count}</span>
          <span style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: r.totalPnl >= 0 ? C.g : C.r }}>
            {fmtD(r.totalPnl)}
          </span>
          <span style={{ textAlign: 'right', fontFamily: M, color: r.winRate >= 50 ? C.g : C.r }}>
            {r.winRate}%
          </span>
          <span style={{ textAlign: 'right', fontFamily: M, fontSize: 10, color: r.avgPerDay >= 0 ? C.g : C.r }}>
            {fmtD(r.avgPerDay)}
          </span>
        </div>
      ))}
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.5 — GOAL PROGRESS WIDGET
// ═══════════════════════════════════════════════════════════════════

export const GoalProgressWidget = React.memo(function GoalProgressWidget({ trades, goals }) {
  const progress = useMemo(() => {
    if (!goals) return [];

    const now = new Date();
    const result = [];

    const periods = {
      daily: { label: 'Daily', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 10)) },
      weekly: {
        label: 'Weekly',
        filter: (t) => {
          const d = new Date(t.date);
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          return d >= weekStart;
        },
      },
      monthly: { label: 'Monthly', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 7)) },
      yearly: { label: 'Yearly', filter: (t) => t.date?.startsWith(now.toISOString().slice(0, 4)) },
    };

    for (const [key, period] of Object.entries(periods)) {
      const goal = goals[key];
      if (!goal?.enabled || !goal.target) continue;

      const filtered = trades.filter(period.filter);
      const pnl = safeSum(filtered.map(t => t.pnl ?? 0));
      const pct = goal.target > 0 ? Math.min(100, Math.round((pnl / goal.target) * 100)) : 0;

      result.push({
        label: period.label,
        target: goal.target,
        current: pnl,
        pct: Math.max(0, pct),
        exceeded: pnl >= goal.target,
        trades: filtered.length,
      });
    }

    return result;
  }, [trades, goals]);

  if (!progress.length) {
    return (
      <Card style={{ padding: 14, textAlign: 'center' }}>
        <div style={hdr()}>🎯 Goals</div>
        <div style={{ fontSize: 11, color: C.t3, padding: '16px 0' }}>
          Set goals in Settings → Goals
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={hdr()}>🎯 Goal Progress</div>

      {progress.map((g, i) => (
        <div key={i} style={{ padding: '6px 14px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.t1 }}>{g.label}</span>
            <span style={{ fontSize: 10, fontFamily: M, color: g.exceeded ? C.g : C.t2 }}>
              {fmtD(g.current)} / {fmtD(g.target)}
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 4, background: C.bd,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${g.pct}%`,
              background: g.exceeded
                ? `linear-gradient(90deg, ${C.g}, ${C.g}CC)`
                : `linear-gradient(90deg, ${C.b}, ${C.b}CC)`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: 9, color: C.t3, marginTop: 2, fontFamily: M }}>
            {g.pct}% · {g.trades} trades
          </div>
        </div>
      ))}
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.6 — SMART ALERT FEED WIDGET
// ═══════════════════════════════════════════════════════════════════

export const SmartAlertFeedWidget = React.memo(function SmartAlertFeedWidget({ alerts = [] }) {
  const top = alerts.slice(0, 5);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={hdr()}>🔔 Smart Alerts</div>

      {top.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 11, color: C.t3, textAlign: 'center' }}>
          No active alerts — open a chart to detect signals
        </div>
      ) : (
        top.map((alert, i) => {
          const sevColor = alert.severity === 'high' ? C.r : alert.severity === 'medium' ? C.y : C.t3;
          return (
            <div key={i} style={{
              padding: '8px 14px',
              borderBottom: `1px solid ${C.bd}15`,
              borderLeft: `3px solid ${sevColor}`,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.t1,
                marginBottom: 2,
              }}>
                {alert.title}
              </div>
              <div style={{ fontSize: 9, color: C.t3, lineHeight: 1.4 }}>
                {alert.body?.slice(0, 100)}
              </div>
              <div style={{
                fontSize: 8, color: sevColor, fontWeight: 700,
                fontFamily: M, marginTop: 3, textTransform: 'uppercase',
              }}>
                {alert.severity} · {Math.round((alert.confidence || 0) * 100)}% confidence
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.7 — CONTEXT PERFORMANCE WIDGET
// ═══════════════════════════════════════════════════════════════════

export const ContextPerformanceWidget = React.memo(function ContextPerformanceWidget({ trades }) {
  const tagStats = useMemo(() => {
    const withCtx = trades.filter(t => t.context?.tags?.length > 0);
    if (!withCtx.length) return [];

    const byTag = {};
    for (const t of withCtx) {
      const pnl = t.pnl ?? 0;
      for (const tag of t.context.tags) {
        if (!byTag[tag]) byTag[tag] = { tag, count: 0, wins: 0, totalPnl: 0 };
        byTag[tag].count++;
        if (pnl > 0) byTag[tag].wins++;
        byTag[tag].totalPnl += pnl;
      }
    }

    return Object.values(byTag)
      .map(b => ({
        ...b,
        winRate: b.count > 0 ? Math.round((b.wins / b.count) * 100) : 0,
        avgPnl: b.count > 0 ? Math.round(b.totalPnl / b.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [trades]);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={hdr()}>🧠 Context Performance</div>

      {tagStats.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 11, color: C.t3, textAlign: 'center' }}>
          Trade context is captured when Intelligence Layer is active
        </div>
      ) : (
        tagStats.map((s, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr 50px 60px 50px',
            padding: '6px 14px', fontSize: 10,
            borderBottom: `1px solid ${C.bd}10`,
            alignItems: 'center',
          }}>
            <span style={{
              fontWeight: 600, color: C.t1,
              background: C.b + '10', borderRadius: 3,
              padding: '1px 6px', fontSize: 9,
              display: 'inline-block', maxWidth: 'fit-content',
            }}>
              {s.tag}
            </span>
            <span style={{ textAlign: 'right', fontFamily: M, color: C.t3, fontSize: 9 }}>
              {s.count} trades
            </span>
            <span style={{
              textAlign: 'right', fontFamily: M, fontWeight: 700,
              color: s.winRate >= 50 ? C.g : C.r,
            }}>
              {s.winRate}%
            </span>
            <span style={{
              textAlign: 'right', fontFamily: M, fontWeight: 700,
              color: s.avgPnl >= 0 ? C.g : C.r, fontSize: 9,
            }}>
              {fmtD(s.avgPnl)}
            </span>
          </div>
        ))
      )}
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.8 — DAILY DEBRIEF WIDGET
// ═══════════════════════════════════════════════════════════════════

export const DailyDebriefWidget = React.memo(function DailyDebriefWidget({ trades, result }) {
  const debrief = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter(t => t.date?.startsWith(today));
    const pnls = todayTrades.map(t => t.pnl ?? 0);
    const totalPnl = safeSum(pnls);
    const wins = pnls.filter(p => p > 0).length;
    const losses = pnls.filter(p => p < 0).length;
    const winRate = pnls.length ? Math.round((wins / pnls.length) * 100) : 0;
    const bestTrade = todayTrades.length ? todayTrades.reduce((a, b) => (a.pnl ?? 0) > (b.pnl ?? 0) ? a : b) : null;
    const worstTrade = todayTrades.length ? todayTrades.reduce((a, b) => (a.pnl ?? 0) < (b.pnl ?? 0) ? a : b) : null;

    // Emotion distribution
    const emotions = {};
    for (const t of todayTrades) {
      if (t.emotion) emotions[t.emotion] = (emotions[t.emotion] || 0) + 1;
    }

    // Rule breaks today
    const ruleBreaks = todayTrades.filter(t => t.rulesFollowed === false).length;

    return {
      count: todayTrades.length,
      totalPnl, wins, losses, winRate,
      bestTrade, worstTrade,
      emotions, ruleBreaks,
    };
  }, [trades]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? '🌅 Good morning' : hour < 17 ? '☀️ Good afternoon' : '🌙 Good evening';

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        ...hdr(),
        background: debrief.totalPnl >= 0 ? C.g + '08' : debrief.totalPnl < 0 ? C.r + '08' : 'transparent',
      }}>
        {greeting}
      </div>

      {debrief.count === 0 ? (
        <div style={{ padding: '20px 14px', fontSize: 13, color: C.t3, textAlign: 'center' }}>
          No trades logged today
        </div>
      ) : (
        <>
          {/* Today's P&L hero */}
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              fontSize: 28, fontWeight: 800, fontFamily: M,
              color: debrief.totalPnl >= 0 ? C.g : C.r,
            }}>
              {fmtD(debrief.totalPnl)}
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              {debrief.count} trades · {debrief.wins}W / {debrief.losses}L · {debrief.winRate}%
            </div>
          </div>

          {/* Best / Worst */}
          {debrief.bestTrade && (
            <div style={metricRow}>
              <span style={metricLabel}>Best Trade</span>
              <span style={metricValue(C.g)}>
                {debrief.bestTrade.symbol} {fmtD(debrief.bestTrade.pnl)}
              </span>
            </div>
          )}
          {debrief.worstTrade && debrief.worstTrade.id !== debrief.bestTrade?.id && (
            <div style={metricRow}>
              <span style={metricLabel}>Worst Trade</span>
              <span style={metricValue(C.r)}>
                {debrief.worstTrade.symbol} {fmtD(debrief.worstTrade.pnl)}
              </span>
            </div>
          )}

          {/* Rule breaks */}
          {debrief.ruleBreaks > 0 && (
            <div style={{
              margin: '4px 14px 8px', padding: '6px 10px',
              background: C.r + '10', borderRadius: 6,
              fontSize: 10, color: C.r, fontWeight: 600,
            }}>
              ⚠ {debrief.ruleBreaks} rule break{debrief.ruleBreaks > 1 ? 's' : ''} today
            </div>
          )}

          {/* Emotions */}
          {Object.keys(debrief.emotions).length > 0 && (
            <div style={{ padding: '4px 14px 10px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(debrief.emotions).map(([emo, count]) => (
                <span key={emo} style={{
                  fontSize: 9, fontWeight: 600, fontFamily: M,
                  padding: '2px 6px', borderRadius: 4,
                  background: C.b + '10', color: C.t2,
                }}>
                  {emo} ×{count}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.11 — QUICK STATS BAR (sticky top-of-page)
// ═══════════════════════════════════════════════════════════════════

export const QuickStatsBar = React.memo(function QuickStatsBar({ result, todayPnl, todayCount }) {
  if (!result) return null;

  const stats = [
    { label: 'Total P&L', value: fmtD(result.totalPnl), color: result.totalPnl >= 0 ? C.g : C.r },
    { label: 'Today', value: fmtD(todayPnl), color: todayPnl >= 0 ? C.g : todayPnl < 0 ? C.r : C.t3 },
    { label: 'Win Rate', value: `${result.winCount && result.tradeCount ? Math.round((result.winCount / result.tradeCount) * 100) : 0}%`, color: C.t1 },
    { label: 'Trades', value: `${result.tradeCount}`, color: C.t2 },
    { label: 'PF', value: result.pf === Infinity ? '∞' : result.pf?.toFixed(2), color: result.pf >= 1.5 ? C.g : C.t2 },
  ];

  return (
    <div style={{
      display: 'flex', gap: 16, padding: '8px 14px',
      background: C.sf, borderRadius: 8,
      marginBottom: 16, overflow: 'auto',
      border: `1px solid ${C.bd}`,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 9, color: C.t3, fontWeight: 600, fontFamily: M, marginBottom: 2 }}>
            {s.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: s.color }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// C8.2 — WIDGET REGISTRY
// ═══════════════════════════════════════════════════════════════════

export const WIDGET_REGISTRY = {
  'stat-cards':        { id: 'stat-cards',        label: 'Key Stats',           icon: '📊', span: 2, default: true,  category: 'core' },
  'win-donut':         { id: 'win-donut',         label: 'Win Rate',            icon: '🎯', span: 1, default: true,  category: 'core' },
  'equity-curve':      { id: 'equity-curve',      label: 'Equity Curve',        icon: '📈', span: 2, default: true,  category: 'core' },
  'daily-pnl':         { id: 'daily-pnl',         label: 'Daily P&L',          icon: '📊', span: 1, default: true,  category: 'core' },
  'calendar':          { id: 'calendar',           label: 'Calendar Heatmap',   icon: '📅', span: 1, default: true,  category: 'core' },
  'streaks':           { id: 'streaks',            label: 'Streak Tracker',     icon: '🔥', span: 1, default: true,  category: 'performance' },
  'rolling':           { id: 'rolling',            label: 'Rolling Metrics',    icon: '📈', span: 1, default: true,  category: 'performance' },
  'goals':             { id: 'goals',              label: 'Goal Progress',      icon: '🎯', span: 1, default: true,  category: 'performance' },
  'debrief':           { id: 'debrief',            label: 'Daily Debrief',      icon: '☀️', span: 1, default: true,  category: 'daily' },
  'alerts':            { id: 'alerts',             label: 'Smart Alerts',       icon: '🔔', span: 1, default: false, category: 'intelligence' },
  'context-perf':      { id: 'context-perf',       label: 'Context Performance', icon: '🧠', span: 1, default: false, category: 'intelligence' },
  'prop-firm':         { id: 'prop-firm',          label: 'Prop Firm Tracker',  icon: '🏢', span: 2, default: false, category: 'advanced' },
  'recent-trades':     { id: 'recent-trades',      label: 'Recent Trades',      icon: '📋', span: 1, default: true,  category: 'core' },
  'insights':          { id: 'insights',           label: 'Insights',           icon: '💡', span: 1, default: true,  category: 'core' },
  'risk-metrics':      { id: 'risk-metrics',       label: 'Risk Metrics',       icon: '🛡', span: 1, default: true,  category: 'risk' },
  'advanced-metrics':  { id: 'advanced-metrics',   label: 'Advanced Metrics',   icon: '⚗️', span: 1, default: true,  category: 'risk' },
};

/**
 * C8.9 — DASHBOARD PRESETS
 */
export const DASHBOARD_PRESETS = {
  default: {
    label: 'Default',
    icon: '📊',
    widgets: ['stat-cards', 'debrief', 'equity-curve', 'daily-pnl', 'calendar', 'streaks', 'rolling', 'goals', 'recent-trades', 'insights', 'risk-metrics', 'advanced-metrics'],
  },
  scalper: {
    label: 'Scalper',
    icon: '⚡',
    description: 'Focus on today\'s performance, streaks, and rapid feedback',
    widgets: ['stat-cards', 'debrief', 'streaks', 'rolling', 'daily-pnl', 'recent-trades', 'goals', 'context-perf'],
  },
  swing: {
    label: 'Swing Trader',
    icon: '🌊',
    description: 'Equity curve, calendar view, goal tracking, risk focus',
    widgets: ['stat-cards', 'equity-curve', 'calendar', 'goals', 'rolling', 'risk-metrics', 'advanced-metrics', 'insights'],
  },
  prop: {
    label: 'Prop Firm',
    icon: '🏢',
    description: 'Prop firm evaluation tracker front and center',
    widgets: ['stat-cards', 'prop-firm', 'debrief', 'daily-pnl', 'risk-metrics', 'streaks', 'goals', 'recent-trades'],
  },
  intelligence: {
    label: 'Intelligence',
    icon: '🧠',
    description: 'Smart alerts, context performance, pattern insights',
    widgets: ['stat-cards', 'debrief', 'alerts', 'context-perf', 'streaks', 'rolling', 'insights', 'recent-trades'],
  },
};
