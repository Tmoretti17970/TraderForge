// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — ChartPane
//
// Independent chart panel for the workspace layout system.
// Each pane manages its OWN:
//   - symbol, timeframe, chart type
//   - data (fetched via FetchService)
//   - indicators (local state, not global store)
//   - drawings (local state)
//
// Unlike ChartsPage which uses global useChartStore, ChartPane is
// self-contained so multiple instances can coexist in a dockable layout.
//
// Props:
//   node  — flexlayout-react TabNode (provides resize events + tab name)
//   symbol — initial symbol
//   tf     — initial timeframe
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { C, M, TFS, CHART_TYPES } from '../constants.js';
import ChartCanvas from './ChartCanvas.jsx';
import SymbolSearch from './SymbolSearch.jsx';
import TemplateSelector from './TemplateSelector.jsx';
import { fetchOHLC, warmCache } from '../data/FetchService.js';
import { setFormatSymbol } from '../engine/chartRenderer.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { checkSymbolAlerts } from '../state/useAlertStore.js';
import { safeClone } from '../utils/safeJSON.js';
import crosshairBus from '../utils/CrosshairBus.js';

const DEFAULT_INDICATORS = [
  { type: 'sma', params: { period: 20 }, color: C.y },
  { type: 'ema', params: { period: 50 }, color: C.p },
];

/**
 * Independent chart pane for the workspace layout.
 *
 * @param {Object} props
 * @param {Object} [props.node] — flexlayout-react TabNode (optional, for tab name updates)
 * @param {string} [props.symbol='BTC'] — initial symbol
 * @param {string} [props.tf='3m'] — initial timeframe
 * @param {string} [props.chartType='candles'] — initial chart type
 */
export default function ChartPane({ node, symbol: initSymbol = 'BTC', tf: initTf = '3m', chartType: initChartType = 'candles' }) {
  // ─── Local State (per-pane, NOT global store) ──────────────
  const [symbol, setSymbol] = useState(initSymbol);
  const [tf, setTf] = useState(initTf);
  const [chartType, setChartType] = useState(initChartType);
  const [data, setData] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataWarning, setDataWarning] = useState(null);
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [drawings, setDrawings] = useState([]);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const chartRef = useRef(null);

  // C5.1: Crosshair sync — unique pane ID
  const paneIdRef = useRef(`pane-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const [syncedTimestamp, setSyncedTimestamp] = useState(null);

  // Subscribe to crosshair bus
  useEffect(() => {
    const paneId = paneIdRef.current;
    const unsub = crosshairBus.subscribe(paneId, (payload) => {
      setSyncedTimestamp(payload ? payload.timestamp : null);
    });
    return unsub;
  }, []);

  // Emit crosshair position to bus
  const handleCrosshairMove = useCallback(({ timestamp, price }) => {
    crosshairBus.emit(paneIdRef.current, { timestamp, price });
  }, []);

  // Trade overlay — shared across panes (read-only from global store)
  const trades = useTradeStore((s) => s.trades);
  const matchingTrades = useMemo(() => {
    if (!trades?.length || !symbol) return [];
    const s = symbol.toUpperCase();
    return trades.filter(t => (t.symbol || '').toUpperCase() === s);
  }, [trades, symbol]);

  // ─── Update Tab Name ──────────────────────────────────────
  useEffect(() => {
    if (!node) return;
    try {
      const model = node.getModel();
      if (model && model.doAction) {
        // Use flexlayout-react's Actions API for safe tab renaming
        // Import dynamically to avoid hard dependency at module level
        import('flexlayout-react').then(({ Actions }) => {
          model.doAction(Actions.renameTab(node.getId(), `${symbol} · ${tf.toUpperCase()}`));
        }).catch(() => {
          // Fallback: set name attribute directly (older flexlayout versions)
          try {
            const tabNode = model.getNodeById(node.getId());
            if (tabNode && tabNode._setName) tabNode._setName(`${symbol} · ${tf.toUpperCase()}`);
          } catch { /* silently fail */ }
        });
      }
    } catch { /* flexlayout may throw if node is being removed during layout change */ }
  }, [symbol, tf, node]);

  // ─── Fetch Data ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDataWarning(null);

    fetchOHLC(symbol, tf).then(result => {
      if (cancelled) return;
      setData(result.data);
      setSource(result.source);
      setLoading(false);
      if (result.source === 'simulated') {
        setDataWarning(`Using simulated data for ${symbol}`);
      }
      // Check price alerts against latest candle close (deferred to avoid store update during render)
      if (result.data?.length > 0) {
        const lastClose = result.data[result.data.length - 1].close;
        if (lastClose != null) queueMicrotask(() => checkSymbolAlerts(symbol, lastClose));
      }
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      setDataWarning(`Failed to load data for ${symbol}`);
    });

    return () => { cancelled = true; };
  }, [symbol, tf]);

  // Warm adjacent timeframe caches when symbol changes
  useEffect(() => { warmCache(symbol, tf); }, [symbol]); // eslint-disable-line

  // Set format context for price axis
  useEffect(() => { setFormatSymbol(symbol); }, [symbol]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleSymbolSelect = useCallback((sym) => {
    setSymbol(sym.toUpperCase());
  }, []);

  const handleAddIndicator = useCallback((preset) => {
    setIndicators(prev => [...prev, { ...preset }]);
  }, []);

  const handleRemoveIndicator = useCallback((idx) => {
    setIndicators(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleUpdateIndicator = useCallback((idx, updates) => {
    setIndicators(prev => prev.map((ind, i) => i === idx ? { ...ind, ...updates } : ind));
  }, []);

  const handleApplyTemplate = useCallback((tpl) => {
    setIndicators(safeClone(tpl.indicators || [], []));
    if (tpl.chartType) setChartType(tpl.chartType);
  }, []);

  const handleDrawingClick = useCallback((drawingData) => {
    setDrawings(prev => [
      ...prev,
      {
        ...drawingData,
        id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        visible: true,
      },
    ]);
  }, []);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: C.bg,
      overflow: 'hidden',
    }}>
      {/* ─── Mini Toolbar ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 6px',
        background: C.bg2,
        borderBottom: `1px solid ${C.bd}`,
        flexShrink: 0,
        minHeight: 32,
      }}>
        {/* Symbol Search */}
        <SymbolSearch
          onSelect={handleSymbolSelect}
          currentSymbol={symbol}
          width={140}
        />

        {/* Timeframe buttons */}
        <div style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
          {TFS.map(t => (
            <button className="tf-btn"
              key={t.id}
              onClick={() => setTf(t.id)}
              style={{
                background: tf === t.id ? C.b + '28' : 'transparent',
                color: tf === t.id ? C.b : C.t3,
                border: tf === t.id ? `1px solid ${C.b}40` : '1px solid transparent',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 11,
                fontFamily: M,
                cursor: 'pointer',
                fontWeight: tf === t.id ? 600 : 400,
                transition: 'all 0.1s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Chart Type Dropdown */}
        <div style={{ position: 'relative', marginLeft: 4 }}>
          <button className="tf-btn"
            onClick={() => setShowTypeMenu(v => !v)}
            style={{
              background: 'transparent',
              color: C.t2,
              border: `1px solid ${C.bd}`,
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: M,
              cursor: 'pointer',
            }}
          >
            {CHART_TYPES.find(ct => ct.id === chartType)?.label || 'Candles'} ▾
          </button>
          {showTypeMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 999,
              background: C.sf,
              border: `1px solid ${C.bd}`,
              borderRadius: 6,
              marginTop: 2,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {CHART_TYPES.map(ct => (
                <div
                  key={ct.id}
                  onMouseDown={() => { setChartType(ct.id); setShowTypeMenu(false); }}
                  style={{
                    padding: '6px 16px 6px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: chartType === ct.id ? C.b : C.t2,
                    background: chartType === ct.id ? C.b + '12' : 'transparent',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ct.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Template selector */}
          <TemplateSelector
            indicators={indicators}
            chartType={chartType}
            onApply={handleApplyTemplate}
          />
          {dataWarning && (
            <span style={{ fontSize: 10, color: C.y, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ⚠ {dataWarning}
            </span>
          )}
          {source && !loading && (
            <span style={{
              fontSize: 10,
              color: source === 'simulated' ? C.y : C.t3,
              fontFamily: M,
              padding: '1px 5px',
              borderRadius: 3,
              background: source === 'simulated' ? C.y + '15' : 'transparent',
            }}>
              {source}
            </span>
          )}
          {/* Indicator count badge */}
          {indicators.length > 0 && (
            <span style={{
              fontSize: 10, color: C.p, fontFamily: M,
              padding: '1px 5px', borderRadius: 3, background: C.p + '15',
            }}>
              {indicators.length} ind
            </span>
          )}
        </div>
      </div>

      {/* ─── Chart Area ───────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: C.t3, fontSize: 13, fontFamily: M,
            gap: 8,
          }}>
            <span style={{
              width: 14, height: 14, border: `2px solid ${C.bd}`,
              borderTopColor: C.b, borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            Loading {symbol}...
          </div>
        ) : data?.length > 0 ? (
          <ChartCanvas
            ref={chartRef}
            data={data}
            chartType={chartType}
            indicators={indicators}
            trades={matchingTrades}
            drawings={drawings}
            drawingsVisible={true}
            onDrawingClick={handleDrawingClick}
            syncedTimestamp={syncedTimestamp}
            onCrosshairMove={handleCrosshairMove}
          />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: C.t3, fontSize: 13,
          }}>
            No data available for {symbol}
          </div>
        )}
      </div>

      {/* Inline CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
