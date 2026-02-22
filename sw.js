// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Service Worker (Sprint 5.7)
//
// Provides offline support and intelligent caching:
//   - Cache-first for static assets (JS, CSS, fonts, images)
//   - Network-first for API calls (Yahoo proxy, server API)
//   - Offline fallback page
//
// Versioned cache — bumping VERSION clears stale caches on update.
// ═══════════════════════════════════════════════════════════════════

const VERSION = 'tf-v10.30';
const STATIC_CACHE = `${VERSION}-static`;
const DYNAMIC_CACHE = `${VERSION}-dynamic`;

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ─── Install ────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate — clean old caches ────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ─────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions, dev tools, etc.
  if (!url.protocol.startsWith('http')) return;

  // API calls → network-first with cache fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/yahoo/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // External resources (fonts, CDN) → cache-first
  if (url.origin !== location.origin) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Static assets → cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Navigation (HTML pages) → network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Default → network-first
  event.respondWith(networkFirstStrategy(request));
});

// ─── Strategies ─────────────────────────────────────────────────

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline — return generic offline response for non-critical assets
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return cached index.html (SPA)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }

    return new Response(
      JSON.stringify({ error: 'offline', message: 'No network connection' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|ico|webp|avif)(\?.*)?$/.test(pathname);
}

// ─── Background Sync (future) ───────────────────────────────────
// When cloud sync is added, queued mutations can be replayed here.
// self.addEventListener('sync', (event) => { ... });
