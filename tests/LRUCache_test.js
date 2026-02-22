// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — LRUCache Tests
// Tests for: createLRUCache, TTL, eviction, getTTLForResolution, barCacheKey
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createLRUCache,
  CACHE_TTL,
  getTTLForResolution,
  barCacheKey,
} from '../chartEngine/data/LRUCache.js';

// ═══════════════════════════════════════════════════════════════════
// createLRUCache — Core Operations
// ═══════════════════════════════════════════════════════════════════

describe('LRUCache core', () => {
  let cache;

  beforeEach(() => {
    cache = createLRUCache({ maxSize: 5, defaultTTL: 60000 });
  });

  it('get returns null for missing key', () => {
    expect(cache.get('nope')).toBeNull();
  });

  it('set + get round-trips a value', () => {
    cache.set('key1', { data: [1, 2, 3] });
    expect(cache.get('key1')).toEqual({ data: [1, 2, 3] });
  });

  it('has returns true for existing key', () => {
    cache.set('k', 42);
    expect(cache.has('k')).toBe(true);
  });

  it('has returns false for missing key', () => {
    expect(cache.has('missing')).toBe(false);
  });

  it('delete removes a key', () => {
    cache.set('k', 42);
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('clear removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('size reports correct count', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
  });

  it('overwriting a key does not increase size', () => {
    cache.set('k', 1);
    cache.set('k', 2);
    expect(cache.size).toBe(1);
    expect(cache.get('k')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// LRU Eviction
// ═══════════════════════════════════════════════════════════════════

describe('LRUCache eviction', () => {
  it('evicts oldest entry when at capacity', () => {
    const cache = createLRUCache({ maxSize: 3, defaultTTL: 60000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // evicts 'a'
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(3);
  });

  it('get promotes entry to most-recently-used', () => {
    const cache = createLRUCache({ maxSize: 3, defaultTTL: 60000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');       // promote 'a'
    cache.set('d', 4);    // evicts 'b' (now oldest)
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeNull();
  });

  it('handles maxSize of 1', () => {
    const cache = createLRUCache({ maxSize: 1, defaultTTL: 60000 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TTL Expiration
// ═══════════════════════════════════════════════════════════════════

describe('LRUCache TTL', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns null for expired entries on get', () => {
    const cache = createLRUCache({ maxSize: 10, defaultTTL: 1000 });
    cache.set('k', 'value');
    expect(cache.get('k')).toBe('value');
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeNull();
  });

  it('has returns false for expired entries', () => {
    const cache = createLRUCache({ maxSize: 10, defaultTTL: 1000 });
    cache.set('k', 'value');
    vi.advanceTimersByTime(1001);
    expect(cache.has('k')).toBe(false);
  });

  it('respects custom per-entry TTL', () => {
    const cache = createLRUCache({ maxSize: 10, defaultTTL: 60000 });
    cache.set('short', 'data', 500);
    cache.set('long', 'data', 5000);
    vi.advanceTimersByTime(600);
    expect(cache.get('short')).toBeNull();
    expect(cache.get('long')).toBe('data');
  });

  it('stats reports expired count correctly', () => {
    const cache = createLRUCache({ maxSize: 10, defaultTTL: 1000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    vi.advanceTimersByTime(1001);
    const stats = cache.stats();
    expect(stats.total).toBe(3);
    expect(stats.expired).toBe(3);
    expect(stats.active).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// clearPrefix
// ═══════════════════════════════════════════════════════════════════

describe('LRUCache clearPrefix', () => {
  it('clears only entries matching prefix', () => {
    const cache = createLRUCache({ maxSize: 10, defaultTTL: 60000 });
    cache.set('bars:BTC:1h', 'btc1');
    cache.set('bars:BTC:5m', 'btc2');
    cache.set('bars:ETH:1h', 'eth1');
    cache.set('symbols:BTC', 'info');
    cache.clearPrefix('bars:BTC');
    expect(cache.get('bars:BTC:1h')).toBeNull();
    expect(cache.get('bars:BTC:5m')).toBeNull();
    expect(cache.get('bars:ETH:1h')).toBe('eth1');
    expect(cache.get('symbols:BTC')).toBe('info');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════════

describe('getTTLForResolution', () => {
  it('returns TICK TTL for 1m', () => {
    expect(getTTLForResolution('1m')).toBe(CACHE_TTL.TICK);
  });

  it('returns INTRADAY TTL for 5m, 15m, 30m', () => {
    expect(getTTLForResolution('5m')).toBe(CACHE_TTL.INTRADAY);
    expect(getTTLForResolution('15m')).toBe(CACHE_TTL.INTRADAY);
  });

  it('returns HOURLY TTL for 1h, 4h', () => {
    expect(getTTLForResolution('1h')).toBe(CACHE_TTL.HOURLY);
    expect(getTTLForResolution('4h')).toBe(CACHE_TTL.HOURLY);
  });

  it('returns DAILY TTL for unrecognized resolutions', () => {
    expect(getTTLForResolution('1d')).toBe(CACHE_TTL.DAILY);
    expect(getTTLForResolution('anything')).toBe(CACHE_TTL.DAILY);
  });
});

describe('barCacheKey', () => {
  it('generates correct key format', () => {
    expect(barCacheKey('BTCUSDT', '1h', 1000, 2000)).toBe('bars:BTCUSDT:1h:1000:2000');
  });
});
