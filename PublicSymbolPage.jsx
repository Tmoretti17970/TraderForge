// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Public Symbol Page
//
// Server-renderable page for /symbol/:ticker
// Shows: symbol name, price (when available), mini chart placeholder,
// key stats, and CTA to open in the app.
//
// Designed for search engine indexing + social sharing.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { C, F, M } from '../../constants.js';
import { space, radii, text } from '../../theme/tokens.js';
import { symbolPageMeta, applyMetaToHead } from '../../seo/meta.js';

/**
 * @param {Object} props
 * @param {string} props.ticker - Symbol/ticker string
 * @param {Object} [props.ssrData] - Pre-loaded data from server
 */
export default function PublicSymbolPage({ ticker, ssrData }) {
  const symbol = (ticker || 'BTC').toUpperCase();
  const [data, setData] = useState(ssrData || null);

  // Client-side: apply meta tags
  useEffect(() => {
    const meta = symbolPageMeta(symbol, data?.price, data?.change24h);
    applyMetaToHead(meta);
  }, [symbol, data]);

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.t1,
      fontFamily: F,
    }}>
      {/* ─── Nav Bar ─────────────────────────────────── */}
      <PublicNav />

      {/* ─── Hero Section ────────────────────────────── */}
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: `${space[8]}px ${space[4]}px`,
      }}>
        {/* Symbol Header */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: space[3],
          marginBottom: space[4],
        }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            {symbol}
          </h1>
          {data?.price != null && (
            <span style={{
              fontSize: 24,
              fontFamily: M,
              fontWeight: 700,
              color: C.t1,
            }}>
              ${data.price.toLocaleString()}
            </span>
          )}
          {data?.change24h != null && (
            <span style={{
              fontSize: 16,
              fontFamily: M,
              fontWeight: 600,
              color: data.change24h >= 0 ? C.g : C.r,
            }}>
              {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Chart Placeholder */}
        <div style={{
          height: 400,
          background: C.sf,
          borderRadius: radii.lg,
          border: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space[6],
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative grid lines */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(${C.bd}20 1px, transparent 1px), linear-gradient(90deg, ${C.bd}20 1px, transparent 1px)`,
            backgroundSize: '60px 40px',
          }} />
          <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 48, marginBottom: space[2], opacity: 0.3 }}>📈</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.t3,
              marginBottom: space[3],
            }}>
              Interactive chart available in the app
            </div>
            <a
              href={`/?symbol=${symbol}&page=charts`}
              className="tf-btn"
              style={{
                display: 'inline-block',
                padding: '10px 24px',
                borderRadius: radii.md,
                background: C.info,
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
                transition: 'opacity 0.15s',
              }}
            >
              Open {symbol} Chart →
            </a>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: space[3],
          marginBottom: space[6],
        }}>
          <InfoCard
            title="Trading Journal"
            text={`Log your ${symbol} trades with entry, exit, P&L, screenshots, and notes. Track your edge over time.`}
            icon="📝"
          />
          <InfoCard
            title="Technical Analysis"
            text={`Full interactive chart with 6+ chart types, indicators (SMA, EMA, RSI, Bollinger), and drawing tools.`}
            icon="📐"
          />
          <InfoCard
            title="Community Insights"
            text={`See what other traders are saying about ${symbol}. View shared charts and analysis.`}
            icon="📡"
          />
          <InfoCard
            title="Performance Analytics"
            text={`Track your ${symbol} win rate, P&L distribution, Sharpe ratio, and R-multiple analytics.`}
            icon="📊"
          />
        </div>

        {/* SEO Text Content */}
        <article style={{
          maxWidth: 680,
          lineHeight: 1.7,
          color: C.t2,
          fontSize: 14,
        }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.t1,
            marginBottom: space[2],
          }}>
            {symbol} on TradeForge
          </h2>
          <p>
            TradeForge provides a comprehensive trading journal and analytics platform
            for {symbol} and other assets. Track your trades, analyze your performance,
            and improve your trading edge with data-driven insights.
          </p>
          <p>
            Use interactive charts with custom indicators, share your analysis with
            the community, and compete on the leaderboard. TradeForge works entirely
            in your browser — no account required.
          </p>
        </article>
      </div>

      {/* ─── Footer ──────────────────────────────────── */}
      <PublicFooter />
    </div>
  );
}

// ─── Shared Public Components ─────────────────────────────────

function PublicNav() {
  return (
    <nav aria-label="TradeForge navigation" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${space[3]}px ${space[4]}px`,
      borderBottom: `1px solid ${C.bd}`,
      maxWidth: 960,
      margin: '0 auto',
    }}>
      <a href="/" style={{
        fontSize: 18,
        fontWeight: 800,
        color: C.t1,
        textDecoration: 'none',
        letterSpacing: '-0.02em',
      }}>
        ⚡ TradeForge
      </a>
      <div style={{ display: 'flex', gap: space[3] }}>
        <a href="/leaderboard" className="tf-btn" style={{ color: C.t3, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
          Leaderboard
        </a>
        <a href="/" style={{
          padding: '6px 16px',
          borderRadius: radii.md,
          background: C.info,
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
        }}>
          Open App
        </a>
      </div>
    </nav>
  );
}

function PublicFooter() {
  return (
    <footer style={{
      borderTop: `1px solid ${C.bd}`,
      padding: `${space[6]}px ${space[4]}px`,
      textAlign: 'center',
      maxWidth: 960,
      margin: '0 auto',
    }}>
      <div style={{ color: C.t3, fontSize: 12, fontFamily: M }}>
        © {new Date().getFullYear()} TradeForge. Open-source trading journal.
      </div>
      <div style={{ marginTop: space[2], display: 'flex', justifyContent: 'center', gap: space[4] }}>
        <a href="/" style={{ color: C.t3, fontSize: 11, textDecoration: 'none' }}>Home</a>
        <a href="/leaderboard" className="tf-btn" style={{ color: C.t3, fontSize: 11, textDecoration: 'none' }}>Leaderboard</a>
      </div>
    </footer>
  );
}

function InfoCard({ title, text: body, icon }) {
  return (
    <div style={{
      padding: space[4],
      background: C.sf,
      borderRadius: radii.lg,
      border: `1px solid ${C.bd}`,
    }}>
      <div style={{ fontSize: 24, marginBottom: space[2] }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: space[1] }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
        {body}
      </div>
    </div>
  );
}

export { PublicNav, PublicFooter, InfoCard };
