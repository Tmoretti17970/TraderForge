// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Export (Sprint 4.5)
//
// Export analytics data in multiple formats:
//   - HTML report (opens in new tab, printable to PDF via Ctrl+P)
//   - CSV trade data (downloadable)
//   - JSON full analytics dump
//
// Uses existing ReportGenerator for markdown, converts to styled HTML.
//
// Usage:
//   import { exportHTMLReport, exportTradesCSV, exportJSON } from './AnalyticsExport.js';
//   exportHTMLReport(trades, analytics, { title: 'Weekly Report' });
//   exportTradesCSV(trades, 'my-trades.csv');
// ═══════════════════════════════════════════════════════════════════

function fmtD(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(2); }
function fmtPct(n) { return (n || 0).toFixed(1) + '%'; }

/**
 * Generate a styled HTML performance report and open in a new tab.
 * User can then print to PDF via browser Ctrl+P.
 *
 * @param {Object[]} trades
 * @param {Object} analytics - Result from computeFast()
 * @param {Object} [opts]
 */
export function exportHTMLReport(trades, analytics, opts = {}) {
  const a = analytics || {};
  const title = opts.title || 'TradeForge Performance Report';
  const dateFrom = opts.dateFrom || '';
  const dateTo = opts.dateTo || '';
  const now = new Date().toISOString().slice(0, 10);

  // Filter trades by date range if specified
  let filtered = trades || [];
  if (dateFrom) filtered = filtered.filter(t => t.date >= dateFrom);
  if (dateTo) filtered = filtered.filter(t => t.date <= dateTo + 'T23:59:59');
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute basic stats from filtered trades
  const totalPnl = sorted.reduce((s, t) => s + (t.pnl || 0), 0);
  const winners = sorted.filter(t => (t.pnl || 0) > 0);
  const losers = sorted.filter(t => (t.pnl || 0) < 0);
  const winRate = sorted.length > 0 ? (winners.length / sorted.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + Math.abs(t.pnl), 0) / losers.length : 0;
  const profitFactor = losers.reduce((s, t) => s + Math.abs(t.pnl), 0) > 0
    ? winners.reduce((s, t) => s + t.pnl, 0) / losers.reduce((s, t) => s + Math.abs(t.pnl), 0)
    : 0;
  const totalFees = sorted.reduce((s, t) => s + (t.fees || 0), 0);

  // By-symbol breakdown
  const bySymbol = {};
  for (const t of sorted) {
    const sym = t.symbol || 'UNKNOWN';
    if (!bySymbol[sym]) bySymbol[sym] = { pnl: 0, count: 0, wins: 0 };
    bySymbol[sym].pnl += t.pnl || 0;
    bySymbol[sym].count++;
    if ((t.pnl || 0) > 0) bySymbol[sym].wins++;
  }

  // By-playbook breakdown
  const byPlaybook = {};
  for (const t of sorted) {
    const pb = t.playbook || 'Unclassified';
    if (!byPlaybook[pb]) byPlaybook[pb] = { pnl: 0, count: 0, wins: 0 };
    byPlaybook[pb].pnl += t.pnl || 0;
    byPlaybook[pb].count++;
    if ((t.pnl || 0) > 0) byPlaybook[pb].wins++;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 32px; max-width: 900px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 4px; font-size: 24px; }
    h2 { color: #c9d1d9; margin: 24px 0 12px; font-size: 16px; border-bottom: 1px solid #30363d; padding-bottom: 6px; }
    .meta { color: #8b949e; font-size: 12px; margin-bottom: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px; }
    .stat-label { font-size: 10px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
    .green { color: #3fb950; }
    .red { color: #f85149; }
    .blue { color: #58a6ff; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #161b22; color: #8b949e; text-transform: uppercase; font-size: 10px; letter-spacing: 0.04em; text-align: left; padding: 8px 10px; }
    td { padding: 6px 10px; border-bottom: 1px solid #21262d; font-family: 'JetBrains Mono', monospace; }
    tr:nth-child(even) { background: #161b2208; }
    .print-note { color: #8b949e; font-size: 11px; margin-top: 32px; text-align: center; }
    @media print {
      body { background: #fff; color: #1a1a2e; padding: 16px; }
      .stat-card { background: #f6f8fa; border-color: #d0d7de; }
      th { background: #f6f8fa; color: #57606a; }
      td { border-color: #d0d7de; }
      .green { color: #1a7f37; }
      .red { color: #cf222e; }
      .blue { color: #0969da; }
      h1 { color: #0969da; }
      h2 { border-color: #d0d7de; }
      .meta { color: #57606a; }
      .print-note { display: none; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    Generated ${now}${dateFrom ? ` · Period: ${dateFrom} to ${dateTo || 'present'}` : ''} · ${sorted.length} trades
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">Total P&L</div><div class="stat-value ${totalPnl >= 0 ? 'green' : 'red'}">${fmtD(totalPnl)}</div></div>
    <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value ${winRate >= 50 ? 'green' : 'red'}">${fmtPct(winRate)}</div></div>
    <div class="stat-card"><div class="stat-label">Profit Factor</div><div class="stat-value blue">${profitFactor.toFixed(2)}</div></div>
    <div class="stat-card"><div class="stat-label">Total Trades</div><div class="stat-value">${sorted.length}</div></div>
    <div class="stat-card"><div class="stat-label">Avg Win</div><div class="stat-value green">${fmtD(avgWin)}</div></div>
    <div class="stat-card"><div class="stat-label">Avg Loss</div><div class="stat-value red">${fmtD(-avgLoss)}</div></div>
    <div class="stat-card"><div class="stat-label">Fees</div><div class="stat-value red">${fmtD(-totalFees)}</div></div>
    <div class="stat-card"><div class="stat-label">Net P&L</div><div class="stat-value ${totalPnl - totalFees >= 0 ? 'green' : 'red'}">${fmtD(totalPnl - totalFees)}</div></div>
  </div>

  ${Object.keys(bySymbol).length > 1 ? `
  <h2>By Symbol</h2>
  <table>
    <thead><tr><th>Symbol</th><th>Trades</th><th>Win Rate</th><th>P&L</th></tr></thead>
    <tbody>
      ${Object.entries(bySymbol).sort((a, b) => b[1].pnl - a[1].pnl).map(([sym, d]) => `
        <tr>
          <td><strong>${sym}</strong></td>
          <td>${d.count}</td>
          <td>${(d.wins / d.count * 100).toFixed(0)}%</td>
          <td class="${d.pnl >= 0 ? 'green' : 'red'}">${fmtD(d.pnl)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>` : ''}

  ${Object.keys(byPlaybook).length > 1 ? `
  <h2>By Strategy</h2>
  <table>
    <thead><tr><th>Strategy</th><th>Trades</th><th>Win Rate</th><th>P&L</th></tr></thead>
    <tbody>
      ${Object.entries(byPlaybook).sort((a, b) => b[1].pnl - a[1].pnl).map(([pb, d]) => `
        <tr>
          <td><strong>${pb}</strong></td>
          <td>${d.count}</td>
          <td>${(d.wins / d.count * 100).toFixed(0)}%</td>
          <td class="${d.pnl >= 0 ? 'green' : 'red'}">${fmtD(d.pnl)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>` : ''}

  <h2>Trade Log (Last ${Math.min(50, sorted.length)})</h2>
  <table>
    <thead><tr><th>Date</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Strategy</th></tr></thead>
    <tbody>
      ${sorted.slice(0, 50).map(t => `
        <tr>
          <td>${t.date ? new Date(t.date).toLocaleDateString() : '—'}</td>
          <td><strong>${t.symbol || '—'}</strong></td>
          <td>${t.side || '—'}</td>
          <td>${t.entry ? '$' + t.entry.toFixed(2) : '—'}</td>
          <td>${t.exit ? '$' + t.exit.toFixed(2) : '—'}</td>
          <td class="${(t.pnl || 0) >= 0 ? 'green' : 'red'}">${fmtD(t.pnl || 0)}</td>
          <td>${t.playbook || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="print-note">
    Press Ctrl+P (Cmd+P on Mac) to save as PDF · Powered by TradeForge OS
  </div>
</body>
</html>`;

  // Open in new tab
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Export trades as CSV file download.
 *
 * @param {Object[]} trades
 * @param {string} [filename='tradeforge-trades.csv']
 */
export function exportTradesCSV(trades, filename = 'tradeforge-trades.csv') {
  const COLUMNS = [
    'Date', 'Symbol', 'Side', 'Entry', 'Exit', 'Qty', 'P&L', 'Fees',
    'Stop Loss', 'Take Profit', 'R Multiple', 'Asset Class', 'Strategy',
    'Emotion', 'Rating', 'Rule Break', 'Notes',
  ];

  const rows = (trades || []).map(t => [
    t.date || '',
    t.symbol || '',
    t.side || '',
    t.entry || '',
    t.exit || '',
    t.qty || '',
    t.pnl || 0,
    t.fees || 0,
    t.stopLoss || '',
    t.takeProfit || '',
    t.rMultiple || '',
    t.assetClass || '',
    t.playbook || '',
    t.emotion || '',
    t.rating || '',
    t.ruleBreak ? 'Yes' : 'No',
    (t.notes || '').replace(/"/g, '""'), // Escape quotes for CSV
  ]);

  const csvContent = [
    COLUMNS.join(','),
    ...rows.map(r => r.map(v => typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
      ? `"${v}"` : v
    ).join(',')),
  ].join('\n');

  downloadBlob(csvContent, filename, 'text/csv');
}

/**
 * Export full analytics result as JSON.
 *
 * @param {Object} analytics - Result from computeFast()
 * @param {string} [filename='tradeforge-analytics.json']
 */
export function exportJSON(analytics, filename = 'tradeforge-analytics.json') {
  const json = JSON.stringify(analytics, null, 2);
  downloadBlob(json, filename, 'application/json');
}

/**
 * Helper: trigger a browser download for a blob.
 */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default exportHTMLReport;
