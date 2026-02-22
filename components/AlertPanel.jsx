// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Alert Panel
//
// Compact sidebar/overlay panel for managing price alerts.
// Inline form: symbol input + condition select + price input + add button.
// Shows active and triggered alerts with toggle/delete controls.
//
// Usage:
//   <AlertPanel /> — shows in sidebar/overlay
//   <AlertPanel compact /> — minimal mode for workspace panels
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import { C, F, M } from '../constants.js';
import { useAlertStore } from '../state/useAlertStore.js';

const CONDITIONS = [
  { id: 'above',       label: '↑ Above',        desc: 'Price goes above target' },
  { id: 'below',       label: '↓ Below',        desc: 'Price drops below target' },
  { id: 'cross_above', label: '↗ Cross Above',  desc: 'Price crosses above target' },
  { id: 'cross_below', label: '↘ Cross Below',  desc: 'Price crosses below target' },
];

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AlertPanel({ compact = false, currentSymbol = '' }) {
  const alerts = useAlertStore(s => s.alerts);
  const addAlert = useAlertStore(s => s.addAlert);
  const removeAlert = useAlertStore(s => s.removeAlert);
  const toggleAlert = useAlertStore(s => s.toggleAlert);
  const clearTriggered = useAlertStore(s => s.clearTriggered);

  const [symbol, setSymbol] = useState(currentSymbol.toUpperCase());
  const [condition, setCondition] = useState('above');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [repeating, setRepeating] = useState(false);

  const activeAlerts = useMemo(() => alerts.filter(a => a.active), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter(a => !a.active && a.triggeredAt), [alerts]);

  const handleAdd = useCallback(() => {
    const p = parseFloat(price);
    if (!symbol.trim() || isNaN(p) || p <= 0) return;

    addAlert({
      symbol: symbol.trim().toUpperCase(),
      condition,
      price: p,
      note,
      repeating,
    });

    setPrice('');
    setNote('');
  }, [symbol, condition, price, note, repeating, addAlert]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const inputStyle = {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    color: C.t1,
    borderRadius: 4,
    padding: '4px 8px',
    fontFamily: M,
    fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: compact ? 8 : 12,
      fontFamily: F,
      background: C.bg,
      color: C.t2,
    }}>
      {/* ─── Header ───────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
          🔔 Price Alerts
        </span>
        <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
          {activeAlerts.length} active
        </span>
      </div>

      {/* ─── Add Alert Form ───────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: 8, background: C.sf, borderRadius: 8,
        border: `1px solid ${C.bd}`, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <input aria-label="Alert parameter"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="SYM"
            style={{ ...inputStyle, width: 60, fontWeight: 700, textAlign: 'center' }}
          />
          <select aria-label="Alert condition"
            value={condition}
            onChange={e => setCondition(e.target.value)}
            style={{
              ...inputStyle,
              flex: 1,
              cursor: 'pointer',
              appearance: 'none',
              paddingRight: 4,
            }}
          >
            {CONDITIONS.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Price"
            type="number"
            step="any"
            style={{ ...inputStyle, width: 80, textAlign: 'right' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Note (optional)"
            style={{ ...inputStyle, flex: 1, fontSize: 11 }}
          />
          <label style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 10, color: C.t3, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <input
              type="checkbox"
              checked={repeating}
              onChange={e => setRepeating(e.target.checked)}
              style={{ width: 12, height: 12 }}
            />
            Repeat
          </label>
          <button className="tf-btn"
            onClick={handleAdd}
            disabled={!symbol.trim() || !price || isNaN(parseFloat(price))}
            style={{
              background: C.b,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: (!symbol.trim() || !price) ? 0.4 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* ─── Active Alerts ────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.04em' }}>
            Active ({activeAlerts.length})
          </div>
          {activeAlerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onToggle={toggleAlert}
              onRemove={removeAlert}
            />
          ))}
        </>
      )}

      {/* ─── Triggered Alerts ─────────────────────────── */}
      {triggeredAlerts.length > 0 && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: activeAlerts.length > 0 ? 12 : 0, marginBottom: 6,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Triggered ({triggeredAlerts.length})
            </span>
            <button className="tf-btn"
              onClick={clearTriggered}
              style={{
                background: 'none', border: 'none', color: C.t3,
                fontSize: 10, cursor: 'pointer', padding: '2px 4px',
              }}
            >
              Clear all
            </button>
          </div>
          {triggeredAlerts.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onToggle={toggleAlert}
              onRemove={removeAlert}
              triggered
            />
          ))}
        </>
      )}

      {/* ─── Empty State ──────────────────────────────── */}
      {alerts.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 12px',
          color: C.t3, fontSize: 12,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔔</div>
          <div>No alerts yet</div>
          <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
            Get notified when a symbol hits your target price.
            Set an alert above to get started.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alert Row Component ────────────────────────────────────────

function AlertRow({ alert, onToggle, onRemove, triggered = false }) {
  const condIcons = {
    above: '↑', below: '↓',
    cross_above: '↗', cross_below: '↘',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 8px',
      background: triggered ? C.sf + '80' : C.sf,
      borderRadius: 6,
      marginBottom: 3,
      opacity: triggered ? 0.7 : 1,
      borderLeft: `3px solid ${triggered ? C.g : (alert.condition.includes('above') || alert.condition.includes('cross_above') ? C.g : C.r)}`,
    }}>
      {/* Symbol + condition */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: M, fontWeight: 700, fontSize: 12, color: C.t1 }}>
            {alert.symbol}
          </span>
          <span style={{ fontSize: 10, color: C.t3 }}>
            {condIcons[alert.condition] || ''} {alert.condition.replace('_', ' ')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <span style={{ fontFamily: M, fontWeight: 600, fontSize: 12, color: C.b }}>
            ${alert.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {alert.repeating && (
            <span style={{ fontSize: 8, color: C.t3, background: C.bd + '60', padding: '1px 4px', borderRadius: 2 }}>
              REPEAT
            </span>
          )}
          {alert.note && (
            <span style={{ fontSize: 9, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {alert.note}
            </span>
          )}
        </div>
        {triggered && alert.triggeredAt && (
          <div style={{ fontSize: 9, color: C.g, marginTop: 2, fontFamily: M }}>
            ✓ Triggered {formatTime(alert.triggeredAt)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button className="tf-btn"
          onClick={() => onToggle(alert.id)}
          title={alert.active ? 'Pause alert' : 'Re-arm alert'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: alert.active ? C.t2 : C.t3, fontSize: 12, padding: '2px 4px',
          }}
        >
          {alert.active ? '⏸' : '▶'}
        </button>
        <button className="tf-btn"
          onClick={() => onRemove(alert.id)}
          title="Delete alert"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.r + '80', fontSize: 11, padding: '2px 4px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export { AlertPanel };
