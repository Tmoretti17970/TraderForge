// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Leaderboard
//
// Community rankings by trading performance metrics.
// Supports: P&L, Win Rate, Sharpe Ratio, Profit Factor.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { C, M } from '../constants.js';
import { space, radii, text, transition, pnlColor } from '../theme/tokens.js';
import { Card } from './UIKit.jsx';
import { useSocialStore } from '../state/useSocialStore.js';

const METRICS = [
  { id: 'pnl', label: 'P&L', format: (v) => `$${v.toLocaleString()}` },
  { id: 'winRate', label: 'Win Rate', format: (v) => `${v}%` },
  { id: 'sharpe', label: 'Sharpe', format: (v) => v.toFixed(2) },
  { id: 'profitFactor', label: 'Profit Factor', format: (v) => v.toFixed(2) },
];

const PERIODS = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All' },
];

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * @param {Object} props
 * @param {Function} [props.onViewProfile] - View user profile
 */
export default function Leaderboard({ onViewProfile }) {
  const leaderboard = useSocialStore((s) => s.leaderboard);
  const loading = useSocialStore((s) => s.leaderboardLoading);
  const metric = useSocialStore((s) => s.leaderboardMetric);
  const period = useSocialStore((s) => s.leaderboardPeriod);
  const setMetric = useSocialStore((s) => s.setLeaderboardMetric);
  const setPeriod = useSocialStore((s) => s.setLeaderboardPeriod);
  const loadLeaderboard = useSocialStore((s) => s.loadLeaderboard);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const metricConfig = METRICS.find((m) => m.id === metric) || METRICS[0];

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ ...text.h3, marginBottom: space[3] }}>
          🏆 Leaderboard
        </div>

        {/* Metric selector */}
        <div style={{
          display: 'flex',
          gap: 3,
          marginBottom: space[2],
        }}>
          {METRICS.map((m) => (
            <button className="tf-btn"
              key={m.id}
              onClick={() => setMetric(m.id)}
              style={{
                padding: '4px 10px',
                borderRadius: radii.pill,
                border: `1px solid ${metric === m.id ? C.b : C.bd}`,
                background: metric === m.id ? C.b + '15' : 'transparent',
                color: metric === m.id ? C.b : C.t3,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: M,
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIODS.map((p) => (
            <button className="tf-btn"
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '3px 8px',
                borderRadius: radii.sm,
                border: 'none',
                background: period === p.id ? C.sf2 : 'transparent',
                color: period === p.id ? C.t1 : C.t3,
                fontSize: 9,
                fontWeight: 600,
                fontFamily: M,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rankings */}
      <div style={{ maxHeight: 450, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: space[6], textAlign: 'center', ...text.captionSm }}>
            Loading rankings...
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ padding: space[6], textAlign: 'center', ...text.bodySm, color: C.t3 }}>
            No rankings available yet.
          </div>
        ) : (
          leaderboard.map((entry) => (
            <div
              key={entry.userId}
              onClick={() => onViewProfile?.(entry.userId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                padding: `${space[2]}px ${space[4]}px`,
                borderBottom: `1px solid ${C.bd}20`,
                cursor: onViewProfile ? 'pointer' : 'default',
                transition: `background ${transition.fast}`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.sf2}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {/* Rank */}
              <div style={{
                width: 28,
                textAlign: 'center',
                fontSize: entry.rank <= 3 ? 16 : 12,
                fontWeight: 700,
                fontFamily: M,
                color: entry.rank <= 3 ? C.t1 : C.t3,
                flexShrink: 0,
              }}>
                {RANK_MEDALS[entry.rank] || `#${entry.rank}`}
              </div>

              {/* Avatar */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${C.b}25, ${C.p}25)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0,
              }}>
                {entry.avatar || '👤'}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.t1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.username}
                </div>
                <div style={{ ...text.captionSm, fontSize: 9 }}>
                  {entry.tradeCount} trades
                </div>
              </div>

              {/* Value */}
              <div style={{
                fontFamily: M,
                fontSize: 13,
                fontWeight: 700,
                color: metric === 'pnl' ? pnlColor(entry.value) : (entry.value > 0 ? C.g : C.t2),
                flexShrink: 0,
              }}>
                {metricConfig.format(entry.value)}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
