// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Store Tests
// Tests for: useTradeStore, useChartStore, useSettingsStore, useUIStore
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { useTradeStore } from '../state/useTradeStore.js';
import { useChartStore } from '../state/useChartStore.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useUIStore } from '../state/useUIStore.js';

const mkTrade = (id = 'test_1', pnl = 100) => ({
  id,
  date: '2025-01-15T10:00:00Z',
  symbol: 'BTC',
  side: 'long',
  pnl,
  fees: 2,
});

// ═══ Trade Store ════════════════════════════════════════════════
describe('useTradeStore', () => {
  it('starts with empty arrays', () => {
    const s = useTradeStore.getState();
    expect(Array.isArray(s.trades)).toBe(true);
    expect(Array.isArray(s.playbooks)).toBe(true);
    expect(Array.isArray(s.notes)).toBe(true);
  });

  it('addTrade prepends to array', () => {
    useTradeStore.setState({ trades: [] });
    useTradeStore.getState().addTrade(mkTrade('t1', 100));
    useTradeStore.getState().addTrade(mkTrade('t2', 200));
    const trades = useTradeStore.getState().trades;
    expect(trades.length).toBe(2);
    expect(trades[0].id).toBe('t2');
  });

  it('addTrades prepends batch', () => {
    useTradeStore.setState({ trades: [mkTrade('old', 50)] });
    useTradeStore.getState().addTrades([mkTrade('n1', 100), mkTrade('n2', 200)]);
    const trades = useTradeStore.getState().trades;
    expect(trades.length).toBe(3);
    expect(trades[0].id).toBe('n1');
    expect(trades[2].id).toBe('old');
  });

  it('deleteTrade removes by id', () => {
    useTradeStore.setState({ trades: [mkTrade('a'), mkTrade('b'), mkTrade('c')] });
    useTradeStore.getState().deleteTrade('b');
    const ids = useTradeStore.getState().trades.map((t) => t.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('updateTrade merges fields', () => {
    useTradeStore.setState({ trades: [mkTrade('x', 100)] });
    useTradeStore.getState().updateTrade('x', { pnl: 999, emotion: 'calm' });
    const t = useTradeStore.getState().trades[0];
    expect(t.pnl).toBe(999);
    expect(t.emotion).toBe('calm');
    expect(t.symbol).toBe('BTC');
  });

  it('addPlaybook / deletePlaybook', () => {
    useTradeStore.setState({ playbooks: [] });
    useTradeStore.getState().addPlaybook({ id: 'pb1', name: 'Breakout' });
    useTradeStore.getState().addPlaybook({ id: 'pb2', name: 'Reversal' });
    expect(useTradeStore.getState().playbooks.length).toBe(2);
    useTradeStore.getState().deletePlaybook('pb1');
    expect(useTradeStore.getState().playbooks.length).toBe(1);
    expect(useTradeStore.getState().playbooks[0].id).toBe('pb2');
  });

  it('addNote / deleteNote', () => {
    useTradeStore.setState({ notes: [] });
    useTradeStore.getState().addNote({ id: 'n1', text: 'Hello' });
    expect(useTradeStore.getState().notes[0].id).toBe('n1');
    useTradeStore.getState().deleteNote('n1');
    expect(useTradeStore.getState().notes.length).toBe(0);
  });

  it('hydrate replaces all data', () => {
    useTradeStore.getState().hydrate({
      trades: [mkTrade('h1')],
      playbooks: [{ id: 'p1', name: 'Test' }],
      notes: [{ id: 'n1', text: 'Note' }],
      tradePlans: [],
    });
    const s = useTradeStore.getState();
    expect(s.trades.length).toBe(1);
    expect(s.playbooks.length).toBe(1);
    expect(s.loaded).toBe(true);
  });

  it('reset clears to demo data', () => {
    useTradeStore.setState({ trades: [mkTrade('a'), mkTrade('b')], notes: [{ id: 'n' }] });
    useTradeStore.getState().reset([mkTrade('demo1')], [{ id: 'dpb' }]);
    const s = useTradeStore.getState();
    expect(s.trades.length).toBe(1);
    expect(s.trades[0].id).toBe('demo1');
    expect(s.playbooks.length).toBe(1);
    expect(s.notes.length).toBe(0);
  });

  it('subscribe fires on state change', () => {
    useTradeStore.setState({ trades: [] });
    let called = false;
    const unsub = useTradeStore.subscribe(() => { called = true; });
    useTradeStore.getState().addTrade(mkTrade('sub1'));
    expect(called).toBe(true);
    unsub();
  });

  it('selector returns slice', () => {
    useTradeStore.setState({ trades: [mkTrade('s1', 500)] });
    const trades = useTradeStore((s) => s.trades);
    expect(trades.length).toBe(1);
    expect(trades[0].pnl).toBe(500);
  });
});

// ═══ Chart Store ════════════════════════════════════════════════
describe('useChartStore', () => {
  it('has default symbol and tf', () => {
    const s = useChartStore.getState();
    expect(s.symbol).toBe('BTC');
    expect(s.tf).toBe('3m');
  });

  it('setSymbol uppercases', () => {
    useChartStore.getState().setSymbol('eth');
    expect(useChartStore.getState().symbol).toBe('ETH');
  });

  it('setTf updates timeframe', () => {
    useChartStore.getState().setTf('1d');
    expect(useChartStore.getState().tf).toBe('1d');
  });

  it('toggleLogScale flips', () => {
    useChartStore.setState({ logScale: false });
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(true);
    useChartStore.getState().toggleLogScale();
    expect(useChartStore.getState().logScale).toBe(false);
  });

  it('addIndicator / removeIndicator', () => {
    useChartStore.setState({ indicators: [] });
    useChartStore.getState().addIndicator({ type: 'rsi', params: { period: 14 } });
    expect(useChartStore.getState().indicators.length).toBe(1);
    useChartStore.getState().removeIndicator(0);
    expect(useChartStore.getState().indicators.length).toBe(0);
  });

  it('toggleReplay enters/exits replay mode', () => {
    useChartStore.setState({
      replayMode: false,
      data: Array(100).fill({ close: 100 }),
    });
    useChartStore.getState().toggleReplay();
    expect(useChartStore.getState().replayMode).toBe(true);
    expect(useChartStore.getState().replayIdx).toBeGreaterThan(0);
    useChartStore.getState().toggleReplay();
    expect(useChartStore.getState().replayMode).toBe(false);
    expect(useChartStore.getState().replayIdx).toBe(0);
  });
});

// ═══ Settings Store ═════════════════════════════════════════════
describe('useSettingsStore', () => {
  it('has default settings', () => {
    const s = useSettingsStore.getState();
    expect(s.dailyLossLimit).toBe(0);
    expect(s.defaultSymbol).toBe('BTC');
  });

  it('update merges settings', () => {
    useSettingsStore.getState().update({ dailyLossLimit: 500 });
    expect(useSettingsStore.getState().dailyLossLimit).toBe(500);
    expect(useSettingsStore.getState().defaultSymbol).toBe('BTC');
  });

  it('hydrate restores from storage', () => {
    useSettingsStore.getState().hydrate({
      dailyLossLimit: 1000,
      defaultSymbol: 'ETH',
    });
    expect(useSettingsStore.getState().dailyLossLimit).toBe(1000);
    expect(useSettingsStore.getState().defaultSymbol).toBe('ETH');
  });

  it('reset restores defaults', () => {
    useSettingsStore.getState().update({ dailyLossLimit: 9999 });
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().dailyLossLimit).toBe(0);
  });
});

// ═══ UI Store ═══════════════════════════════════════════════════
describe('useUIStore', () => {
  it('starts on dashboard', () => {
    expect(useUIStore.getState().page).toBe('dashboard');
  });

  it('setPage changes page', () => {
    useUIStore.getState().setPage('charts');
    expect(useUIStore.getState().page).toBe('charts');
  });

  it('modal open/close', () => {
    useUIStore.getState().openModal({ id: 't1', pnl: 100 });
    expect(useUIStore.getState().modal).not.toBeNull();
    expect(useUIStore.getState().modal.id).toBe('t1');
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().modal).toBeNull();
  });

  it('toggleZen flips', () => {
    useUIStore.setState({ zenMode: false });
    useUIStore.getState().toggleZen();
    expect(useUIStore.getState().zenMode).toBe(true);
  });

  it('closeAll closes everything', () => {
    useUIStore.setState({
      modal: { id: 'x' },
      confirmDialog: { msg: 'y' },
      cmdPaletteOpen: true,
      shortcutsOpen: true,
      quickTradeOpen: true,
    });
    useUIStore.getState().closeAll();
    const s = useUIStore.getState();
    expect(s.modal).toBeNull();
    expect(s.confirmDialog).toBeNull();
    expect(s.cmdPaletteOpen).toBe(false);
    expect(s.shortcutsOpen).toBe(false);
    expect(s.quickTradeOpen).toBe(false);
  });
});
