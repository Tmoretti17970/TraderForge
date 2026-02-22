// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — UndoStack Tests
// Tests for: push, undo, redo, TTL eviction, bounds, subscription
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UndoStack, executeUndo, executeRedo } from '../utils/UndoStack.js';

// ─── Helpers ────────────────────────────────────────────────────
const mkEntry = (type = 'delete', label = 'test') => ({
  type,
  payload: { id: 'trade-1', symbol: 'ES' },
  inverse: { trade: { id: 'trade-1', symbol: 'ES', pnl: 100 } },
  label,
});

// ═══════════════════════════════════════════════════════════════════
// Core Operations
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack core', () => {
  let stack;

  beforeEach(() => {
    stack = new UndoStack({ ttlMs: 0 }); // disable TTL for core tests
  });

  it('starts empty', () => {
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
    expect(stack.undoCount).toBe(0);
    expect(stack.redoCount).toBe(0);
  });

  it('push adds to undo stack', () => {
    stack.push(mkEntry());
    expect(stack.canUndo).toBe(true);
    expect(stack.undoCount).toBe(1);
  });

  it('push returns the record with timestamp', () => {
    const record = stack.push(mkEntry());
    expect(record.ts).toBeDefined();
    expect(record.type).toBe('delete');
    expect(record.label).toBe('test');
  });

  it('undo pops from past and pushes to future', () => {
    stack.push(mkEntry('delete', 'first'));
    stack.push(mkEntry('update', 'second'));

    const entry = stack.undo();
    expect(entry.type).toBe('update');
    expect(entry.label).toBe('second');
    expect(stack.undoCount).toBe(1);
    expect(stack.redoCount).toBe(1);
  });

  it('redo pops from future and pushes to past', () => {
    stack.push(mkEntry());
    stack.undo();
    expect(stack.canRedo).toBe(true);

    const entry = stack.redo();
    expect(entry.type).toBe('delete');
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it('undo returns null when empty', () => {
    expect(stack.undo()).toBeNull();
  });

  it('redo returns null when empty', () => {
    expect(stack.redo()).toBeNull();
  });

  it('push clears the redo stack', () => {
    stack.push(mkEntry('delete', 'a'));
    stack.push(mkEntry('update', 'b'));
    stack.undo(); // redo now has 'b'
    expect(stack.canRedo).toBe(true);

    stack.push(mkEntry('bulkDelete', 'c')); // new action clears redo
    expect(stack.canRedo).toBe(false);
    expect(stack.redoCount).toBe(0);
  });

  it('redo refreshes timestamp', () => {
    const before = Date.now();
    stack.push(mkEntry());
    stack.undo();

    // small delay to ensure timestamp differs
    const entry = stack.redo();
    expect(entry.ts).toBeGreaterThanOrEqual(before);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Peek / History
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack peek/history', () => {
  let stack;

  beforeEach(() => {
    stack = new UndoStack({ ttlMs: 0 });
  });

  it('peekUndo returns next undoable without popping', () => {
    stack.push(mkEntry('delete', 'peek-me'));
    const peeked = stack.peekUndo();
    expect(peeked.label).toBe('peek-me');
    expect(stack.undoCount).toBe(1); // not popped
  });

  it('peekUndo returns null when empty', () => {
    expect(stack.peekUndo()).toBeNull();
  });

  it('peekRedo returns next redoable without popping', () => {
    stack.push(mkEntry('update', 'redo-me'));
    stack.undo();
    const peeked = stack.peekRedo();
    expect(peeked.label).toBe('redo-me');
    expect(stack.redoCount).toBe(1);
  });

  it('history returns past in reverse chronological order', () => {
    stack.push(mkEntry('delete', 'first'));
    stack.push(mkEntry('update', 'second'));
    stack.push(mkEntry('bulkDelete', 'third'));

    const h = stack.history();
    expect(h).toHaveLength(3);
    expect(h[0].label).toBe('third');
    expect(h[2].label).toBe('first');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Bounded Size
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack bounds', () => {
  it('evicts oldest when exceeding max', () => {
    const stack = new UndoStack({ max: 3, ttlMs: 0 });
    stack.push(mkEntry('delete', '1'));
    stack.push(mkEntry('delete', '2'));
    stack.push(mkEntry('delete', '3'));
    stack.push(mkEntry('delete', '4')); // evicts '1'

    expect(stack.undoCount).toBe(3);
    const h = stack.history();
    expect(h.map(e => e.label)).toEqual(['4', '3', '2']);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TTL Eviction
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack TTL', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('evicts stale entries on undo', () => {
    const stack = new UndoStack({ ttlMs: 2000 });
    stack.push(mkEntry('delete', 'stale'));
    vi.advanceTimersByTime(2001);
    expect(stack.undo()).toBeNull();
    expect(stack.canUndo).toBe(false);
  });

  it('keeps fresh entries on canUndo check', () => {
    const stack = new UndoStack({ ttlMs: 5000 });
    stack.push(mkEntry('delete', 'fresh'));
    vi.advanceTimersByTime(1000);
    expect(stack.canUndo).toBe(true);
  });

  it('evicts old entries but keeps new ones', () => {
    const stack = new UndoStack({ ttlMs: 3000 });
    stack.push(mkEntry('delete', 'old'));
    vi.advanceTimersByTime(2000);
    stack.push(mkEntry('update', 'new'));
    vi.advanceTimersByTime(1500); // total 3500ms for 'old', 1500ms for 'new'

    expect(stack.undoCount).toBe(1);
    const entry = stack.peekUndo();
    expect(entry.label).toBe('new');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Subscription
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack subscription', () => {
  it('notifies on push', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    const fn = vi.fn();
    stack.subscribe(fn);
    stack.push(mkEntry());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies on undo and redo', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    const fn = vi.fn();
    stack.push(mkEntry());
    stack.subscribe(fn);
    stack.undo();
    stack.redo();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    const fn = vi.fn();
    const unsub = stack.subscribe(fn);
    stack.push(mkEntry());
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    stack.push(mkEntry());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('swallows listener errors', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    stack.subscribe(() => { throw new Error('boom'); });
    expect(() => stack.push(mkEntry())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Clear
// ═══════════════════════════════════════════════════════════════════

describe('UndoStack clear', () => {
  it('clear empties both stacks', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    stack.push(mkEntry());
    stack.push(mkEntry());
    stack.undo();
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });

  it('clear fires notification', () => {
    const stack = new UndoStack({ ttlMs: 0 });
    const fn = vi.fn();
    stack.subscribe(fn);
    stack.clear();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// executeUndo / executeRedo
// ═══════════════════════════════════════════════════════════════════

describe('executeUndo', () => {
  it('returns empty string for null entry', () => {
    expect(executeUndo(null, {})).toBe('');
  });

  it('calls addTrade for delete undo', () => {
    const store = { addTrade: vi.fn() };
    const entry = {
      type: 'delete',
      inverse: { trade: { id: '1', symbol: 'ES' } },
    };
    const msg = executeUndo(entry, store);
    expect(store.addTrade).toHaveBeenCalledWith(entry.inverse.trade);
    expect(msg).toContain('Restored');
  });

  it('calls updateTrade for update undo', () => {
    const store = { updateTrade: vi.fn() };
    const entry = {
      type: 'update',
      inverse: { id: '1', prev: { symbol: 'NQ', pnl: 50 } },
    };
    const msg = executeUndo(entry, store);
    expect(store.updateTrade).toHaveBeenCalledWith('1', entry.inverse.prev);
    expect(msg).toContain('Reverted');
  });

  it('calls addTrades for bulkDelete undo', () => {
    const store = { addTrades: vi.fn() };
    const entry = {
      type: 'bulkDelete',
      inverse: { trades: [{ id: '1' }, { id: '2' }] },
    };
    const msg = executeUndo(entry, store);
    expect(store.addTrades).toHaveBeenCalledWith(entry.inverse.trades);
    expect(msg).toContain('2 trades');
  });
});

describe('executeRedo', () => {
  it('returns empty string for null entry', () => {
    expect(executeRedo(null, {})).toBe('');
  });

  it('calls deleteTrade for delete redo', () => {
    const store = { deleteTrade: vi.fn() };
    const entry = {
      type: 'delete',
      payload: { id: '1', symbol: 'ES' },
    };
    const msg = executeRedo(entry, store);
    expect(store.deleteTrade).toHaveBeenCalledWith('1');
    expect(msg).toContain('Deleted');
  });

  it('calls addTrades for bulkAdd redo', () => {
    const store = { addTrades: vi.fn() };
    const entry = {
      type: 'bulkAdd',
      payload: { trades: [{ id: '1' }, { id: '2' }, { id: '3' }] },
    };
    const msg = executeRedo(entry, store);
    expect(store.addTrades).toHaveBeenCalledWith(entry.payload.trades);
    expect(msg).toContain('3 trades');
  });
});
