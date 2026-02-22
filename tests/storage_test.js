// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — StorageService Tests
// Tests the in-memory fallback path (no IndexedDB in Node).
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../data/StorageService.js';

const mkTrade = (id, pnl = 100) => ({
  id,
  date: '2025-01-15T10:00:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl,
});

describe('StorageService.trades', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('put + getAll round-trips', async () => {
    await StorageService.trades.put(mkTrade('t1', 100));
    await StorageService.trades.put(mkTrade('t2', 200));
    const result = await StorageService.trades.getAll();
    expect(result.ok).toBe(true);
    expect(result.data.length).toBe(2);
  });

  it('put overwrites existing by id', async () => {
    await StorageService.trades.put(mkTrade('t1', 100));
    await StorageService.trades.put({ ...mkTrade('t1', 999), symbol: 'ETH' });
    const result = await StorageService.trades.getAll();
    expect(result.data.length).toBe(1);
    expect(result.data[0].pnl).toBe(999);
    expect(result.data[0].symbol).toBe('ETH');
  });

  it('bulkPut inserts many', async () => {
    const trades = Array.from({ length: 50 }, (_, i) => mkTrade(`b${i}`, i * 10));
    await StorageService.trades.bulkPut(trades);
    const result = await StorageService.trades.getAll();
    expect(result.ok).toBe(true);
    expect(result.data.length).toBe(50);
  });

  it('delete removes by id', async () => {
    await StorageService.trades.put(mkTrade('d1'));
    await StorageService.trades.put(mkTrade('d2'));
    await StorageService.trades.delete('d1');
    const result = await StorageService.trades.getAll();
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe('d2');
  });

  it('count returns correct number', async () => {
    await StorageService.trades.put(mkTrade('c1'));
    await StorageService.trades.put(mkTrade('c2'));
    await StorageService.trades.put(mkTrade('c3'));
    const result = await StorageService.trades.count();
    expect(result.ok).toBe(true);
    expect(result.data).toBe(3);
  });

  it('getAll returns empty array when empty', async () => {
    const result = await StorageService.trades.getAll();
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });
});

describe('StorageService.playbooks', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('put + getAll', async () => {
    await StorageService.playbooks.put({ id: 'pb1', name: 'Breakout' });
    await StorageService.playbooks.put({ id: 'pb2', name: 'Reversal' });
    const result = await StorageService.playbooks.getAll();
    expect(result.data.length).toBe(2);
  });

  it('delete removes playbook', async () => {
    await StorageService.playbooks.put({ id: 'pb1', name: 'X' });
    await StorageService.playbooks.delete('pb1');
    const result = await StorageService.playbooks.getAll();
    expect(result.data.length).toBe(0);
  });
});

describe('StorageService.notes', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('put + getAll + delete', async () => {
    await StorageService.notes.put({ id: 'n1', date: '2025-01-15', text: 'Hello' });
    const r1 = await StorageService.notes.getAll();
    expect(r1.data.length).toBe(1);
    await StorageService.notes.delete('n1');
    const r2 = await StorageService.notes.getAll();
    expect(r2.data.length).toBe(0);
  });
});

describe('StorageService.settings', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('set + get key-value', async () => {
    await StorageService.settings.set('dailyLossLimit', 500);
    const result = await StorageService.settings.get('dailyLossLimit');
    expect(result.ok).toBe(true);
    expect(result.data).toBe(500);
  });

  it('get returns null for missing key', async () => {
    const result = await StorageService.settings.get('nonexistent');
    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });

  it('getAll returns object of all settings', async () => {
    await StorageService.settings.set('dailyLossLimit', 1000);
    await StorageService.settings.set('defaultSymbol', 'ETH');
    const result = await StorageService.settings.getAll();
    expect(result.ok).toBe(true);
    expect(result.data.dailyLossLimit).toBe(1000);
    expect(result.data.defaultSymbol).toBe('ETH');
  });

  it('set overwrites existing key', async () => {
    await StorageService.settings.set('key1', 'old');
    await StorageService.settings.set('key1', 'new');
    const result = await StorageService.settings.get('key1');
    expect(result.data).toBe('new');
  });
});

describe('StorageService.clearAll', () => {
  it('clears all tables', async () => {
    await StorageService.trades.put(mkTrade('t1'));
    await StorageService.playbooks.put({ id: 'pb1', name: 'X' });
    await StorageService.notes.put({ id: 'n1', text: 'Y' });
    await StorageService.settings.set('key', 'val');

    await StorageService.clearAll();

    const trades = await StorageService.trades.getAll();
    const pbs = await StorageService.playbooks.getAll();
    const notes = await StorageService.notes.getAll();
    const settings = await StorageService.settings.getAll();

    expect(trades.data.length).toBe(0);
    expect(pbs.data.length).toBe(0);
    expect(notes.data.length).toBe(0);
    expect(Object.keys(settings.data).length).toBe(0);
  });
});

describe('StorageService.tradePlans', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  it('put + getAll + delete', async () => {
    await StorageService.tradePlans.put({ id: 'tp1', date: '2025-01-15', plan: 'Buy dips' });
    const r1 = await StorageService.tradePlans.getAll();
    expect(r1.data.length).toBe(1);
    expect(r1.data[0].plan).toBe('Buy dips');
    await StorageService.tradePlans.delete('tp1');
    const r2 = await StorageService.tradePlans.getAll();
    expect(r2.data.length).toBe(0);
  });
});
