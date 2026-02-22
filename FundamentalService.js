// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Fundamental Data Service
//
// Fetches market fundamentals for crypto assets via CoinGecko.
// Long TTL (1hr) since fundamentals don't change per-tick.
// Stocks: returns null (no free fundamental API integrated yet).
//
// Data shape:
//   { marketCap, volume24h, supply, maxSupply, ath, athDate,
//     atl, atlDate, rank, priceChange24h, priceChange7d,
//     priceChange30d, high24h, low24h }
// ═══════════════════════════════════════════════════════════════════

import { CRYPTO_IDS, isCrypto } from '../constants.js';

const CACHE_TTL = 3600_000; // 1 hour
const cache = new Map();    // key → { data, ts }

// Rate limit: share bucket with main FetchService concept
let lastFetch = 0;
const MIN_INTERVAL = 6000; // 6s between calls (10/min)

/**
 * Fetch fundamental data for a symbol.
 *
 * @param {string} symbol - e.g. 'BTC', 'ETH', 'SPY'
 * @returns {Promise<Object|null>} fundamental data or null if unavailable
 */
export async function fetchFundamentals(symbol) {
  const sym = (symbol || '').toUpperCase();

  // Only crypto supported for now
  if (!isCrypto(sym)) return null;

  const cgId = CRYPTO_IDS[sym];
  if (!cgId) return null;

  // Check cache
  const cached = cache.get(sym);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Rate limit
  const now = Date.now();
  if (now - lastFetch < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - (now - lastFetch)));
  }
  lastFetch = Date.now();

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${cgId}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`FundamentalService: CoinGecko returned ${res.status} for ${sym}`);
      // Return stale cache if available
      return cached?.data || null;
    }

    const json = await res.json();
    const md = json.market_data || {};

    const data = {
      name: json.name || sym,
      symbol: (json.symbol || sym).toUpperCase(),
      rank: json.market_cap_rank || null,
      marketCap: md.market_cap?.usd || null,
      volume24h: md.total_volume?.usd || null,
      supply: md.circulating_supply || null,
      maxSupply: md.max_supply || null,
      totalSupply: md.total_supply || null,

      // All-time high/low
      ath: md.ath?.usd || null,
      athDate: md.ath_date?.usd || null,
      athChange: md.ath_change_percentage?.usd || null,
      atl: md.atl?.usd || null,
      atlDate: md.atl_date?.usd || null,

      // Price changes
      priceChange24h: md.price_change_percentage_24h || null,
      priceChange7d: md.price_change_percentage_7d || null,
      priceChange30d: md.price_change_percentage_30d || null,

      // 24h range
      high24h: md.high_24h?.usd || null,
      low24h: md.low_24h?.usd || null,

      // Misc
      fullyDilutedValuation: md.fully_diluted_valuation?.usd || null,
      mcapToVolume: md.market_cap?.usd && md.total_volume?.usd
        ? md.market_cap.usd / md.total_volume.usd
        : null,
    };

    cache.set(sym, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn('FundamentalService: fetch error', err.message);
    return cached?.data || null;
  }
}

/**
 * Check if fundamentals are available for a given symbol.
 * @param {string} symbol
 * @returns {boolean}
 */
export function hasFundamentals(symbol) {
  return isCrypto(symbol);
}

/**
 * Clear the fundamentals cache.
 */
export function clearFundamentalsCache() {
  cache.clear();
}

// ─── Formatters (compact display) ─────────────────────────────

/**
 * Format large numbers with K/M/B suffixes.
 * @param {number} n
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function fmtCompact(n, decimals = 1) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
  return n.toFixed(decimals);
}

/**
 * Format supply with max supply ratio.
 * e.g. "19.6M / 21M" or "19.6M" if no max.
 */
export function fmtSupply(supply, maxSupply) {
  if (!supply) return '—';
  const s = fmtCompact(supply, 1);
  if (maxSupply) return `${s} / ${fmtCompact(maxSupply, 1)}`;
  return s;
}
