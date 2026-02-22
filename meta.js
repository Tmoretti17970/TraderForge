// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — SEO Meta System
//
// Generates <head> meta tags for public pages:
//   - Standard meta (title, description, canonical)
//   - Open Graph (Facebook, LinkedIn, Discord)
//   - Twitter Cards
//   - JSON-LD structured data
//
// Works both client-side (document.head manipulation) and
// server-side (returns HTML string for injection).
// ═══════════════════════════════════════════════════════════════════

const SITE_NAME = 'TradeForge';
const SITE_URL = 'https://tradeforge.app';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;
const TWITTER_HANDLE = '@tradeforgeapp';

/**
 * Generate meta tag objects for a page.
 * @param {Object} opts
 * @param {string} opts.title - Page title
 * @param {string} opts.description - Page description
 * @param {string} opts.path - URL path (e.g., '/symbol/BTC')
 * @param {string} [opts.image] - OG image URL
 * @param {string} [opts.type] - OG type (default: 'website')
 * @param {Object} [opts.structuredData] - JSON-LD object
 * @returns {Object} { title, metas[], links[], jsonLd }
 */
export function generateMeta({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  structuredData,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonical = `${SITE_URL}${path}`;
  const ogImage = image || DEFAULT_IMAGE;

  const metas = [
    // Standard
    { name: 'description', content: description },
    { name: 'robots', content: 'index, follow' },

    // Open Graph
    { property: 'og:title', content: fullTitle },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: ogImage },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: SITE_NAME },

    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: TWITTER_HANDLE },
    { name: 'twitter:title', content: fullTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
  ];

  const links = [
    { rel: 'canonical', href: canonical },
  ];

  // JSON-LD structured data
  const jsonLd = structuredData || {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: fullTitle,
    description,
    url: canonical,
    image: ogImage,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return { title: fullTitle, metas, links, jsonLd };
}

// ─── Page-Specific Meta Generators ────────────────────────────

/**
 * Symbol/ticker page meta.
 */
export function symbolPageMeta(symbol, price, change24h) {
  const changeStr = change24h != null
    ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`
    : '';
  const priceStr = price != null ? `$${price.toLocaleString()}` : '';

  return generateMeta({
    title: `${symbol.toUpperCase()} ${priceStr} ${changeStr}`.trim(),
    description: `Live ${symbol.toUpperCase()} chart, technical analysis, and trading journal insights on TradeForge. Track price action, indicators, and community sentiment.`,
    path: `/symbol/${symbol.toLowerCase()}`,
    type: 'website',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'FinancialProduct',
      name: `${symbol.toUpperCase()} Trading Analysis`,
      description: `Technical analysis and trading insights for ${symbol.toUpperCase()}`,
      url: `${SITE_URL}/symbol/${symbol.toLowerCase()}`,
      provider: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
    },
  });
}

/**
 * Shared snapshot page meta.
 */
export function snapshotPageMeta(snapshot, author) {
  const authorName = author?.displayName || author?.username || 'Trader';
  return generateMeta({
    title: snapshot.title || `${snapshot.symbol} Analysis`,
    description: snapshot.description
      || `${authorName}'s ${snapshot.symbol} chart analysis on TradeForge`,
    path: `/shared/${snapshot.id}`,
    type: 'article',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: snapshot.title,
      description: snapshot.description,
      author: {
        '@type': 'Person',
        name: authorName,
      },
      datePublished: new Date(snapshot.createdAt).toISOString(),
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
      },
    },
  });
}

/**
 * Leaderboard page meta.
 */
export function leaderboardPageMeta(metric = 'pnl', period = '30d') {
  const metricLabels = {
    pnl: 'P&L',
    winRate: 'Win Rate',
    sharpe: 'Sharpe Ratio',
    profitFactor: 'Profit Factor',
  };
  const periodLabels = {
    '7d': 'Weekly',
    '30d': 'Monthly',
    '90d': 'Quarterly',
    all: 'All-Time',
  };

  return generateMeta({
    title: `${periodLabels[period] || ''} ${metricLabels[metric] || 'Trading'} Leaderboard`,
    description: `Top traders ranked by ${metricLabels[metric] || metric} on TradeForge. See who\'s leading the community in verified trading performance.`,
    path: `/leaderboard`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `TradeForge ${metricLabels[metric]} Leaderboard`,
      description: `Trading leaderboard ranked by ${metricLabels[metric]}`,
      url: `${SITE_URL}/leaderboard`,
    },
  });
}

// ─── Client-Side Head Manager ─────────────────────────────────

/**
 * Apply meta tags to document.head (client-side only).
 * Cleans up previous dynamic tags before applying new ones.
 */
export function applyMetaToHead(meta) {
  if (typeof document === 'undefined') return;

  // Update title
  document.title = meta.title;

  // Remove previous dynamic metas
  document.querySelectorAll('meta[data-tf-dynamic]').forEach((el) => el.remove());
  document.querySelectorAll('link[data-tf-dynamic]').forEach((el) => el.remove());
  document.querySelectorAll('script[data-tf-jsonld]').forEach((el) => el.remove());

  // Add metas
  for (const m of meta.metas) {
    const el = document.createElement('meta');
    if (m.name) el.setAttribute('name', m.name);
    if (m.property) el.setAttribute('property', m.property);
    el.setAttribute('content', m.content || '');
    el.setAttribute('data-tf-dynamic', 'true');
    document.head.appendChild(el);
  }

  // Add links
  for (const l of meta.links) {
    const el = document.createElement('link');
    el.setAttribute('rel', l.rel);
    el.setAttribute('href', l.href);
    el.setAttribute('data-tf-dynamic', 'true');
    document.head.appendChild(el);
  }

  // Add JSON-LD
  if (meta.jsonLd) {
    const script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-tf-jsonld', 'true');
    script.textContent = JSON.stringify(meta.jsonLd);
    document.head.appendChild(script);
  }
}

// ─── Server-Side HTML String ──────────────────────────────────

/**
 * Render meta tags as HTML string (server-side injection).
 */
export function renderMetaToString(meta) {
  const parts = [];

  parts.push(`<title>${escapeHtml(meta.title)}</title>`);

  for (const m of meta.metas) {
    const key = m.name ? `name="${m.name}"` : `property="${m.property}"`;
    parts.push(`<meta ${key} content="${escapeHtml(m.content || '')}" data-tf-dynamic="true" />`);
  }

  for (const l of meta.links) {
    parts.push(`<link rel="${l.rel}" href="${escapeHtml(l.href)}" data-tf-dynamic="true" />`);
  }

  if (meta.jsonLd) {
    parts.push(`<script type="application/ld+json" data-tf-jsonld="true">${JSON.stringify(meta.jsonLd)}</script>`);
  }

  return parts.join('\n    ');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { SITE_NAME, SITE_URL };
