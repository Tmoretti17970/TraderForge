// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Public Snapshot Page
//
// Server-renderable page for /shared/:id
// Shows: snapshot title, author info, chart config, description,
// tags, like count, and comment thread.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { C, F, M } from '../../constants.js';
import { space, radii } from '../../theme/tokens.js';
import { snapshotPageMeta, applyMetaToHead } from '../../seo/meta.js';
import { PublicNav, PublicFooter } from './PublicSymbolPage.jsx';

/**
 * @param {Object} props
 * @param {string} props.snapshotId
 * @param {Object} [props.ssrData] - { snapshot, author }
 */
export default function PublicSnapshotPage({ snapshotId, ssrData }) {
  const [data, setData] = useState(ssrData || null);

  useEffect(() => {
    if (data?.snapshot) {
      const meta = snapshotPageMeta(data.snapshot, data.author);
      applyMetaToHead(meta);
    }
  }, [data]);

  // Loading / not found
  if (!data?.snapshot) {
    return (
      <div style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.t1,
        fontFamily: F,
      }}>
        <PublicNav />
        <div style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: `${space[8]}px ${space[4]}px`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: space[3], opacity: 0.3 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: space[2] }}>
            Chart Not Found
          </h1>
          <p style={{ color: C.t3, marginBottom: space[4] }}>
            This shared chart may have been removed or the link is incorrect.
          </p>
          <a href="/" className="tf-btn" style={{
            padding: '10px 24px',
            borderRadius: radii.md,
            background: C.info,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}>
            Go to TradeForge →
          </a>
        </div>
        <PublicFooter />
      </div>
    );
  }

  const { snapshot, author } = data;

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.t1,
      fontFamily: F,
    }}>
      <PublicNav />

      <div style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: `${space[6]}px ${space[4]}px`,
      }}>
        {/* ─── Author ──────────────────────────────── */}
        {author && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
            marginBottom: space[3],
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.info}20, ${C.p}20)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}>
              {author.avatar || '🔥'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {author.displayName || author.username}
              </div>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                @{author.username}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: C.t3 }}>
              {timeAgo(snapshot.createdAt)}
            </span>
          </div>
        )}

        {/* ─── Title ───────────────────────────────── */}
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: space[2],
          lineHeight: 1.3,
        }}>
          {snapshot.title || `${snapshot.symbol} Analysis`}
        </h1>

        {/* ─── Symbol / TF badges ──────────────────── */}
        <div style={{
          display: 'flex',
          gap: space[2],
          marginBottom: space[3],
          flexWrap: 'wrap',
        }}>
          <Badge color={C.info}>{snapshot.symbol}</Badge>
          {snapshot.timeframe && <Badge color={C.p}>{snapshot.timeframe}</Badge>}
          {snapshot.chartType && <Badge color={C.t3}>{snapshot.chartType}</Badge>}
        </div>

        {/* ─── Chart Placeholder ───────────────────── */}
        <div style={{
          height: 320,
          background: C.sf,
          borderRadius: radii.lg,
          border: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space[4],
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${C.bd}15 1px, transparent 1px), linear-gradient(90deg, ${C.bd}15 1px, transparent 1px)`,
            backgroundSize: '60px 40px',
          }} />
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 36, marginBottom: space[2], opacity: 0.3 }}>📊</div>
            <a
              href={`/?symbol=${snapshot.symbol}&page=charts`}
              style={{
                padding: '8px 20px',
                borderRadius: radii.md,
                background: C.info,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Open in TradeForge →
            </a>
          </div>
        </div>

        {/* ─── Indicators Used ─────────────────────── */}
        {snapshot.indicators?.length > 0 && (
          <div style={{ marginBottom: space[3] }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: space[1] }}>
              Indicators
            </div>
            <div style={{ display: 'flex', gap: space[1], flexWrap: 'wrap' }}>
              {snapshot.indicators.map((ind, i) => (
                <span key={i} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: radii.pill,
                  background: C.bd,
                  fontSize: 10,
                  fontFamily: M,
                  color: C.t2,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: ind.color || C.info,
                  }} />
                  {ind.type?.toUpperCase()}
                  {ind.params?.period ? ` (${ind.params.period})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Description ─────────────────────────── */}
        {snapshot.description && (
          <p style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: C.t1,
            marginBottom: space[4],
          }}>
            {snapshot.description}
          </p>
        )}

        {/* ─── Tags ────────────────────────────────── */}
        {snapshot.tags?.length > 0 && (
          <div style={{
            display: 'flex',
            gap: space[1],
            flexWrap: 'wrap',
            marginBottom: space[4],
          }}>
            {snapshot.tags.map((tag) => (
              <span key={tag} style={{
                padding: '2px 8px',
                borderRadius: radii.pill,
                background: C.info + '10',
                border: `1px solid ${C.info}25`,
                color: C.info,
                fontSize: 10,
                fontWeight: 600,
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* ─── Stats Row ───────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: space[4],
          padding: `${space[3]}px 0`,
          borderTop: `1px solid ${C.bd}`,
          borderBottom: `1px solid ${C.bd}`,
          marginBottom: space[4],
          color: C.t3,
          fontSize: 12,
        }}>
          <span>❤️ {snapshot.likes || 0} likes</span>
          <span>💬 {snapshot.commentCount || 0} comments</span>
        </div>

        {/* ─── CTA ─────────────────────────────────── */}
        <div style={{
          padding: space[4],
          background: C.sf,
          borderRadius: radii.lg,
          border: `1px solid ${C.bd}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: space[2] }}>
            Join the conversation on TradeForge
          </div>
          <div style={{ color: C.t3, fontSize: 13, marginBottom: space[3] }}>
            Log trades, share charts, and compete with other traders.
          </div>
          <a href="/" className="tf-btn" style={{
            display: 'inline-block',
            padding: '10px 28px',
            borderRadius: radii.md,
            background: C.info,
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}>
            Get Started Free →
          </a>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function Badge({ children, color }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: radii.pill,
      background: color + '18',
      color,
      fontSize: 11,
      fontWeight: 700,
      fontFamily: M,
    }}>
      {children}
    </span>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
