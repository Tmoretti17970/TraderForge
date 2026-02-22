// ═══════════════════════════════════════════════════════════════════
// TradeForge — Dashboard Page (Sprint 3: Narrative Redesign)
//
// Default: Narrative layout that tells a story:
//   1. Hero stat (today's session)
//   2. Your trend (equity curve + key metrics)
//   3. Patterns & habits (calendar + insights)
//   4. Risk check (streaks, drawdown, alerts)
//   5. Recent activity (last 5 trades)
//
// "Custom Layout" toggle restores the widget grid for power users.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { C, F, M } from '../constants.js';
import { text, layout, space, preset } from '../theme/tokens.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useAnalyticsStore } from '../state/useAnalyticsStore.js';
import { useUIStore } from '../state/useUIStore.js';
import { useGoalStore } from '../state/useGoalStore.js';
import { useDashboardStore } from '../state/useDashboardStore.js';
import { computeAndStore } from '../engine/analyticsSingleton.js';
import { Card, StatCard, AutoGrid, SkeletonRow } from '../components/UIKit.jsx';
import { DashboardEmptyState, MilestoneBar } from '../components/EmptyState.jsx';
import { fmtD, timeAgo, METRIC_TIPS } from '../utils.js';
import { safeSum } from '../engine/Money.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import WidgetBoundary from '../components/WidgetBoundary.jsx';
import WidgetGrid from '../components/WidgetGrid.jsx';
import WidgetCustomizer from '../components/WidgetCustomizer.jsx';
import { StreakWidget, RollingMetricsWidget, GoalProgressWidget, SmartAlertFeedWidget, ContextPerformanceWidget, DailyDebriefWidget, QuickStatsBar, WIDGET_REGISTRY } from '../components/DashboardWidgets.jsx';
import EquityCurveChart from '../components/EquityCurveChart.jsx';
import DailyPnlChart from '../components/DailyPnlChart.jsx';
import TradeHeatmap from '../components/TradeHeatmap.jsx';
import WinRateDonut from '../components/WinRateDonut.jsx';
import PropFirmWidget from '../components/PropFirmWidget.jsx';

export default function DashboardPage() {
  const trades = useTradeStore((s) => s.trades);
  const result = useAnalyticsStore((s) => s.result);
  const computing = useAnalyticsStore((s) => s.computing);
  const setPage = useUIStore((s) => s.setPage);
  const goals = useGoalStore((s) => s.goals);
  const { isMobile, isTablet } = useBreakpoints();

  // Dashboard layout store
  const activeWidgets = useDashboardStore((s) => s.activeWidgets);
  const activePreset = useDashboardStore((s) => s.activePreset);
  const editMode = useDashboardStore((s) => s.editMode);
  const setActiveWidgets = useDashboardStore((s) => s.setActiveWidgets);
  const applyPreset = useDashboardStore((s) => s.applyPreset);
  const toggleEditMode = useDashboardStore((s) => s.toggleEditMode);

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [layoutMode, setLayoutMode] = useState('narrative'); // 'narrative' | 'custom'

  // Compute analytics when trades change
  useEffect(() => {
    computeAndStore(trades, { mcRuns: 1000 });
  }, [trades]);

  // Today's stats
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTrades = trades.filter((t) => t.date && t.date.startsWith(today));
    const pnl = safeSum(todayTrades.map((t) => t.pnl || 0));
    const wins = todayTrades.filter((t) => (t.pnl || 0) > 0).length;
    return {
      pnl,
      count: todayTrades.length,
      wins,
      winRate: todayTrades.length > 0 ? Math.round((wins / todayTrades.length) * 100) : 0,
    };
  }, [trades]);

  // Recent trades
  const recentTrades = useMemo(() =>
    [...trades].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5),
    [trades]
  );

  // Loading / empty states
  if (!result) {
    return (
      <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1200 }}>
        <DashHeader
          trades={trades} computing={computing} layoutMode={layoutMode}
          onLayoutToggle={() => setLayoutMode(m => m === 'narrative' ? 'custom' : 'narrative')}
          editMode={editMode} onToggleEdit={toggleEditMode}
          onCustomize={() => setShowCustomizer(true)}
          activePreset={activePreset}
        />
        {computing ? (
          <Card><div style={{ padding: 48 }}><SkeletonRow count={6} /></div></Card>
        ) : trades.length === 0 ? (
          <DashboardEmptyState onGoToJournal={() => setPage('journal')} />
        ) : (
          <Card><div style={{ padding: 48 }}><SkeletonRow count={6} /></div></Card>
        )}
      </div>
    );
  }

  const pagePad = isMobile ? 16 : 32;
  const sectionGap = isMobile ? 20 : 28;

  // ═══════════════════════════════════════════════════════════════
  // NARRATIVE LAYOUT
  // ═══════════════════════════════════════════════════════════════
  if (layoutMode === 'narrative') {
    return (
      <div style={{ padding: pagePad, maxWidth: 1200 }}>
        <DashHeader
          trades={trades} computing={computing} layoutMode={layoutMode}
          onLayoutToggle={() => setLayoutMode('custom')}
          editMode={false} onToggleEdit={toggleEditMode}
          onCustomize={() => setShowCustomizer(true)}
          activePreset={activePreset}
        />

        {/* Milestone progress for early-stage users */}
        {trades.length > 0 && trades.length < 100 && (
          <div style={{ marginBottom: sectionGap }}>
            <MilestoneBar tradeCount={trades.length} />
          </div>
        )}

        {/* ═══ Section 1: Today's Session ═══ */}
        <SectionHeader label="Today's Session" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr',
          gap: isMobile ? 10 : 12,
          marginBottom: sectionGap,
        }}>
          <StatCard
            tier="hero"
            label="Today's P&L"
            value={fmtD(todayStats.pnl)}
            color={todayStats.pnl >= 0 ? C.g : todayStats.pnl < 0 ? C.r : C.t3}
          />
          <StatCard
            label="Win Rate"
            value={todayStats.count > 0 ? `${todayStats.winRate}%` : '—'}
            color={todayStats.winRate >= 60 ? C.g : todayStats.winRate >= 40 ? C.y : C.t3}
          />
          <StatCard
            label="Trades"
            value={`${todayStats.count}`}
            color={C.t1}
          />
        </div>

        {/* ═══ Section 2: Your Trend (30d) ═══ */}
        <SectionHeader label="Your Trend" />
        <Card style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ ...text.label }}>Equity Curve</span>
            <span style={{
              ...text.dataMd,
              color: result.totalPnl >= 0 ? C.g : C.r,
            }}>
              {fmtD(result.totalPnl)}
            </span>
          </div>
          <WidgetBoundary name="Equity Curve" height={isMobile ? 180 : 240}>
            <EquityCurveChart eq={result.eq} height={isMobile ? 180 : 240} />
          </WidgetBoundary>
        </Card>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr',
          gap: 10,
          marginBottom: sectionGap,
        }}>
          <MetricCard label="Profit Factor" value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)} color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r} />
          <MetricCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 1 ? C.g : result.sharpe >= 0 ? C.y : C.r} />
          <MetricCard label="Max DD" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r} />
          <MetricCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} />
        </div>

        {/* ═══ Section 3: Patterns & Habits ═══ */}
        <SectionHeader label="Patterns & Habits" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 12,
          marginBottom: sectionGap,
        }}>
          <Card style={{ padding: 16 }}>
            <div style={{ ...text.label, marginBottom: 10 }}>Calendar</div>
            <WidgetBoundary name="Calendar" height={180}>
              <TradeHeatmap trades={trades} onDayClick={() => setPage('journal')} />
            </WidgetBoundary>
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ ...text.label, marginBottom: 10 }}>Insights</div>
            {result.insights?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.insights.slice(0, 4).map((ins, i) => (
                  <div key={i} style={{
                    padding: '8px 12px',
                    background: ins.t === 'positive' ? C.g + '0c' : ins.t === 'warning' ? C.y + '0c' : C.b + '0c',
                    borderLeft: `3px solid ${ins.t === 'positive' ? C.g : ins.t === 'warning' ? C.y : C.b}`,
                    borderRadius: '0 6px 6px 0',
                    fontSize: 12, lineHeight: 1.5, color: C.t2,
                  }}>
                    {ins.x}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.t3, padding: '20px 0', textAlign: 'center' }}>
                Add more trades to unlock insights
              </div>
            )}
          </Card>
        </div>

        {/* ═══ Section 4: Risk Check ═══ */}
        <SectionHeader label="Risk Check" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 12,
          marginBottom: sectionGap,
        }}>
          <Card style={{ padding: 16 }}>
            <div style={{ ...text.label, marginBottom: 10 }}>Streaks & Risk</div>
            <MetricRow label="Best Streak" value={`${result.best} wins`} color={C.g} />
            <MetricRow label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
            <MetricRow label="Avg Win" value={fmtD(result.avgWin)} color={C.g} />
            <MetricRow label="Avg Loss" value={fmtD(result.avgLoss)} color={C.r} />
            <MetricRow label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={C.t1} />
          </Card>
          <Card style={{ padding: 16 }}>
            <div style={{ ...text.label, marginBottom: 10 }}>Advanced</div>
            <MetricRow label="Kelly Criterion" value={`${(result.kelly * 100).toFixed(1)}%`} color={C.b} tip={METRIC_TIPS['Kelly Criterion']} />
            <MetricRow label="Risk of Ruin" value={`${result.ror.toFixed(1)}%`} color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r} tip={METRIC_TIPS['Risk of Ruin']} />
            <MetricRow label="Sortino" value={result.sortino.toFixed(2)} color={result.sortino >= 1 ? C.g : C.t2} tip={METRIC_TIPS['Sortino']} />
            <MetricRow label="Rule Breaks" value={`${result.ruleBreaks}`} color={result.ruleBreaks > 0 ? C.r : C.g} />
            <MetricRow label="Total Fees" value={fmtD(result.totalFees)} color={C.y} />
          </Card>
        </div>

        {/* ═══ Section 5: Recent Activity ═══ */}
        <SectionHeader label="Recent Activity" />
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.bd}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ ...text.label, marginBottom: 0 }}>Last {recentTrades.length} Trades</span>
            <button
              onClick={() => setPage('journal')}
              className="tf-link"
              style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
            >
              View all →
            </button>
          </div>
          {recentTrades.map((t) => (
            <div key={t.id} style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '60px 1fr auto' : '80px 60px 60px 1fr auto',
              gap: 8, padding: '10px 16px',
              borderBottom: `1px solid ${C.bd}`,
              fontSize: 12, alignItems: 'center',
            }}>
              <div style={{ fontFamily: M, fontSize: 11, color: C.t3 }} title={t.date}>
                {timeAgo(t.date)}
              </div>
              <div style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>{t.symbol}</div>
              {!isMobile && (
                <div style={{
                  color: t.side === 'long' ? C.g : C.r,
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {t.side}
                </div>
              )}
              {!isMobile && (
                <div style={{ fontSize: 11, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.playbook || t.setup || ''}
                </div>
              )}
              <div style={{
                fontFamily: M, fontWeight: 700, fontSize: 13,
                color: (t.pnl || 0) >= 0 ? C.g : C.r, textAlign: 'right',
              }}>
                {fmtD(t.pnl)}
              </div>
            </div>
          ))}
          {recentTrades.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: C.t3 }}>
              No trades yet
            </div>
          )}
        </Card>

        {/* Widget Customizer Modal (still available) */}
        <WidgetCustomizer
          isOpen={showCustomizer}
          onClose={() => setShowCustomizer(false)}
          activeWidgets={activeWidgets}
          onUpdateWidgets={setActiveWidgets}
          onApplyPreset={applyPreset}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // CUSTOM LAYOUT (widget grid — original behavior)
  // ═══════════════════════════════════════════════════════════════
  const cols = isMobile ? 1 : isTablet ? 1 : 2;

  const widgetComponents = {
    'stat-cards': (
      <Card style={{ padding: 12 }}>
        <AutoGrid minWidth={isMobile ? 100 : 120} gap={8}>
          <StatCard label="Total P&L" value={fmtD(result.totalPnl)} color={result.totalPnl >= 0 ? C.g : C.r} />
          <StatCard label="Today" value={fmtD(todayStats.pnl)} color={todayStats.pnl >= 0 ? C.g : todayStats.pnl < 0 ? C.r : C.t3} />
          <StatCard label="Profit Factor" value={result.pf === Infinity ? '∞' : result.pf.toFixed(2)} color={result.pf >= 1.5 ? C.g : result.pf >= 1 ? C.y : C.r} />
          <StatCard label="Expectancy" value={fmtD(result.expectancy)} color={result.expectancy >= 0 ? C.g : C.r} />
          <StatCard label="Sharpe" value={result.sharpe.toFixed(2)} color={result.sharpe >= 1 ? C.g : result.sharpe >= 0 ? C.y : C.r} />
          <StatCard label="Max DD" value={`${result.maxDd.toFixed(1)}%`} color={result.maxDd < 10 ? C.g : result.maxDd < 25 ? C.y : C.r} />
        </AutoGrid>
      </Card>
    ),
    'win-donut': (
      <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <WidgetBoundary name="Win Rate" height={130}>
          <WinRateDonut wins={result.winCount} losses={result.lossCount} size={130} />
        </WidgetBoundary>
      </Card>
    ),
    'equity-curve': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Equity Curve" right={`${result.tradeCount} trades`} />
        <WidgetBoundary name="Equity Curve" height={260}>
          <EquityCurveChart eq={result.eq} height={260} />
        </WidgetBoundary>
      </Card>
    ),
    'daily-pnl': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Daily P&L" />
        <WidgetBoundary name="Daily P&L" height={200}>
          <DailyPnlChart eq={result.eq} height={200} />
        </WidgetBoundary>
      </Card>
    ),
    'calendar': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Calendar" />
        <WidgetBoundary name="Calendar Heatmap" height={180}>
          <TradeHeatmap trades={trades} onDayClick={() => setPage('journal')} />
        </WidgetBoundary>
      </Card>
    ),
    'streaks': <StreakWidget trades={trades} />,
    'rolling': <RollingMetricsWidget trades={trades} />,
    'goals': <GoalProgressWidget trades={trades} goals={goals} />,
    'debrief': <DailyDebriefWidget trades={trades} result={result} />,
    'alerts': <SmartAlertFeedWidget alerts={[]} />,
    'context-perf': <ContextPerformanceWidget trades={trades} />,
    'prop-firm': (
      <WidgetBoundary name="Prop Firm Tracker">
        <PropFirmWidget />
      </WidgetBoundary>
    ),
    'recent-trades': (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${C.bd}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <OldSectionLabel text="Recent Trades" style={{ marginBottom: 0 }} />
          <button
            onClick={() => setPage('journal')}
            className="tf-link"
            style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}
          >
            View all →
          </button>
        </div>
        {recentTrades.map((t) => (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '70px 60px 1fr auto',
            gap: 8, padding: '8px 16px',
            borderBottom: `1px solid ${C.bd}`,
            fontSize: 12, alignItems: 'center',
          }}>
            <div style={{ fontFamily: M, fontSize: 11, color: C.t3 }} title={t.date}>{timeAgo(t.date)}</div>
            <div style={{ fontWeight: 700, color: C.t1 }}>{t.symbol}</div>
            <div style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{t.side}</div>
            <div style={{ fontFamily: M, fontWeight: 700, color: (t.pnl || 0) >= 0 ? C.g : C.r, textAlign: 'right' }}>{fmtD(t.pnl)}</div>
          </div>
        ))}
        {recentTrades.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.t3 }}>No trades yet</div>
        )}
      </Card>
    ),
    'insights': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Insights" />
        {result.insights?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.insights.map((ins, i) => (
              <div key={i} style={{
                padding: '8px 12px',
                background: ins.t === 'positive' ? C.g + '0c' : ins.t === 'warning' ? C.y + '0c' : C.b + '0c',
                borderLeft: `3px solid ${ins.t === 'positive' ? C.g : ins.t === 'warning' ? C.y : C.b}`,
                borderRadius: '0 6px 6px 0', fontSize: 12, lineHeight: 1.5, color: C.t2,
              }}>{ins.x}</div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.t3, padding: '20px 0', textAlign: 'center' }}>
            Add more trades to unlock insights
          </div>
        )}
      </Card>
    ),
    'risk-metrics': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Streaks & Risk" />
        <MetricRow label="Best Streak" value={`${result.best} wins`} color={C.g} />
        <MetricRow label="Worst Streak" value={`${result.worst} losses`} color={C.r} />
        <MetricRow label="Avg Win" value={fmtD(result.avgWin)} color={C.g} />
        <MetricRow label="Avg Loss" value={fmtD(result.avgLoss)} color={C.r} />
        <MetricRow label="Win/Loss Ratio" value={result.rr === Infinity ? '∞' : result.rr.toFixed(2)} color={C.t1} />
        <MetricRow label="Consec. 3+ Losses" value={`${result.consLoss3}x`} color={result.consLoss3 > 3 ? C.r : C.t2} />
      </Card>
    ),
    'advanced-metrics': (
      <Card style={{ padding: 16 }}>
        <OldSectionLabel text="Advanced" />
        <MetricRow label="Kelly Criterion" value={`${(result.kelly * 100).toFixed(1)}%`} color={C.b} tip={METRIC_TIPS['Kelly Criterion']} />
        <MetricRow label="Risk of Ruin" value={`${result.ror.toFixed(1)}%`} color={result.ror < 5 ? C.g : result.ror < 30 ? C.y : C.r} tip={METRIC_TIPS['Risk of Ruin']} />
        <MetricRow label="Sortino Ratio" value={result.sortino.toFixed(2)} color={result.sortino >= 1 ? C.g : C.t2} tip={METRIC_TIPS['Sortino']} />
        <MetricRow label="Total Fees" value={fmtD(result.totalFees)} color={C.y} />
        <MetricRow label="Rule Breaks" value={`${result.ruleBreaks}`} color={result.ruleBreaks > 0 ? C.r : C.g} />
        <MetricRow label="Largest Win" value={fmtD(result.lw)} color={C.g} />
        <MetricRow label="Largest Loss" value={fmtD(result.ll)} color={C.r} />
      </Card>
    ),
  };

  const widgets = activeWidgets
    .filter(id => widgetComponents[id])
    .map(id => ({
      id,
      span: WIDGET_REGISTRY[id]?.span || 1,
      component: widgetComponents[id],
    }));

  return (
    <div style={{ padding: pagePad, maxWidth: 1200 }}>
      <DashHeader
        trades={trades} computing={computing} layoutMode={layoutMode}
        onLayoutToggle={() => setLayoutMode('narrative')}
        editMode={editMode} onToggleEdit={toggleEditMode}
        onCustomize={() => setShowCustomizer(true)}
        activePreset={activePreset}
      />

      <QuickStatsBar result={result} todayPnl={todayStats.pnl} todayCount={todayStats.count} />

      <WidgetGrid
        widgets={widgets}
        cols={cols}
        gap={isMobile ? 12 : 16}
        editable={editMode}
        onLayoutChange={(order) => {
          const newOrder = order.map(i => widgets[i]?.id).filter(Boolean);
          if (newOrder.length === widgets.length) {
            useDashboardStore.getState().setActiveWidgets(newOrder);
          }
        }}
      />

      {editMode && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: C.b + '10', borderRadius: 8,
          border: `1px dashed ${C.b}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: C.b, fontWeight: 600 }}>
            Drag widgets to rearrange
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowCustomizer(true)}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: `1px solid ${C.b}40`, background: C.b + '15',
                color: C.b, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Add/Remove
            </button>
            <button
              onClick={toggleEditMode}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: 'none', background: C.b, color: '#fff',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      <WidgetCustomizer
        isOpen={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        activeWidgets={activeWidgets}
        onUpdateWidgets={setActiveWidgets}
        onApplyPreset={applyPreset}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function DashHeader({ trades, computing, layoutMode, onLayoutToggle, editMode, onToggleEdit, onCustomize, activePreset }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', marginBottom: space[5],
    }}>
      <div>
        <h1 style={text.h1}>Dashboard</h1>
        <p style={{ ...text.dataSm, margin: `${space[1]}px 0 0` }}>
          {trades.length} trades{computing ? ' · computing...' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <HeaderBtn
          label={layoutMode === 'narrative' ? '⊞ Custom' : '☰ Story'}
          onClick={onLayoutToggle}
        />
        {layoutMode === 'custom' && (
          <>
            <HeaderBtn
              label={editMode ? '✓ Done' : 'Edit'}
              active={editMode}
              onClick={onToggleEdit}
            />
            <HeaderBtn label="⚙ Widgets" onClick={onCustomize} />
          </>
        )}
      </div>
    </div>
  );
}

function HeaderBtn({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className="tf-btn"
      style={{
        padding: '5px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '15' : C.sf,
        color: active ? C.b : C.t2,
        fontSize: 11, fontWeight: 600, fontFamily: F,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Narrative section header with accent left border */
function SectionHeader({ label }) {
  return (
    <div
      className="tf-section-accent"
      style={{
        ...text.label,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

/** Secondary stat card with tooltip support */
function MetricCard({ label, value, color }) {
  const tip = METRIC_TIPS[label];
  return (
    <StatCard
      tier="secondary"
      label={label}
      value={value}
      color={color}
      style={tip ? { cursor: 'help' } : {}}
    />
  );
}

/** Legacy section label for custom widget layout */
function OldSectionLabel({ text: label, right, style = {} }) {
  return (
    <div style={{ ...layout.rowBetween, marginBottom: space[2] + 2, ...style }}>
      <div style={preset.sectionLabel}>{label}</div>
      {right && <div style={text.monoXs}>{right}</div>}
    </div>
  );
}

function MetricRow({ label, value, color = C.t1, tip }) {
  return (
    <div style={{ ...preset.metricRow }} title={tip || undefined}>
      <span style={{ ...text.bodySm, display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        {tip && (
          <span style={{ fontSize: 10, color: C.t3, cursor: 'help' }} title={tip}>ⓘ</span>
        )}
      </span>
      <span style={{ ...text.mono, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
