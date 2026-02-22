// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Daily Guard Banner
//
// Fixed-position warning bar at the top of the app viewport.
// Shows when daily loss limit is approaching (warning) or
// breached (lockout). Includes override button for lockout.
//
// Renders nothing when status is 'ok'.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { C, F, M } from '../constants.js';
import { useDailyGuardStore, bannerProps } from '../state/useDailyGuardStore.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useTradeStore } from '../state/useTradeStore.js';

export default function DailyGuardBanner() {
  const trades = useTradeStore(s => s.trades);
  const dailyLossLimit = useSettingsStore(s => s.dailyLossLimit);
  const evaluate = useDailyGuardStore(s => s.evaluate);
  const guardState = useDailyGuardStore();
  const override = useDailyGuardStore(s => s.override);

  // Re-evaluate whenever trades or settings change
  useEffect(() => {
    evaluate(trades, dailyLossLimit);
  }, [trades, dailyLossLimit, evaluate]);

  const banner = bannerProps(guardState);
  if (!banner.show) return null;

  const isLocked = banner.type === 'error';
  const bgColor = isLocked ? '#ef444420' : '#f59e0b15';
  const borderColor = isLocked ? '#ef444440' : '#f59e0b30';
  const textColor = isLocked ? C.r : C.y;
  const icon = isLocked ? '🛑' : '⚠️';

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 16px',
        background: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        fontFamily: F,
        fontSize: 12,
        color: textColor,
        fontWeight: 600,
        flexShrink: 0,
        zIndex: 100,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span>{banner.message}</span>

      {/* Progress bar */}
      <div style={{
        width: 80, height: 4, background: C.sf,
        borderRadius: 2, overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: `${Math.min(100, guardState.pctUsed * 100)}%`,
          height: '100%',
          background: textColor,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Today's stats */}
      <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
        {guardState.todayCount} trades · {guardState.todayWins}W {guardState.todayLosses}L
      </span>

      {/* Override button (lockout only) */}
      {banner.canOverride && (
        <button className="tf-btn"
          onClick={override}
          style={{
            background: 'none',
            border: `1px solid ${textColor}40`,
            borderRadius: 4,
            color: textColor,
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 8px',
            cursor: 'pointer',
            fontFamily: M,
          }}
        >
          Continue Trading
        </button>
      )}
    </div>
  );
}

export { DailyGuardBanner };
