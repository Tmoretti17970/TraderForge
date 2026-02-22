// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — SSR Entry Point
//
// Server-side render function. Called by server.js for each request.
//
// Flow:
//   1. Match URL against public routes
//   2. If match: load data, render page component, generate head tags
//   3. If no match: return empty shell (SPA takes over on client)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { renderToString } from 'react-dom/server';
import { matchRoute } from './seo/routes.js';
import { renderMetaToString } from './seo/meta.js';

// Page component map (statically imported for SSR bundle)
import PublicSymbolPage from './pages/public/PublicSymbolPage.jsx';
import PublicSnapshotPage from './pages/public/PublicSnapshotPage.jsx';
import PublicLeaderboardPage from './pages/public/PublicLeaderboardPage.jsx';
import PublicProfilePage from './pages/public/PublicProfilePage.jsx';

const PAGE_COMPONENTS = {
  PublicSymbolPage,
  PublicSnapshotPage,
  PublicLeaderboardPage,
  PublicProfilePage,
};

/**
 * Render a URL to HTML string + head tags.
 *
 * @param {string} url - Request URL path
 * @returns {Promise<{ html: string, head: string, statusCode: number, redirect?: string }>}
 */
export async function render(url) {
  // Parse URL
  const path = url.split('?')[0];

  // Match against public routes
  const matched = matchRoute(path);

  // ─── No match: SPA fallback ─────────────────────────────
  if (!matched) {
    return {
      html: '',  // Empty — client-side SPA will hydrate
      head: '',
      statusCode: 200,
    };
  }

  const { route, params } = matched;

  // ─── Home route: redirect to SPA ────────────────────────
  if (route.id === 'home') {
    // For the home page, we could render a landing page
    // or just serve the SPA shell. For now, SPA shell.
    const meta = route.meta(params, null);
    return {
      html: '',
      head: renderMetaToString(meta),
      statusCode: 200,
    };
  }

  // ─── Load route data ────────────────────────────────────
  let data = null;
  try {
    data = await route.loader(params);
  } catch (err) {
    console.error(`[SSR] Data loader error for ${route.id}:`, err.message);
  }

  // ─── Generate meta tags ─────────────────────────────────
  const meta = route.meta(params, data);
  const head = renderMetaToString(meta);

  // ─── Render component ───────────────────────────────────
  const Component = PAGE_COMPONENTS[route.component];
  if (!Component) {
    console.warn(`[SSR] No component found for: ${route.component}`);
    return { html: '', head, statusCode: 200 };
  }

  // Build props based on route type
  const props = buildProps(route.id, params, data);
  let html = '';

  try {
    html = renderToString(React.createElement(Component, props));
  } catch (err) {
    console.error(`[SSR] Render error for ${route.id}:`, err.message);
    return { html: '', head, statusCode: 500 };
  }

  return {
    html,
    head,
    statusCode: data === null && route.id === 'shared' ? 404 : 200,
  };
}

// ─── Prop Builders ────────────────────────────────────────────

function buildProps(routeId, params, data) {
  switch (routeId) {
    case 'symbol':
      return { ticker: params.ticker, ssrData: data };
    case 'shared':
      return { snapshotId: params.id, ssrData: data };
    case 'leaderboard':
      return { ssrData: data };
    default:
      return { ssrData: data };
  }
}
