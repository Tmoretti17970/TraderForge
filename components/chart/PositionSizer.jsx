// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.6 — Position Sizer Panel
// Sprint 10 C10.3: Floating overlay on chart showing account size,
// risk %, calculated position size, and R:R metrics.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, F, M } from '../../constants.js';
import { useChartTradeStore, calcRiskReward, calcPositionSize } from '../../state/useChartTradeStore.js';

export default function PositionSizer() {
  const {
    showPositionSizer, togglePositionSizer,
    accountSize, riskPercent, riskAmount, riskMode,
    setAccountSize, setRiskPercent, setRiskAmount, setRiskMode,
    pendingEntry, pendingSL, pendingTP, tradeSide,
  } = useChartTradeStore();

  const entry = pendingEntry?.price;
  const sl = pendingSL?.price;
  const tp = pendingTP?.price;

  const rr = useMemo(() => calcRiskReward(entry, sl, tp, tradeSide), [entry, sl, tp, tradeSide]);
  const pos = useMemo(() => calcPositionSize(riskAmount, entry, sl), [riskAmount, entry, sl]);

  if (!showPositionSizer) return null;

  return (
    <div style={{
      position: 'absolute', top: 50, right: 12, zIndex: 80,
      width: 220, background: C.bg, border: `1px solid ${C.bd}`,
      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${C.bd}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>
          Position Sizer
        </span>
        <button className="tf-btn"
          onClick={togglePositionSizer}
          style={{ background: 'none', border: 'none', color: C.t3, fontSize: 14, cursor: 'pointer' }}
        >✕</button>
      </div>

      {/* Account + Risk */}
      <div style={{ padding: '8px 12px' }}>
        <Row label="Account">
          <NumberInput
            value={accountSize}
            onChange={setAccountSize}
            prefix="$"
            step={1000}
          />
        </Row>

        <Row label="Risk Mode">
          <div style={{ display: 'flex', gap: 2 }}>
            {['percent', 'fixed'].map(m => (
              <button className="tf-btn"
                key={m}
                onClick={() => setRiskMode(m)}
                style={{
                  flex: 1, padding: '3px 0', fontSize: 9, fontWeight: 700,
                  borderRadius: 3, border: `1px solid ${riskMode === m ? C.b : C.bd}`,
                  background: riskMode === m ? C.b + '15' : 'transparent',
                  color: riskMode === m ? C.b : C.t3,
                  cursor: 'pointer', fontFamily: M,
                }}
              >
                {m === 'percent' ? '%' : '$'}
              </button>
            ))}
          </div>
        </Row>

        {riskMode === 'percent' ? (
          <Row label="Risk %">
            <NumberInput
              value={riskPercent}
              onChange={setRiskPercent}
              suffix="%"
              step={0.25}
              min={0.1}
              max={10}
            />
          </Row>
        ) : (
          <Row label="Risk $">
            <NumberInput
              value={riskAmount}
              onChange={setRiskAmount}
              prefix="$"
              step={50}
              min={10}
            />
          </Row>
        )}

        <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

        {/* Calculated risk amount */}
        <Row label="Risk Amount">
          <span style={{ fontSize: 11, fontWeight: 700, color: C.r, fontFamily: M }}>
            ${riskAmount.toFixed(0)}
          </span>
        </Row>

        {/* Levels display */}
        <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

        <Row label="Entry">
          <LevelDisplay value={entry} color="#3b82f6" />
        </Row>
        <Row label="Stop Loss">
          <LevelDisplay value={sl} color={C.r} />
        </Row>
        <Row label="Target">
          <LevelDisplay value={tp} color={C.g} />
        </Row>

        {/* Computed results */}
        {pos && (
          <>
            <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />
            <Row label="Position Size">
              <span style={{ fontSize: 12, fontWeight: 800, color: C.t1, fontFamily: M }}>
                {pos.shares} shares
              </span>
            </Row>
            <Row label="Notional">
              <span style={{ fontSize: 10, color: C.t2, fontFamily: M }}>
                ${pos.notional.toLocaleString()}
              </span>
            </Row>
            <Row label="Risk/Share">
              <span style={{ fontSize: 10, color: C.r, fontFamily: M }}>
                ${pos.riskPerShare}
              </span>
            </Row>
            <Row label="Actual Risk">
              <span style={{ fontSize: 10, color: C.r, fontFamily: M }}>
                ${pos.actualRisk}
              </span>
            </Row>
          </>
        )}

        {rr && (
          <>
            <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />
            <Row label="R:R Ratio">
              <span style={{
                fontSize: 13, fontWeight: 800, fontFamily: M,
                color: rr.rr >= 2 ? C.g : rr.rr >= 1 ? C.y : C.r,
              }}>
                {rr.rr > 0 ? `${rr.rr}:1` : '—'}
              </span>
            </Row>

            {!rr.slValid && (
              <div style={{ fontSize: 8, color: C.r, fontFamily: M, marginTop: 2 }}>
                ⚠ SL is on wrong side of entry for {tradeSide}
              </div>
            )}
            {!rr.tpValid && (
              <div style={{ fontSize: 8, color: C.r, fontFamily: M, marginTop: 2 }}>
                ⚠ TP is on wrong side of entry for {tradeSide}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0',
    }}>
      <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, prefix, suffix, step = 1, min, max }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {prefix && <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (min != null) v = Math.max(min, v);
          if (max != null) v = Math.min(max, v);
          onChange(v);
        }}
        step={step}
        style={{
          width: 70, padding: '2px 6px', fontSize: 10,
          borderRadius: 3, border: `1px solid ${C.bd}`,
          background: C.sf, color: C.t1, fontFamily: M,
          outline: 'none', textAlign: 'right',
        }}
      />
      {suffix && <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{suffix}</span>}
    </div>
  );
}

function LevelDisplay({ value, color }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: M,
      color: value ? color : C.t3,
    }}>
      {value ? `$${value.toFixed(2)}` : '—'}
    </span>
  );
}
