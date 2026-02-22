// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Alert Store
//
// Price alert system: "Alert when AAPL > $200"
// - Persisted to localStorage (lightweight, no IndexedDB needed)
// - Checked on every OHLCV data update or WS tick
// - Triggers: browser notification + in-app toast
// - Types: price_above, price_below, price_cross
//
// Usage:
//   import { useAlertStore, checkAlerts } from './useAlertStore.js';
//   const addAlert = useAlertStore(s => s.addAlert);
//   addAlert({ symbol: 'AAPL', condition: 'above', price: 200 });
//   checkAlerts(currentPrices); // call on each tick/candle
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ALERT_KEY = 'tradeforge-alerts';

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} symbol - e.g., 'AAPL', 'BTC'
 * @property {'above'|'below'|'cross_above'|'cross_below'} condition
 * @property {number} price - target price
 * @property {boolean} active - still armed (not yet triggered)
 * @property {boolean} repeating - re-arm after trigger
 * @property {string|null} triggeredAt - ISO timestamp of last trigger
 * @property {string} createdAt - ISO timestamp
 * @property {string} [note] - optional user note
 */

const useAlertStore = create(
  persist(
    (set, get) => ({
      alerts: [],

      /**
       * Add a new price alert.
       * @param {Object} params
       * @param {string} params.symbol
       * @param {'above'|'below'|'cross_above'|'cross_below'} params.condition
       * @param {number} params.price
       * @param {string} [params.note]
       * @param {boolean} [params.repeating]
       */
      addAlert: ({ symbol, condition, price, note = '', repeating = false }) => {
        const alert = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          symbol: (symbol || '').toUpperCase(),
          condition,
          price: Number(price),
          active: true,
          repeating,
          triggeredAt: null,
          createdAt: new Date().toISOString(),
          note,
          // Track last known price for "cross" conditions
          _lastPrice: null,
        };
        set((s) => ({ alerts: [...s.alerts, alert] }));
        return alert.id;
      },

      /**
       * Remove an alert by ID.
       */
      removeAlert: (id) => {
        set((s) => ({ alerts: s.alerts.filter(a => a.id !== id) }));
      },

      /**
       * Toggle active state.
       */
      toggleAlert: (id) => {
        set((s) => ({
          alerts: s.alerts.map(a =>
            a.id === id ? { ...a, active: !a.active, triggeredAt: !a.active ? null : a.triggeredAt } : a
          ),
        }));
      },

      /**
       * Mark an alert as triggered.
       */
      triggerAlert: (id) => {
        set((s) => ({
          alerts: s.alerts.map(a => {
            if (a.id !== id) return a;
            return {
              ...a,
              active: a.repeating, // re-arm if repeating
              triggeredAt: new Date().toISOString(),
            };
          }),
        }));
      },

      /**
       * Update the _lastPrice for cross detection.
       */
      updateLastPrice: (symbol, price) => {
        set((s) => ({
          alerts: s.alerts.map(a =>
            a.symbol === symbol ? { ...a, _lastPrice: price } : a
          ),
        }));
      },

      /**
       * Clear all triggered (inactive, non-repeating) alerts.
       */
      clearTriggered: () => {
        set((s) => ({
          alerts: s.alerts.filter(a => a.active || a.repeating),
        }));
      },

      /**
       * Clear all alerts.
       */
      clearAll: () => set({ alerts: [] }),
    }),
    {
      name: ALERT_KEY,
      partialize: (state) => ({
        alerts: state.alerts.map(a => ({
          ...a,
          // Don't persist internal tracking fields
          _lastPrice: null,
        })),
      }),
    }
  )
);

// ─── Alert Checker ──────────────────────────────────────────────

/**
 * Request browser notification permission (call once on app boot).
 */
export function requestNotificationPermission() {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Send a browser notification.
 */
function sendNotification(title, body) {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.svg',
        tag: 'tradeforge-alert',
        renotify: true,
      });
    } catch { /* notifications may fail in some contexts */ }
  }
}

/**
 * Dispatch an in-app toast event.
 */
function dispatchAlertToast(alert, currentPrice) {
  if (typeof window === 'undefined') return;
  const condLabel = {
    above: '↑ above',
    below: '↓ below',
    cross_above: '↗ crossed above',
    cross_below: '↘ crossed below',
  };
  window.dispatchEvent(new CustomEvent('tradeforge:alert-triggered', {
    detail: {
      alert,
      currentPrice,
      message: `${alert.symbol} ${condLabel[alert.condition] || alert.condition} $${alert.price.toFixed(2)}`,
    },
  }));
}

/**
 * Check all active alerts against current prices.
 * Call this on each OHLCV update or WebSocket tick.
 *
 * @param {Object} prices - Map of symbol → current price, e.g. { BTC: 97500, AAPL: 245 }
 */
export function checkAlerts(prices) {
  if (!prices || typeof prices !== 'object') return;

  const store = useAlertStore.getState();
  const activeAlerts = store.alerts.filter(a => a.active);

  for (const alert of activeAlerts) {
    const price = prices[alert.symbol];
    if (price == null) continue;

    let triggered = false;

    switch (alert.condition) {
      case 'above':
        triggered = price >= alert.price;
        break;
      case 'below':
        triggered = price <= alert.price;
        break;
      case 'cross_above':
        // On cold start (_lastPrice null), just record price — don't trigger
        if (alert._lastPrice == null) break;
        if (alert._lastPrice < alert.price && price >= alert.price) {
          triggered = true;
        }
        break;
      case 'cross_below':
        if (alert._lastPrice == null) break;
        if (alert._lastPrice > alert.price && price <= alert.price) {
          triggered = true;
        }
        break;
    }

    if (triggered) {
      store.triggerAlert(alert.id);
      const msg = `${alert.symbol} hit $${price.toFixed(2)} (alert: ${alert.condition} $${alert.price.toFixed(2)})`;
      sendNotification(`🔔 ${alert.symbol} Price Alert`, msg);
      dispatchAlertToast(alert, price);
    }

    // Always update last price for cross detection
    store.updateLastPrice(alert.symbol, price);
  }
}

/**
 * Check a single symbol's price against its alerts.
 * Convenience wrapper for use with WebSocket ticks.
 *
 * @param {string} symbol
 * @param {number} price
 */
export function checkSymbolAlerts(symbol, price) {
  checkAlerts({ [symbol.toUpperCase()]: price });
}

export { useAlertStore };
export default useAlertStore;
