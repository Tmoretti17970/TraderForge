// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Demo Data Generator
// Extracted from v9.3 monolith genDemoData().
// Generates realistic sample trades + playbooks for new users.
// ═══════════════════════════════════════════════════════════════════

let _uidCounter = 0;

/** Generate a simple unique ID */
function uid() {
  return 'tf_' + Date.now().toString(36) + '_' + (++_uidCounter).toString(36);
}

/** Create ISO date string for N days ago at given hour:minute */
function isoAt(daysAgo, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Generate demo trades and playbooks.
 * Returns { trades, playbooks } with ~12 sample trades spanning a week.
 *
 * @returns {{ trades: Object[], playbooks: Object[] }}
 */
function genDemoData() {
  _uidCounter = 0; // Reset for deterministic IDs in tests

  const playbooks = [
    {
      id: 'pb1',
      name: 'Trend Following',
      rules: [
        'Wait for 20 EMA alignment',
        'Confirm with volume',
        'Risk max 1% per trade',
      ],
    },
    {
      id: 'pb2',
      name: 'Mean Reversion',
      rules: [
        'RSI below 30 or above 70',
        'Wait for reversal candle',
        'Tight stop-loss at swing point',
      ],
    },
    {
      id: 'pb3',
      name: 'Breakout',
      rules: [
        'Wait for consolidation squeeze',
        'Enter on volume breakout',
        'Trail stop at prior swing',
      ],
    },
  ];

  const trades = [
    {
      id: uid(), date: isoAt(0, 9, 30), symbol: 'ES', assetClass: 'futures',
      side: 'long', qty: 2, entry: 6045.25, pnl: 487.50, fees: 4.60,
      playbook: 'Trend Following', emotion: 'Confident',
      rMultiple: 2.4, rating: 4,
      notes: 'Clean trend day. Held through morning pullback.',
      tags: ['A+setup', 'trendday'],
    },
    {
      id: uid(), date: isoAt(0, 14, 15), symbol: 'BTC', assetClass: 'crypto',
      side: 'long', qty: 0.15, entry: 97250, pnl: 312.00, fees: 8.40,
      playbook: 'Breakout', emotion: 'Focused',
      rMultiple: 1.8, rating: 3,
      notes: 'Breakout above 97k resistance.',
    },
    {
      id: uid(), date: isoAt(2, 10, 0), symbol: 'NQ', assetClass: 'futures',
      side: 'short', qty: 1, entry: 21420, pnl: -225.00, fees: 4.60,
      playbook: 'Mean Reversion', emotion: 'Anxious',
      rMultiple: -1.2, rating: 2,
      notes: 'Faded the gap but trend continued. Should have waited.',
    },
    {
      id: uid(), date: isoAt(3, 9, 45), symbol: 'CL', assetClass: 'futures',
      side: 'long', qty: 1, entry: 68.20, pnl: 340.00, fees: 4.60,
      playbook: 'Trend Following', emotion: 'Calm',
      rMultiple: 2.1, rating: 4,
    },
    {
      id: uid(), date: isoAt(3, 13, 0), symbol: 'BTC', assetClass: 'crypto',
      side: 'short', qty: 0.1, entry: 96800, pnl: -180.00, fees: 5.20,
      playbook: 'Mean Reversion', emotion: 'Frustrated',
      rMultiple: -0.9, rating: 1,
      notes: 'Revenge trade after morning miss. Bad discipline.',
      tags: ['revenge', 'overtrading'],
    },
    {
      id: uid(), date: isoAt(4, 10, 30), symbol: 'ES', assetClass: 'futures',
      side: 'long', qty: 2, entry: 6020.50, pnl: 625.00, fees: 4.60,
      playbook: 'Breakout', emotion: 'Confident',
      rMultiple: 3.1, rating: 5,
      notes: 'Perfect breakout. Added on pullback.',
      tags: ['A+setup'],
    },
    {
      id: uid(), date: isoAt(4, 15, 0), symbol: 'SOL', assetClass: 'crypto',
      side: 'long', qty: 10, entry: 178.50, pnl: 145.00, fees: 3.80,
      playbook: 'Trend Following', emotion: 'Neutral',
      rMultiple: 1.1, rating: 3,
    },
    {
      id: uid(), date: isoAt(5, 9, 30), symbol: 'NQ', assetClass: 'futures',
      side: 'long', qty: 1, entry: 21350, pnl: 475.00, fees: 4.60,
      playbook: 'Trend Following', emotion: 'Focused',
      rMultiple: 2.6, rating: 4,
      notes: 'Gap and go setup. Held for full move.',
      tags: ['gapandgo'],
    },
    {
      id: uid(), date: isoAt(5, 11, 0), symbol: 'ETH', assetClass: 'crypto',
      side: 'long', qty: 1.5, entry: 3380, pnl: -95.00, fees: 6.20,
      playbook: 'Breakout', emotion: 'Uncertain',
      rMultiple: -0.5, rating: 2,
      notes: 'False breakout. Cut quickly.',
    },
    {
      id: uid(), date: isoAt(6, 14, 30), symbol: 'ES', assetClass: 'futures',
      side: 'short', qty: 2, entry: 6080, pnl: -312.50, fees: 4.60,
      playbook: 'Mean Reversion', emotion: 'Anxious',
      rMultiple: -1.5, rating: 1,
      notes: 'Faded strength into FOMC. Should know better.',
      tags: ['FOMC', 'overtrading'],
    },
    {
      id: uid(), date: isoAt(6, 10, 0), symbol: 'BTC', assetClass: 'crypto',
      side: 'long', qty: 0.2, entry: 95800, pnl: 520.00, fees: 9.60,
      playbook: 'Trend Following', emotion: 'Calm',
      rMultiple: 2.8, rating: 5,
      tags: ['A+setup', 'trendday'],
    },
  ];

  // ─── Add ~30 more generated trades for a meaningful demo ────
  const extraSymbols = ['ES', 'NQ', 'BTC', 'ETH', 'CL', 'SOL', 'AAPL', 'SPY'];
  const extraEmotions = ['Calm', 'Confident', 'Neutral', 'Uncertain', 'Focused', 'Anxious'];
  const extraPlaybooks = ['Trend Following', 'Mean Reversion', 'Breakout', 'Scalp'];
  const seed = 42;
  let s = seed;
  const rand = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };

  for (let i = 0; i < 30; i++) {
    const daysAgo = 7 + Math.floor(rand() * 25); // spread days 7-32 ago
    const hour = 8 + Math.floor(rand() * 8);
    const minute = Math.floor(rand() * 60);
    const sym = extraSymbols[Math.floor(rand() * extraSymbols.length)];
    const side = rand() > 0.5 ? 'long' : 'short';
    const pb = extraPlaybooks[Math.floor(rand() * extraPlaybooks.length)];
    const emo = extraEmotions[Math.floor(rand() * extraEmotions.length)];
    // Slight positive bias: 55% win rate
    const isWin = rand() < 0.55;
    const pnl = isWin
      ? Math.round((50 + rand() * 600) * 100) / 100
      : -Math.round((30 + rand() * 400) * 100) / 100;
    const fees = Math.round(rand() * 8 * 100) / 100;

    trades.push({
      id: uid(),
      date: isoAt(daysAgo, hour, minute),
      symbol: sym,
      assetClass: ['BTC', 'ETH', 'SOL'].includes(sym) ? 'crypto' : sym === 'AAPL' || sym === 'SPY' ? 'stocks' : 'futures',
      side,
      qty: Math.ceil(rand() * 10),
      entry: Math.round((100 + rand() * 4900) * 100) / 100,
      exit: 0,
      pnl,
      fees,
      emotion: emo,
      playbook: pb,
      rMultiple: Math.round((pnl / 200) * 100) / 100,
      tags: [],
    });
  }

  // Sort trades by date descending (newest first)
  trades.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { trades, playbooks };
}

/**
 * Generate N random trades for stress testing.
 * @param {number} n — number of trades
 * @param {Object} [opts]
 * @param {string[]} [opts.symbols] — symbol pool
 * @param {number} [opts.maxPnl] — max absolute P&L
 * @returns {Object[]}
 */
function genRandomTrades(n, opts = {}) {
  const {
    symbols = ['ES', 'NQ', 'BTC', 'ETH', 'AAPL', 'SPY', 'CL', 'SOL'],
    maxPnl = 1000,
  } = opts;

  const sides = ['long', 'short'];
  const emotions = ['Calm', 'Confident', 'Neutral', 'Uncertain', 'Anxious', 'Focused'];
  const playbooks = ['Trend Following', 'Mean Reversion', 'Breakout', 'Scalp'];

  return Array.from({ length: n }, (_, i) => {
    const daysAgo = Math.floor(Math.random() * 90);
    const hour = 8 + Math.floor(Math.random() * 8);
    const minute = Math.floor(Math.random() * 60);
    const pnl = (Math.random() - 0.45) * maxPnl * 2; // slight positive bias

    return {
      id: uid(),
      date: isoAt(daysAgo, hour, minute),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      side: sides[Math.floor(Math.random() * sides.length)],
      pnl: Math.round(pnl * 100) / 100,
      fees: Math.round(Math.random() * 10 * 100) / 100,
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      playbook: playbooks[Math.floor(Math.random() * playbooks.length)],
      rMultiple: Math.round((pnl / (maxPnl * 0.3)) * 100) / 100,
    };
  });
}

export { genDemoData, genRandomTrades, uid, isoAt };
export default genDemoData;
