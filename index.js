// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Chart Engine
// Public API surface
// ═══════════════════════════════════════════════════════════════════

// Core engine
export { createChartEngine } from './ChartEngine.js';

// React wrapper
export { default as ChartWidget } from './ChartWidget.jsx';

// Coordinate system (for drawing tools, indicators, custom renderers)
export {
  mediaToBitmap,
  bitmapToMedia,
  mediaWidthToBitmap,
  positionsLine,
  positionsBox,
  createPriceTransform,
  createTimeTransform,
  candleWidthCoefficient,
  candleBodyWidth,
  candleWickWidth,
  visiblePriceRange,
  niceScale,
  formatPrice,
  formatTimeLabel,
} from './CoordinateSystem.js';

// Canvas management
export { createFancyCanvas } from './FancyCanvas.js';

// Pane widget
export { createPaneWidget } from './PaneWidget.js';

// Renderers
export {
  createCandlestickRenderer,
  createLineRenderer,
  createVolumeRenderer,
  toHeikinAshi,
  DEFAULT_CANDLE_THEME,
} from './renderers/CandlestickRenderer.js';

export {
  createGridRenderer,
  createCrosshairRenderer,
  drawPriceLabel,
  drawOHLCVLegend,
} from './renderers/GridCrosshair.js';

// Data feeds
export { RESOLUTION_MS, normalizeResolution } from './feeds/DataFeed.js';
export { createBinanceFeed } from './feeds/BinanceFeed.js';
export { createDataManager } from './feeds/DataManager.js';
export { createLRUCache, CACHE_TTL, getTTLForResolution } from './feeds/LRUCache.js';
export { useChartData } from './feeds/useChartData.js';

// Multi-pane layout
export { createPaneLayout, DEFAULT_PANE_CONFIGS } from './PaneLayout.js';

// Theme system
export { createThemeManager, DARK_THEME, LIGHT_THEME } from './ThemeManager.js';

// Chart types
export {
  CHART_TYPES,
  getChartDrawFunction,
  getChartTypeList,
  drawCandlesticks,
  drawHollowCandles,
  drawHeikinAshi,
  drawOHLCBars,
  drawLineChart,
  drawAreaChart,
  drawBaselineChart,
} from './renderers/ChartTypes.js';

// Volume pane
export { createVolumePaneRenderer } from './renderers/VolumePaneRenderer.js';

// Drawing tools
export {
  createDrawing,
  generateId,
  DEFAULT_STYLES,
  FIB_LEVELS,
  FIB_COLORS,
  TOOL_POINT_COUNT,
  serializeDrawings,
  deserializeDrawings,
} from './tools/DrawingModel.js';
export { createDrawingEngine } from './tools/DrawingEngine.js';
export { createDrawingRenderer } from './tools/DrawingRenderer.js';

// Indicators
export * as IndicatorMath from './indicators/computations.js';
export {
  INDICATORS,
  getIndicator,
  getOverlayIndicators,
  getPaneIndicators,
  getAllIndicators,
  createIndicatorInstance,
} from './indicators/registry.js';
export {
  renderOverlayIndicator,
  renderPaneIndicator,
} from './indicators/renderer.js';

// UI components
export { default as SymbolSearch } from './ui/SymbolSearch.jsx';
export { default as TimeframeSwitcher } from './ui/TimeframeSwitcher.jsx';
export { default as ConnectionStatus } from './ui/ConnectionStatus.jsx';
export { default as DrawingToolbar } from './ui/DrawingToolbar.jsx';
