// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Public Leaderboard Page
//
// Server-renderable page for /leaderboard
// Shows: rankings table, metric selector, period filter.
// Full HTML table for SEO crawlability.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { C, F, M } from '../../constants.js';
import { space, radii } from '../../theme/tokens.js';
import { leaderboardPageMeta, applyMetaToHead } from '../../seo/meta.js';
import { PublicNav, PublicFooter } from './PublicSymbolPage.jsx';

const METRICS = [
  { id: 'pnl', label: 'P&L', format: (v) => `${v >= 0 ? '+' : ''}$${v.toLocaleString()}` },
  { id: 'winRate', label: 'Win Rate', format: (v) => `${v.toFixed(1)}%` },
  { id: 'sharpe', label: 'Sharpe', format: (v) => v.toFixed(2) },
  { id: 'profitFactor', label: 'Profit Factor', format: (v) => v.toFixed(2) },
];

/**
 * @param {Object} props
 * @param {Object} [props.ssrData] - { rankings: [] }
 */
export default function PublicLeaderboardPage({ ssrData }) {
  const [data, setData] = useState(ssrData || null);
  const [metric, setMetric] = useState('pnl');

  useEffect(() => {
    const meta = leaderboardPageMeta(metric, '30d');
    applyMetaToHead(meta);
  }, [metric]);

  const rankings = data?.rankings || [];
  const activeMetric = METRICS.find((m) => m.id === metric) || METRICS[0];

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.t1,
      fontFamily: F,
    }}>
      <PublicNav />

      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: `${space[6]}px ${space[4]}px`,
      }}>
        {/* ─── Header ──────────────────────────────── */}
        <div style={{ marginBottom: space[5] }}>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: space[1],
          }}>
            🏆 Trader Leaderboard
          </h1>
          <p style={{ color: C.t3, fontSize: 14, margin: 0 }}>
            Top performers in the TradeForge community, ranked by verified trading metrics.
          </p>
        </div>

        {/* ─── Metric Selector ─────────────────────── */}
        <div style={{
          display: 'flex',
          gap: space[1],
          marginBottom: space[4],
          flexWrap: 'wrap',
        }}>
          {METRICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className="tf-btn"
              aria-pressed={metric === m.id}
              style={{
                padding: '6px 14px',
                borderRadius: radii.pill,
                border: `1px solid ${metric === m.id ? C.info : C.bd}`,
                background: metric === m.id ? C.info + '18' : 'transparent',
                color: metric === m.id ? C.info : C.t3,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* ─── Rankings Table ──────────────────────── */}
        {rankings.length === 0 ? (
          <div style={{
            padding: space[8],
            textAlign: 'center',
            color: C.t3,
          }}>
            <div style={{ fontSize: 48, marginBottom: space[2], opacity: 0.3 }}>🏆</div>
            <div style={{ fontSize: 14 }}>No rankings available yet.</div>
          </div>
        ) : (
          <table role="table" aria-label="Trader rankings" style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
          }}>
            <thead>
              <tr style={{
                borderBottom: `1px solid ${C.bd}`,
                color: C.t3,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>Rank</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Trader</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>{activeMetric.label}</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 80 }}>Trades</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row, i) => (
                <tr
                  key={row.userId || i}
                  style={{
                    borderBottom: '1px solid #1e213040',
                  }}
                >
                  {/* Rank */}
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {row.rank <= 3 ? (
                      <span style={{ fontSize: 16 }}>
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span style={{ color: C.t3, fontFamily: M, fontWeight: 700 }}>
                        {row.rank}
                      </span>
                    )}
                  </td>

                  {/* Trader */}
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${C.info}20, ${C.p}20)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        flexShrink: 0,
                      }}>
                        {row.avatar || '🔥'}
                      </div>
                      <span style={{ fontWeight: 600 }}>
                        {row.username}
                      </span>
                    </div>
                  </td>

                  {/* Value */}
                  <td style={{
                    ...tdStyle,
                    textAlign: 'right',
                    fontFamily: M,
                    fontWeight: 700,
                    color: metric === 'pnl'
                      ? (row.value >= 0 ? C.g : C.r)
                      : C.t1,
                  }}>
                    {activeMetric.format(row.value)}
                  </td>

                  {/* Trade count */}
                  <td style={{
                    ...tdStyle,
                    textAlign: 'right',
                    color: C.t3,
                    fontFamily: M,
                  }}>
                    {row.tradeCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ─── CTA ─────────────────────────────────── */}
        <div style={{
          marginTop: space[6],
          padding: space[4],
          background: C.sf,
          borderRadius: radii.lg,
          border: `1px solid ${C.bd}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: space[2] }}>
            Think you can make the board?
          </div>
          <div style={{ color: C.t3, fontSize: 13, marginBottom: space[3] }}>
            Start journaling your trades and climb the rankings.
          </div>
          <a href="/" style={{
            display: 'inline-block',
            padding: '10px 28px',
            borderRadius: radii.md,
            background: C.info,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}>
            Start Trading Journal →
          </a>
        </div>

        {/* ─── SEO Content ─────────────────────────── */}
        <article style={{
          marginTop: space[6],
          color: C.t3,
          fontSize: 13,
          lineHeight: 1.7,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.t2, marginBottom: space[2] }}>
            About the TradeForge Leaderboard
          </h2>
          <p>
            The TradeForge leaderboard ranks traders by their verified performance metrics
            including total P&L, win rate, Sharpe ratio, and profit factor. Rankings are
            updated as traders log and verify their trades through the platform.
          </p>
          <p>
            All metrics are computed from actual trade journal entries, ensuring transparency
            and accountability. Whether you trade crypto, forex, or equities, the leaderboard
            provides a fair comparison across all trading styles.
          </p>
        </article>
      </div>

      <PublicFooter />
    </div>
  );
}

const thStyle = {
  padding: '8px 12px',
  fontFamily: M,
};

const tdStyle = {
  padding: '10px 12px',
};
