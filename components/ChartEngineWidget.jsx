// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — ChartEngineWidget (Bridge Component)
//
// Wraps the Sprint 1-5 chart engine and connects it to TradeForge's
// existing Zustand stores. Drop-in replacement for the old ChartCanvas.
//
// Reads from:
//   useChartStore  → symbol, timeframe, chartType, indicators, drawings
//   useTradeStore  → trade entries for marker overlay
//   useThemeStore  → dark/light theme
//   useSettingsStore → user preferences
//
// Exposes:
//   engineRef      → direct access for screenshots, programmatic control
//   onBarClick     → callback when user clicks a bar (for trade entry)
//   onCrosshairMove → callback with current price/time (for trade toolbar)
//
// Usage:
//   <ChartEngineWidget
//     height="100%"
//     onBarClick={(price, time) => ...}
//     onCrosshairMove={({price, time, bar}) => ...}
//   />
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useChartStore } from '../state/useChartStore.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useThemeStore } from '../state/useThemeStore.js';

// ─── Chart Engine Imports ────────────────────────────────────────
// These come from the new Sprint 1-5 engine at src/chartEngine/
// CoordinateSystem utilities imported via ChartEngine
import { createFancyCanvas } from '../chartEngine/FancyCanvas.js';
import { createPaneWidget } from '../chartEngine/PaneWidget.js';
import { createChartEngine } from '../chartEngine/ChartEngine.js';
import { createCandlestickRenderer } from '../chartEngine/renderers/CandlestickRenderer.js';
import { createGridCrosshair } from '../chartEngine/renderers/GridCrosshair.js';
import { getChartTypeRenderer } from '../chartEngine/renderers/ChartTypes.js';
import { createVolumeRenderer } from '../chartEngine/renderers/VolumePaneRenderer.js';
import { createPaneLayout } from '../chartEngine/PaneLayout.js';
import { getTheme } from '../chartEngine/ThemeManager.js';
import { createBinanceFeed } from '../chartEngine/feeds/BinanceFeed.js';
import { createDataManager } from '../chartEngine/feeds/DataManager.js';
import { createDrawingEngine } from '../chartEngine/tools/DrawingEngine.js';
import { createDrawingRenderer } from '../chartEngine/tools/DrawingRenderer.js';
import {
  serializeDrawings,
  deserializeDrawings,
} from '../chartEngine/tools/DrawingModel.js';
import {
  createIndicatorInstance,
  INDICATORS,
} from '../chartEngine/indicators/registry.js';
import {
  renderOverlayIndicator,
  renderPaneIndicator,
} from '../chartEngine/indicators/renderer.js';

// ─── Constants ───────────────────────────────────────────────────
const BINANCE_TF_MAP = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1D': '1d', '1d': '1d', '3D': '3d', '1W': '1w', '1w': '1w', '1M': '1M',
};

const SYMBOL_MAP = {
  'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT',
  'BNB': 'BNBUSDT', 'XRP': 'XRPUSDT', 'DOGE': 'DOGEUSDT',
  'ADA': 'ADAUSDT', 'AVAX': 'AVAXUSDT', 'DOT': 'DOTUSDT',
  'MATIC': 'MATICUSDT', 'LINK': 'LINKUSDT', 'UNI': 'UNIUSDT',
  // Futures
  'ES': 'BTCUSDT', 'NQ': 'ETHUSDT', // Fallback mapping for non-crypto
};

/**
 * Resolve a TradeForge symbol to a Binance symbol.
 * If the symbol already ends in USDT/BUSD/BTC, use as-is.
 */
function resolveSymbol(sym) {
  if (!sym) return 'BTCUSDT';
  const upper = sym.toUpperCase();
  if (upper.endsWith('USDT') || upper.endsWith('BUSD') || upper.endsWith('BTC')) return upper;
  return SYMBOL_MAP[upper] || upper + 'USDT';
}

/**
 * Resolve a TradeForge timeframe to a Binance interval.
 */
function resolveTf(tf) {
  return BINANCE_TF_MAP[tf] || '1h';
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

/**
 * ChartEngineWidget — Bridge between new chart engine and TradeForge stores.
 *
 * @param {Object} props
 * @param {string} [props.height='100%']  - Container height
 * @param {string} [props.width='100%']   - Container width
 * @param {Function} [props.onBarClick]   - Callback: (price, time, bar) => void
 * @param {Function} [props.onCrosshairMove] - Callback: ({price, time, bar, x, y}) => void
 * @param {Function} [props.onEngineReady] - Callback: (engineRef) => void
 * @param {string} [props.overrideSymbol]  - Override store symbol (for ChartPane)
 * @param {string} [props.overrideTf]      - Override store timeframe (for ChartPane)
 * @param {Array}  [props.overrideIndicators] - Override store indicators (for ChartPane)
 * @param {boolean} [props.showToolbar=false] - Show drawing toolbar
 * @param {boolean} [props.showVolume=true]   - Show volume overlay
 * @param {boolean} [props.compact=false]     - Compact mode (no axis labels)
 * @param {React.ReactNode} [props.children]  - Overlay elements (trade bars, etc.)
 */
export default function ChartEngineWidget({
  height = '100%',
  width = '100%',
  onBarClick,
  onCrosshairMove,
  onEngineReady,
  overrideSymbol,
  overrideTf,
  overrideIndicators,
  showToolbar = false,
  showVolume = true,
  compact = false,
  children,
}) {
  // ─── Store Connections ───────────────────────────────────────
  const storeSymbol = useChartStore((s) => s.symbol);
  const storeTf = useChartStore((s) => s.tf);
  const storeChartType = useChartStore((s) => s.chartType);
  const storeIndicators = useChartStore((s) => s.indicators);
  const storeLogScale = useChartStore((s) => s.logScale);
  const storeActiveTool = useChartStore((s) => s.activeTool);
  const setStoreData = useChartStore((s) => s.setData);
  const theme = useThemeStore((s) => s.theme);
  const trades = useTradeStore((s) => s.trades);

  // Use overrides if provided (for independent ChartPane instances)
  const symbol = overrideSymbol || storeSymbol;
  const tf = overrideTf || storeTf;
  const indicators = overrideIndicators || storeIndicators;

  // ─── Refs ────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const dataManagerRef = useRef(null);
  const drawingEngineRef = useRef(null);
  const drawingRendererRef = useRef(null);
  const indicatorInstancesRef = useRef([]);
  const barsRef = useRef([]);
  const wsRef = useRef(null);
  const mountedRef = useRef(true);

  // ─── State ───────────────────────────────────────────────────
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [barCount, setBarCount] = useState(0);
  const [activeTool, setActiveTool] = useState(null);
  const [selectedDrawing, setSelectedDrawing] = useState(null);
  const [drawColor, setDrawColor] = useState('#2962FF');

  // ─── Resolve symbols/timeframes ──────────────────────────────
  const binanceSymbol = useMemo(() => resolveSymbol(symbol), [symbol]);
  const binanceTf = useMemo(() => resolveTf(tf), [tf]);

  // ─── Initialize Engine ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    mountedRef.current = true;

    // Create dual canvas
    el.innerHTML = '';
    const mainCanvas = document.createElement('canvas');
    const topCanvas = document.createElement('canvas');

    [mainCanvas, topCanvas].forEach((c, i) => {
      c.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;z-index:${i}`;
      el.appendChild(c);
    });

    const mainCtx = mainCanvas.getContext('2d', { alpha: false });
    const topCtx = topCanvas.getContext('2d');

    // Engine state
    const state = {
      visibleBars: 80,
      scrollOffset: 0,
      mouseX: null,
      mouseY: null,
      hoverIdx: null,
      dragging: false,
      dragStartX: 0,
      dragStartOffset: 0,
      mainDirty: true,
      topDirty: true,
      lastRender: null,
    };

    // Resize handler
    function resize() {
      const pr = devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;

      [mainCanvas, topCanvas].forEach((c) => {
        c.width = Math.round(w * pr);
        c.height = Math.round(h * pr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
      });

      state.mainDirty = true;
      state.topDirty = true;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Store engine ref
    engineRef.current = {
      state,
      mainCanvas,
      topCanvas,
      mainCtx,
      topCtx,
      el,
      ro,
      getCanvas: () => mainCanvas,
      getBars: () => barsRef.current,
      getVisibleRange: () => {
        const bars = barsRef.current;
        const end = bars.length - 1 - state.scrollOffset + 5;
        const start = Math.max(0, Math.floor(end - state.visibleBars + 1));
        return { start, end: Math.min(bars.length - 1, Math.floor(end)) };
      },
      markDirty: () => { state.mainDirty = true; state.topDirty = true; },
    };

    if (onEngineReady) onEngineReady(engineRef.current);

    // Cleanup
    return () => {
      mountedRef.current = false;
      ro.disconnect();
      el.innerHTML = '';
      engineRef.current = null;
    };
  }, []); // Mount once

  // ─── Data Loading ────────────────────────────────────────────
  useEffect(() => {
    if (!engineRef.current) return;
    let cancelled = false;

    setStatus('loading');
    barsRef.current = [];
    engineRef.current.state.scrollOffset = 0;

    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    (async () => {
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceTf}&limit=500`;
        const res = await fetch(url);
        const data = await res.json();

        if (cancelled) return;

        const bars = data.map((k) => ({
          time: k[0],
          open: +k[1],
          high: +k[2],
          low: +k[3],
          close: +k[4],
          volume: +k[5],
        }));

        barsRef.current = bars;
        setBarCount(bars.length);
        setStatus('ready');

        // Sync to global store
        setStoreData(bars, 'binance');

        // Mark engine dirty
        if (engineRef.current) {
          engineRef.current.state.mainDirty = true;
          engineRef.current.state.topDirty = true;
        }

        // WebSocket for live updates
        const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@kline_${binanceTf}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(evt.data);
            if (msg.e === 'kline' && msg.k) {
              const k = msg.k;
              const bar = {
                time: k.t,
                open: +k.o,
                high: +k.h,
                low: +k.l,
                close: +k.c,
                volume: +k.v,
              };

              const prev = barsRef.current;
              if (!prev.length) return;

              const last = prev[prev.length - 1];
              if (last.time === bar.time) {
                // Update current bar
                const next = [...prev];
                next[next.length - 1] = bar;
                barsRef.current = next;
              } else {
                // New bar
                barsRef.current = [...prev, bar];
              }

              setBarCount(barsRef.current.length);

              if (engineRef.current) {
                engineRef.current.state.mainDirty = true;
                engineRef.current.state.topDirty = true;
              }
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => { if (!cancelled) setStatus('ready'); };
        ws.onclose = () => { wsRef.current = null; };
      } catch (err) {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [binanceSymbol, binanceTf]);

  // ─── Compute Indicators ──────────────────────────────────────
  useEffect(() => {
    const bars = barsRef.current;
    if (!bars.length || !indicators?.length) {
      indicatorInstancesRef.current = [];
      return;
    }

    const instances = indicators.map((ind) => {
      // Support both old format {type, params, color} and new {indicatorId, params}
      const id = ind.indicatorId || ind.type;
      if (!INDICATORS[id]) return null;

      const instance = createIndicatorInstance(id, ind.params || {});

      // Apply color override if provided
      if (ind.color && instance.outputs[0]) {
        instance.outputs[0].color = ind.color;
      }

      instance.compute(bars);
      return instance;
    }).filter(Boolean);

    indicatorInstancesRef.current = instances;

    if (engineRef.current) {
      engineRef.current.state.mainDirty = true;
    }
  }, [indicators, barCount]);

  // ─── Render Loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!engineRef.current) return;
    let raf;

    function render() {
      raf = requestAnimationFrame(render);

      const eng = engineRef.current;
      if (!eng) return;

      const { state: S, mainCtx: mCtx, topCtx: tCtx, mainCanvas, topCanvas } = eng;
      const bars = barsRef.current;

      if (!bars.length) return;

      // ─── Main Canvas ──────────────────────────────────
      if (S.mainDirty) {
        S.mainDirty = false;
        const pr = devicePixelRatio || 1;
        const bw = mainCanvas.width;
        const bh = mainCanvas.height;
        const mw = bw / pr;
        const mh = bh / pr;
        const thm = getTheme(theme === 'light' ? 'light' : 'dark');

        const axW = compact ? 0 : 72;
        const txH = compact ? 0 : 24;
        const cW = mw - axW;
        const mainH = mh - txH;

        // Viewport calc
        const end = bars.length - 1 - S.scrollOffset + 5;
        const start = Math.max(0, Math.floor(end - S.visibleBars + 1));
        const vis = bars.slice(start, Math.min(bars.length, Math.floor(end) + 1));
        const bSp = cW / S.visibleBars;

        let lo = Infinity, hi = -Infinity;
        for (const b of vis) {
          if (b.low < lo) lo = b.low;
          if (b.high > hi) hi = b.high;
        }

        const rng = hi - lo || 1;
        const pad = rng * 0.06;
        const yMin = lo - pad;
        const yMax = hi + pad;
        const p2y = (p) => mainH - ((p - yMin) / (yMax - yMin)) * mainH;

        // Background
        mCtx.fillStyle = thm.bg;
        mCtx.fillRect(0, 0, bw, bh);

        // Store render info
        S.lastRender = { start, end: Math.floor(end), vis, bSp, p2y, yMin, yMax, cW, mainH, axW, txH, thm, pr };

        // Grid
        const cBW = Math.round(cW * pr);
        const mainBH = Math.round(mainH * pr);
        mCtx.save();
        mCtx.beginPath();
        mCtx.rect(0, 0, cBW, mainBH);
        mCtx.clip();

        // Grid lines
        const niceStep = niceScale(yMin, yMax, Math.floor(mainH / 50));
        mCtx.fillStyle = thm.gridLine || 'rgba(54,58,69,0.3)';
        for (const t of niceStep.ticks) {
          const y = Math.round(p2y(t) * pr);
          mCtx.fillRect(0, y, cBW, Math.max(1, pr));
        }

        // Volume
        if (showVolume) {
          let mV = 0;
          for (const b of vis) if ((b.volume || 0) > mV) mV = b.volume;
          if (mV > 0) {
            const vH = mainH * 0.12;
            const vbw = Math.max(1, Math.floor(bSp * 0.7));
            for (let ps = 0; ps < 2; ps++) {
              mCtx.fillStyle = ps === 0
                ? (thm.bullVolume || 'rgba(38,166,154,0.2)')
                : (thm.bearVolume || 'rgba(239,83,80,0.2)');
              for (let i = 0; i < vis.length; i++) {
                const b = vis[i];
                if ((b.close >= b.open) !== (ps === 0)) continue;
                const vP = (b.volume || 0) / mV;
                const vHp = Math.max(1, Math.round(vH * vP * pr));
                const x = Math.round((i + 0.5) * bSp * pr);
                const bx = x - Math.floor(vbw * pr / 2);
                mCtx.fillRect(bx, mainBH - vHp, Math.max(1, Math.floor(vbw * pr)), vHp);
              }
            }
          }
        }

        // Candles
        const bodyW = candleBodyWidth(bSp);
        for (let ps = 0; ps < 2; ps++) {
          // Wicks
          mCtx.fillStyle = ps === 0 ? (thm.bullCandle || '#26A69A') : (thm.bearCandle || '#EF5350');
          for (let i = 0; i < vis.length; i++) {
            const b = vis[i];
            if ((b.close >= b.open) !== (ps === 0)) continue;
            const x = Math.round((i + 0.5) * bSp * pr);
            const hY = Math.round(p2y(b.high) * pr);
            const lY = Math.round(p2y(b.low) * pr);
            const ww = Math.max(1, Math.round(pr));
            mCtx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));
          }
        }
        for (let ps = 0; ps < 2; ps++) {
          // Bodies
          mCtx.fillStyle = ps === 0 ? (thm.bullCandle || '#26A69A') : (thm.bearCandle || '#EF5350');
          for (let i = 0; i < vis.length; i++) {
            const b = vis[i];
            if ((b.close >= b.open) !== (ps === 0)) continue;
            const x = Math.round((i + 0.5) * bSp * pr);
            const oY = Math.round(p2y(b.open) * pr);
            const cY = Math.round(p2y(b.close) * pr);
            const tp = Math.min(oY, cY);
            const h = Math.max(1, Math.max(oY, cY) - tp);
            const bw2 = Math.max(1, Math.floor(bodyW * pr));
            mCtx.fillRect(x - Math.floor(bw2 / 2), tp, bw2, h);
          }
        }

        // Overlay indicators
        const overlayInds = indicatorInstancesRef.current.filter((i) => i.mode === 'overlay');
        for (const ind of overlayInds) {
          renderOverlayIndicator(mCtx, ind, {
            startIdx: start,
            endIdx: Math.min(Math.floor(end), bars.length - 1),
            barSpacing: bSp,
            priceToY: p2y,
            pixelRatio: pr,
            bitmapWidth: bw,
            bitmapHeight: mainBH,
          });
        }

        // Trade markers
        if (trades?.length) {
          renderTradeMarkers(mCtx, trades, symbol, bars, start, Math.floor(end), bSp, p2y, pr);
        }

        // Price line
        const last = bars[bars.length - 1];
        if (last) {
          const yB = Math.round(p2y(last.close) * pr);
          mCtx.strokeStyle = last.close >= last.open ? (thm.bullCandle || '#26A69A') : (thm.bearCandle || '#EF5350');
          mCtx.lineWidth = Math.max(1, pr);
          mCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
          mCtx.beginPath();
          mCtx.moveTo(0, yB + 0.5);
          mCtx.lineTo(cBW, yB + 0.5);
          mCtx.stroke();
          mCtx.setLineDash([]);
        }

        mCtx.restore();

        // Price axis
        if (!compact) {
          const axX = cBW;
          mCtx.fillStyle = thm.axisBg || '#1E222D';
          mCtx.fillRect(axX, 0, bw - axX, mainBH);
          const fs = Math.round(11 * pr);
          mCtx.font = `${fs}px Arial`;
          mCtx.textAlign = 'right';
          mCtx.textBaseline = 'middle';
          mCtx.fillStyle = thm.axisText || '#787B86';
          const axP = Math.round(8 * pr);
          for (const t of niceStep.ticks) {
            mCtx.fillText(formatPrice(t), bw - axP, Math.round(p2y(t) * pr));
          }

          // Current price badge
          if (last) {
            const y = Math.round(p2y(last.close) * pr);
            const bH = Math.round(18 * pr);
            mCtx.fillStyle = last.close >= last.open ? (thm.bullCandle || '#26A69A') : (thm.bearCandle || '#EF5350');
            mCtx.fillRect(axX, y - bH / 2, bw - axX, bH);
            mCtx.fillStyle = '#fff';
            mCtx.font = `bold ${fs}px Arial`;
            mCtx.fillText(formatPrice(last.close), bw - axP, y);
          }

          // Time axis
          const tY = mainBH;
          mCtx.fillStyle = thm.axisBg || '#1E222D';
          mCtx.fillRect(0, tY, bw, bh - tY);
        }
      }

      // ─── Top Canvas (Crosshair) ──────────────────────
      if (S.topDirty) {
        S.topDirty = false;
        const pr = devicePixelRatio || 1;
        tCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);

        const R = S.lastRender;
        if (!R) return;

        // Crosshair
        if (S.mouseX !== null && S.mouseY !== null) {
          const bx = Math.round(S.mouseX * pr);
          const by = Math.round(S.mouseY * pr);
          const cBW = Math.round(R.cW * pr);
          const mainBH = Math.round(R.mainH * pr);

          tCtx.strokeStyle = 'rgba(149,152,161,0.5)';
          tCtx.lineWidth = Math.max(1, Math.round(pr));
          tCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
          tCtx.beginPath();
          tCtx.moveTo(0, by + 0.5);
          tCtx.lineTo(cBW, by + 0.5);
          tCtx.stroke();
          tCtx.beginPath();
          tCtx.moveTo(bx + 0.5, 0);
          tCtx.lineTo(bx + 0.5, topCanvas.height);
          tCtx.stroke();
          tCtx.setLineDash([]);
        }

        // OHLCV legend
        const lb = S.hoverIdx != null ? bars[S.hoverIdx] : bars[bars.length - 1];
        if (lb) {
          const fs = Math.round(12 * pr);
          const sfs = Math.round(11 * pr);
          const x = Math.round(8 * pr);
          let y = Math.round(6 * pr);
          const bull = lb.close >= lb.open;
          const vc = bull ? (R.thm.bullCandle || '#26A69A') : (R.thm.bearCandle || '#EF5350');

          tCtx.font = `bold ${fs}px Arial`;
          tCtx.fillStyle = R.thm.textPrimary || '#D1D4DC';
          tCtx.textAlign = 'left';
          tCtx.textBaseline = 'top';
          tCtx.fillText(`${symbol}  ${tf}`, x, y);
          y += Math.round(16 * pr);

          tCtx.font = `${sfs}px Arial`;
          let ox = x;
          for (const [l, v] of [
            ['O', formatPrice(lb.open)],
            ['H', formatPrice(lb.high)],
            ['L', formatPrice(lb.low)],
            ['C', formatPrice(lb.close)],
          ]) {
            tCtx.fillStyle = R.thm.textSecondary || '#787B86';
            tCtx.fillText(l, ox, y);
            ox += tCtx.measureText(l).width + Math.round(2 * pr);
            tCtx.fillStyle = vc;
            tCtx.fillText(v, ox, y);
            ox += tCtx.measureText(v).width + Math.round(8 * pr);
          }

          // Overlay indicator values in legend
          const overlayInds = indicatorInstancesRef.current.filter((i) => i.mode === 'overlay');
          if (overlayInds.length) {
            y += Math.round(16 * pr);
            tCtx.font = `${Math.round(10 * pr)}px Arial`;
            for (const ind of overlayInds) {
              if (!ind.computed) continue;
              ox = x;
              tCtx.fillStyle = R.thm.textSecondary || '#787B86';
              const lbl = ind.label + ' ';
              tCtx.fillText(lbl, ox, y);
              ox += tCtx.measureText(lbl).width;

              for (const output of ind.outputs) {
                const vals = ind.computed[output.key];
                if (!vals) continue;
                const idx = S.hoverIdx != null ? S.hoverIdx : bars.length - 1;
                const val = idx < vals.length ? vals[idx] : NaN;
                if (isNaN(val)) continue;
                tCtx.fillStyle = output.color;
                const txt = formatPrice(val);
                tCtx.fillText(txt, ox, y);
                ox += tCtx.measureText(txt).width + Math.round(8 * pr);
              }
              y += Math.round(14 * pr);
            }
          }
        }
      }
    }

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [theme, symbol, tf, showVolume, compact, barCount, trades, indicators]);

  // ─── Mouse Interaction ───────────────────────────────────────
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const tc = eng.topCanvas;

    function getPos(e) {
      const r = tc.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function onMouseMove(e) {
      const pos = getPos(e);
      const S = eng.state;
      const R = S.lastRender;
      if (!R) return;

      S.mouseX = pos.x;
      S.mouseY = pos.y;

      const ri = Math.round(pos.x / R.bSp - 0.5);
      S.hoverIdx = Math.max(0, Math.min(barsRef.current.length - 1, R.start + ri));

      if (S.dragging) {
        S.scrollOffset = Math.max(0, Math.round(S.dragStartOffset + (e.clientX - S.dragStartX) / R.bSp));
        S.mainDirty = true;
      }

      S.topDirty = true;

      // Callback
      if (onCrosshairMove && S.hoverIdx != null) {
        const bar = barsRef.current[S.hoverIdx];
        if (bar) {
          const price = R.yMin + ((R.mainH - pos.y) / R.mainH) * (R.yMax - R.yMin);
          onCrosshairMove({ price, time: bar.time, bar, x: pos.x, y: pos.y });
        }
      }
    }

    function onMouseLeave() {
      eng.state.mouseX = null;
      eng.state.mouseY = null;
      eng.state.hoverIdx = null;
      eng.state.dragging = false;
      tc.style.cursor = 'crosshair';
      eng.state.topDirty = true;
    }

    function onMouseDown(e) {
      if (e.button !== 0) return;
      eng.state.dragging = true;
      eng.state.dragStartX = e.clientX;
      eng.state.dragStartOffset = eng.state.scrollOffset;
      tc.style.cursor = 'grabbing';
    }

    function onMouseUp(e) {
      const wasDrag = eng.state.dragging;
      eng.state.dragging = false;
      tc.style.cursor = 'crosshair';

      // Click (not drag) → bar click callback
      if (!wasDrag) return;
      const moved = Math.abs(e.clientX - eng.state.dragStartX);
      if (moved < 3 && onBarClick && eng.state.hoverIdx != null) {
        const R = eng.state.lastRender;
        if (R) {
          const pos = getPos(e);
          const price = R.yMin + ((R.mainH - pos.y) / R.mainH) * (R.yMax - R.yMin);
          const bar = barsRef.current[eng.state.hoverIdx];
          if (bar) onBarClick(price, bar.time, bar);
        }
      }
    }

    function onWheel(e) {
      e.preventDefault();
      const d = Math.sign(e.deltaY);
      eng.state.visibleBars = Math.max(10, Math.min(2000, Math.round(eng.state.visibleBars * (1 + d * 0.15))));
      eng.state.mainDirty = true;
      eng.state.topDirty = true;
    }

    tc.style.cursor = 'crosshair';
    tc.addEventListener('mousemove', onMouseMove);
    tc.addEventListener('mouseleave', onMouseLeave);
    tc.addEventListener('mousedown', onMouseDown);
    tc.addEventListener('mouseup', onMouseUp);
    tc.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      tc.removeEventListener('mousemove', onMouseMove);
      tc.removeEventListener('mouseleave', onMouseLeave);
      tc.removeEventListener('mousedown', onMouseDown);
      tc.removeEventListener('mouseup', onMouseUp);
      tc.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onBarClick, onCrosshairMove]);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width, height, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Status overlay */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#787B86', fontSize: 13, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 16, height: 16,
            border: '2px solid #363A45', borderTopColor: '#2962FF',
            borderRadius: '50%', animation: 'spin .8s linear infinite',
          }} />
          Loading {symbol}...
        </div>
      )}

      {status === 'error' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#EF5350', fontSize: 13, zIndex: 10,
        }}>
          Failed to load data for {symbol}
        </div>
      )}

      {/* Overlay children (trade bars, etc.) */}
      {children}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════

function formatPrice(p) {
  const a = Math.abs(p);
  if (a >= 10000) return p.toFixed(0);
  if (a >= 1) return p.toFixed(2);
  if (a >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

function candleBodyWidth(spacing) {
  if (spacing < 0.5) return 1;
  if (spacing < 4) return Math.max(1, Math.floor(spacing * (1 - (spacing - 0.5) * 0.085)));
  return Math.max(1, Math.floor(spacing * (0.7 + 0.1 * (2 / Math.PI) * Math.atan((spacing - 4) * 0.3))));
}

function niceScale(min, max, maxTicks = 8) {
  const range = max - min || 1;
  const rough = range / maxTicks;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let nice;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 3.5) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  const step = nice * mag;
  const nMin = Math.floor(min / step) * step;
  const nMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = nMin; v <= nMax + step * 0.5; v += step) {
    if (v >= min - step * 0.01 && v <= max + step * 0.01) {
      ticks.push(Math.round(v * 1e10) / 1e10);
    }
  }
  return { min: nMin, max: nMax, ticks };
}

/**
 * Render trade entry/exit markers on the chart.
 * Reads from useTradeStore format.
 */
function renderTradeMarkers(ctx, trades, symbol, bars, startIdx, endIdx, bSp, p2y, pr) {
  const symUpper = symbol.toUpperCase();
  const matchingTrades = trades.filter((t) => {
    const ts = (t.symbol || '').toUpperCase();
    return ts === symUpper || ts === symUpper + 'USDT' || ts.includes(symUpper);
  });

  if (!matchingTrades.length) return;

  const timeMap = new Map();
  bars.forEach((b, i) => timeMap.set(b.time, i));

  for (const trade of matchingTrades) {
    const entryTime = trade.entryTime || trade.openTime;
    const exitTime = trade.exitTime || trade.closeTime;
    const entryPrice = trade.entryPrice || trade.openPrice;
    const exitPrice = trade.exitPrice || trade.closePrice;
    const isWin = (exitPrice - entryPrice) * (trade.side === 'short' ? -1 : 1) > 0;

    // Find closest bar index for entry
    let entryIdx = -1, exitIdx = -1;
    if (entryTime) {
      for (let i = 0; i < bars.length; i++) {
        if (Math.abs(bars[i].time - entryTime) < 60000 * 5) { entryIdx = i; break; }
      }
    }
    if (exitTime) {
      for (let i = 0; i < bars.length; i++) {
        if (Math.abs(bars[i].time - exitTime) < 60000 * 5) { exitIdx = i; break; }
      }
    }

    // Entry arrow (▲ for long, ▼ for short)
    if (entryIdx >= startIdx && entryIdx <= endIdx && entryPrice) {
      const x = Math.round((entryIdx - startIdx + 0.5) * bSp * pr);
      const y = Math.round(p2y(entryPrice) * pr);
      const isLong = trade.side !== 'short';

      ctx.fillStyle = isLong ? '#26A69A' : '#EF5350';
      ctx.beginPath();
      const s = Math.round(6 * pr);
      if (isLong) {
        ctx.moveTo(x, y - s);
        ctx.lineTo(x - s, y + s);
        ctx.lineTo(x + s, y + s);
      } else {
        ctx.moveTo(x, y + s);
        ctx.lineTo(x - s, y - s);
        ctx.lineTo(x + s, y - s);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Exit marker (×)
    if (exitIdx >= startIdx && exitIdx <= endIdx && exitPrice) {
      const x = Math.round((exitIdx - startIdx + 0.5) * bSp * pr);
      const y = Math.round(p2y(exitPrice) * pr);

      ctx.strokeStyle = isWin ? '#26A69A' : '#EF5350';
      ctx.lineWidth = Math.round(2 * pr);
      const s = Math.round(5 * pr);
      ctx.beginPath();
      ctx.moveTo(x - s, y - s);
      ctx.lineTo(x + s, y + s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s, y - s);
      ctx.lineTo(x - s, y + s);
      ctx.stroke();
    }

    // Connecting line
    if (entryIdx >= 0 && exitIdx >= 0 && entryPrice && exitPrice) {
      const x1 = Math.round((entryIdx - startIdx + 0.5) * bSp * pr);
      const y1 = Math.round(p2y(entryPrice) * pr);
      const x2 = Math.round((exitIdx - startIdx + 0.5) * bSp * pr);
      const y2 = Math.round(p2y(exitPrice) * pr);

      ctx.strokeStyle = isWin ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)';
      ctx.lineWidth = Math.max(1, pr);
      ctx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
