// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — ChartEngine
// The main orchestrator for the charting system.
//
// Responsibilities:
//   - Viewport state (scroll position, zoom level, visible range)
//   - requestAnimationFrame render loop with dirty-flag batching
//   - Mouse/touch interaction (scroll, zoom, crosshair)
//   - Renderer coordination (grid → candles → indicators → crosshair)
//   - Data management (bars array, live updates)
//
// Usage:
//   const engine = createChartEngine(containerDiv);
//   engine.setData(ohlcvBars);
//   engine.setSymbol('BTCUSDT');
//   // Engine handles everything else automatically
// ═══════════════════════════════════════════════════════════════════

import { createPaneWidget } from './PaneWidget.js';
import {
  createPriceTransform,
  createTimeTransform,
  visiblePriceRange,
  niceScale,
  formatPrice,
  formatTimeLabel,
  mediaToBitmap,
  positionsLine,
  candleBodyWidth,
} from './CoordinateSystem.js';
import { createCandlestickRenderer, createVolumeRenderer } from './renderers/CandlestickRenderer.js';
import { createGridRenderer, createCrosshairRenderer, drawOHLCVLegend } from './renderers/GridCrosshair.js';


// ═══════════════════════════════════════════════════════════════════
// Theme
// ═══════════════════════════════════════════════════════════════════

const DARK_THEME = {
  background: '#131722',
  axisBackground: '#1E222D',
  textPrimary: '#D1D4DC',
  textSecondary: '#787B86',
  gridColor: 'rgba(54, 58, 69, 0.3)',
  crosshairColor: 'rgba(149, 152, 161, 0.5)',
  candleUp: '#26A69A',
  candleDown: '#EF5350',
  volumeUp: 'rgba(38, 166, 154, 0.3)',
  volumeDown: 'rgba(239, 83, 80, 0.3)',
  currentPriceUp: '#26A69A',
  currentPriceDown: '#EF5350',
};

const LIGHT_THEME = {
  background: '#FFFFFF',
  axisBackground: '#F8F9FD',
  textPrimary: '#131722',
  textSecondary: '#787B86',
  gridColor: 'rgba(0, 0, 0, 0.06)',
  crosshairColor: 'rgba(0, 0, 0, 0.3)',
  candleUp: '#26A69A',
  candleDown: '#EF5350',
  volumeUp: 'rgba(38, 166, 154, 0.2)',
  volumeDown: 'rgba(239, 83, 80, 0.2)',
  currentPriceUp: '#26A69A',
  currentPriceDown: '#EF5350',
};


// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  axisWidth: 72,             // Price axis width in CSS px
  timeAxisHeight: 24,        // Time axis height in CSS px
  defaultVisibleBars: 80,    // Initial visible bar count
  minVisibleBars: 10,        // Minimum visible bars (max zoom in)
  maxVisibleBars: 2000,      // Maximum visible bars (max zoom out)
  rightPadding: 5,           // Empty bars on right edge
  scrollSpeed: 1.0,          // Scroll sensitivity multiplier
  zoomSpeed: 0.15,           // Zoom sensitivity (fraction per wheel tick)
  crosshairMagnet: true,     // Snap crosshair to candle OHLC
  showVolume: true,          // Show volume histogram on main pane
  volumeHeightPct: 0.15,     // Volume takes 15% of main pane height
  theme: 'dark',
};


// ═══════════════════════════════════════════════════════════════════
// ChartEngine Factory
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new ChartEngine instance.
 *
 * @param {HTMLElement} container - DOM element to render into
 * @param {Partial<typeof DEFAULT_CONFIG>} [config]
 * @returns {Object} ChartEngine instance
 */
export function createChartEngine(container, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let theme = cfg.theme === 'light' ? LIGHT_THEME : DARK_THEME;

  // ── State ──
  let bars = [];                    // Full OHLCV dataset
  let symbol = '';
  let timeframe = '1h';
  let scrollOffset = 0;            // Bars scrolled from right edge
  let visibleBarCount = cfg.defaultVisibleBars;
  let scaleMode = 'linear';        // 'linear' | 'log' | 'percentage'

  // Crosshair state
  let mouseX = null;               // CSS pixels (null = cursor outside chart)
  let mouseY = null;
  let hoveredBarIdx = null;        // Index into bars[] that crosshair snaps to

  // Interaction state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let pinchStartDist = 0;
  let pinchStartBars = 0;

  // Render loop
  let rafId = null;
  let disposed = false;

  // ── DOM Structure ──
  // Layout:  [chart pane] [price axis]
  //          [time axis ] [corner    ]
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = theme.background;

  const chartArea = document.createElement('div');
  chartArea.style.position = 'absolute';
  chartArea.style.top = '0';
  chartArea.style.left = '0';
  chartArea.style.right = cfg.axisWidth + 'px';
  chartArea.style.bottom = cfg.timeAxisHeight + 'px';
  chartArea.style.overflow = 'hidden';
  container.appendChild(chartArea);

  const priceAxisArea = document.createElement('div');
  priceAxisArea.style.position = 'absolute';
  priceAxisArea.style.top = '0';
  priceAxisArea.style.right = '0';
  priceAxisArea.style.width = cfg.axisWidth + 'px';
  priceAxisArea.style.bottom = cfg.timeAxisHeight + 'px';
  priceAxisArea.style.backgroundColor = theme.axisBackground;
  priceAxisArea.style.borderLeft = '1px solid ' + theme.gridColor;
  container.appendChild(priceAxisArea);

  const timeAxisArea = document.createElement('div');
  timeAxisArea.style.position = 'absolute';
  timeAxisArea.style.bottom = '0';
  timeAxisArea.style.left = '0';
  timeAxisArea.style.right = cfg.axisWidth + 'px';
  timeAxisArea.style.height = cfg.timeAxisHeight + 'px';
  timeAxisArea.style.backgroundColor = theme.axisBackground;
  timeAxisArea.style.borderTop = '1px solid ' + theme.gridColor;
  container.appendChild(timeAxisArea);

  // ── Create pane with dual canvases ──
  const mainPane = createPaneWidget(chartArea, { isMainPane: true });

  // ── Create axis canvases ──
  const priceAxisCanvas = document.createElement('canvas');
  priceAxisCanvas.style.width = '100%';
  priceAxisCanvas.style.height = '100%';
  priceAxisCanvas.style.display = 'block';
  priceAxisArea.appendChild(priceAxisCanvas);
  const priceAxisCtx = priceAxisCanvas.getContext('2d');

  const timeAxisCanvas = document.createElement('canvas');
  timeAxisCanvas.style.width = '100%';
  timeAxisCanvas.style.height = '100%';
  timeAxisCanvas.style.display = 'block';
  timeAxisArea.appendChild(timeAxisCanvas);
  const timeAxisCtx = timeAxisCanvas.getContext('2d');

  // ── Create renderers ──
  const candleRenderer = createCandlestickRenderer({
    upColor: theme.candleUp,
    downColor: theme.candleDown,
    upWickColor: theme.candleUp,
    downWickColor: theme.candleDown,
    fillBody: true,
  });
  const volumeRenderer = createVolumeRenderer({
    upColor: theme.volumeUp,
    downColor: theme.volumeDown,
  });
  const gridRenderer = createGridRenderer({ color: theme.gridColor });
  const crosshairRenderer = createCrosshairRenderer({ lineColor: theme.crosshairColor });


  // ═══════════════════════════════════════════════════════════════
  // Viewport Calculations
  // ═══════════════════════════════════════════════════════════════

  /** Calculate the visible bar index range */
  function getVisibleRange() {
    const totalBars = bars.length;
    if (totalBars === 0) return { start: 0, end: 0, count: 0 };

    const endIdx = totalBars - 1 - scrollOffset + cfg.rightPadding;
    const startIdx = endIdx - visibleBarCount + 1;

    return {
      start: Math.max(0, Math.floor(startIdx)),
      end: Math.min(totalBars - 1, Math.floor(endIdx)),
      count: visibleBarCount,
    };
  }

  /** Get the bar spacing in CSS pixels */
  function getBarSpacing() {
    const { mediaWidth } = mainPane.size;
    return mediaWidth / visibleBarCount;
  }

  /** Get the visible bars slice */
  function getVisibleBars() {
    const range = getVisibleRange();
    return bars.slice(range.start, range.end + 1);
  }


  // ═══════════════════════════════════════════════════════════════
  // Main Render Functions
  // ═══════════════════════════════════════════════════════════════

  /** Register the main canvas renderer */
  mainPane.addMainRenderer((ctx, size) => {
    if (bars.length === 0) return;

    const { bitmapWidth, bitmapHeight, pixelRatio } = size;
    const range = getVisibleRange();
    const visibleBars = bars.slice(range.start, range.end + 1);
    if (visibleBars.length === 0) return;

    const barSpacing = getBarSpacing();

    // Price range
    const priceRange = visiblePriceRange(visibleBars);
    const scale = niceScale(priceRange.min, priceRange.max, Math.floor(size.mediaHeight / 50));
    const { priceToY } = createPriceTransform(
      scale.min, scale.max, size.mediaHeight, scaleMode === 'log'
    );

    // ── Background ──
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, bitmapWidth, bitmapHeight);

    // ── Time ticks for vertical grid lines ──
    const xTicks = computeTimeTicks(visibleBars, range.start, barSpacing, range.start, size.mediaWidth);

    // ── Grid ──
    gridRenderer.draw(ctx, {
      yTicks: scale.ticks,
      xTicks: xTicks.map(t => t.x),
      priceToY,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    });

    // ── Volume (if enabled, drawn behind candles) ──
    if (cfg.showVolume) {
      // Volume takes bottom portion of the chart
      const volHeight = bitmapHeight * cfg.volumeHeightPct;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, bitmapHeight - volHeight, bitmapWidth, volHeight);
      ctx.clip();

      // Create a sub-context for volume rendering at bottom
      volumeRenderer.draw(ctx, {
        bars: visibleBars,
        startIdx: range.start,
        barSpacing,
        firstVisibleIdx: range.start,
        pixelRatio,
        bitmapWidth,
        bitmapHeight: volHeight,
      });
      ctx.restore();
    }

    // ── Candlesticks ──
    candleRenderer.draw(ctx, {
      bars: visibleBars,
      startIdx: range.start,
      barSpacing,
      firstVisibleIdx: range.start,
      priceToY,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    });

    // ── Current price line ──
    const lastBar = bars[bars.length - 1];
    if (lastBar && range.end >= bars.length - 1) {
      const lastY = priceToY(lastBar.close);
      const lastYBitmap = mediaToBitmap(lastY, pixelRatio);
      const isBull = lastBar.close >= lastBar.open;

      ctx.strokeStyle = isBull ? theme.currentPriceUp : theme.currentPriceDown;
      ctx.lineWidth = Math.max(1, Math.round(pixelRatio));
      ctx.setLineDash([Math.round(4 * pixelRatio), Math.round(4 * pixelRatio)]);
      ctx.beginPath();
      ctx.moveTo(0, lastYBitmap + 0.5);
      ctx.lineTo(bitmapWidth, lastYBitmap + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Store computed values for price axis and crosshair
    mainPane._lastRender = {
      scale,
      priceToY,
      barSpacing,
      range,
      visibleBars,
      xTicks,
    };
  });

  /** Register the top canvas renderer (crosshair + legend) */
  mainPane.addTopRenderer((ctx, size) => {
    const { bitmapWidth, bitmapHeight, pixelRatio } = size;
    const render = mainPane._lastRender;
    if (!render) return;

    // ── Crosshair ──
    crosshairRenderer.draw(ctx, {
      x: mouseX,
      y: mouseY,
      pixelRatio,
      bitmapWidth,
      bitmapHeight,
    });

    // ── OHLCV Legend ──
    const legendBar = hoveredBarIdx != null ? bars[hoveredBarIdx] : bars[bars.length - 1];
    drawOHLCVLegend(ctx, {
      bar: legendBar,
      symbol,
      timeframe,
      formatPrice,
      pixelRatio,
    });
  });


  // ═══════════════════════════════════════════════════════════════
  // Axis Rendering
  // ═══════════════════════════════════════════════════════════════

  function renderPriceAxis() {
    const render = mainPane._lastRender;
    if (!render) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const rect = priceAxisArea.getBoundingClientRect();
    const w = Math.round(rect.width * pixelRatio);
    const h = Math.round(rect.height * pixelRatio);

    if (priceAxisCanvas.width !== w || priceAxisCanvas.height !== h) {
      priceAxisCanvas.width = w;
      priceAxisCanvas.height = h;
      priceAxisCanvas.style.width = rect.width + 'px';
      priceAxisCanvas.style.height = rect.height + 'px';
    }

    const ctx = priceAxisCtx;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = theme.axisBackground;
    ctx.fillRect(0, 0, w, h);

    // Price tick labels
    const fontSize = Math.round(11 * pixelRatio);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = theme.textSecondary;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const padding = Math.round(8 * pixelRatio);

    for (const tick of render.scale.ticks) {
      const yMedia = render.priceToY(tick);
      const y = Math.round(yMedia * pixelRatio);
      ctx.fillText(formatPrice(tick), w - padding, y);
    }

    // Current price badge
    const lastBar = bars[bars.length - 1];
    if (lastBar) {
      const yMedia = render.priceToY(lastBar.close);
      const y = Math.round(yMedia * pixelRatio);
      const isBull = lastBar.close >= lastBar.open;
      const badgeH = Math.round(18 * pixelRatio);
      const badgeColor = isBull ? theme.currentPriceUp : theme.currentPriceDown;

      ctx.fillStyle = badgeColor;
      ctx.fillRect(0, y - badgeH / 2, w, badgeH);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.fillText(formatPrice(lastBar.close), w - padding, y);
    }

    // Crosshair price label
    if (mouseY !== null && render.priceToY) {
      const { yToPrice } = createPriceTransform(
        render.scale.min, render.scale.max, rect.height, scaleMode === 'log'
      );
      const price = yToPrice(mouseY);
      const y = Math.round(mouseY * pixelRatio);
      const badgeH = Math.round(18 * pixelRatio);

      ctx.fillStyle = theme.textSecondary;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, y - badgeH / 2, w, badgeH);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${fontSize}px Arial`;
      ctx.fillText(formatPrice(price), w - padding, y);
    }
  }

  function renderTimeAxis() {
    const render = mainPane._lastRender;
    if (!render) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const rect = timeAxisArea.getBoundingClientRect();
    const w = Math.round(rect.width * pixelRatio);
    const h = Math.round(rect.height * pixelRatio);

    if (timeAxisCanvas.width !== w || timeAxisCanvas.height !== h) {
      timeAxisCanvas.width = w;
      timeAxisCanvas.height = h;
      timeAxisCanvas.style.width = rect.width + 'px';
      timeAxisCanvas.style.height = rect.height + 'px';
    }

    const ctx = timeAxisCtx;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = theme.axisBackground;
    ctx.fillRect(0, 0, w, h);

    const fontSize = Math.round(11 * pixelRatio);
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = theme.textSecondary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const tick of render.xTicks) {
      const x = Math.round(tick.x * pixelRatio);
      ctx.fillText(tick.label, x, h / 2);
    }

    // Crosshair time label
    if (mouseX !== null && hoveredBarIdx != null && bars[hoveredBarIdx]) {
      const bar = bars[hoveredBarIdx];
      if (bar.time) {
        const x = Math.round(mouseX * pixelRatio);
        const label = formatTimeLabel(bar.time, timeframe);
        const tw = ctx.measureText(label).width;
        const badgeW = tw + Math.round(12 * pixelRatio);
        const badgeH = h - Math.round(4 * pixelRatio);

        ctx.fillStyle = theme.textSecondary;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x - badgeW / 2, (h - badgeH) / 2, badgeW, badgeH);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, x, h / 2);
      }
    }
  }

  /** Compute time axis tick positions */
  function computeTimeTicks(visibleBars, startIdx, barSpacing, firstVisibleIdx, chartWidth) {
    const ticks = [];
    if (visibleBars.length === 0) return ticks;

    // Target: one label every ~100px
    const labelInterval = Math.max(1, Math.ceil(100 / barSpacing));

    for (let i = 0; i < visibleBars.length; i += labelInterval) {
      const bar = visibleBars[i];
      if (!bar || !bar.time) continue;

      const barIdx = startIdx + i;
      const x = (barIdx - firstVisibleIdx + 0.5) * barSpacing;

      if (x >= 0 && x <= chartWidth) {
        ticks.push({
          x,
          label: formatTimeLabel(bar.time, timeframe),
          time: bar.time,
        });
      }
    }

    return ticks;
  }


  // ═══════════════════════════════════════════════════════════════
  // Render Loop
  // ═══════════════════════════════════════════════════════════════

  function renderLoop() {
    if (disposed) return;

    // Paint pane canvases (only if dirty)
    const painted = mainPane.paint();

    // Always repaint axes when main painted or crosshair moved
    if (painted || mainPane.isTopDirty) {
      renderPriceAxis();
      renderTimeAxis();
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  // Start the render loop
  rafId = requestAnimationFrame(renderLoop);


  // ═══════════════════════════════════════════════════════════════
  // Mouse / Touch Interaction
  // ═══════════════════════════════════════════════════════════════

  function getChartRect() {
    return chartArea.getBoundingClientRect();
  }

  function onMouseMove(e) {
    const rect = getChartRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    // Snap to nearest bar
    const barSpacing = getBarSpacing();
    const range = getVisibleRange();
    const relIdx = Math.round(mouseX / barSpacing - 0.5);
    hoveredBarIdx = range.start + relIdx;
    hoveredBarIdx = Math.max(0, Math.min(bars.length - 1, hoveredBarIdx));

    // Magnet mode: snap Y to nearest OHLC value
    if (cfg.crosshairMagnet && hoveredBarIdx != null && bars[hoveredBarIdx]) {
      const render = mainPane._lastRender;
      if (render) {
        const bar = bars[hoveredBarIdx];
        const prices = [bar.open, bar.high, bar.low, bar.close];
        let closestDist = Infinity;
        let closestY = mouseY;

        for (const p of prices) {
          const py = render.priceToY(p);
          const dist = Math.abs(py - mouseY);
          if (dist < closestDist && dist < 20) { // 20px magnet radius
            closestDist = dist;
            closestY = py;
          }
        }
        mouseY = closestY;
      }
    }

    if (isDragging) {
      const dx = e.clientX - dragStartX;
      const barsMoved = dx / barSpacing;
      scrollOffset = Math.max(0, Math.round(dragStartOffset + barsMoved));
      mainPane.invalidateAll();
    }

    mainPane.invalidateTop();
  }

  function onMouseLeave() {
    mouseX = null;
    mouseY = null;
    hoveredBarIdx = null;
    isDragging = false;
    mainPane.invalidateTop();
  }

  function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    isDragging = true;
    dragStartX = e.clientX;
    dragStartOffset = scrollOffset;
    chartArea.style.cursor = 'grabbing';
  }

  function onMouseUp() {
    isDragging = false;
    chartArea.style.cursor = 'crosshair';
  }

  function onWheel(e) {
    e.preventDefault();

    const delta = Math.sign(e.deltaY);
    const zoomFactor = 1 + delta * cfg.zoomSpeed;

    const newCount = Math.round(visibleBarCount * zoomFactor);
    visibleBarCount = Math.max(cfg.minVisibleBars, Math.min(cfg.maxVisibleBars, newCount));

    mainPane.invalidateAll();
  }

  // Touch support
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      isDragging = true;
      dragStartX = touch.clientX;
      dragStartOffset = scrollOffset;
    } else if (e.touches.length === 2) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      pinchStartBars = visibleBarCount;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const rect = getChartRect();
      const barSpacing = getBarSpacing();

      // Scroll
      const dx = touch.clientX - dragStartX;
      const barsMoved = dx / barSpacing;
      scrollOffset = Math.max(0, Math.round(dragStartOffset + barsMoved));

      // Crosshair
      mouseX = touch.clientX - rect.left;
      mouseY = touch.clientY - rect.top;

      mainPane.invalidateAll();
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = pinchStartDist / dist;

      const newCount = Math.round(pinchStartBars * ratio);
      visibleBarCount = Math.max(cfg.minVisibleBars, Math.min(cfg.maxVisibleBars, newCount));

      mainPane.invalidateAll();
    }
  }

  function onTouchEnd() {
    isDragging = false;
    mouseX = null;
    mouseY = null;
    mainPane.invalidateTop();
  }

  // ── Attach event listeners ──
  chartArea.style.cursor = 'crosshair';
  chartArea.addEventListener('mousemove', onMouseMove);
  chartArea.addEventListener('mouseleave', onMouseLeave);
  chartArea.addEventListener('mousedown', onMouseDown);
  chartArea.addEventListener('mouseup', onMouseUp);
  chartArea.addEventListener('wheel', onWheel, { passive: false });
  chartArea.addEventListener('touchstart', onTouchStart, { passive: true });
  chartArea.addEventListener('touchmove', onTouchMove, { passive: false });
  chartArea.addEventListener('touchend', onTouchEnd);

  // Also listen on window for mouseup (in case drag ends outside chart)
  window.addEventListener('mouseup', onMouseUp);


  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  const engine = {
    // ── Data ──

    /**
     * Set the full OHLCV dataset.
     * @param {Array<{time:number, open:number, high:number, low:number, close:number, volume?:number}>} data
     */
    setData(data) {
      bars = data || [];
      scrollOffset = 0;
      mainPane.invalidateAll();
    },

    /**
     * Append a new bar or update the last bar (for real-time streaming).
     * @param {{time:number, open:number, high:number, low:number, close:number, volume?:number}} bar
     */
    updateBar(bar) {
      if (bars.length === 0) {
        bars.push(bar);
      } else {
        const lastBar = bars[bars.length - 1];
        if (lastBar.time === bar.time) {
          // Update existing bar
          bars[bars.length - 1] = bar;
        } else {
          // New bar
          bars.push(bar);
        }
      }
      mainPane.invalidateMain();
      mainPane.invalidateTop(); // Update legend
    },

    /**
     * Prepend historical bars (for lazy loading on scroll-left).
     * @param {Array} olderBars
     */
    prependBars(olderBars) {
      if (!olderBars || olderBars.length === 0) return;
      bars = [...olderBars, ...bars];
      // Adjust scroll offset to maintain visual position
      scrollOffset += olderBars.length;
      mainPane.invalidateAll();
    },

    /** Get the current bar count */
    get barCount() { return bars.length; },

    /** Get all bars */
    get bars() { return bars; },

    // ── Symbol / Timeframe ──

    setSymbol(s) {
      symbol = s;
      mainPane.invalidateTop();
    },

    setTimeframe(tf) {
      timeframe = tf;
      mainPane.invalidateAll();
    },

    get symbol() { return symbol; },
    get timeframe() { return timeframe; },

    // ── Viewport ──

    setVisibleBars(count) {
      visibleBarCount = Math.max(cfg.minVisibleBars, Math.min(cfg.maxVisibleBars, count));
      mainPane.invalidateAll();
    },

    scrollTo(barIndex) {
      scrollOffset = Math.max(0, bars.length - 1 - barIndex);
      mainPane.invalidateAll();
    },

    scrollToEnd() {
      scrollOffset = 0;
      mainPane.invalidateAll();
    },

    get visibleRange() { return getVisibleRange(); },
    get barSpacing() { return getBarSpacing(); },

    // ── Scale Mode ──

    setScaleMode(mode) {
      scaleMode = mode; // 'linear' | 'log' | 'percentage'
      mainPane.invalidateAll();
    },

    // ── Theme ──

    setTheme(themeName) {
      theme = themeName === 'light' ? LIGHT_THEME : DARK_THEME;
      container.style.backgroundColor = theme.background;
      priceAxisArea.style.backgroundColor = theme.axisBackground;
      timeAxisArea.style.backgroundColor = theme.axisBackground;

      candleRenderer.setTheme({
        upColor: theme.candleUp,
        downColor: theme.candleDown,
        upWickColor: theme.candleUp,
        downWickColor: theme.candleDown,
      });
      gridRenderer.setTheme({ color: theme.gridColor });
      crosshairRenderer.setTheme({ lineColor: theme.crosshairColor });

      mainPane.invalidateAll();
    },

    // ── Pane Access (for adding custom renderers) ──

    get mainPane() { return mainPane; },

    /**
     * Add a custom renderer to the main canvas.
     * Receives the same context and size as built-in renderers.
     * @param {Function} renderer
     * @returns {Function} Unregister function
     */
    addRenderer(renderer) {
      return mainPane.addMainRenderer(renderer);
    },

    /**
     * Add a custom renderer to the top (overlay) canvas.
     * @param {Function} renderer
     * @returns {Function} Unregister function
     */
    addOverlayRenderer(renderer) {
      return mainPane.addTopRenderer(renderer);
    },

    // ── Coordinate access (for drawing tools, indicators) ──

    /**
     * Get the price transform for the current viewport.
     * Useful for drawing tools and indicators that need to convert
     * between price and pixel coordinates.
     */
    getPriceTransform() {
      const render = mainPane._lastRender;
      if (!render) return null;
      return createPriceTransform(
        render.scale.min, render.scale.max,
        mainPane.size.mediaHeight, scaleMode === 'log'
      );
    },

    /**
     * Get the time transform for the current viewport.
     */
    getTimeTransform() {
      const range = getVisibleRange();
      return createTimeTransform(range.start, getBarSpacing());
    },

    /**
     * Convert a price/time coordinate to pixel position.
     * Used by drawing tools.
     */
    priceTimeToPixel(price, time) {
      const render = mainPane._lastRender;
      if (!render) return null;

      const y = render.priceToY(price);

      // Find bar index for this time
      let barIdx = -1;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].time >= time) {
          barIdx = i;
          break;
        }
      }
      if (barIdx === -1) barIdx = bars.length - 1;

      const range = getVisibleRange();
      const barSpacing = getBarSpacing();
      const x = (barIdx - range.start + 0.5) * barSpacing;

      return { x, y };
    },

    /** Force a full redraw */
    invalidate() {
      mainPane.invalidateAll();
    },

    // ── Cleanup ──

    dispose() {
      if (disposed) return;
      disposed = true;

      if (rafId) cancelAnimationFrame(rafId);

      chartArea.removeEventListener('mousemove', onMouseMove);
      chartArea.removeEventListener('mouseleave', onMouseLeave);
      chartArea.removeEventListener('mousedown', onMouseDown);
      chartArea.removeEventListener('mouseup', onMouseUp);
      chartArea.removeEventListener('wheel', onWheel);
      chartArea.removeEventListener('touchstart', onTouchStart);
      chartArea.removeEventListener('touchmove', onTouchMove);
      chartArea.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);

      mainPane.dispose();

      // Clear container
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    },
  };

  return engine;
}
