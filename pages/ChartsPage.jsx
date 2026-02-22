// ═══════════════════════════════════════════════════════════════════
// TradeForge — Charts Page (Sprint 4: Progressive Disclosure)
// Toolbar tiers: Primary (always) → Secondary (toggle) → Overflow (menu)
// Heavy panels lazy-loaded. Chart-first layout.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { C, F, M, CHART_TYPES, TFS } from '../constants.js';
import { useChartStore } from '../state/useChartStore.js';
// No UIKit Btn needed — ChartsPage uses local ToolbarBtn

// ─── Core (always needed) ────────────────────────────────────────
import ChartCanvas from '../components/ChartCanvas.jsx';
import SymbolSearch from '../components/SymbolSearch.jsx';
import DrawingToolbar from '../components/DrawingToolbar.jsx';
import IndicatorPanel from '../components/IndicatorPanel.jsx';
import LiveTicker from '../components/LiveTicker.jsx';
import { generateOHLCV } from '../engine/generateOHLCV.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import { exportChartPNG, copyChartToClipboard, generateShareURL, parseShareURL } from '../utils/chartExport.js';
import useWebSocket from '../data/useWebSocket.js';
import { WebSocketService } from '../data/WebSocketService.js';
import { fetchOHLC, warmCache } from '../data/FetchService.js';
import { setFormatSymbol } from '../engine/chartRenderer.js';
import { TOOL_CONFIG, magnetSnap } from '../engine/drawingTools.js';
import { useAlertStore, checkSymbolAlerts, requestNotificationPermission } from '../state/useAlertStore.js';
import { safeClone } from '../utils/safeJSON.js';
import { useWatchlistStore } from '../state/useWatchlistStore.js';
import { analyzeAll } from '../engine/PriceActionEngine.js';

// Sprint 10: Chart trade workflow (core — used on every chart interaction)
import { useChartTradeStore } from '../state/useChartTradeStore.js';
import { useChartTradeHandler } from '../components/chart/useChartTradeHandler.js';
import ChartTradeToolbar from '../components/chart/ChartTradeToolbar.jsx';
import ChartContextMenu from '../components/chart/ChartContextMenu.jsx';

// ─── Lazy-loaded (Tier 2+: opened on demand) ────────────────────
const ReplayBar = React.lazy(() => import('../components/ReplayBar.jsx'));
const QuadChart = React.lazy(() => import('../components/QuadChart.jsx'));
const WorkspaceLayout = React.lazy(() => import('../components/WorkspaceLoader.jsx'));
const FundamentalsCard = React.lazy(() => import('../components/FundamentalsCard.jsx'));
const ScriptEditor = React.lazy(() => import('../components/ScriptEditor.jsx'));
const ScriptManager = React.lazy(() => import('../components/ScriptManager.jsx'));
const ShareSnapshotModal = React.lazy(() => import('../components/ShareSnapshotModal.jsx'));
const WatchlistPanel = React.lazy(() => import('../components/WatchlistPanel.jsx'));
const AlertPanel = React.lazy(() => import('../components/AlertPanel.jsx'));
const TemplateSelector = React.lazy(() => import('../components/TemplateSelector.jsx'));
const ChartSettingsBar = React.lazy(() => import('../components/ChartSettingsBar.jsx'));
const ChartInsightsPanel = React.lazy(() => import('../components/ChartInsightsPanel.jsx'));
const SnapshotPublisher = React.lazy(() => import('../components/SnapshotPublisher.jsx'));
const TradeEntryBar = React.lazy(() => import('../components/chart/TradeEntryBar.jsx'));
const PositionSizer = React.lazy(() => import('../components/chart/PositionSizer.jsx'));
const QuickJournalPanel = React.lazy(() => import('../components/chart/QuickJournalPanel.jsx'));

// Sprint 6: Mobile Pro (lazy — only loaded on mobile)
const MobileDrawingSheet = React.lazy(() => import('../components/MobileDrawingSheet.jsx'));
const MobileChartSheet = React.lazy(() => import('../components/MobileChartSheet.jsx'));
const MobileShareSheet = React.lazy(() => import('../components/MobileShareSheet.jsx'));
const SwipeChartNav = React.lazy(() => import('../components/SwipeChartNav.jsx'));
const GestureGuide = React.lazy(() => import('../components/GestureGuide.jsx'));

import { useScriptStore } from '../state/useScriptStore.js';
import useScriptRunner from '../engine/useScriptRunner.js';

export default function ChartsPage() {
  // Sprint 11: Defer mount to prevent Zustand forceStoreRerender infinite loop
  // during React 18 passive effects commit phase
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: C.t3, fontFamily: F }}>
        Loading charts…
      </div>
    );
  }

  return <ChartsPageInner />;
}

function ChartsPageInner() {
  const symbol = useChartStore((s) => s.symbol);
  const tf = useChartStore((s) => s.tf);
  const chartType = useChartStore((s) => s.chartType);
  const indicators = useChartStore((s) => s.indicators);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const setTf = useChartStore((s) => s.setTf);
  const setChartType = useChartStore((s) => s.setChartType);
  const setIndicators = useChartStore((s) => s.setIndicators);
  const setData = useChartStore((s) => s.setData);
  const data = useChartStore((s) => s.data);
  const dataSource = useChartStore((s) => s.source);
  const dataLoading = useChartStore((s) => s.loading);
  const replayMode = useChartStore((s) => s.replayMode);
  const replayIdx = useChartStore((s) => s.replayIdx);
  const activeGhost = useChartStore((s) => s.activeGhost);
  const toggleReplay = useChartStore((s) => s.toggleReplay);
  const quadMode = useChartStore((s) => s.quadMode);
  const toggleQuadMode = useChartStore((s) => s.toggleQuadMode);

  // Drawing tools
  const activeTool = useChartStore((s) => s.activeTool);
  const drawings = useChartStore((s) => s.drawings);
  const drawingsVisible = useChartStore((s) => s.drawingsVisible);
  const showVolumeProfile = useChartStore((s) => s.showVolumeProfile); // C1.4
  const comparisonSymbol = useChartStore((s) => s.comparisonSymbol);     // C5.2
  const comparisonData = useChartStore((s) => s.comparisonData);         // C5.2
  const intelligence = useChartStore((s) => s.intelligence);             // C7.11

  // C7.1: Intelligence analysis (memoized on data changes)
  const analysis = useMemo(() => {
    if (!intelligence.enabled || !data?.length) return null;
    return analyzeAll(data);
  }, [data, intelligence.enabled]);

  const [showInsights, setShowInsights] = useState(false);
  const pendingDrawing = useChartStore((s) => s.pendingDrawing);

  // Sprint 10: Chart trade workflow
  const tradeMode = useChartTradeStore((s) => s.tradeMode);
  const tradeStep = useChartTradeStore((s) => s.tradeStep);
  const tradeSide = useChartTradeStore((s) => s.tradeSide);
  const pendingEntry = useChartTradeStore((s) => s.pendingEntry);
  const pendingSL = useChartTradeStore((s) => s.pendingSL);
  const pendingTP = useChartTradeStore((s) => s.pendingTP);
  const riskAmount = useChartTradeStore((s) => s.riskAmount);
  const contextMenu = useChartTradeStore((s) => s.contextMenu);
  const closeContextMenu = useChartTradeStore((s) => s.closeContextMenu);
  const showQuickJournal = useChartTradeStore((s) => s.showQuickJournal);
  const toggleQuickJournal = useChartTradeStore((s) => s.toggleQuickJournal);
  const { handleChartClick: handleTradeClick, handleContextMenu, contextMenuHandlers } = useChartTradeHandler();
  const setPendingDrawing = useChartStore((s) => s.setPendingDrawing);
  const addDrawing = useChartStore((s) => s.addDrawing);

  const [symbolInput, setSymbolInput] = useState(symbol);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showTrades, setShowTrades] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showScriptManager, setShowScriptManager] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [showSnapshotPublisher, setShowSnapshotPublisher] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);    // C6.2
  const [showMobileShare, setShowMobileShare] = useState(false);          // C6.5
  const [isLandscapeFullscreen, setIsLandscapeFullscreen] = useState(false); // C6.8
  const [dataWarning, setDataWarning] = useState(null);
  const [showOverflow, setShowOverflow] = useState(false); // Sprint 4: toolbar overflow menu
  const [workspaceMode, setWorkspaceMode] = useState(() => {
    try { return localStorage.getItem('tradeforge-workspace-mode') === 'true'; } catch { return false; }
  });
  const { isMobile, isTablet } = useBreakpoints();
  const watchlistSymbols = useWatchlistStore((s) => s.items.map(i => i.symbol)); // C6.4
  const chartRef = useRef(null);
  const editorRef = useRef(null);
  const mountedRef = useRef(false);

  // Guard: defer all store mutations until after first render commit
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // C1.3: Set symbol context for price formatting
  useEffect(() => { setFormatSymbol(symbol); }, [symbol]);

  // C2.6: Warm cache with adjacent timeframes when symbol changes
  useEffect(() => { warmCache(symbol, tf); }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request notification permission for price alerts
  useEffect(() => { requestNotificationPermission(); }, []);

  // Listen for alert triggers and show toast
  const alertCount = useAlertStore(s => s.alerts.filter(a => a.active).length);
  const [showAlerts, setShowAlerts] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      // Import toast dynamically to avoid circular dependency
      import('../components/Toast.jsx').then(({ default: toast }) => {
        toast.info(`🔔 ${e.detail.message}`);
      }).catch(() => {});
    };
    window.addEventListener('tradeforge:alert-triggered', handler);
    return () => window.removeEventListener('tradeforge:alert-triggered', handler);
  }, []);

  // C5.11: Ctrl+S → open snapshot publisher
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        setShowSnapshotPublisher(true);
      }
      // C7.12: I key → toggle insights panel
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey &&
          e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        setShowInsights(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // C2.1 + C2.5: Listen for data fallback warnings from FetchService
  useEffect(() => {
    const handler = (e) => {
      setDataWarning(e.detail.message);
      // Auto-clear after 8 seconds
      setTimeout(() => setDataWarning(null), 8000);
    };
    window.addEventListener('tradeforge:data-warning', handler);
    return () => window.removeEventListener('tradeforge:data-warning', handler);
  }, []);

  // Script engine — auto-runs enabled scripts against current data
  const { scriptOutputs, setEditorOutputs, errors: scriptErrors } = useScriptRunner(data);
  const enabledScriptCount = useScriptStore((s) => s.scripts.filter((sc) => sc.enabled).length);

  // ─── Export Handlers ─────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    const canvas = chartRef.current?.getCanvas();
    if (canvas) exportChartPNG(canvas, null, { symbol, tf });
  }, [symbol, tf]);

  const handleCopyChart = useCallback(async () => {
    const canvas = chartRef.current?.getCanvas();
    if (!canvas) return;
    const ok = await copyChartToClipboard(canvas);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  }, []);

  const handleShareURL = useCallback(() => {
    const url = generateShareURL({ symbol, tf, chartType, indicators });
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }).catch(() => {
      // Fallback: prompt
      window.prompt('Share URL:', url);
    });
  }, [symbol, tf, chartType, indicators]);

  // WebSocket: live candle + ticker for supported crypto symbols
  const { tick, wsStatus, isLive } = useWebSocket(symbol, tf);
  const wsSupported = WebSocketService.isSupported(symbol);

  // Get trades for this symbol
  const allTrades = useTradeStore((s) => s.trades);
  const matchingTrades = useMemo(() =>
    showTrades
      ? allTrades.filter((t) => (t.symbol || '').toUpperCase() === symbol.toUpperCase())
      : [],
    [allTrades, symbol, showTrades]
  );

  // Get bar count for the timeframe
  const barCount = useMemo(() => {
    const tfConfig = TFS.find((t) => t.id === tf);
    return tfConfig ? tfConfig.fb || 120 : 120;
  }, [tf]);

  // Drawing tool click handler — uses TOOL_CONFIG for behavior
  const magnetMode = useChartStore((s) => s.magnetMode);

  const handleDrawingClick = useCallback(({ price, barIdx }) => {
    // Sprint 10: Trade mode takes priority over drawing tools
    if (tradeMode) {
      handleTradeClick(price, barIdx);
      return;
    }

    if (!activeTool) return;

    const config = TOOL_CONFIG[activeTool];
    if (!config) return;
    const color = config.color;

    // C5.7: Magnet mode — snap to nearest OHLC
    let snapPrice = price, snapBarIdx = barIdx;
    if (magnetMode && data?.length) {
      const snapped = magnetSnap(price, barIdx, data);
      snapPrice = snapped.price;
      snapBarIdx = snapped.barIdx;
    }

    // Single-click tools (clicks: 1)
    if (config.clicks === 1) {
      const drawing = { type: activeTool, points: [{ price: snapPrice, barIdx: snapBarIdx }], color };
      // Text tools: prompt for text
      if (activeTool === 'text' || activeTool === 'callout') {
        const text = prompt('Enter text:', '');
        if (!text) return;
        drawing.text = text;
      }
      addDrawing(drawing);
      return;
    }

    // Multi-click tools (clicks: 2 or 3)
    if (!pendingDrawing) {
      // First click
      setPendingDrawing({ type: activeTool, points: [{ price: snapPrice, barIdx: snapBarIdx }], color });
    } else if (config.clicks === 3 && pendingDrawing.points.length === 1) {
      // Second click for 3-click tools (e.g. pitchfork)
      setPendingDrawing({
        ...pendingDrawing,
        points: [...pendingDrawing.points, { price: snapPrice, barIdx: snapBarIdx }],
      });
    } else {
      // Final click — complete drawing
      const drawing = {
        type: pendingDrawing.type,
        points: [...pendingDrawing.points, { price: snapPrice, barIdx: snapBarIdx }],
        color: pendingDrawing.color,
      };
      // Callout: prompt for text on final click
      if (pendingDrawing.type === 'callout') {
        const text = prompt('Enter callout text:', '');
        if (text) drawing.text = text;
      }
      addDrawing(drawing);
    }
  }, [activeTool, pendingDrawing, setPendingDrawing, addDrawing, magnetMode, data, tradeMode, handleTradeClick]);

  // Fetch real data when symbol or tf changes — via FetchService pipeline
  // Tries CoinGecko (crypto) or Yahoo Finance (equities), falls back to demo data
  useEffect(() => {
    let cancelled = false;
    // Defer ALL store mutations to next tick to avoid Zustand re-render loop
    // during React 18 commit phase (forceStoreRerender / updateStoreInstance)
    const loadTimer = setTimeout(() => {
      if (!cancelled) useChartStore.getState().setLoading(true);
    }, 0);

    // Use setTimeout to ensure fetch + store update happens outside commit phase
    const fetchTimer = setTimeout(() => {
      if (cancelled) return;
      fetchOHLC(symbol, tf).then(({ data: newData, source }) => {
        if (cancelled) return;
        useChartStore.getState().setData(newData, source);
        if (newData?.length > 0) {
          const last = newData[newData.length - 1].close;
          if (last != null) queueMicrotask(() => checkSymbolAlerts(symbol, last));
        }
      }).catch(() => {
        if (cancelled) return;
        const bc = TFS.find((t) => t.id === tf)?.fb || 200;
        const newData = generateOHLCV(symbol, Math.max(bc, 200), tf);
        useChartStore.getState().setData(newData, 'simulated');
      });
    }, 10);

    return () => { cancelled = true; clearTimeout(loadTimer); clearTimeout(fetchTimer); };
  }, [symbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // C5.2: Fetch comparison symbol data when comparison is set
  useEffect(() => {
    if (!comparisonSymbol) return;
    let cancelled = false;

    fetchOHLC(comparisonSymbol, tf).then(({ data: compData }) => {
      if (cancelled) return;
      setTimeout(() => useChartStore.getState().setComparison(comparisonSymbol, compData), 0);
    }).catch(() => {
      if (cancelled) return;
      // Fallback to generated data for comparison
      const bc = TFS.find((t) => t.id === tf)?.fb || 200;
      const compData = generateOHLCV(comparisonSymbol, Math.max(bc, 200), tf);
      setTimeout(() => useChartStore.getState().setComparison(comparisonSymbol, compData), 0);
    });

    return () => { cancelled = true; };
  }, [comparisonSymbol, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse shared chart URL on mount (one-time)
  useEffect(() => {
    const shared = parseShareURL();
    if (shared) {
      setSymbol(shared.symbol);
      setSymbolInput(shared.symbol);
      if (shared.tf) useChartStore.getState().setTf(shared.tf);
      if (shared.chartType) useChartStore.getState().setChartType(shared.chartType);
      // Clean URL param after applying
      const url = new URL(window.location.href);
      url.searchParams.delete('chart');
      window.history.replaceState({}, '', url.toString());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ─── Unified Toolbar (Sprint 4: Tiered) ──────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 4 : 6,
          padding: isMobile ? '4px 8px' : '6px 12px',
          borderBottom: `1px solid ${C.bd}`,
          background: C.bg,
          flexShrink: 0,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          overflow: 'hidden',
        }}
      >
        {/* ═══ PRIMARY: Symbol + Timeframe + Chart Type ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: M, fontWeight: 800, fontSize: 14, color: C.t1,
            padding: '3px 8px', background: C.sf, borderRadius: 4,
            border: `1px solid ${C.bd}`, minWidth: 40, textAlign: 'center',
          }}>
            {symbol}
          </span>
          <SymbolSearch
            onSelect={(sym) => { setSymbol(sym); setSymbolInput(sym); }}
            currentSymbol={symbol}
            width={isMobile ? 120 : 160}
          />
        </div>

        <Divider />

        {/* Timeframe pills */}
        <div style={{ display: 'flex', gap: 1 }}>
          {TFS.map((t) => (
            <ToolbarBtn key={t.id} active={tf === t.id} onClick={() => setTf(t.id)}>
              {t.label}
            </ToolbarBtn>
          ))}
        </div>

        <Divider />

        {/* Chart Type — hidden on mobile */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 1 }}>
            {CHART_TYPES.map((ct) => (
              <ToolbarBtn key={ct.id} active={chartType === ct.id} onClick={() => setChartType(ct.id)}>
                {ct.label}
              </ToolbarBtn>
            ))}
          </div>
        )}

        {!isMobile && <Divider />}

        {/* ═══ SECONDARY: Core toggles ═══ */}
        <ToolbarBtn active={showIndicators} onClick={() => setShowIndicators(!showIndicators)}>
          📐 {isMobile ? indicators.length : `Ind (${indicators.length})`}
        </ToolbarBtn>

        {!isMobile && (
          <ToolbarBtn active={showTrades} onClick={() => setShowTrades(!showTrades)}>
            📍 Trades ({matchingTrades.length})
          </ToolbarBtn>
        )}

        {/* Sprint 10: Trade Toolbar */}
        {!isMobile && <ChartTradeToolbar />}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ═══ OVERFLOW: Power features (desktop) ═══ */}
        {!isMobile && (
          <div style={{ position: 'relative' }}>
            <ToolbarBtn
              active={showOverflow}
              onClick={() => setShowOverflow(o => !o)}
            >
              ⋯ More
            </ToolbarBtn>

            {/* Overflow dropdown */}
            {showOverflow && (
              <>
                <div
                  onClick={() => setShowOverflow(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 500 }}
                />
                <div
                  className="tf-dropdown-enter"
                  style={{
                  position: 'absolute', top: '100%', right: 0,
                  marginTop: 4, minWidth: 180,
                  background: C.sf2, border: `1px solid ${C.bd}`,
                  borderRadius: 8, padding: 4, zIndex: 501,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
                }}>
                  <OverflowItem
                    label={showVolumeProfile ? '✓ Volume Profile' : 'Volume Profile'}
                    onClick={() => { useChartStore.getState().toggleVolumeProfile(); setShowOverflow(false); }}
                  />
                  {!workspaceMode && (
                    <Suspense fallback={null}>
                      <OverflowItem
                        label="Templates"
                        onClick={() => setShowOverflow(false)}
                        custom={
                          <TemplateSelector
                            indicators={indicators}
                            chartType={chartType}
                            onApply={(tpl) => {
                              setIndicators(safeClone(tpl.indicators || [], []));
                              if (tpl.chartType) setChartType(tpl.chartType);
                              setShowOverflow(false);
                            }}
                          />
                        }
                      />
                    </Suspense>
                  )}
                  <OverflowDivider />
                  <OverflowItem
                    label={replayMode ? '⏹ Stop Replay' : '⏮ Replay'}
                    active={replayMode}
                    onClick={() => { toggleReplay(); setShowOverflow(false); }}
                  />
                  <OverflowItem
                    label="⊞ Quad View"
                    active={quadMode}
                    onClick={() => { toggleQuadMode(); setShowOverflow(false); }}
                    disabled={workspaceMode}
                  />
                  <OverflowItem
                    label="◧ Workspace"
                    active={workspaceMode}
                    onClick={() => {
                      const next = !workspaceMode;
                      setWorkspaceMode(next);
                      try { localStorage.setItem('tradeforge-workspace-mode', String(next)); } catch {}
                      setShowOverflow(false);
                    }}
                  />
                  <OverflowDivider />
                  <OverflowItem
                    label={`📜 Scripts${enabledScriptCount > 0 ? ` (${enabledScriptCount})` : ''}`}
                    active={enabledScriptCount > 0}
                    onClick={() => { setShowScriptManager(true); setShowOverflow(false); }}
                  />
                  <OverflowItem
                    label={intelligence.enabled ? '🧠 Intel ON' : '🧠 Intelligence'}
                    active={intelligence.enabled}
                    onClick={() => { useChartStore.getState().toggleIntelligenceMaster(); setShowOverflow(false); }}
                  />
                  <OverflowItem
                    label="📊 Insights Panel"
                    active={showInsights}
                    onClick={() => { setShowInsights(prev => !prev); setShowOverflow(false); }}
                  />
                  <OverflowDivider />
                  <OverflowItem label="↓ Export PNG" onClick={() => { handleExportPNG(); setShowOverflow(false); }} />
                  <OverflowItem label={copyFeedback ? '✓ Copied' : '⎘ Copy'} onClick={() => { handleCopyChart(); setShowOverflow(false); }} />
                  <OverflowItem label="🔗 Share Link" onClick={() => { handleShareURL(); setShowOverflow(false); }} />
                  <OverflowItem label="📤 Post Snapshot" onClick={() => { setShowShareModal(true); setShowOverflow(false); }} />
                </div>
              </>
            )}
          </div>
        )}

        {/* Watchlist toggle */}
        <ToolbarBtn active={showWatchlist} onClick={() => setShowWatchlist(w => !w)} title="Toggle watchlist">
          ★
        </ToolbarBtn>

        {/* Alerts toggle */}
        <ToolbarBtn active={showAlerts} onClick={() => setShowAlerts(a => !a)} title="Price alerts">
          🔔{alertCount > 0 ? ` ${alertCount}` : ''}
        </ToolbarBtn>

        {/* Data Source Badge */}
        <DataSourceBadge
          isLive={isLive}
          wsSupported={wsSupported}
          wsStatus={wsStatus}
          dataSource={dataSource}
          dataLoading={dataLoading}
        />
      </div>

      {/* C2.5: Data warning toast — shown when Yahoo/CoinGecko fails */}
      {!workspaceMode && dataWarning && (
        <div style={{
          padding: '6px 12px',
          background: C.y + '15',
          borderBottom: `1px solid ${C.y}30`,
          color: C.y,
          fontSize: 11,
          fontFamily: M,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          {dataWarning}
          <button
            onClick={() => setDataWarning(null)}
            className="tf-btn"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: C.y, cursor: 'pointer', fontSize: 14, padding: '0 4px',
            }}
          >×</button>
        </div>
      )}

      {/* Live Ticker Bar — only shown for WS-supported symbols */}
      {!workspaceMode && wsSupported && (
        <div style={{
          borderBottom: `1px solid ${C.bd}`,
          background: C.bg,
          flexShrink: 0,
        }}>
          <LiveTicker tick={tick} status={wsStatus} symbol={symbol} />
        </div>
      )}

      {/* Fundamentals Bar — crypto only, auto-fetches */}
      {!workspaceMode && (
        <Suspense fallback={null}>
          <FundamentalsCard symbol={symbol} />
        </Suspense>
      )}

      {/* Sprint 10: Trade Entry Bar */}
      {!workspaceMode && tradeMode && (
        <Suspense fallback={null}>
          <TradeEntryBar />
        </Suspense>
      )}

      {/* Replay Bar */}
      {!workspaceMode && replayMode && (
        <Suspense fallback={null}>
          <ReplayBar />
        </Suspense>
      )}

      {/* ─── Workspace Mode ─────────────────────────────── */}
      {workspaceMode ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={<div style={{ padding: 24, color: C.t3 }}>Loading workspace...</div>}>
            <WorkspaceLayout />
          </Suspense>
        </div>
      ) : (
      /* ─── Classic Chart Mode ──────────────────────────── */
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Drawing Toolbar — desktop only */}
        {!quadMode && !isMobile && <DrawingToolbar />}

        {/* Chart */}
        <div
          style={{ flex: 1, position: 'relative' }}
          onContextMenu={(e) => {
            // Sprint 10: Right-click context menu
            if (isMobile || quadMode) return;
            e.preventDefault();
            // Estimate price from Y position using chart bounds
            const rect = e.currentTarget.getBoundingClientRect();
            const yFrac = (e.clientY - rect.top) / rect.height;
            // We'll use the context menu with approximate price
            // The handleContextMenu will set the menu position
            const chartState = chartRef.current;
            let price = 0;
            if (chartState?.getLayout) {
              const layout = chartState.getLayout();
              if (layout) price = layout.yMax - yFrac * (layout.yMax - layout.yMin);
            }
            handleContextMenu(e, price, 0, null);
          }}
        >
          {quadMode ? (
            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.t3 }}>Loading...</div>}>
              <QuadChart />
            </Suspense>
          ) : isMobile ? (
            /* C6.4: Wrap chart in SwipeChartNav on mobile */
            <Suspense fallback={null}>
              <SwipeChartNav
              watchlist={watchlistSymbols}
              currentSymbol={symbol}
              onSymbolChange={(sym) => { setSymbol(sym); setSymbolInput(sym); }}
            >
              <ChartCanvas
                ref={chartRef}
                data={data}
                chartType={chartType}
                indicators={indicators}
                trades={matchingTrades}
                replayIdx={replayMode ? replayIdx : -1}
                activeGhost={replayMode ? activeGhost : null}
                drawings={drawings}
                drawingsVisible={drawingsVisible}
                showVolumeProfile={showVolumeProfile}
                activeTool={activeTool}
                pendingDrawing={pendingDrawing}
                onDrawingClick={handleDrawingClick}
                scriptOutputs={scriptOutputs}
                comparisonData={comparisonData}
                comparisonSymbol={comparisonSymbol}
                srLevels={intelligence.enabled && intelligence.showSR ? analysis?.levels : null}
                patternMarkers={intelligence.enabled && intelligence.showPatterns ? analysis?.patterns : null}
                divergences={intelligence.enabled && intelligence.showDivergences ? analysis?.divergences : null}
              />
            </SwipeChartNav>
            </Suspense>
          ) : (
            <ChartCanvas
              ref={chartRef}
              data={data}
              chartType={chartType}
              indicators={indicators}
              trades={matchingTrades}
              replayIdx={replayMode ? replayIdx : -1}
              activeGhost={replayMode ? activeGhost : null}
              drawings={drawings}
              drawingsVisible={drawingsVisible}
              showVolumeProfile={showVolumeProfile}
              activeTool={activeTool}
              pendingDrawing={pendingDrawing}
              onDrawingClick={handleDrawingClick}
              scriptOutputs={scriptOutputs}
              comparisonData={comparisonData}
              comparisonSymbol={comparisonSymbol}
              srLevels={intelligence.enabled && intelligence.showSR ? analysis?.levels : null}
              patternMarkers={intelligence.enabled && intelligence.showPatterns ? analysis?.patterns : null}
              divergences={intelligence.enabled && intelligence.showDivergences ? analysis?.divergences : null}
            />
          )}

          {/* C6.1: Mobile Drawing Sheet (bottom sheet) */}
          {isMobile && !quadMode && (
            <Suspense fallback={null}>
              <MobileDrawingSheet />
            </Suspense>
          )}

          {/* Sprint 10: Chart Trade Overlays */}
          <Suspense fallback={null}>
            <PositionSizer />
          </Suspense>
          {showQuickJournal && (
            <Suspense fallback={null}>
              <QuickJournalPanel onClose={toggleQuickJournal} />
            </Suspense>
          )}
          <ChartContextMenu
            menu={contextMenu}
            onClose={closeContextMenu}
            handlers={contextMenuHandlers}
            tradeMode={tradeMode}
            tradeStep={tradeStep}
          />

          {/* C6.6: Mobile floating action buttons (settings + screenshot) */}
          {isMobile && !quadMode && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', gap: 6, zIndex: 400,
            }}>
              <MobileFab
                icon="⚙️"
                onClick={() => setShowMobileSettings(true)}
              />
              <MobileFab
                icon="📸"
                onClick={() => setShowMobileShare(true)}
              />
              <MobileFab
                icon={isLandscapeFullscreen ? '↙' : '⛶'}
                onClick={() => {
                  if (isLandscapeFullscreen) {
                    document.exitFullscreen?.();
                    setIsLandscapeFullscreen(false);
                  } else {
                    const el = document.documentElement;
                    el.requestFullscreen?.();
                    setIsLandscapeFullscreen(true);
                  }
                }}
              />
            </div>
          )}

          {/* Bottom-right chart settings (TradingView-style) — desktop only */}
          {!quadMode && !isMobile && (
            <Suspense fallback={null}>
              <ChartSettingsBar
                onScreenshot={() => {
                  const canvas = chartRef.current?.getCanvas();
                  if (canvas) exportChartPNG(canvas, symbol, tf);
                }}
                onFullscreen={() => {
                  const el = document.querySelector('[role="img"]');
                  if (el?.requestFullscreen) el.requestFullscreen();
                }}
              />
            </Suspense>
          )}
        </div>

        {/* Indicator Panel — full catalog with editable params */}
        {showIndicators && (
          <div
            style={{
              width: isMobile ? '100%' : 220,
              borderLeft: isMobile ? 'none' : `1px solid ${C.bd}`,
              background: C.bg,
              overflowY: 'auto',
              flexShrink: 0,
              ...(isMobile ? {
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                borderLeft: `1px solid ${C.bd}`,
                width: '75%',
                maxWidth: 280,
              } : {}),
            }}
          >
            <IndicatorPanel />
          </div>
        )}

        {/* Watchlist Panel — slide-in */}
        {showWatchlist && !isMobile && (
          <div
            className="tf-slide-right"
            style={{
              width: 200,
              borderLeft: `1px solid ${C.bd}`,
              background: C.bg,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <Suspense fallback={null}>
              <WatchlistPanel compact />
            </Suspense>
          </div>
        )}

        {/* Alerts Panel — slide-in */}
        {showAlerts && !isMobile && (
          <div
            className="tf-slide-right"
            style={{
              width: 240,
              borderLeft: `1px solid ${C.bd}`,
              background: C.bg,
              overflowY: 'auto',
              flexShrink: 0,
            }}
          >
            <Suspense fallback={null}>
              <AlertPanel currentSymbol={symbol} />
            </Suspense>
          </div>
        )}

        {/* C7.7: Intelligence Insights Panel — slide-in */}
        {showInsights && !isMobile && (
          <Suspense fallback={null}>
            <ChartInsightsPanel
              data={data}
              isOpen={showInsights}
              onClose={() => setShowInsights(false)}
              onApplyAutoFib={(fib) => {
                useChartStore.getState().addDrawing(fib);
                useChartStore.getState().setIntelligence('showAutoFib', true);
              }}
              onCreateAlert={(level) => {
                const { addAlert } = useAlertStore.getState();
                addAlert({
                  symbol,
                  condition: level.price > data[data.length - 1]?.close ? 'above' : 'below',
                  price: level.price,
                  note: `[Smart] ${level.type} level with ${level.touches} touches`,
                });
              }}
            />
          </Suspense>
        )}
      </div>
      )}

      {/* ─── Script Editor (Bottom Panel) ──────────── */}
      {!isMobile && (
        <Suspense fallback={null}>
          <ScriptEditor
            ref={editorRef}
            bars={data}
            onResults={setEditorOutputs}
          />
        </Suspense>
      )}

      {/* ─── Script Manager Overlay ────────────────── */}
      <Suspense fallback={null}>
        <ScriptManager
          open={showScriptManager}
          onClose={() => setShowScriptManager(false)}
          onEditScript={(id) => {
            setShowScriptManager(false);
            if (editorRef.current?.openScript) {
              editorRef.current.openScript(id);
            }
          }}
        />
      </Suspense>

      {/* ─── Share Snapshot Modal ──────────────────── */}
      <Suspense fallback={null}>
        <ShareSnapshotModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          chartConfig={{ symbol, tf, chartType, indicators }}
        />
      </Suspense>

      {/* ─── Snapshot Publisher (Ctrl+S) ──────────────── */}
      <Suspense fallback={null}>
        <SnapshotPublisher
          isOpen={showSnapshotPublisher}
          onClose={() => setShowSnapshotPublisher(false)}
          canvas={chartRef.current?.getCanvas()}
          chartInfo={{ symbol, tf, chartType }}
        />
      </Suspense>

      {/* ─── C6.2: Mobile Chart Settings Sheet ──────────── */}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileChartSheet
            isOpen={showMobileSettings}
            onClose={() => setShowMobileSettings(false)}
            onScreenshot={() => {
              setShowMobileSettings(false);
              setShowMobileShare(true);
            }}
            onFullscreen={() => {
              document.documentElement.requestFullscreen?.();
              setIsLandscapeFullscreen(true);
            }}
          />
        </Suspense>
      )}

      {/* ─── C6.5: Mobile Share Sheet ────────────────────── */}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileShareSheet
            isOpen={showMobileShare}
            onClose={() => setShowMobileShare(false)}
            canvas={chartRef.current?.getCanvas()}
            chartInfo={{ symbol, tf, chartType }}
          />
        </Suspense>
      )}

      {/* ─── C6.12: Gesture Guide (first-time mobile) ───── */}
      {isMobile && (
        <Suspense fallback={null}>
          <GestureGuide />
        </Suspense>
      )}
    </div>
  );
}

// ─── Toolbar Sub-components ─────────────────────────────────────

function ToolbarBtn({ children, active, onClick, title, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className="tf-toolbar-btn"
      style={{
        padding: '4px 8px',
        borderRadius: 3,
        border: 'none',
        background: active ? C.b + '25' : 'transparent',
        color: disabled ? C.t3 + '50' : active ? C.b : C.t3,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: F,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.1s',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Sprint 4: Overflow menu item */
function OverflowItem({ label, onClick, active, disabled, custom }) {
  if (custom) return custom;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="tf-btn"
      style={{
        display: 'block', width: '100%',
        padding: '8px 12px',
        background: active ? C.b + '15' : 'transparent',
        border: 'none', borderRadius: 6,
        color: disabled ? C.t3 + '50' : active ? C.b : C.t1,
        fontSize: 12, fontWeight: active ? 600 : 500,
        fontFamily: F, textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

/** Sprint 4: Overflow menu divider */
function OverflowDivider() {
  return <div style={{ height: 1, background: C.bd, margin: '4px 8px' }} />;
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: C.bd, margin: '0 4px' }} />;
}

/** C6.6: Floating action button for mobile chart controls */
function MobileFab({ icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 36, height: 36,
        borderRadius: '50%',
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '20' : C.sf + 'DD',
        color: active ? C.b : C.t2,
        fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        touchAction: 'manipulation',
      }}
    >
      {icon}
    </button>
  );
}

/**
 * C2.1: Data Source Badge
 * Shows the actual data pipeline state:
 *   ● LIVE (green)   — WebSocket streaming real-time
 *   ● DELAYED (blue)  — REST API data (CoinGecko, Yahoo)
 *   ● SIMULATED (orange) — Demo/fallback data
 *   ○ LOADING (gray)  — Fetching in progress
 *
 * C2.5: Stale Data Indicator
 * When WS was connected but disconnected, pulses orange to indicate frozen prices.
 */
function DataSourceBadge({ isLive, wsSupported, wsStatus, dataSource, dataLoading }) {
  // Determine badge state
  let label, color, pulse;

  if (dataLoading) {
    label = 'LOADING';
    color = C.t3;
    pulse = false;
  } else if (isLive) {
    label = '● LIVE';
    color = C.g;
    pulse = false;
  } else if (wsSupported && wsStatus === 'reconnecting') {
    // C2.5: Was live, now reconnecting — stale data indicator
    label = '● STALE';
    color = C.y;
    pulse = true;
  } else if (dataSource === 'coingecko' || dataSource === 'yahoo' || dataSource === 'binance') {
    label = '● DELAYED';
    color = C.info;
    pulse = false;
  } else if (dataSource === 'simulated' || dataSource === 'demo') {
    label = '◌ SIMULATED';
    color = C.y;
    pulse = false;
  } else if (dataSource?.includes(':stale')) {
    label = '● CACHED';
    color = C.p;
    pulse = false;
  } else {
    label = wsSupported ? 'CONNECTING...' : '◌ DEMO';
    color = C.t3;
    pulse = false;
  }

  return (
    <div style={{
      fontSize: 9,
      color: color,
      fontFamily: M,
      padding: '2px 6px',
      background: color + '15',
      borderRadius: 3,
      border: `1px solid ${color}30`,
      fontWeight: 700,
      letterSpacing: '0.5px',
      animation: pulse ? 'tfPulse 1.5s ease-in-out infinite' : 'none',
    }}>
      {label}
      <style>{`
        @keyframes tfPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
