// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Service Worker Registration (Sprint 5.7)
//
// Registers the service worker for PWA support.
// Only registers in production builds to avoid dev interference.
//
// Usage: import './registerSW.js'; // in main.jsx
// ═══════════════════════════════════════════════════════════════════

export function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return;
  }

  // Only register in production
  if (import.meta.env?.DEV) {
    console.log('[SW] Skipping registration in dev mode');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Check for updates periodically (every 60 min)
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New version available — notify user
            console.log('[SW] New version available');
            if (window.__onSWUpdate) window.__onSWUpdate();
          }
        });
      });

      console.log('[SW] Registered successfully, scope:', registration.scope);
    } catch (err) {
      console.warn('[SW] Registration failed:', err.message);
    }
  });
}

export function unregisterSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}

export default registerSW;
