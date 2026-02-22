// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.2 — Mobile Drawing Sheet
// Sprint 6 C6.1: Bottom-sheet drawing tool picker for touch devices.
//
// Design:
//   - Peek bar (drag handle) always visible at bottom of chart
//   - Swipe up → reveals horizontal scrollable tool strip
//   - Tap tool → activates it, sheet auto-collapses
//   - Active tool shows as highlighted pill above peek bar
//   - Long-press on chart → places drawing anchor
//   - Second tap → completes drawing
//   - Includes magnet toggle and clear-all
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { C, M } from '../constants.js';
import { useChartStore } from '../state/useChartStore.js';

// ─── Tool definitions (compact for mobile) ─────────────────────
const MOBILE_TOOLS = [
  { id: null, icon: '✛', label: 'Crosshair' },
  { id: 'trendline', icon: '╲', label: 'Trend' },
  { id: 'hlevel', icon: '─', label: 'H-Line' },
  { id: 'ray', icon: '╱→', label: 'Ray' },
  { id: 'fib', icon: '▦', label: 'Fib' },
  { id: 'fibext', icon: '▥', label: 'Fib Ext' },
  { id: 'fibtimezone', icon: '|||', label: 'Fib TZ' },
  { id: 'gannfan', icon: '⊿', label: 'Gann' },
  { id: 'pitchfork', icon: '⋔', label: 'Fork' },
  { id: 'anchoredvwap', icon: 'V̄', label: 'VWAP' },
  { id: 'rectangle', icon: '▢', label: 'Rect' },
  { id: 'circle', icon: '◯', label: 'Circle' },
  { id: 'longposition', icon: '▲', label: 'Long' },
  { id: 'shortposition', icon: '▼', label: 'Short' },
  { id: 'measure', icon: '↔', label: 'Measure' },
  { id: 'text', icon: 'T', label: 'Text' },
];

/**
 * Mobile-optimized bottom sheet for drawing tools.
 */
export default function MobileDrawingSheet() {
  const activeTool = useChartStore((s) => s.activeTool);
  const setActiveTool = useChartStore((s) => s.setActiveTool);
  const clearActiveTool = useChartStore((s) => s.clearActiveTool);
  const drawings = useChartStore((s) => s.drawings);
  const clearAllDrawings = useChartStore((s) => s.clearAllDrawings);
  const magnetMode = useChartStore((s) => s.magnetMode);
  const toggleMagnetMode = useChartStore((s) => s.toggleMagnetMode);

  const [expanded, setExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const scrollRef = useRef(null);

  const handleToolSelect = useCallback((toolId) => {
    if (toolId === null) {
      clearActiveTool();
    } else if (toolId === activeTool) {
      clearActiveTool();
    } else {
      setActiveTool(toolId);
    }
    setExpanded(false);
  }, [activeTool, setActiveTool, clearActiveTool]);

  // Drag handle gesture
  const handleDragStart = useCallback((e) => {
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    setTouchStartY(y);
  }, []);

  const handleDragEnd = useCallback((e) => {
    const y = e.changedTouches?.[0]?.clientY ?? e.clientY;
    const delta = touchStartY - y;
    if (delta > 30) setExpanded(true);
    else if (delta < -30) setExpanded(false);
  }, [touchStartY]);

  const activeLabel = MOBILE_TOOLS.find(t => t.id === activeTool)?.label || '';

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      zIndex: 500,
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: expanded ? 'translateY(0)' : 'translateY(calc(100% - 36px))',
    }}>
      {/* ─── Drag Handle / Peek Bar ─────────────────────────── */}
      <div
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        onClick={() => setExpanded(!expanded)}
        style={{
          height: 36,
          background: C.sf,
          borderTop: `1px solid ${C.bd}`,
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {/* Drag indicator */}
        <div style={{
          width: 32, height: 3, borderRadius: 2,
          background: C.t3 + '60',
        }} />

        {/* Active tool indicator */}
        {activeTool && (
          <div style={{
            position: 'absolute', left: 12,
            fontSize: 10, fontWeight: 700, fontFamily: M,
            color: C.b, background: C.b + '15',
            padding: '2px 8px', borderRadius: 10,
          }}>
            {activeLabel}
          </div>
        )}

        {/* Drawing count */}
        {drawings.length > 0 && (
          <div style={{
            position: 'absolute', right: 12,
            fontSize: 9, fontWeight: 600, fontFamily: M,
            color: C.t3,
          }}>
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ─── Tool Strip ─────────────────────────────────────── */}
      <div style={{
        background: C.sf,
        borderTop: `1px solid ${C.bd}`,
        padding: '8px 0 12px',
      }}>
        {/* Horizontal scrollable tools */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '0 8px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {MOBILE_TOOLS.map((tool) => (
            <button className="tf-btn"
              key={tool.id || 'crosshair'}
              onClick={() => handleToolSelect(tool.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 52, height: 52,
                borderRadius: 8,
                border: activeTool === tool.id
                  ? `2px solid ${C.b}`
                  : `1px solid ${C.bd}`,
                background: activeTool === tool.id ? C.b + '15' : C.bg,
                color: activeTool === tool.id ? C.b : C.t2,
                cursor: 'pointer',
                padding: '4px 2px',
                flexShrink: 0,
                touchAction: 'manipulation',
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tool.icon}</span>
              <span style={{
                fontSize: 8, fontWeight: 600, fontFamily: M,
                marginTop: 2, whiteSpace: 'nowrap',
              }}>
                {tool.label}
              </span>
            </button>
          ))}
        </div>

        {/* Utilities row */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px 0',
          justifyContent: 'center',
        }}>
          <UtilPill
            label={`Magnet ${magnetMode ? 'ON' : 'OFF'}`}
            active={magnetMode}
            onClick={toggleMagnetMode}
          />
          {drawings.length > 0 && (
            <UtilPill
              label={`Clear All (${drawings.length})`}
              active={false}
              color={C.r}
              onClick={clearAllDrawings}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function UtilPill({ label, active, color, onClick }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 16,
        border: `1px solid ${active ? C.b : color || C.bd}`,
        background: active ? C.b + '15' : 'transparent',
        color: active ? C.b : color || C.t3,
        fontSize: 10, fontWeight: 600, fontFamily: M,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {label}
    </button>
  );
}

export { MobileDrawingSheet };
