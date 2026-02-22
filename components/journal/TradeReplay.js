// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.5 — Trade Replay Launcher
// Sprint 9 C9.2: Click a trade in journal → chart opens at entry bar
// with trade overlay, entry/exit markers, and optional replay mode.
//
// Integrates with: useChartStore, navigateToTrade, ReplayBar
// ═══════════════════════════════════════════════════════════════════

import { useUIStore } from '../../state/useUIStore.js';
import { useChartStore } from '../../state/useChartStore.js';
import { C } from '../../constants.js';

/**
 * Navigate to chart and set up replay at trade's entry point.
 * @param {Object} trade - Trade object with symbol, date, entry, exit, side
 * @param {Object} opts
 * @param {boolean} opts.replayMode - Start in replay mode (default false)
 * @param {boolean} opts.highlightTrade - Highlight this trade on chart (default true)
 */
export function launchTradeReplay(trade, opts = {}) {
  const { replayMode = false, highlightTrade = true } = opts;
  const store = useChartStore.getState();
  const ui = useUIStore.getState();

  // 1. Switch to chart page
  ui.setPage('charts');

  // 2. Set symbol and timeframe
  if (trade.symbol) {
    store.setSymbol(trade.symbol.toUpperCase());
  }

  // Infer timeframe from trade duration
  if (trade.entryTime && trade.exitTime) {
    const durMs = new Date(trade.exitTime) - new Date(trade.entryTime);
    const durMin = durMs / 60000;
    if (durMin < 30) store.setTf('1');
    else if (durMin < 120) store.setTf('5');
    else if (durMin < 480) store.setTf('15');
    else store.setTf('D');
  }

  // 3. Set highlighted trade
  if (highlightTrade) {
    store.setHighlightedTradeId?.(trade.id);
  }

  // 4. Optionally enter replay mode at entry bar
  if (replayMode && store.toggleReplay) {
    // Delay to let chart data load
    setTimeout(() => {
      const data = store.data || [];
      if (!data.length) return;

      // Find bar closest to entry time
      const entryDate = new Date(trade.entryTime || trade.date);
      let bestIdx = 0;
      let bestDiff = Infinity;

      for (let i = 0; i < data.length; i++) {
        const barDate = new Date(data[i].timestamp || data[i].date);
        const diff = Math.abs(barDate - entryDate);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      // Start replay 20 bars before entry
      const startIdx = Math.max(0, bestIdx - 20);

      if (!store.replayMode) store.toggleReplay();
      store.setReplayIdx(startIdx);
    }, 500);
  }
}

/**
 * Build entry/exit drawing markers for a trade.
 * Returns drawing objects that can be added to the chart.
 * @param {Object} trade
 * @returns {Array} Drawing objects
 */
export function buildTradeDrawings(trade) {
  const drawings = [];

  if (trade.entry) {
    drawings.push({
      id: `trade-entry-${trade.id}`,
      type: 'hlevel',
      points: [{ price: trade.entry, barIdx: 0 }],
      color: trade.side === 'long' ? C.g : C.r,
      label: `Entry ${trade.entry}`,
      visible: true,
      auto: true,
    });
  }

  if (trade.exit) {
    drawings.push({
      id: `trade-exit-${trade.id}`,
      type: 'hlevel',
      points: [{ price: trade.exit, barIdx: 0 }],
      color: trade.side === 'long' ? C.r : C.g,
      label: `Exit ${trade.exit}`,
      visible: true,
      auto: true,
    });
  }

  if (trade.stopLoss) {
    drawings.push({
      id: `trade-sl-${trade.id}`,
      type: 'hlevel',
      points: [{ price: trade.stopLoss, barIdx: 0 }],
      color: C.r,
      label: `SL ${trade.stopLoss}`,
      visible: true,
      auto: true,
    });
  }

  if (trade.takeProfit) {
    drawings.push({
      id: `trade-tp-${trade.id}`,
      type: 'hlevel',
      points: [{ price: trade.takeProfit, barIdx: 0 }],
      color: C.g,
      label: `TP ${trade.takeProfit}`,
      visible: true,
      auto: true,
    });
  }

  return drawings;
}

export default launchTradeReplay;
