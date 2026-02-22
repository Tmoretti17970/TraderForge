// ═══════════════════════════════════════════════════════════════════
// TradeForge — Empty State System (Redesign)
//
// Three tiers:
//   1. Aspirational: Shows a blurred preview of the filled page
//   2. Milestone: Shows progress toward unlocking features
//   3. Minimal: Simple text for inline widget empty states
//
// All empty states include a clear CTA and feel like a doorway,
// not a dead end.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../constants.js';
import { space, radii, text } from '../theme/tokens.js';
import { Card, Btn } from './UIKit.jsx';

// ─── Core EmptyState (enhanced) ─────────────────────────────────

export default function EmptyState({
  icon, title, message, actionLabel, onAction,
  secondaryLabel, onSecondary, children, preview,
}) {
  return (
    <Card className="tf-fade-scale" style={{ padding: 0, textAlign: 'center', overflow: 'hidden' }}>
      {/* Aspirational preview (blurred mockup) */}
      {preview && (
        <div style={{
          position: 'relative',
          height: 160,
          overflow: 'hidden',
          borderBottom: `1px solid ${C.bd}`,
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            filter: 'blur(3px) brightness(0.5)',
            opacity: 0.6,
            pointerEvents: 'none',
          }}>
            {preview}
          </div>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${C.bg})`,
          }} />
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            fontSize: 11,
            fontWeight: 600,
            color: C.t3,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            Preview
          </div>
        </div>
      )}

      <div style={{ padding: `${space[8]}px ${space[6]}px ${space[6]}px` }}>
        {/* Icon */}
        {icon && (
          <div style={{
            width: 56,
            height: 56,
            margin: '0 auto',
            borderRadius: 16,
            background: `linear-gradient(135deg, ${C.b}15, ${C.y}10)`,
            border: `1px solid ${C.b}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            marginBottom: space[4],
          }}>
            {icon}
          </div>
        )}

        {/* Title */}
        <h3 style={{
          ...text.h2,
          marginBottom: space[2],
        }}>
          {title}
        </h3>

        {/* Message */}
        <p style={{
          ...text.body,
          color: C.t2,
          maxWidth: 380,
          margin: `0 auto ${space[5]}px`,
          lineHeight: 1.6,
        }}>
          {message}
        </p>

        {/* Actions */}
        {(actionLabel || secondaryLabel) && (
          <div style={{
            display: 'flex',
            gap: space[3],
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            {actionLabel && (
              <Btn onClick={onAction}>{actionLabel}</Btn>
            )}
            {secondaryLabel && (
              <Btn onClick={onSecondary} variant="ghost">{secondaryLabel}</Btn>
            )}
          </div>
        )}

        {children}
      </div>
    </Card>
  );
}

// ─── Dashboard Empty State ──────────────────────────────────────

export function DashboardEmptyState({ onGoToJournal }) {
  return (
    <EmptyState
      icon="📊"
      title="Your Trading Story Starts Here"
      message="Log your first trade to unlock performance analytics, equity tracking, and personalized insights."
      actionLabel="Log Your First Trade →"
      onAction={onGoToJournal}
      preview={<DashboardPreview />}
    >
      <FeatureRoadmap
        items={[
          { trades: 1,  label: 'Basic P&L tracking',        icon: '📈' },
          { trades: 5,  label: 'Win rate & streak analysis', icon: '🎯' },
          { trades: 20, label: 'Advanced metrics & patterns', icon: '🧠' },
          { trades: 50, label: 'Monte Carlo & risk models',  icon: '🔬' },
        ]}
        current={0}
      />
    </EmptyState>
  );
}

// ─── Journal Empty State ────────────────────────────────────────

export function JournalEmptyState({ onAddTrade, onImportCSV }) {
  return (
    <EmptyState
      icon="📒"
      title="Start Building Your Edge"
      message="Every trade tells a story. Log your trades with context, strategy, and emotions to find patterns that move the needle."
      actionLabel="+ Add First Trade"
      onAction={onAddTrade}
      secondaryLabel="📁 Import CSV"
      onSecondary={onImportCSV}
      preview={<JournalPreview />}
    >
      <div style={{
        marginTop: space[6],
        padding: space[4],
        background: C.sf2,
        borderRadius: radii.md,
        textAlign: 'left',
        maxWidth: 380,
        margin: `${space[6]}px auto 0`,
        border: `1px solid ${C.bd}40`,
      }}>
        <div style={{ ...text.label, marginBottom: space[2], color: C.b }}>Quick Start Tips</div>
        <TipItem text="Log trades right after closing — emotions are freshest" />
        <TipItem text="Add your strategy name to unlock pattern detection" />
        <TipItem text="Track emotional state to spot tilt before it costs you" />
        <TipItem text="Import broker CSVs for instant historical analysis" />
      </div>
    </EmptyState>
  );
}

// ─── Insights Empty State ───────────────────────────────────────

export function InsightsEmptyState({ onGoToJournal }) {
  return (
    <EmptyState
      icon="🔬"
      title="Intelligence Unlocks With Data"
      message="The more you trade and log, the smarter your insights become. Each trade adds a data point to your edge."
      actionLabel="Start Logging Trades →"
      onAction={onGoToJournal}
    >
      <FeatureRoadmap
        items={[
          { trades: 1,   label: 'Strategy overview',           icon: '📋' },
          { trades: 10,  label: 'Timing & psychology analysis', icon: '🧠' },
          { trades: 25,  label: 'Playbook pattern matching',    icon: '📚' },
          { trades: 50,  label: 'Full risk modeling suite',     icon: '🔬' },
        ]}
        current={0}
      />
    </EmptyState>
  );
}

// ─── Charts Empty State (for when no data loads) ────────────────

export function ChartsEmptyState({ onSearch }) {
  return (
    <EmptyState
      icon="📈"
      title="Search a Symbol to Begin"
      message="Type a ticker symbol above to load real-time charts with indicators, drawing tools, and trade overlays."
    />
  );
}

// ─── Notes Empty State ──────────────────────────────────────────

export function NotesEmptyState({ onNewNote }) {
  return (
    <EmptyState
      icon="✏️"
      title="Capture Your Thoughts"
      message="Market observations, trade reviews, daily reflections — your notes become searchable context for future decisions."
      actionLabel="Write First Note"
      onAction={onNewNote}
    />
  );
}

// ─── Inline Widget Empty State (minimal, for cards) ──────────────

export function WidgetEmptyState({ message, actionLabel, onAction }) {
  return (
    <div style={{
      padding: '24px 16px',
      textAlign: 'center',
      color: C.t3,
      fontSize: 13,
      lineHeight: 1.6,
    }}>
      <div style={{ marginBottom: actionLabel ? 12 : 0 }}>{message}</div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="tf-link"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Milestone Progress Component ───────────────────────────────

export function MilestoneBar({ tradeCount }) {
  const milestones = [
    { count: 1,   label: 'First trade' },
    { count: 10,  label: 'Getting started' },
    { count: 25,  label: 'Building habits' },
    { count: 50,  label: 'Pattern detection' },
    { count: 100, label: 'Statistical edge' },
  ];

  const nextMilestone = milestones.find(m => tradeCount < m.count);
  if (!nextMilestone) return null;

  const prevCount = milestones[milestones.indexOf(nextMilestone) - 1]?.count || 0;
  const progress = Math.min(((tradeCount - prevCount) / (nextMilestone.count - prevCount)) * 100, 100);

  return (
    <div style={{
      padding: '10px 16px',
      background: C.sf,
      borderRadius: radii.md,
      border: `1px solid ${C.bd}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.t2, fontWeight: 500 }}>
          {tradeCount} / {nextMilestone.count} trades
        </span>
        <span style={{ fontSize: 11, color: C.b, fontWeight: 600 }}>
          {nextMilestone.label}
        </span>
      </div>
      <div style={{
        height: 4,
        borderRadius: 2,
        background: C.bd,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${C.b}, ${C.y})`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// ─── Feature Roadmap (shows what unlocks at each tier) ───────────

function FeatureRoadmap({ items, current }) {
  return (
    <div style={{
      marginTop: space[6],
      maxWidth: 360,
      margin: `${space[6]}px auto 0`,
    }}>
      <div style={{ ...text.label, marginBottom: space[3], textAlign: 'left', color: C.t3 }}>
        What unlocks as you trade
      </div>
      {items.map((item, i) => {
        const unlocked = current >= item.trades;
        return (
          <div
            key={i}
            className={`tf-stagger-${i + 1}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: radii.md,
              background: unlocked ? C.b + '08' : 'transparent',
              marginBottom: 2,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: unlocked ? C.b + '20' : C.bd + '30',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              flexShrink: 0,
            }}>
              {unlocked ? '✓' : item.icon}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{
                fontSize: 13,
                fontWeight: unlocked ? 600 : 500,
                color: unlocked ? C.t1 : C.t3,
              }}>
                {item.label}
              </div>
            </div>
            <div style={{
              fontSize: 10,
              fontFamily: M,
              fontWeight: 600,
              color: unlocked ? C.g : C.t3,
              padding: '2px 8px',
              borderRadius: 10,
              background: unlocked ? C.g + '15' : C.bd + '20',
            }}>
              {item.trades}+
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Aspirational Previews ──────────────────────────────────────
// Lightweight SVG/div mockups showing what the page looks like
// when populated. These are intentionally abstract/blurred.

function DashboardPreview() {
  return (
    <div style={{ padding: 16, display: 'flex', gap: 8, height: '100%' }}>
      {/* Hero stat */}
      <div style={{
        flex: 2, background: C.g + '15', borderRadius: 8, padding: 12,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 8, color: C.t3, marginBottom: 4 }}>Today's P&L</div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: M, color: C.g }}>+$1,247.50</div>
      </div>
      {/* Secondary stats */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ flex: 1, background: C.sf, borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 7, color: C.t3 }}>Win Rate</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color: C.t1 }}>68%</div>
        </div>
        <div style={{ flex: 1, background: C.sf, borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 7, color: C.t3 }}>Trades</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color: C.t1 }}>12</div>
        </div>
      </div>
      {/* Equity curve mockup */}
      <div style={{ flex: 3, background: C.sf, borderRadius: 8, padding: 8, position: 'relative' }}>
        <div style={{ fontSize: 7, color: C.t3, marginBottom: 4 }}>Equity Curve</div>
        <svg width="100%" height="80" viewBox="0 0 200 80" preserveAspectRatio="none">
          <path
            d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 30 L120 35 L140 22 L160 18 L180 25 L200 10"
            fill="none" stroke={C.g} strokeWidth="2" opacity="0.7"
          />
          <path
            d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 30 L120 35 L140 22 L160 18 L180 25 L200 10 L200 80 L0 80"
            fill={C.g + '10'} stroke="none"
          />
        </svg>
      </div>
    </div>
  );
}

function JournalPreview() {
  const rows = [
    { sym: 'AAPL',  side: 'long',  pnl: '+$342.00', color: C.g },
    { sym: 'TSLA',  side: 'short', pnl: '-$128.50', color: C.r },
    { sym: 'NVDA',  side: 'long',  pnl: '+$567.25', color: C.g },
    { sym: 'SPY',   side: 'long',  pnl: '+$89.00',  color: C.g },
  ];
  return (
    <div style={{ padding: '12px 16px' }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: C.sf, borderRadius: 6,
          marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontFamily: M, fontSize: 12, color: C.t1 }}>{r.sym}</span>
            <span style={{ fontSize: 9, color: r.side === 'long' ? C.g : C.r, fontWeight: 600, textTransform: 'uppercase' }}>{r.side}</span>
          </div>
          <span style={{ fontWeight: 700, fontFamily: M, fontSize: 12, color: r.color }}>{r.pnl}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Helpers ─────────────────────────────────────────────

function TipItem({ text: label }) {
  return (
    <div style={{
      display: 'flex',
      gap: space[2],
      alignItems: 'flex-start',
      padding: `${space[1] + 1}px 0`,
    }}>
      <span style={{ color: C.b, fontSize: 10, lineHeight: '18px', flexShrink: 0 }}>●</span>
      <span style={{ fontSize: 13, color: C.t2, lineHeight: '18px' }}>{label}</span>
    </div>
  );
}

function MetricPreview({ label }) {
  return (
    <div style={{
      padding: `${space[2]}px ${space[3]}px`,
      background: C.sf2,
      borderRadius: radii.md,
      border: `1px solid ${C.bd}40`,
    }}>
      <div style={{ ...text.captionSm, marginBottom: 2 }}>{label}</div>
      <div style={{
        fontFamily: M,
        fontSize: 16,
        fontWeight: 700,
        color: C.t3 + '50',
      }}>
        —
      </div>
    </div>
  );
}
