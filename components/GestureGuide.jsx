// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.2 — Gesture Guide Overlay
// Sprint 6 C6.12: Shows mobile chart gesture instructions on first use.
//
// Shows once per device (localStorage flag). Dismisses on tap.
// Teaches: pinch-zoom, pan, tap-crosshair, long-press-draw, swipe-nav.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../constants.js';

const STORAGE_KEY = 'tradeforge-gesture-guide-seen';

const GESTURES = [
  {
    icon: '👆',
    title: 'Tap',
    desc: 'Show crosshair at any bar',
  },
  {
    icon: '👆👆',
    title: 'Double Tap',
    desc: 'Reset zoom to default',
  },
  {
    icon: '🤏',
    title: 'Pinch',
    desc: 'Zoom in / out on chart',
  },
  {
    icon: '👈',
    title: 'Drag',
    desc: 'Pan chart left / right',
  },
  {
    icon: '👆⏱️',
    title: 'Long Press',
    desc: 'Place drawing anchor',
  },
  {
    icon: '👈→',
    title: 'Edge Swipe',
    desc: 'Switch between watchlist symbols',
  },
];

/**
 * Full-screen overlay teaching chart gestures. Shows once.
 * @param {boolean} forceShow - Show regardless of localStorage flag
 * @param {Function} onDismiss - Optional callback after dismissal
 */
export default function GestureGuide({ forceShow = false, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Delay showing so chart renders first
        const timer = setTimeout(() => setVisible(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [forceShow]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 18, fontWeight: 800, color: C.t1,
        fontFamily: F, marginBottom: 6,
      }}>
        Chart Gestures
      </div>
      <div style={{
        fontSize: 12, color: C.t3, fontFamily: F,
        marginBottom: 24,
      }}>
        Touch controls for your chart
      </div>

      {/* Gesture grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        maxWidth: 340,
        width: '100%',
      }}>
        {GESTURES.map((g, i) => (
          <div
            key={i}
            style={{
              background: C.sf + '80',
              border: `1px solid ${C.bd}`,
              borderRadius: 12,
              padding: '14px 12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{g.icon}</div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: C.t1,
              fontFamily: F, marginBottom: 3,
            }}>
              {g.title}
            </div>
            <div style={{
              fontSize: 10, color: C.t3, fontFamily: F,
              lineHeight: 1.3,
            }}>
              {g.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Dismiss hint */}
      <div style={{
        marginTop: 28,
        fontSize: 11, color: C.t3 + '80', fontFamily: M,
        fontWeight: 600,
      }}>
        Tap anywhere to dismiss
      </div>
    </div>
  );
}

/**
 * Reset the gesture guide so it shows again.
 */
export function resetGestureGuide() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export { GestureGuide };
