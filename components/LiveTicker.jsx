// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — LiveTicker
// Compact real-time price display with 24h change and WS status.
//
// Layout: [●] BTC $97,234.56 +2.34% | 24h Vol $1.2B | H $98,000 L $95,000
//
// Usage:
//   <LiveTicker tick={tick} status="connected" symbol="BTC" />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../constants.js';
import { WS_STATUS } from '../data/WebSocketService.js';

const STATUS_COLORS = {
  [WS_STATUS.CONNECTED]: C.g,
  [WS_STATUS.CONNECTING]: C.y,
  [WS_STATUS.RECONNECTING]: C.y,
  [WS_STATUS.DISCONNECTED]: C.t3,
};

const STATUS_LABELS = {
  [WS_STATUS.CONNECTED]: 'Live',
  [WS_STATUS.CONNECTING]: 'Connecting...',
  [WS_STATUS.RECONNECTING]: 'Reconnecting...',
  [WS_STATUS.DISCONNECTED]: 'Offline',
};

function formatPrice(price) {
  if (price >= 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVolume(vol) {
  if (vol >= 1e9) return '$' + (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return '$' + (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return '$' + (vol / 1e3).toFixed(0) + 'K';
  return '$' + vol.toFixed(0);
}

/**
 * @param {Object} props
 * @param {Object|null} props.tick - { price, change24h, high24h, low24h, volume24h }
 * @param {string} props.status - WS_STATUS value
 * @param {string} props.symbol - TradeForge symbol (e.g., 'BTC')
 */
function LiveTicker({ tick, status, symbol }) {
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS[WS_STATUS.DISCONNECTED];
  const statusLabel = STATUS_LABELS[status] || 'Offline';

  // Pulsing animation for connected state
  const isPulsing = status === WS_STATUS.CONNECTED;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 10px',
        fontSize: 11,
        fontFamily: M,
        color: C.t2,
        flexWrap: 'wrap',
      }}
    >
      {/* Connection status dot */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        title={statusLabel}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: isPulsing ? `0 0 4px ${statusColor}` : 'none',
            animation: isPulsing ? 'tfPulse 2s ease infinite' : 'none',
          }}
        />
        <span style={{ fontSize: 9, color: statusColor, fontWeight: 600 }}>
          {statusLabel}
        </span>
        <style>{`
          @keyframes tfPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>

      {/* Price + change */}
      {tick && (
        <>
          <span style={{ color: C.t1, fontWeight: 700, fontSize: 12 }}>
            ${formatPrice(tick.price)}
          </span>

          <span
            style={{
              color: tick.change24h >= 0 ? C.g : C.r,
              fontWeight: 700,
              fontSize: 11,
            }}
          >
            {tick.change24h >= 0 ? '+' : ''}{tick.change24h.toFixed(2)}%
          </span>

          {/* Separator */}
          <span style={{ color: C.bd }}>│</span>

          {/* 24h stats */}
          <span style={{ color: C.t3, fontSize: 10 }}>
            Vol {formatVolume(tick.volume24h)}
          </span>

          <span style={{ color: C.t3, fontSize: 10 }}>
            H <span style={{ color: C.t2 }}>${formatPrice(tick.high24h)}</span>
          </span>

          <span style={{ color: C.t3, fontSize: 10 }}>
            L <span style={{ color: C.t2 }}>${formatPrice(tick.low24h)}</span>
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Minimal status-only indicator for tight spaces (e.g., toolbar).
 */
export function ConnectionDot({ status }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS[WS_STATUS.DISCONNECTED];
  const label = STATUS_LABELS[status] || 'Offline';
  return (
    <div
      title={label}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        boxShadow: status === WS_STATUS.CONNECTED ? `0 0 4px ${color}` : 'none',
      }}
    />
  );
}
export default React.memo(LiveTicker);
