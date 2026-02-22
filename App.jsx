// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11.0 — Application Root
// Boot sequence → Loading → Sidebar + Page layout
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useAppBoot } from './AppBoot.js';
import Sidebar from './components/Sidebar.jsx';
import MobileNav from './components/MobileNav.jsx';
import PageRouter from './components/PageRouter.jsx';
import { ToastContainer } from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import DailyGuardBanner from './components/DailyGuardBanner.jsx';
import { useNotificationLog } from './state/useNotificationLog.js';
import { useBreakpoints } from './utils/useMediaQuery.js';
import { useHotkeys } from './utils/useHotkeys.js';
import { useThemeStore } from './state/useThemeStore.js';
import { useUIStore } from './state/useUIStore.js';
import { installGlobalErrorHandlers } from './utils/globalErrorHandler.js';
import { C, F, M } from './constants.js';
import KeyboardShortcuts from './components/KeyboardShortcuts.jsx';

// Lazy-load overlay components (not needed on initial render)
const CommandPalette = React.lazy(() => import('./components/CommandPalette.jsx'));
const NotificationPanel = React.lazy(() => import('./components/NotificationPanel.jsx'));
const OnboardingWizard = React.lazy(() => import('./components/OnboardingWizard.jsx'));

// Install global error handlers once at module load
installGlobalErrorHandlers();

// Expose notification store globally for error handler integration
if (typeof globalThis !== 'undefined') {
  setTimeout(() => {
    try {
      globalThis.__tradeforge_notification_store__ = useNotificationLog;
    } catch {}
  }, 0);
}

export default function App() {
  const ready = useAppBoot();
  const { isMobile } = useBreakpoints();
  const toggleNotifications = useNotificationLog((s) => s.togglePanel);
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const theme = useThemeStore((s) => s.theme);

  // Keyboard shortcuts panel
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  // Hydrate theme on mount
  useEffect(() => {
    useThemeStore.getState().hydrate();
  }, []);

  // Page navigation map: keys 1-7 → pages
  const PAGE_KEYS = ['dashboard', 'journal', 'charts', 'analytics', 'notes', 'plans', 'social'];

  // Global hotkeys
  useHotkeys([
    { key: 'ctrl+.', handler: toggleNotifications, description: 'Toggle activity log', allowInInput: true },
    { key: '?', handler: () => setShortcutsOpen(o => !o), description: 'Toggle keyboard shortcuts' },
    { key: '1', handler: () => setPage(PAGE_KEYS[0]), description: 'Go to Dashboard' },
    { key: '2', handler: () => setPage(PAGE_KEYS[1]), description: 'Go to Journal' },
    { key: '3', handler: () => setPage(PAGE_KEYS[2]), description: 'Go to Charts' },
    { key: '4', handler: () => setPage(PAGE_KEYS[3]), description: 'Go to Analytics' },
    { key: '5', handler: () => setPage(PAGE_KEYS[4]), description: 'Go to Notes' },
    { key: '6', handler: () => setPage(PAGE_KEYS[5]), description: 'Go to Plans' },
    { key: '7', handler: () => setPage(PAGE_KEYS[6]), description: 'Go to Community' },
  ], { scope: 'global', enabled: true });

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <div key={theme} style={{
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      height: '100vh',
      overflow: 'hidden',
      background: C.bg,
      transition: 'background-color 0.2s ease',
    }}>
      {!isMobile && <Sidebar />}
      <ErrorBoundary resetKey={page}>
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isMobile ? 56 : 0,
        }}>
          <DailyGuardBanner />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <PageRouter />
          </div>
        </div>
      </ErrorBoundary>
      {isMobile && <MobileNav />}
      <ToastContainer />
      <Suspense fallback={null}>
        <CommandPalette />
        <NotificationPanel />
        <OnboardingWizard />
      </Suspense>
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={closeShortcuts} />
    </div>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: F,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${C.b}, ${C.y})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 22,
          fontFamily: M,
          color: '#fff',
        }}
      >
        TF
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>
        TradeForge
      </div>
      <div
        style={{
          width: 24,
          height: 24,
          border: `2px solid ${C.bd}`,
          borderTop: `2px solid ${C.b}`,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
        Loading...
      </div>
    </div>
  );
}
