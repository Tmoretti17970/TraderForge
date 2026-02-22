// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Sitemap Generator
//
// Generates sitemap.xml for search engine indexing.
// Includes all public routes: static pages + known symbol pages.
//
// Called by server.js on GET /sitemap.xml.
// Can also be used for static generation: node -e "import('./src/seo/sitemap.js').then(m => console.log(m.generateSitemap()))"
// ═══════════════════════════════════════════════════════════════════

import { SITE_URL } from './meta.js';
import { getAllPublicPaths } from './routes.js';

/**
 * Generate sitemap.xml content.
 * @returns {string} XML string
 */
export function generateSitemap() {
  const paths = getAllPublicPaths();
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const urls = paths.map((path) => {
    const priority = getPriority(path);
    const changefreq = getChangefreq(path);

    return `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

/**
 * Generate robots.txt content.
 * @returns {string}
 */
export function generateRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /_internal/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────

function getPriority(path) {
  if (path === '/') return '1.0';
  if (path === '/leaderboard') return '0.8';
  if (path.startsWith('/symbol/')) return '0.7';
  if (path.startsWith('/shared/')) return '0.5';
  return '0.5';
}

function getChangefreq(path) {
  if (path === '/') return 'daily';
  if (path === '/leaderboard') return 'hourly';
  if (path.startsWith('/symbol/')) return 'hourly';
  if (path.startsWith('/shared/')) return 'weekly';
  return 'weekly';
}
