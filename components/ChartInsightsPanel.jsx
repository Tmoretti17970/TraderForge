// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.3 — Chart Insights Panel
// Sprint 7 C7.7: Sidebar showing auto-detected price intelligence.
//
// Sections:
//   1. Support/Resistance levels with strength bars
//   2. Recent candlestick patterns with bias indicators
//   3. Divergences (bullish/bearish RSI divergence)
//   4. Auto-Fib status
//   5. Drawing proximity alerts
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { analyzeAll, checkDrawingProximity } from '../engine/PriceActionEngine.js';
import { useChartStore } from '../state/useChartStore.js';

/**
 * @param {Array} data - OHLCV data
 * @param {boolean} isOpen - Panel visibility
 * @param {Function} onClose - Close handler
 * @param {Function} onApplyAutoFib - Callback to add auto-fib drawing
 * @param {Function} onCreateAlert - Callback to create alert from S/R level
 */
export default function ChartInsightsPanel({ data, isOpen, onClose, onApplyAutoFib, onCreateAlert }) {
  const drawings = useChartStore((s) => s.drawings);
  const intelligence = useChartStore((s) => s.intelligence);

  // Run analysis
  const analysis = useMemo(() => {
    if (!data?.length) return null;
    return analyzeAll(data);
  }, [data]);

  // Drawing proximity check
  const proximityAlerts = useMemo(() => {
    if (!data?.length || !drawings?.length) return [];
    return checkDrawingProximity(drawings, data[data.length - 1]);
  }, [data, drawings]);

  if (!isOpen || !analysis) return null;

  const { levels, patterns, swings, autoFib, divergences } = analysis;

  // Recent patterns (last 20 bars)
  const recentPatterns = patterns.filter(p => p.idx >= data.length - 20);

  return (
    <div style={{
      width: 240, background: C.bg, borderLeft: `1px solid ${C.bd}`,
      overflowY: 'auto', flexShrink: 0, fontSize: 12, fontFamily: F,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', borderBottom: `1px solid ${C.bd}`,
      }}>
        <span style={{ fontWeight: 700, color: C.t1, fontSize: 13 }}>
          🧠 Chart Intelligence
        </span>
        <button className="tf-btn" onClick={onClose} style={{
          background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </div>

      {/* ─── S/R Levels ──────────────────────────────── */}
      <Section title={`Support/Resistance (${levels.length})`} color="#f59e0b">
        {levels.length === 0 ? (
          <Empty>No significant levels detected</Empty>
        ) : (
          levels.map((level, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              borderBottom: `1px solid ${C.bd}15`,
            }}>
              <TypeBadge type={level.type} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontFamily: M, color: C.t1, fontSize: 12 }}>
                  {level.price.toFixed(2)}
                </div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  {level.touches} touches · {level.distancePct}% away
                </div>
              </div>
              <StrengthBar strength={level.strength} maxStrength={Math.max(...levels.map(l => l.strength))} />
              {onCreateAlert && (
                <button className="tf-btn"
                  onClick={() => onCreateAlert(level)}
                  title="Create alert at this level"
                  style={{
                    background: 'none', border: 'none', color: C.t3,
                    cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                  }}
                >🔔</button>
              )}
            </div>
          ))
        )}
      </Section>

      {/* ─── Candlestick Patterns ────────────────────── */}
      <Section title={`Patterns (${recentPatterns.length})`} color="#a855f7">
        {recentPatterns.length === 0 ? (
          <Empty>No patterns in last 20 bars</Empty>
        ) : (
          recentPatterns.slice(0, 8).map((pat, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px',
              borderBottom: `1px solid ${C.bd}15`,
            }}>
              <span style={{ fontSize: 14 }}>{pat.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.t1, fontSize: 11 }}>
                  {pat.label}
                </div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  Bar {pat.idx} · {Math.round(pat.confidence * 100)}% confidence
                </div>
              </div>
              <BiasBadge bias={pat.bias} />
            </div>
          ))
        )}
      </Section>

      {/* ─── Divergences ─────────────────────────────── */}
      <Section title={`Divergences (${divergences.length})`} color="#3b82f6">
        {divergences.length === 0 ? (
          <Empty>No RSI divergences detected</Empty>
        ) : (
          divergences.slice(-4).map((div, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px',
              borderBottom: `1px solid ${C.bd}15`,
            }}>
              <span style={{
                fontSize: 14,
                color: div.type === 'bullish' ? C.g : C.r,
              }}>
                {div.type === 'bullish' ? '↗' : '↘'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.t1, fontSize: 11 }}>
                  {div.type === 'bullish' ? 'Bullish' : 'Bearish'} Divergence
                </div>
                <div style={{ fontSize: 9, color: C.t3 }}>
                  Bars {div.startIdx}–{div.endIdx} · RSI {div.rsiStart.toFixed(0)}→{div.rsiEnd.toFixed(0)}
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* ─── Auto-Fib ────────────────────────────────── */}
      <Section title="Auto Fibonacci" color="#22c55e">
        {autoFib ? (
          <div style={{ padding: '6px 12px' }}>
            <div style={{ fontSize: 11, color: C.t2, marginBottom: 6 }}>
              Swing {swings?.direction === 'up' ? '↑ Up' : '↓ Down'}: {' '}
              <span style={{ fontFamily: M, fontWeight: 700 }}>
                {swings.swingLow.price.toFixed(2)} → {swings.swingHigh.price.toFixed(2)}
              </span>
            </div>
            {onApplyAutoFib && (
              <button className="tf-btn"
                onClick={() => onApplyAutoFib(autoFib)}
                style={{
                  width: '100%', padding: '6px 0',
                  borderRadius: 6, border: `1px solid #22c55e40`,
                  background: '#22c55e15', color: C.g,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: M,
                }}
              >
                Apply Auto-Fib to Chart
              </button>
            )}
          </div>
        ) : (
          <Empty>No clear swing structure detected</Empty>
        )}
      </Section>

      {/* ─── Drawing Alerts ──────────────────────────── */}
      {proximityAlerts.length > 0 && (
        <Section title={`Drawing Alerts (${proximityAlerts.length})`} color="#ec4899">
          {proximityAlerts.map((alert, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', background: '#ec489910',
              borderBottom: `1px solid ${C.bd}15`,
            }}>
              <span style={{ color: C.pink, fontSize: 12 }}>⚠</span>
              <div style={{ flex: 1, fontSize: 10, color: C.t2 }}>
                Price {alert.direction} <strong>{alert.drawingType}</strong> at{' '}
                <span style={{ fontFamily: M }}>{alert.level.toFixed(2)}</span>
                <span style={{ color: C.t3 }}> ({alert.distancePct}%)</span>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Section({ title, color, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.bd}` }}>
      <div style={{
        padding: '8px 12px',
        fontSize: 10, fontWeight: 700, color: color || C.t3,
        textTransform: 'uppercase', letterSpacing: 0.8,
        fontFamily: M,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{ padding: '8px 12px', fontSize: 10, color: C.t3, fontStyle: 'italic' }}>
      {children}
    </div>
  );
}

function TypeBadge({ type }) {
  const colors = {
    support: { bg: C.g, label: 'S' },
    resistance: { bg: C.r, label: 'R' },
    both: { bg: C.y, label: 'SR' },
  };
  const c = colors[type] || colors.both;
  return (
    <span style={{
      background: c.bg + '20', color: c.bg,
      fontSize: 8, fontWeight: 800, fontFamily: M,
      padding: '2px 4px', borderRadius: 3,
      minWidth: 16, textAlign: 'center',
    }}>
      {c.label}
    </span>
  );
}

function BiasBadge({ bias }) {
  const colors = {
    bullish: C.g, bearish: C.r, neutral: C.y, trend: C.info,
  };
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, fontFamily: M,
      color: colors[bias] || C.t3,
      padding: '2px 5px', borderRadius: 3,
      background: (colors[bias] || C.t3) + '15',
      textTransform: 'uppercase',
    }}>
      {bias}
    </span>
  );
}

function StrengthBar({ strength, maxStrength }) {
  const pct = maxStrength > 0 ? strength / maxStrength : 0;
  return (
    <div style={{
      width: 30, height: 4, borderRadius: 2,
      background: C.bd,
    }}>
      <div style={{
        width: `${Math.round(pct * 100)}%`,
        height: '100%', borderRadius: 2,
        background: pct > 0.7 ? C.g : pct > 0.4 ? C.y : C.t3,
      }} />
    </div>
  );
}

export { ChartInsightsPanel };
