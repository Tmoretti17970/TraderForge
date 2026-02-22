// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Chart Settings Panel
// Bottom-right floating controls, TradingView-style.
// Gear icon opens a popup with chart appearance settings.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F, M } from '../constants.js';
import { useChartStore } from '../state/useChartStore.js';

// ─── SVG Icons ───────────────────────────────────────────────────
const GearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const MaxIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CameraIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// ─── Toggle Row ──────────────────────────────────────────────────
function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 12, color: C.t2, fontFamily: F }}>{label}</span>
      <button className="tf-btn"
        onClick={() => onChange(!value)}
        style={{
          width: 34, height: 18, borderRadius: 9, border: 'none',
          background: value ? C.b : C.bg2,
          position: 'relative', cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: 7,
          background: '#fff',
          position: 'absolute', top: 2,
          left: value ? 18 : 2,
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

// ─── Select Row ──────────────────────────────────────────────────
function SelectRow({ label, value, options, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0',
    }}>
      <span style={{ fontSize: 12, color: C.t2, fontFamily: F }}>{label}</span>
      <select aria-label="Chart setting"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: C.bg2, color: C.t1, border: `1px solid ${C.bd}`,
          borderRadius: 4, padding: '2px 6px', fontSize: 11,
          fontFamily: M, cursor: 'pointer', outline: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Comparison Input ────────────────────────────────────────────
function ComparisonRow() {
  const compSymbol = useChartStore((s) => s.comparisonSymbol);
  const clearComparison = useChartStore((s) => s.clearComparison);
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);

  const handleAdd = () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    // Signal ChartsPage to fetch comparison data
    useChartStore.setState({ comparisonSymbol: sym, comparisonData: null });
    setInput('');
    setShow(false);
  };

  if (compSymbol) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 0',
      }}>
        <span style={{ fontSize: 12, color: C.t2, fontFamily: F }}>
          Compare: <span style={{ color: C.pink, fontWeight: 700 }}>{compSymbol}</span>
        </span>
        <button className="tf-btn"
          onClick={clearComparison}
          style={{
            background: C.r + '20', border: `1px solid ${C.r}40`, borderRadius: 4,
            color: C.r, fontSize: 10, cursor: 'pointer', padding: '2px 6px',
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {show ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <input aria-label="Chart parameter"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Symbol..."
            autoFocus
            style={{
              flex: 1, background: C.bg2, color: C.t1, border: `1px solid ${C.bd}`,
              borderRadius: 4, padding: '3px 6px', fontSize: 11,
              fontFamily: M, outline: 'none',
            }}
          />
          <button className="tf-btn"
            onClick={handleAdd}
            style={{
              background: C.b, color: '#fff', border: 'none', borderRadius: 4,
              fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontWeight: 600,
            }}
          >
            Add
          </button>
        </div>
      ) : (
        <button className="tf-btn"
          onClick={() => setShow(true)}
          style={{
            width: '100%', padding: '5px 0', borderRadius: 4,
            background: 'transparent', border: `1px solid ${C.bd}`,
            color: C.t2, fontSize: 11, cursor: 'pointer', fontFamily: F,
          }}
        >
          + Compare Symbol
        </button>
      )}
    </div>
  );
}

function MagnetToggle() {
  const magnetMode = useChartStore((s) => s.magnetMode);
  const toggleMagnet = useChartStore((s) => s.toggleMagnetMode);
  return (
    <ToggleRow
      label="Magnet Mode (N)"
      value={magnetMode}
      onChange={toggleMagnet}
    />
  );
}

// ─── Settings Popup ──────────────────────────────────────────────
function SettingsPopup({ onClose }) {
  const chartType = useChartStore((s) => s.chartType);
  const setChartType = useChartStore((s) => s.setChartType);
  const logScale = useChartStore((s) => s.logScale);
  const toggleLogScale = useChartStore((s) => s.toggleLogScale);
  const orderFlow = useChartStore((s) => s.orderFlow);
  const toggleOrderFlow = useChartStore((s) => s.toggleOrderFlow);
  const showVolumeProfile = useChartStore((s) => s.showVolumeProfile);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: 36, right: 0,
        width: 220, background: C.bg,
        border: `1px solid ${C.bd}`, borderRadius: 8,
        padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 100,
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: 1,
        marginBottom: 8, fontFamily: F,
      }}>
        Chart Settings
      </div>

      <SelectRow
        label="Chart Type"
        value={chartType}
        onChange={setChartType}
        options={[
          { value: 'candles', label: 'Candles' },
          { value: 'hollow', label: 'Hollow' },
          { value: 'ohlc', label: 'OHLC' },
          { value: 'line', label: 'Line' },
          { value: 'area', label: 'Area' },
          { value: 'heikinashi', label: 'Heikin Ashi' },
        ]}
      />

      <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

      <ToggleRow
        label="Log Scale"
        value={logScale}
        onChange={toggleLogScale}
      />

      <ToggleRow
        label="Order Flow"
        value={orderFlow}
        onChange={toggleOrderFlow}
      />

      <ToggleRow
        label="Volume Profile"
        value={showVolumeProfile}
        onChange={() => useChartStore.setState((s) => ({ showVolumeProfile: !s.showVolumeProfile }))}
      />

      <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

      <div style={{
        fontSize: 9, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: 1,
        marginTop: 6, marginBottom: 4, fontFamily: F,
      }}>
        Overlays
      </div>

      <ComparisonRow />
      <MagnetToggle />

      <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

      {/* C7.8: Intelligence toggles */}
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: 0.8,
        fontFamily: M, marginBottom: 4,
      }}>
        Intelligence
      </div>
      <IntelligenceToggles />

      <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

      <div style={{
        fontSize: 10, color: C.t3, fontFamily: M,
        marginTop: 4,
      }}>
        Keyboard: +/- zoom · Arrows scroll · Home/End jump
      </div>
    </div>
  );
}

// ─── C7.8: Intelligence Toggles ─────────────────────────────────
function IntelligenceToggles() {
  const intelligence = useChartStore((s) => s.intelligence);
  const toggle = useChartStore((s) => s.toggleIntelligence);
  const toggleMaster = useChartStore((s) => s.toggleIntelligenceMaster);

  const items = [
    { key: 'enabled', label: '🧠 Master', active: intelligence.enabled },
    { key: 'showSR', label: 'S/R Levels', active: intelligence.showSR },
    { key: 'showPatterns', label: 'Patterns', active: intelligence.showPatterns },
    { key: 'showDivergences', label: 'Divergences', active: intelligence.showDivergences },
  ];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {items.map(item => (
        <button className="tf-btn"
          key={item.key}
          onClick={() => item.key === 'enabled' ? toggleMaster() : toggle(item.key)}
          style={{
            padding: '3px 7px', borderRadius: 4,
            border: `1px solid ${item.active ? C.b + '60' : C.bd}`,
            background: item.active ? C.b + '15' : 'transparent',
            color: item.active ? C.b : C.t3,
            fontSize: 9, fontWeight: 600, fontFamily: M,
            cursor: 'pointer',
            opacity: item.key !== 'enabled' && !intelligence.enabled ? 0.4 : 1,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Mini Button ─────────────────────────────────────────────────
function MiniBtn({ icon, tip, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button className="tf-btn"
      onClick={onClick}
      title={tip}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 6,
        background: hov ? C.t3 + '20' : C.bg + 'cc',
        color: hov ? C.t1 : C.t3,
        cursor: 'pointer', transition: 'all 0.15s',
        backdropFilter: 'blur(8px)',
      }}
    >
      {icon}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function ChartSettingsBar({ onScreenshot, onFullscreen }) {
  const [open, setOpen] = useState(false);
  const source = useChartStore((s) => s.source);

  return (
    <div
      style={{
        position: 'absolute', bottom: 32, right: 8,
        display: 'flex', gap: 4, alignItems: 'center',
        zIndex: 20,
      }}
    >
      {/* Data source badge */}
      {source && (
        <div style={{
          fontSize: 9, color: C.t3 + 'aa', fontFamily: M,
          padding: '3px 6px', background: C.bg + 'cc',
          borderRadius: 4, backdropFilter: 'blur(8px)',
          marginRight: 4,
        }}>
          {source === 'simulated' ? '⚠ demo' : `● ${source}`}
        </div>
      )}

      {/* Screenshot */}
      {onScreenshot && (
        <MiniBtn icon={<CameraIcon />} tip="Screenshot chart" onClick={onScreenshot} />
      )}

      {/* Fullscreen */}
      {onFullscreen && (
        <MiniBtn icon={<MaxIcon />} tip="Fullscreen" onClick={onFullscreen} />
      )}

      {/* Settings */}
      <div style={{ position: 'relative' }}>
        <MiniBtn
          icon={<GearIcon />}
          tip="Chart settings"
          onClick={() => setOpen(!open)}
        />
        {open && (
          <>
            {/* Backdrop to close */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            />
            <SettingsPopup onClose={() => setOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}
