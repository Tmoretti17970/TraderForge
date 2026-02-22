// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Public Route Definitions (SEO)
// Defines URL patterns for server-side rendered public pages.
// ═══════════════════════════════════════════════════════════════════

const PUBLIC_ROUTES = [
  { path: '/s/:symbol', page: 'symbol', title: (p) => `${p.symbol} — TradeForge` },
  { path: '/snap/:id', page: 'snapshot', title: () => 'Trade Snapshot — TradeForge' },
  { path: '/u/:username', page: 'profile', title: (p) => `${p.username} — TradeForge` },
  { path: '/leaderboard', page: 'leaderboard', title: () => 'Leaderboard — TradeForge' },
];

export function matchRoute(url) {
  for (const route of PUBLIC_ROUTES) {
    const pattern = route.path.replace(/:(\w+)/g, '(?<$1>[^/]+)');
    const match = url.match(new RegExp(`^${pattern}$`));
    if (match) return { ...route, params: match.groups || {} };
  }
  return null;
}

export function getAllPublicPaths() {
  return PUBLIC_ROUTES.map((r) => r.path);
}

export { PUBLIC_ROUTES };
