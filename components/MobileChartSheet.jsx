// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.2 — Mobile Chart Sheet
// Sprint 6 C6.2: Bottom sheet with chart settings for mobile.
//
// Replaces ChartSettingsBar on mobile devices with a swipeable
// bottom sheet containing chart type, indicators, comparison,
// screenshot, and fullscreen controls.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../constants.js';
import { useChartStore } from '../state/useChartStore.js';

const MOBILE_CHART_TYPES = [
  { id: 'candles', icon: '🕯️', label: 'Candles' },
  { id: 'hollow', icon: '◇', label: 'Hollow' },
  { id: 'line', icon: '📈', label: 'Line' },
  { id: 'area', icon: '▓', label: 'Area' },
  { id: 'heikinashi', icon: '🟩', label: 'HA' },
];

const QUICK_INDICATORS = [
  { type: 'sma', params: { period: 20 }, color: C.y, label: 'SMA 20' },
  { type: 'ema', params: { period: 9 }, color: C.g, label: 'EMA 9' },
  { type: 'ema', params: { period: 50 }, color: C.p, label: 'EMA 50' },
  { type: 'ema', params: { period: 200 }, color: C.r, label: 'EMA 200' },
  { type: 'bb', params: { period: 20, stdDev: 2 }, color: C.info, label: 'BB' },
  { type: 'rsi', params: { period: 14 }, color: C.orange, label: 'RSI' },
];

/**
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {Function} onScreenshot - Callback for chart screenshot
 * @param {Function} onFullscreen - Callback for fullscreen toggle
 */
export default function MobileChartSheet({ isOpen, onClose, onScreenshot, onFullscreen }) {
  const chartType = useChartStore((s) => s.chartType);
  const setChartType = useChartStore((s) => s.setChartType);
  const indicators = useChartStore((s) => s.indicators);
  const addIndicator = useChartStore((s) => s.addIndicator);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const showVolumeProfile = useChartStore((s) => s.showVolumeProfile);
  const comparisonSymbol = useChartStore((s) => s.comparisonSymbol);
  const clearComparison = useChartStore((s) => s.clearComparison);

  const [compInput, setCompInput] = useState('');
  const [showCompare, setShowCompare] = useState(false);

  const isIndicatorActive = useCallback((qi) => {
    return indicators.some(ind =>
      ind.type === qi.type &&
      ind.params?.period === qi.params?.period
    );
  }, [indicators]);

  const toggleIndicator = useCallback((qi) => {
    const idx = indicators.findIndex(ind =>
      ind.type === qi.type &&
      ind.params?.period === qi.params?.period
    );
    if (idx >= 0) {
      removeIndicator(idx);
    } else {
      addIndicator({ ...qi });
    }
  }, [indicators, addIndicator, removeIndicator]);

  const handleAddComparison = useCallback(() => {
    const sym = compInput.trim().toUpperCase();
    if (!sym) return;
    useChartStore.setState({ comparisonSymbol: sym, comparisonData: null });
    setCompInput('');
    setShowCompare(false);
  }, [compInput]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: C.sf,
        borderRadius: '16px 16px 0 0',
        maxHeight: '70vh',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Handle */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '8px 0 4px',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.t3 + '40' }} />
        </div>

        {/* Title */}
        <div style={{
          padding: '4px 16px 12px',
          fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F,
        }}>
          Chart Settings
        </div>

        {/* ─── Chart Type ──────────────────────────────────── */}
        <Section title="Chart Type">
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px' }}>
            {MOBILE_CHART_TYPES.map(ct => (
              <ChipButton
                key={ct.id}
                label={`${ct.icon} ${ct.label}`}
                active={chartType === ct.id}
                onClick={() => setChartType(ct.id)}
              />
            ))}
          </div>
        </Section>

        {/* ─── Indicators ──────────────────────────────────── */}
        <Section title="Indicators">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px' }}>
            {QUICK_INDICATORS.map(qi => (
              <ChipButton
                key={qi.label}
                label={qi.label}
                active={isIndicatorActive(qi)}
                color={qi.color}
                onClick={() => toggleIndicator(qi)}
              />
            ))}
          </div>
        </Section>

        {/* ─── Comparison ──────────────────────────────────── */}
        <Section title="Compare Symbol">
          <div style={{ padding: '0 16px' }}>
            {comparisonSymbol ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: C.pink, fontWeight: 700, fontFamily: M }}>
                  vs {comparisonSymbol}
                </span>
                <button className="tf-btn"
                  onClick={clearComparison}
                  style={{
                    background: C.r + '15', border: `1px solid ${C.r}40`,
                    borderRadius: 8, color: C.r, padding: '6px 14px',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : showCompare ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={compInput}
                  onChange={(e) => setCompInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComparison()}
                  placeholder="Enter symbol..."
                  autoFocus
                  style={{
                    flex: 1, background: C.bg, color: C.t1,
                    border: `1px solid ${C.bd}`, borderRadius: 8,
                    padding: '8px 12px', fontSize: 14, fontFamily: M,
                    outline: 'none',
                  }}
                />
                <button className="tf-btn"
                  onClick={handleAddComparison}
                  style={{
                    background: C.b, color: '#fff', border: 'none',
                    borderRadius: 8, padding: '8px 16px', fontSize: 13,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button className="tf-btn"
                onClick={() => setShowCompare(true)}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8,
                  background: C.bg, border: `1px solid ${C.bd}`,
                  color: C.t2, fontSize: 13, cursor: 'pointer', fontFamily: F,
                }}
              >
                + Add Comparison
              </button>
            )}
          </div>
        </Section>

        {/* ─── Actions ─────────────────────────────────────── */}
        <Section title="Actions">
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 8px' }}>
            <ActionBtn icon="📸" label="Screenshot" onClick={() => { onScreenshot?.(); onClose(); }} />
            <ActionBtn icon="⛶" label="Fullscreen" onClick={() => { onFullscreen?.(); onClose(); }} />
            <ActionBtn
              icon="📊"
              label={showVolumeProfile ? 'VP On' : 'VP Off'}
              active={showVolumeProfile}
              onClick={() => useChartStore.setState(s => ({ showVolumeProfile: !s.showVolumeProfile }))}
            />
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: C.t3,
        textTransform: 'uppercase', letterSpacing: 1,
        padding: '0 16px', marginBottom: 6, fontFamily: M,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipButton({ label, active, color, onClick }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 20,
        border: active
          ? `2px solid ${color || C.b}`
          : `1px solid ${C.bd}`,
        background: active ? (color || C.b) + '15' : C.bg,
        color: active ? (color || C.b) : C.t2,
        fontSize: 12, fontWeight: 600, fontFamily: M,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        touchAction: 'manipulation',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ icon, label, active, onClick }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 4, padding: '10px 8px',
        borderRadius: 10,
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '15' : C.bg,
        color: active ? C.b : C.t2,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: M }}>{label}</span>
    </button>
  );
}

export { MobileChartSheet };
