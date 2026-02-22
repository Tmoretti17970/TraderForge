// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — useChartData Hook
// One-liner React integration: connects BinanceFeed → DataManager → ChartEngine
//
// Usage:
//   const { status, switchSymbol, switchTimeframe, searchSymbols } =
//     useChartData(engineRef, 'BTCUSDT', '1h');
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { createBinanceFeed } from './BinanceFeed.js';
import { createDataManager } from './DataManager.js';

/**
 * @typedef {Object} ChartDataState
 * @property {boolean}  loading      - Currently loading data
 * @property {string}   status       - 'idle'|'loading'|'ready'|'error'|'loading_more'
 * @property {string}   feedStatus   - WebSocket status
 * @property {string|null} error     - Error message if any
 * @property {string}   symbol       - Current symbol
 * @property {string}   resolution   - Current timeframe
 */

/**
 * React hook that connects a ChartEngine to live Binance data.
 *
 * @param {Object|null} engine       - ChartEngine instance (from onEngineReady)
 * @param {string}      initialSymbol - Starting symbol (e.g. 'BTCUSDT')
 * @param {string}      initialResolution - Starting timeframe (e.g. '1h')
 * @param {Object}      [options]
 * @param {number}      [options.initialBars=300]
 * @param {number}      [options.scrollThreshold=20]
 * @returns {Object} Hook state and controls
 */
export function useChartData(engine, initialSymbol = 'BTCUSDT', initialResolution = '1h', options = {}) {
  const [state, setState] = useState({
    loading: false,
    status: 'idle',
    feedStatus: 'disconnected',
    error: null,
    symbol: initialSymbol,
    resolution: initialResolution,
  });

  const managerRef = useRef(null);
  const feedRef = useRef(null);

  // ── Initialize feed + manager when engine is ready ──
  useEffect(() => {
    if (!engine) return;

    // Create feed
    const feed = createBinanceFeed({
      onEvent(event, data) {
        if (event === 'error') {
          console.warn('[BinanceFeed]', data?.error?.message || event);
        }
      },
    });
    feedRef.current = feed;

    // Create data manager
    const manager = createDataManager(engine, feed, {
      initialBars: options.initialBars || 300,
      scrollThreshold: options.scrollThreshold || 20,
    });
    managerRef.current = manager;

    // Listen for state changes
    manager.onStateChange(({ loading, status, error }) => {
      setState(prev => ({
        ...prev,
        loading,
        status,
        error: error || null,
        feedStatus: feed.getStatus(),
        symbol: manager.symbol,
        resolution: manager.resolution,
      }));
    });

    // Load initial symbol
    manager.load(initialSymbol, initialResolution);

    // Set up scroll-based lazy loading
    // Poll visible range every 500ms (lightweight check)
    const scrollInterval = setInterval(() => {
      manager.checkScroll();
    }, 500);

    return () => {
      clearInterval(scrollInterval);
      manager.dispose();
      feed.dispose();
      managerRef.current = null;
      feedRef.current = null;
    };
  }, [engine]); // Only re-run when engine instance changes

  // ── Symbol switch ──
  const switchSymbol = useCallback(async (symbol) => {
    const manager = managerRef.current;
    if (!manager) return;
    await manager.switchSymbol(symbol);
  }, []);

  // ── Timeframe switch ──
  const switchTimeframe = useCallback(async (resolution) => {
    const manager = managerRef.current;
    if (!manager) return;
    await manager.switchTimeframe(resolution);
  }, []);

  // ── Symbol search ──
  const searchSymbols = useCallback(async (query) => {
    const manager = managerRef.current;
    if (!manager) return [];
    return manager.searchSymbols(query);
  }, []);

  // ── Load more history manually ──
  const loadMore = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.loadMore();
  }, []);

  return {
    ...state,
    switchSymbol,
    switchTimeframe,
    searchSymbols,
    loadMore,
    manager: managerRef.current,
    feed: feedRef.current,
  };
}
