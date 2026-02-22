// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Fundamentals Card
//
// Compact market data widget for chart page. Shows key metrics in
// a dense 2-row grid: market cap, volume, supply, ATH, rank,
// and price changes. Auto-fetches on symbol change.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import { C, M } from '../constants.js';
import { fetchFundamentals, hasFundamentals, fmtCompact, fmtSupply } from '../data/FundamentalService.js';

/**
 * @param {Object} props
 * @param {string} props.symbol - Current chart symbol
 */
export default function FundamentalsCard({ symbol }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!hasFundamentals(symbol)) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetchFundamentals(symbol).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [symbol]);

  // Don't render for non-crypto or if no data
  if (!hasFundamentals(symbol)) return null;

  if (loading && !data) {
    return (
      <div style={{
        padding: '6px 12px',
        borderBottom: `1px solid ${C.bd}`,
        background: C.bg,
        fontSize: 10,
        color: C.t3,
        fontFamily: M,
      }}>
        Loading fundamentals...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      style={{
        borderBottom: `1px solid ${C.bd}`,
        background: C.bg,
        padding: '4px 12px',
        flexShrink: 0,
      }}
    >
      {/* Primary row — always visible */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Rank badge */}
        {data.rank && (
          <MetricBadge label="Rank" value={`#${data.rank}`} />
        )}

        <Metric label="Mkt Cap" value={`$${fmtCompact(data.marketCap)}`} />
        <Metric label="24h Vol" value={`$${fmtCompact(data.volume24h)}`} />
        <Metric label="Supply" value={fmtSupply(data.supply, data.maxSupply)} />

        {/* 24h change */}
        {data.priceChange24h != null && (
          <Metric
            label="24h"
            value={`${data.priceChange24h >= 0 ? '+' : ''}${data.priceChange24h.toFixed(1)}%`}
            color={data.priceChange24h >= 0 ? C.g : C.r}
          />
        )}

        {/* 7d change */}
        {data.priceChange7d != null && (
          <Metric
            label="7d"
            value={`${data.priceChange7d >= 0 ? '+' : ''}${data.priceChange7d.toFixed(1)}%`}
            color={data.priceChange7d >= 0 ? C.g : C.r}
          />
        )}

        {/* Expand toggle */}
        <button className="tf-btn"
          onClick={() => setExpanded(!expanded)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: C.t3,
            fontSize: 9,
            fontFamily: M,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
          title={expanded ? 'Collapse' : 'More metrics'}
        >
          {expanded ? '▴ Less' : '▾ More'}
        </button>
      </div>

      {/* Expanded metrics */}
      {expanded && (
        <div style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginTop: 3,
          paddingTop: 3,
          borderTop: `1px solid ${C.bd}40`,
        }}>
          {/* ATH */}
          {data.ath != null && (
            <Metric
              label="ATH"
              value={`$${data.ath >= 1000 ? fmtCompact(data.ath, 0) : data.ath.toLocaleString()}`}
              sub={data.athChange != null ? `${data.athChange.toFixed(0)}%` : null}
              subColor={C.r}
            />
          )}

          {/* ATL */}
          {data.atl != null && (
            <Metric
              label="ATL"
              value={`$${data.atl < 0.01 ? data.atl.toFixed(6) : data.atl.toLocaleString()}`}
            />
          )}

          {/* 30d change */}
          {data.priceChange30d != null && (
            <Metric
              label="30d"
              value={`${data.priceChange30d >= 0 ? '+' : ''}${data.priceChange30d.toFixed(1)}%`}
              color={data.priceChange30d >= 0 ? C.g : C.r}
            />
          )}

          {/* 24h High/Low */}
          {data.high24h != null && (
            <Metric label="24h H" value={`$${data.high24h.toLocaleString()}`} />
          )}
          {data.low24h != null && (
            <Metric label="24h L" value={`$${data.low24h.toLocaleString()}`} />
          )}

          {/* FDV */}
          {data.fullyDilutedValuation != null && (
            <Metric label="FDV" value={`$${fmtCompact(data.fullyDilutedValuation)}`} />
          )}

          {/* Mcap/Vol ratio */}
          {data.mcapToVolume != null && (
            <Metric label="MC/Vol" value={data.mcapToVolume.toFixed(1)} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function Metric({ label, value, color, sub, subColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ fontSize: 9, color: C.t3, fontFamily: M, fontWeight: 500 }}>
        {label}
      </span>
      <span style={{
        fontSize: 10,
        color: color || C.t1,
        fontFamily: M,
        fontWeight: 600,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 8, color: subColor || C.t3, fontFamily: M }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function MetricBadge({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '1px 6px',
      background: C.b + '15',
      borderRadius: 3,
      border: `1px solid ${C.b}30`,
    }}>
      <span style={{ fontSize: 8, color: C.t3, fontFamily: M }}>{label}</span>
      <span style={{ fontSize: 10, color: C.b, fontFamily: M, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
