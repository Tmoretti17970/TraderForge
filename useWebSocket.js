// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — useWebSocket Hook
//
// Bridges the WebSocketService singleton into React.
// Manages subscription lifecycle, live candle updates, and ticker state.
//
// When a kline message arrives:
//   - If NOT closed: update the last bar in chartStore.data in-place
//   - If closed: append the finalized bar, start new current bar
//
// Usage:
//   const { tick, wsStatus, isLive } = useWebSocket(symbol, tf);
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback } from 'react';
import { wsService, WS_STATUS, WebSocketService } from '../data/WebSocketService.js';
import { useChartStore } from '../state/useChartStore.js';

/**
 * @param {string} symbol - TradeForge symbol (e.g., 'BTC')
 * @param {string} tf - TradeForge timeframe ID (e.g., '1d')
 * @returns {{ tick: Object|null, wsStatus: string, isLive: boolean }}
 */
export default function useWebSocket(symbol, tf) {
  const [tick, setTick] = useState(null);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.DISCONNECTED);

  // Track whether we've received the first kline to avoid updating stale data
  const liveBarRef = useRef(null); // current open bar's start time (ISO)

  const onCandle = useCallback((candle) => {
    const store = useChartStore.getState();
    const currentData = store.data;
    if (!currentData?.length) return;

    if (candle.isClosed) {
      // ─── Candle closed: finalize and append ─────────────────
      const lastBar = currentData[currentData.length - 1];
      const lastTime = lastBar?.time;

      // Update the last bar to final values if it matches
      if (lastTime === candle.time) {
        const updated = [...currentData];
        updated[updated.length - 1] = {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        };
        store.setData(updated, 'binance:live');
      } else {
        // Candle for a new time slot we haven't seen — append it
        const newBar = {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        };
        store.setData([...currentData, newBar], 'binance:live');
      }
      liveBarRef.current = null; // reset — next update starts a new bar
    } else {
      // ─── Candle still open: update last bar in-place ────────
      const lastBar = currentData[currentData.length - 1];

      if (lastBar?.time === candle.time) {
        // Same bar — update OHLCV
        const updated = [...currentData];
        updated[updated.length - 1] = {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        };
        store.setData(updated, 'binance:live');
      } else if (liveBarRef.current !== candle.time) {
        // New bar opened — append it
        liveBarRef.current = candle.time;
        const newBar = {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        };
        store.setData([...currentData, newBar], 'binance:live');
      }
    }
  }, []);

  const onTick = useCallback((tickData) => {
    setTick(tickData);
  }, []);

  const onStatus = useCallback((status) => {
    setWsStatus(status);
  }, []);

  useEffect(() => {
    // Only subscribe for supported crypto symbols
    if (!WebSocketService.isSupported(symbol)) {
      setWsStatus(WS_STATUS.DISCONNECTED);
      setTick(null);
      return;
    }

    wsService.subscribe(symbol, tf, {
      onCandle,
      onTick,
      onStatus,
    });

    return () => {
      wsService.unsubscribe();
      liveBarRef.current = null;
    };
  }, [symbol, tf, onCandle, onTick, onStatus]);

  return {
    tick,
    wsStatus,
    isLive: wsStatus === WS_STATUS.CONNECTED,
  };
}
