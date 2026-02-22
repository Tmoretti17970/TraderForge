// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — ChartWidget (React Wrapper)
// Drop-in React component wrapping the framework-independent ChartEngine.
//
// The engine manages its own DOM and canvases — React only handles:
//   - Lifecycle (mount/unmount)
//   - Prop changes → engine updates
//   - Container ref
//
// Usage:
//   <ChartWidget
//     data={ohlcvBars}
//     symbol="BTCUSDT"
//     timeframe="1h"
//     theme="dark"
//     onBarClick={(bar, idx) => { ... }}
//   />
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { createChartEngine } from './ChartEngine.js';

/**
 * @param {Object} props
 * @param {Array} props.data         - OHLCV bars array
 * @param {string} [props.symbol]    - Ticker symbol
 * @param {string} [props.timeframe] - Current timeframe
 * @param {string} [props.theme]     - 'dark' | 'light'
 * @param {string} [props.scaleMode] - 'linear' | 'log' | 'percentage'
 * @param {number} [props.visibleBars] - Number of visible bars
 * @param {boolean} [props.showVolume] - Show volume histogram
 * @param {Object} [props.style]     - Container style overrides
 * @param {string} [props.className] - Container className
 * @param {Function} [props.onEngineReady] - Callback with engine instance
 */
export default function ChartWidget({
  data,
  symbol = '',
  timeframe = '1h',
  theme = 'dark',
  scaleMode = 'linear',
  visibleBars,
  showVolume = true,
  style,
  className,
  onEngineReady,
}) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);

  // ── Mount: create engine ──
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = createChartEngine(containerRef.current, {
      theme,
      showVolume,
    });

    engineRef.current = engine;

    if (onEngineReady) {
      onEngineReady(engine);
    }

    // ── Cleanup on unmount ──
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Mount only once

  // ── Data updates ──
  useEffect(() => {
    if (!engineRef.current || !data) return;
    engineRef.current.setData(data);
  }, [data]);

  // ── Symbol updates ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setSymbol(symbol);
  }, [symbol]);

  // ── Timeframe updates ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setTimeframe(timeframe);
  }, [timeframe]);

  // ── Theme updates ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setTheme(theme);
  }, [theme]);

  // ── Scale mode updates ──
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setScaleMode(scaleMode);
  }, [scaleMode]);

  // ── Visible bars updates ──
  useEffect(() => {
    if (!engineRef.current || visibleBars == null) return;
    engineRef.current.setVisibleBars(visibleBars);
  }, [visibleBars]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '300px',
        ...style,
      }}
    />
  );
}
