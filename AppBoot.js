// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — App Boot Sequence
//
// Hydrates all Zustand stores from IndexedDB on first mount.
// Seeds demo data if the database is empty (first-time user).
// Subscribes to store changes for debounced auto-save.
//
// Usage in App.jsx:
//   import { useAppBoot } from './AppBoot.js';
//   function App() {
//     const ready = useAppBoot();
//     if (!ready) return <LoadingScreen />;
//     return <AppMain />;
//   }
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useTradeStore } from './state/useTradeStore.js';
import { useSettingsStore } from './state/useSettingsStore.js';
import { useOnboardingStore } from './state/useOnboardingStore.js';
import { useScriptStore } from './state/useScriptStore.js';
import { useWorkspaceStore } from './state/useWorkspaceStore.js';
import { useWatchlistStore } from './state/useWatchlistStore.js';
import { StorageService } from './data/StorageService.js';
import { genDemoData } from './data/demoData.js';
import { migrateAllTrades } from './engine/Money.js';

const AUTOSAVE_DELAY = 1500; // ms — debounce window for auto-save

/**
 * Hook that hydrates all stores from IndexedDB.
 * Returns true when boot is complete.
 */
export function useAppBoot() {
  const [ready, setReady] = useState(false);
  const unsubscribers = useRef([]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        // ─── Step 1: Attempt legacy migration (v9.3 → v10) ─────
        await StorageService.migrateFromLegacy();

        // ─── Step 2: Load from IndexedDB ────────────────────────
        const [tradesResult, playbooksResult, notesResult, tradePlansResult, settingsResult, onboardingResult, scriptsResult, workspacesResult, watchlistResult] =
          await Promise.all([
            StorageService.trades.getAll(),
            StorageService.playbooks.getAll(),
            StorageService.notes.getAll(),
            StorageService.tradePlans.getAll(),
            StorageService.settings.get('settings'),
            StorageService.settings.get('onboarding'),
            StorageService.settings.get('scripts'),
            StorageService.settings.get('workspaces'),
            StorageService.settings.get('watchlist'),
          ]);

        if (cancelled) return;

        // ─── Step 3: Hydrate stores ─────────────────────────────
        let trades = tradesResult.ok ? tradesResult.data : [];
        const playbooks = playbooksResult.ok ? playbooksResult.data : [];
        const notes = notesResult.ok ? notesResult.data : [];
        const tradePlans = tradePlansResult.ok ? tradePlansResult.data : [];

        // ─── Step 3a: Financial precision migration ──────────────
        // Auto-round monetary fields to eliminate stored float imprecision.
        // Idempotent: trades already migrated (_moneyV === 1) are skipped.
        trades = migrateAllTrades(trades);

        // If database is empty, seed demo data for first-time users
        if (trades.length === 0 && playbooks.length === 0) {
          const demo = genDemoData();
          useTradeStore.getState().hydrate({
            trades: demo.trades,
            playbooks: demo.playbooks,
            notes: [],
            tradePlans: [],
          });
        } else {
          useTradeStore.getState().hydrate({ trades, playbooks, notes, tradePlans });
        }

        // Hydrate settings
        const savedSettings = settingsResult.ok ? settingsResult.data : null;
        if (savedSettings && typeof savedSettings === 'object') {
          useSettingsStore.getState().hydrate(savedSettings);
        }

        // Hydrate onboarding state
        const savedOnboarding = onboardingResult.ok ? onboardingResult.data : null;
        if (savedOnboarding && typeof savedOnboarding === 'object') {
          useOnboardingStore.getState().hydrate(savedOnboarding);
        }

        // Hydrate scripts (built-in merge happens inside store)
        const savedScripts = scriptsResult.ok ? scriptsResult.data : null;
        useScriptStore.getState().hydrate(Array.isArray(savedScripts) ? savedScripts : []);

        // Hydrate workspaces
        const savedWorkspaces = workspacesResult.ok ? workspacesResult.data : null;
        useWorkspaceStore.getState().hydrate(Array.isArray(savedWorkspaces) ? savedWorkspaces : []);

        // Hydrate watchlist
        const savedWatchlist = watchlistResult.ok ? watchlistResult.data : null;
        useWatchlistStore.getState().hydrate(Array.isArray(savedWatchlist) ? savedWatchlist : []);

        // ─── Step 4: Subscribe to changes for auto-save ─────────
        unsubscribers.current = setupAutoSave();

        // ─── Step 5: Check storage quota ──────────────────────────
        const quotaCheck = await StorageService.checkQuota();
        if (quotaCheck.ok && quotaCheck.data.percent > 85) {
          console.warn(`[AppBoot] Storage quota at ${quotaCheck.data.percent}% — consider cleanup`);
          if (quotaCheck.data.percent >= 95) {
            console.warn('[AppBoot] Critical quota — running auto-recovery');
            await StorageService.quotaRecovery(70);
          }
        }

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('[AppBoot] Hydration failed:', err);
        // Seed demo data so the app still works
        const demo = genDemoData();
        useTradeStore.getState().hydrate({
          trades: demo.trades,
          playbooks: demo.playbooks,
          notes: [],
          tradePlans: [],
        });
        if (!cancelled) setReady(true);
      }
    }

    boot();

    return () => {
      cancelled = true;
      unsubscribers.current.forEach((unsub) => unsub());
    };
  }, []);

  return ready;
}

/**
 * Set up debounced auto-save subscriptions.
 * Returns array of unsubscribe functions.
 */
function setupAutoSave() {
  const unsubs = [];
  let tradeTimer = null;
  let settingsTimer = null;

  // Auto-save trades/playbooks/notes/tradePlans
  unsubs.push(
    useTradeStore.subscribe((state, prevState) => {
      // Skip the initial hydration write-back
      if (!prevState.loaded) return;

      clearTimeout(tradeTimer);
      tradeTimer = setTimeout(async () => {
        try {
          // Clear + rewrite ensures deletes persist correctly
          await Promise.all([
            StorageService.trades.replaceAll(state.trades),
            StorageService.playbooks.replaceAll(state.playbooks),
            StorageService.notes.replaceAll(state.notes),
            StorageService.tradePlans.replaceAll(state.tradePlans),
          ]);
        } catch (err) {
          console.warn('[AppBoot] Auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  // Auto-save settings
  unsubs.push(
    useSettingsStore.subscribe((state) => {
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(async () => {
        try {
          // Strip out functions, save only data
          const { update, hydrate, reset, ...data } = state;
          await StorageService.settings.set('settings', data);
        } catch (err) {
          console.warn('[AppBoot] Settings auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  // Auto-save onboarding state
  let onboardingTimer = null;
  unsubs.push(
    useOnboardingStore.subscribe((state) => {
      clearTimeout(onboardingTimer);
      onboardingTimer = setTimeout(async () => {
        try {
          const data = useOnboardingStore.getState().toJSON();
          await StorageService.settings.set('onboarding', data);
        } catch (err) {
          console.warn('[AppBoot] Onboarding auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  // Auto-save scripts
  let scriptsTimer = null;
  unsubs.push(
    useScriptStore.subscribe((state) => {
      if (!state.loaded) return;
      clearTimeout(scriptsTimer);
      scriptsTimer = setTimeout(async () => {
        try {
          const data = useScriptStore.getState().toJSON();
          await StorageService.settings.set('scripts', data);
        } catch (err) {
          console.warn('[AppBoot] Scripts auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  // Auto-save workspaces
  let workspacesTimer = null;
  unsubs.push(
    useWorkspaceStore.subscribe((state) => {
      clearTimeout(workspacesTimer);
      workspacesTimer = setTimeout(async () => {
        try {
          await StorageService.settings.set('workspaces', state.workspaces);
        } catch (err) {
          console.warn('[AppBoot] Workspaces auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  // Auto-save watchlist
  let watchlistTimer = null;
  unsubs.push(
    useWatchlistStore.subscribe((state) => {
      if (!state.loaded) return;
      clearTimeout(watchlistTimer);
      watchlistTimer = setTimeout(async () => {
        try {
          await StorageService.settings.set('watchlist', state.items);
        } catch (err) {
          console.warn('[AppBoot] Watchlist auto-save failed:', err);
        }
      }, AUTOSAVE_DELAY);
    })
  );

  return unsubs;
}

/**
 * Migrate data from old window.storage / localStorage into IndexedDB.
 * Called automatically during boot. Safe to call multiple times.
 */
export async function migrateFromV9() {
  return StorageService.migrateFromLegacy();
}
