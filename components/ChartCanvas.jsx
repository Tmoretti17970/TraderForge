// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — ChartCanvas.jsx (Backward Compatibility Wrapper)
// Wraps ChartEngineWidget to maintain the old ChartCanvas prop interface.
// All rendering is now handled by the Sprint 1-5 chart engine.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import ChartEngineWidget from './ChartEngineWidget.jsx';
import { useChartStore } from '../state/useChartStore.js';

/**
 * ChartCanvas — Backward-compatible wrapper.
 *
 * The old ChartCanvas accepted data, layout, and drawing state as props.
 * The new ChartEngineWidget manages all of this internally via stores.
 * This wrapper bridges the two interfaces.
 *
 * @param {Object} props - All original ChartCanvas props are accepted but most
 *                         are now handled internally by ChartEngineWidget.
 */
export default function ChartCanvas({
  // Old props (accepted but delegated to engine)
  data,
  startIdx,
  endIdx,
  chartW,
  chartH,
  indicators,
  drawings,
  pendingDrawing,
  activeTool,
  trades,
  chartType,
  candleMode,
  logScale,
  selectedDrawingId,
  intelligence,
  comparisonData,
  comparisonSymbol,
  replayMode,
  replayIdx,
  showVolumeProfile,
  magnetMode,
  orderFlow,
  multiTfOverlay,
  onViewportChange,
  onDrawingComplete,
  onDrawingSelect,
  canvasRef: externalCanvasRef,
  scripts,
  // New/pass-through props
  ...rest
}) {
  // If data is passed directly (from ChartsPage), sync to store
  React.useEffect(() => {
    if (data?.length) {
      const store = useChartStore.getState();
      if (!store.data || store.data.length !== data.length) {
        store.setData(data, 'legacy');
      }
    }
  }, [data]);

  return (
    <ChartEngineWidget
      height="100%"
      width="100%"
      showVolume={true}
      onBarClick={rest.onBarClick}
      onCrosshairMove={rest.onCrosshairMove}
      onEngineReady={(eng) => {
        // Expose canvas ref for chart export
        if (externalCanvasRef) {
          externalCanvasRef.current = eng?.getCanvas?.() || null;
        }
        if (rest.onEngineReady) rest.onEngineReady(eng);
      }}
      {...rest}
    />
  );
}

// Re-export the new widget for direct usage
export { default as ChartEngineWidget } from './ChartEngineWidget.jsx';
