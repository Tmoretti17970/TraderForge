// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — Indicator Panel
// Updated to use Sprint 5 indicator registry.
// Groups indicators by overlay/pane, supports parameter editing.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react';
import { C, F } from '../constants.js';
import { useChartStore } from '../state/useChartStore.js';
import {
  INDICATORS,
  getOverlayIndicators,
  getPaneIndicators,
} from '../chartEngine/indicators/registry.js';

/**
 * IndicatorPanel — Add, remove, and configure indicators.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen     - Panel visibility
 * @param {Function} props.onClose   - Close handler
 */
export default function IndicatorPanel({ isOpen, onClose }) {
  const indicators = useChartStore((s) => s.indicators);
  const addIndicator = useChartStore((s) => s.addIndicator);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const updateIndicator = useChartStore((s) => s.updateIndicator);
  const toggleVisibility = useChartStore((s) => s.toggleIndicatorVisibility);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);

  const overlayDefs = useMemo(() => getOverlayIndicators(), []);
  const paneDefs = useMemo(() => getPaneIndicators(), []);

  // Filter by search
  const filterFn = useCallback(
    (def) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        def.name.toLowerCase().includes(q) ||
        def.shortName.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
      );
    },
    [searchTerm]
  );

  const filteredOverlay = overlayDefs.filter(filterFn);
  const filteredPane = paneDefs.filter(filterFn);

  // Add indicator with defaults
  const handleAdd = useCallback(
    (def) => {
      const params = {};
      for (const [key, config] of Object.entries(def.params)) {
        params[key] = config.default;
      }
      addIndicator({
        indicatorId: def.id,
        params,
        color: def.outputs[0]?.color,
        visible: true,
      });
    },
    [addIndicator]
  );

  // Update a parameter value
  const handleParamChange = useCallback(
    (idx, paramKey, value) => {
      const ind = indicators[idx];
      if (!ind) return;
      updateIndicator(idx, {
        params: { ...ind.params, [paramKey]: Number(value) },
      });
    },
    [indicators, updateIndicator]
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 300,
        maxHeight: 'calc(100vh - 80px)',
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>
          Indicators
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.t3,
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search indicators..."
          style={{
            width: '100%',
            padding: '6px 10px',
            background: C.bg2,
            border: `1px solid ${C.bd}`,
            borderRadius: 6,
            color: C.t1,
            fontSize: 12,
            outline: 'none',
            fontFamily: F,
          }}
        />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
        {/* Active indicators */}
        {indicators.length > 0 && (
          <>
            <SectionLabel>Active ({indicators.length})</SectionLabel>
            {indicators.map((ind, idx) => {
              const id = ind.indicatorId || ind.type;
              const def = INDICATORS[id];
              const paramStr = Object.values(ind.params || {}).join(', ');
              const isEditing = editingIdx === idx;

              return (
                <div key={idx}>
                  <div
                    style={{
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {/* Color dot */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: ind.color || def?.outputs[0]?.color || C.b,
                        flexShrink: 0,
                      }}
                    />

                    {/* Name + params */}
                    <button
                      onClick={() => setEditingIdx(isEditing ? null : idx)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: C.t1,
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        padding: 0,
                        fontFamily: F,
                      }}
                    >
                      {def?.shortName || id}
                      {paramStr && (
                        <span style={{ color: C.t3 }}> ({paramStr})</span>
                      )}
                    </button>

                    {/* Visibility toggle */}
                    <button
                      onClick={() => toggleVisibility(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: ind.visible !== false ? C.t2 : C.t3,
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '0 2px',
                        opacity: ind.visible !== false ? 1 : 0.4,
                      }}
                    >
                      👁
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => {
                        removeIndicator(idx);
                        if (editingIdx === idx) setEditingIdx(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: C.r,
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '0 2px',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Parameter editor */}
                  {isEditing && def && Object.keys(def.params).length > 0 && (
                    <div
                      style={{
                        padding: '4px 12px 8px 28px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      {Object.entries(def.params).map(([key, config]) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label
                            style={{
                              fontSize: 10,
                              color: C.t3,
                              fontFamily: F,
                            }}
                          >
                            {config.label || key}
                          </label>
                          <input
                            type="number"
                            value={ind.params?.[key] ?? config.default}
                            min={config.min}
                            max={config.max}
                            step={config.step || 1}
                            onChange={(e) => handleParamChange(idx, key, e.target.value)}
                            style={{
                              width: 60,
                              padding: '3px 6px',
                              background: C.bg,
                              border: `1px solid ${C.bd}`,
                              borderRadius: 4,
                              color: C.t1,
                              fontSize: 11,
                              fontFamily: F,
                              outline: 'none',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Available overlays */}
        {filteredOverlay.length > 0 && (
          <>
            <SectionLabel>Overlay</SectionLabel>
            {filteredOverlay.map((def) => (
              <IndicatorRow
                key={def.id}
                def={def}
                onAdd={() => handleAdd(def)}
              />
            ))}
          </>
        )}

        {/* Available pane indicators */}
        {filteredPane.length > 0 && (
          <>
            <SectionLabel>Oscillators & Pane</SectionLabel>
            {filteredPane.map((def) => (
              <IndicatorRow
                key={def.id}
                def={def}
                onAdd={() => handleAdd(def)}
              />
            ))}
          </>
        )}

        {/* No results */}
        {filteredOverlay.length === 0 && filteredPane.length === 0 && searchTerm && (
          <div style={{ padding: '16px 12px', textAlign: 'center', color: C.t3, fontSize: 12 }}>
            No indicators match "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div
      style={{
        padding: '6px 12px 2px',
        fontSize: 10,
        color: C.t3,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: 600,
        borderTop: `1px solid ${C.bd}`,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function IndicatorRow({ def, onAdd }) {
  const [hovered, setHovered] = useState(false);
  const paramStr = Object.entries(def.params)
    .map(([, config]) => config.default)
    .join(', ');

  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 12px',
        background: hovered ? C.sf2 : 'transparent',
        border: 'none',
        color: C.t1,
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: F,
        transition: 'background 0.1s',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: def.outputs[0]?.color || '#787B86',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1 }}>
        {def.name}
        {paramStr && (
          <span style={{ color: C.t3, fontSize: 11 }}> ({paramStr})</span>
        )}
      </span>
      <span
        style={{
          fontSize: 10,
          color: C.t3,
          background: C.bg2,
          padding: '1px 5px',
          borderRadius: 3,
        }}
      >
        {def.mode === 'overlay' ? 'overlay' : 'pane'}
      </span>
    </button>
  );
}
