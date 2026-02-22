// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.6 — Chart Trade Handler Hook
// Sprint 10 C10.8: Connects chart canvas clicks to trade entry
// workflow. Handles entry/SL/TP placement and context menu.
//
// Sprint 11 fix: Use getState() for action functions to avoid
// subscribing to entire store (prevents infinite re-render loops).
// ═══════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useChartTradeStore } from '../../state/useChartTradeStore.js';
import { useAlertStore } from '../../state/useAlertStore.js';
import { useChartStore } from '../../state/useChartStore.js';
import toast from '../Toast.jsx';

/**
 * Hook providing chart click handlers for trade mode.
 * @returns {Object} handlers for chart events
 */
export function useChartTradeHandler() {
  // Only subscribe to the values we read during render
  const tradeMode = useChartTradeStore((s) => s.tradeMode);
  const tradeStep = useChartTradeStore((s) => s.tradeStep);
  const addAlert = useAlertStore((s) => s.addAlert);
  const symbol = useChartStore((s) => s.symbol);

  /**
   * Handle left-click on chart canvas.
   * In trade mode: set entry → SL → TP sequentially.
   */
  const handleChartClick = useCallback((price, barIdx) => {
    if (!tradeMode) return false;

    const actions = useChartTradeStore.getState();
    switch (tradeStep) {
      case 'entry':
        actions.setEntry(price, barIdx);
        toast.info(`Entry set @ $${price.toFixed(2)}`);
        return true;
      case 'sl':
        actions.setSL(price, barIdx);
        toast.info(`Stop Loss set @ $${price.toFixed(2)}`);
        return true;
      case 'tp':
        actions.setTP(price, barIdx);
        toast.info(`Target set @ $${price.toFixed(2)}`);
        return true;
      default:
        return false;
    }
  }, [tradeMode, tradeStep]);

  /**
   * Handle right-click on chart canvas → open context menu.
   */
  const handleContextMenu = useCallback((e, price, barIdx, date) => {
    e.preventDefault();
    useChartTradeStore.getState().setContextMenu({
      x: e.clientX,
      y: e.clientY,
      price,
      barIdx,
      date,
    });
  }, []);

  /**
   * Context menu action handlers.
   */
  const contextMenuHandlers = {
    onSetEntry: (price, barIdx) => {
      const a = useChartTradeStore.getState();
      if (!a.tradeMode) a.enterTradeMode('long');
      a.setEntry(price, barIdx);
      toast.info(`Entry set @ $${price.toFixed(2)}`);
    },
    onSetSL: (price, barIdx) => {
      useChartTradeStore.getState().setSL(price, barIdx);
      toast.info(`Stop Loss set @ $${price.toFixed(2)}`);
    },
    onSetTP: (price, barIdx) => {
      useChartTradeStore.getState().setTP(price, barIdx);
      toast.info(`Target set @ $${price.toFixed(2)}`);
    },
    onLongEntry: (price, barIdx) => {
      const a = useChartTradeStore.getState();
      a.enterTradeMode('long');
      a.setEntry(price, barIdx);
      toast.info(`Long entry set @ $${price.toFixed(2)} — click to set SL`);
    },
    onShortEntry: (price, barIdx) => {
      const a = useChartTradeStore.getState();
      a.enterTradeMode('short');
      a.setEntry(price, barIdx);
      toast.info(`Short entry set @ $${price.toFixed(2)} — click to set SL`);
    },
    onAddAlert: (price) => {
      if (addAlert) {
        addAlert({ symbol, condition: 'cross_above', price });
        toast.success(`Alert set @ $${price.toFixed(2)}`);
      }
    },
    onQuickJournal: () => {
      useChartTradeStore.getState().toggleQuickJournal();
    },
    onCopyPrice: (price) => {
      navigator.clipboard?.writeText(price.toFixed(2));
      toast.info(`$${price.toFixed(2)} copied`);
    },
    onExitTradeMode: () => {
      useChartTradeStore.getState().exitTradeMode();
      toast.info('Trade mode cancelled');
    },
  };

  return {
    handleChartClick,
    handleContextMenu,
    contextMenuHandlers,
  };
}
