// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.6 — Chart Trade Toolbar
// Sprint 10 C10.7: Trade-related buttons for the chart toolbar.
// Long/Short entry, position sizer toggle, quick journal.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../constants.js';
import { useChartTradeStore } from '../../state/useChartTradeStore.js';

/**
 * Renders trade-related toolbar buttons.
 * Drop this into ChartSettingsBar or ChartsPage toolbar area.
 */
export default function ChartTradeToolbar() {
  const {
    tradeMode, enterTradeMode, exitTradeMode,
    togglePositionSizer, showPositionSizer,
    toggleQuickJournal, showQuickJournal,
  } = useChartTradeStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      padding: '0 4px',
    }}>
      {/* Divider */}
      <div style={{ width: 1, height: 18, background: C.bd, margin: '0 4px' }} />

      {/* Long entry */}
      <ToolBtn
        label="📈 Long"
        active={tradeMode}
        color={C.g}
        onClick={() => tradeMode ? exitTradeMode() : enterTradeMode('long')}
        title="Enter long trade (click chart to set entry)"
      />

      {/* Short entry */}
      <ToolBtn
        label="📉 Short"
        color={C.r}
        onClick={() => tradeMode ? exitTradeMode() : enterTradeMode('short')}
        title="Enter short trade (click chart to set entry)"
      />

      {/* Divider */}
      <div style={{ width: 1, height: 18, background: C.bd, margin: '0 2px' }} />

      {/* Position sizer */}
      <ToolBtn
        label="📐"
        active={showPositionSizer}
        onClick={togglePositionSizer}
        title="Position Sizer"
      />

      {/* Quick journal */}
      <ToolBtn
        label="📝"
        active={showQuickJournal}
        onClick={toggleQuickJournal}
        title="Quick Journal"
      />
    </div>
  );
}

function ToolBtn({ label, active, color, onClick, title }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      title={title}
      style={{
        padding: '3px 8px', fontSize: 10, fontWeight: 700,
        borderRadius: 4, cursor: 'pointer', fontFamily: M,
        border: `1px solid ${active ? (color || C.b) + '50' : C.bd}`,
        background: active ? (color || C.b) + '12' : 'transparent',
        color: active ? (color || C.b) : C.t2,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
