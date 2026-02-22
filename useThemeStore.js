// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Theme Store
// Manages dark/light theme preference. Persisted via localStorage.
// Applies .theme-light class to documentElement for CSS variable swap.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncThemeColors } from '../constants.js';

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // 'dark' | 'light'

      setTheme(theme) {
        syncThemeColors(theme);
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme() {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        syncThemeColors(next);
        set({ theme: next });
        applyTheme(next);
      },

      /** Call once on app boot to sync DOM and C object with persisted state */
      hydrate() {
        const theme = get().theme;
        syncThemeColors(theme);
        applyTheme(theme);
      },
    }),
    {
      name: 'tradeforge-theme',
      version: 1,
    }
  )
);

/** Apply theme class to document root */
function applyTheme(theme) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  if (theme === 'light') {
    root.classList.add('theme-light');
    root.classList.remove('theme-dark');
  } else {
    root.classList.add('theme-dark');
    root.classList.remove('theme-light');
  }
}

export { useThemeStore };
export default useThemeStore;
