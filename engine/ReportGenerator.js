// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Analytics Report Generator (Sprint 8)
//
// J2.6: Generate markdown performance summary for date ranges.
// Useful for prop firm evaluations, self-review, and sharing.
//
// Usage:
//   import { generateReport } from './ReportGenerator.js';
//   const md = generateReport(trades, analytics, options);
// ═══════════════════════════════════════════════════════════════════

import { fmtD } from '../utils.js';

/**
 * Generate a comprehensive markdown performance report.
 *
 * @param {Object[]} trades - Trade array
 * @param {Object} analytics - Result from computeFast()
 * @param {Object} [opts]
 * @param {string} [opts.title] - Report title
 * @param {string} [opts.dateFrom] - Start date filter
 * @param {string} [opts.dateTo] - End date filter
 * @param {Object} [opts.propFirm] - Prop firm evaluation state
 * @param {Object} [opts.prediction] - MC prediction results
 * @returns {string} Markdown report
 */
function generateReport(trades, analytics, opts = {}) {
  const a = analytics || {};
  const title = opts.title || 'TradeForge Performance Report';
  const now = new Date().toISOString().slice(0, 10);
  const dateRange = opts.dateFrom && opts.dateTo
    ? `${opts.dateFrom} to ${opts.dateTo}`
    : `All time (as of ${now})`;

  // Filter trades by date range
  let filtered = trades || [];
  if (opts.dateFrom) filtered = filtered.filter(t => t.date >= opts.dateFrom);
  if (opts.dateTo) filtered = filtered.filter(t => t.date <= opts.dateTo);

  const sections = [];

  // ─── Header ─────────────────────────────────────────
  sections.push(`# ${title}\n`);
  sections.push(`**Generated:** ${new Date().toLocaleString()}  `);
  sections.push(`**Period:** ${dateRange}  `);
  sections.push(`**Total Trades:** ${filtered.length}\n`);

  // ─── Key Metrics ────────────────────────────────────
  sections.push(`## Key Metrics\n`);
  sections.push(`| Metric | Value |`);
  sections.push(`|---|---|`);
  sections.push(`| Total P&L | ${fmtD(a.totalPnl || 0)} |`);
  sections.push(`| Win Rate | ${(a.winRate || 0).toFixed(1)}% |`);
  sections.push(`| Profit Factor | ${a.pf === Infinity ? '∞' : (a.pf || 0).toFixed(2)} |`);
  sections.push(`| Expectancy | ${fmtD(a.expectancy || 0)} / trade |`);
  sections.push(`| Sharpe Ratio | ${(a.sharpe || 0).toFixed(2)} |`);
  sections.push(`| Sortino Ratio | ${(a.sortino || 0).toFixed(2)} |`);
  sections.push(`| Max Drawdown | ${(a.maxDd || 0).toFixed(1)}% |`);
  sections.push(`| Avg Win | ${fmtD(a.avgWin || 0)} |`);
  sections.push(`| Avg Loss | ${fmtD(a.avgLoss || 0)} |`);
  sections.push(`| Reward/Risk | ${(a.rr || 0).toFixed(2)}:1 |`);
  sections.push(`| Best Trade | ${fmtD(a.largestWin || 0)} |`);
  sections.push(`| Worst Trade | ${fmtD(a.largestLoss || 0)} |`);
  sections.push(`| Best Streak | ${a.bestStreak || 0} wins |`);
  sections.push(`| Worst Streak | ${Math.abs(a.worstStreak || 0)} losses |`);
  sections.push(`| Kelly Criterion | ${((a.kelly || 0) * 100).toFixed(1)}% |`);
  sections.push(`| MC Risk of Ruin | ${(a.ror || 0).toFixed(1)}% |`);
  sections.push('');

  // ─── Win/Loss Breakdown ─────────────────────────────
  sections.push(`## Win/Loss Breakdown\n`);
  sections.push(`- **Wins:** ${a.winCount || 0} (${(a.winRate || 0).toFixed(1)}%)`);
  sections.push(`- **Losses:** ${a.lossCount || 0} (${(100 - (a.winRate || 0)).toFixed(1)}%)`);
  sections.push(`- **Breakeven:** ${(filtered.length || 0) - (a.winCount || 0) - (a.lossCount || 0)}`);
  sections.push('');

  // ─── Performance by Symbol ──────────────────────────
  if (a.bySym && Object.keys(a.bySym).length > 0) {
    sections.push(`## Performance by Symbol\n`);
    sections.push(`| Symbol | P&L | Trades | Win Rate |`);
    sections.push(`|---|---|---|---|`);
    const sorted = Object.entries(a.bySym).sort((x, y) => y[1].pnl - x[1].pnl);
    for (const [sym, data] of sorted) {
      const wr = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : '0';
      sections.push(`| ${sym} | ${fmtD(data.pnl)} | ${data.count} | ${wr}% |`);
    }
    sections.push('');
  }

  // ─── Performance by Playbook ────────────────────────
  if (a.byPlaybook && Object.keys(a.byPlaybook).length > 0) {
    sections.push(`## Performance by Strategy\n`);
    sections.push(`| Playbook | P&L | Trades | Win Rate |`);
    sections.push(`|---|---|---|---|`);
    const sorted = Object.entries(a.byPlaybook).sort((x, y) => y[1].pnl - x[1].pnl);
    for (const [pb, data] of sorted) {
      if (!pb) continue;
      const wr = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : '0';
      sections.push(`| ${pb} | ${fmtD(data.pnl)} | ${data.count} | ${wr}% |`);
    }
    sections.push('');
  }

  // ─── Prop Firm Evaluation ───────────────────────────
  if (opts.propFirm) {
    const pf = opts.propFirm;
    sections.push(`## Prop Firm Evaluation\n`);
    sections.push(`| Parameter | Value |`);
    sections.push(`|---|---|`);
    sections.push(`| Status | ${pf.status?.toUpperCase() || 'N/A'} |`);
    sections.push(`| Cumulative P&L | ${fmtD(pf.cumPnl || 0)} |`);
    sections.push(`| Profit Target | ${fmtD(pf.targetAbs || 0)} |`);
    sections.push(`| Target Progress | ${(pf.targetProgress || 0).toFixed(0)}% |`);
    sections.push(`| Current Drawdown | ${fmtD(pf.trailingDD || 0)} / ${fmtD(pf.maxDDAbs || 0)} |`);
    sections.push(`| DD Progress | ${(pf.ddProgress || 0).toFixed(0)}% |`);
    sections.push(`| Days Traded | ${pf.daysTraded || 0} |`);
    sections.push(`| Calendar Days | ${pf.calendarDays || 0} |`);
    if (pf.failReason) sections.push(`| Fail Reason | ${pf.failReason} |`);
    sections.push('');

    // MC Prediction
    if (opts.prediction && !opts.prediction.insufficient) {
      const pred = opts.prediction;
      sections.push(`### Monte Carlo Prediction (${pred.runs.toLocaleString()} simulations)\n`);
      sections.push(`- **Pass Probability:** ${pred.passRate.toFixed(1)}%`);
      sections.push(`- **Fail Probability:** ${pred.failRate.toFixed(1)}%`);
      sections.push(`- **Avg Days to Pass:** ${pred.avgDaysToPass}`);
      sections.push(`- **Median Final P&L:** ${fmtD(pred.medianFinalPnl)}`);
      sections.push(`- **P10/P50/P90:** ${fmtD(pred.p10)} / ${fmtD(pred.p50)} / ${fmtD(pred.p90)}`);
      sections.push(`- **Confidence:** ${pred.confidence}`);
      sections.push('');
    }
  }

  // ─── Insights ───────────────────────────────────────
  if (a.insights?.length) {
    sections.push(`## Insights\n`);
    for (const ins of a.insights) {
      const icon = ins.t === 'positive' ? '✅' : ins.t === 'warning' ? '⚠️' : 'ℹ️';
      sections.push(`${icon} ${ins.x}`);
    }
    sections.push('');
  }

  // ─── Footer ─────────────────────────────────────────
  sections.push(`---\n*Generated by TradeForge OS v10.9*`);

  return sections.join('\n');
}

/**
 * Download report as markdown file.
 */
function downloadReport(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `tradeforge-report-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { generateReport, downloadReport };
