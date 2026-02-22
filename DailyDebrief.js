// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Daily Debrief Generator (Sprint 4.2)
//
// Auto-generates an end-of-day summary from trade data:
//   "Today: 5 trades, +$420. Won 3/5. Best: AAPL Breakout (+$600).
//    Possible revenge trade at 2:15 PM cost you $180."
//
// Pure function — no side effects, no store access.
//
// Usage:
//   import { generateDebrief, generateWeeklyDebrief } from './DailyDebrief.js';
//   const summary = generateDebrief(trades, '2024-12-15');
//   const weeklySummary = generateWeeklyDebrief(trades);
// ═══════════════════════════════════════════════════════════════════

function fmtD(n) { return (n >= 0 ? '+' : '-') + '$' + Math.abs(n || 0).toFixed(2); }
function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

/**
 * Generate a daily debrief summary.
 *
 * @param {Object[]} trades - All trades from useTradeStore
 * @param {string} [dateStr] - Date to debrief (YYYY-MM-DD). Default: today.
 * @returns {Object} Debrief object
 */
export function generateDebrief(trades, dateStr) {
  const target = dateStr || new Date().toISOString().slice(0, 10);

  // Filter trades for target date
  const dayTrades = (trades || []).filter(t => {
    try { return new Date(t.date).toISOString().slice(0, 10) === target; }
    catch { return false; }
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (dayTrades.length === 0) {
    return {
      date: target,
      totalTrades: 0,
      headline: 'No trades today',
      sections: [],
      observations: [],
      grade: null,
    };
  }

  // ─── Core Stats ───────────────────────────────────────────
  const totalPnl = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const winners = dayTrades.filter(t => (t.pnl || 0) > 0);
  const losers = dayTrades.filter(t => (t.pnl || 0) < 0);
  const winRate = dayTrades.length > 0 ? (winners.length / dayTrades.length) * 100 : 0;
  const totalFees = dayTrades.reduce((s, t) => s + (t.fees || 0), 0);

  // Best and worst trade
  const best = [...dayTrades].sort((a, b) => (b.pnl || 0) - (a.pnl || 0))[0];
  const worst = [...dayTrades].sort((a, b) => (a.pnl || 0) - (b.pnl || 0))[0];

  // ─── Headline ─────────────────────────────────────────────
  const pnlEmoji = totalPnl > 0 ? '🟢' : totalPnl < 0 ? '🔴' : '⚪';
  const headline = `${pnlEmoji} ${dayTrades.length} trade${dayTrades.length !== 1 ? 's' : ''}, ${fmtD(totalPnl)}. Won ${winners.length}/${dayTrades.length}.`;

  // ─── Sections ─────────────────────────────────────────────
  const sections = [];

  sections.push({
    title: 'Overview',
    items: [
      `P&L: ${fmtD(totalPnl)}${totalFees > 0 ? ` (${fmtD(-totalFees)} in fees)` : ''}`,
      `Win Rate: ${winRate.toFixed(0)}% (${winners.length}W / ${losers.length}L)`,
      `Net: ${fmtD(totalPnl - totalFees)}`,
    ],
  });

  if (best && (best.pnl || 0) > 0) {
    sections.push({
      title: 'Best Trade',
      items: [
        `${best.symbol} ${best.playbook ? `(${best.playbook})` : ''} at ${fmtTime(best.date)}: ${fmtD(best.pnl)}`,
      ],
    });
  }

  if (worst && (worst.pnl || 0) < 0) {
    sections.push({
      title: 'Worst Trade',
      items: [
        `${worst.symbol} ${worst.playbook ? `(${worst.playbook})` : ''} at ${fmtTime(worst.date)}: ${fmtD(worst.pnl)}`,
      ],
    });
  }

  // ─── Observations (auto-detected) ────────────────────────
  const observations = [];

  // Revenge trade detection
  for (let i = 1; i < dayTrades.length; i++) {
    const prev = dayTrades[i - 1];
    const curr = dayTrades[i];
    if ((prev.pnl || 0) < 0) {
      const gap = Math.abs(new Date(curr.date) - new Date(prev.date)) / 60000;
      if (gap < 10 && (curr.pnl || 0) < 0) {
        observations.push({
          type: 'warning',
          text: `Possible revenge trade at ${fmtTime(curr.date)} — entered ${gap.toFixed(0)} min after a ${fmtD(prev.pnl)} loss, resulting in another ${fmtD(curr.pnl)} loss.`,
        });
      }
    }
  }

  // Win/loss streak within the day
  let streak = 0, maxWin = 0, maxLoss = 0;
  for (const t of dayTrades) {
    if ((t.pnl || 0) > 0) { streak = streak > 0 ? streak + 1 : 1; maxWin = Math.max(maxWin, streak); }
    else { streak = streak < 0 ? streak - 1 : -1; maxLoss = Math.max(maxLoss, Math.abs(streak)); }
  }
  if (maxWin >= 3) observations.push({ type: 'positive', text: `${maxWin}-trade winning streak!` });
  if (maxLoss >= 3) observations.push({ type: 'warning', text: `${maxLoss}-trade losing streak. Consider stepping away after 3 consecutive losses.` });

  // Emotional state
  const emotions = dayTrades.filter(t => t.emotion).map(t => t.emotion);
  if (emotions.length > 0) {
    const counts = {};
    emotions.forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (dominant[1] >= 2) {
      observations.push({ type: 'info', text: `Dominant emotion today: "${dominant[0]}" (${dominant[1]} trades)` });
    }
  }

  // Rule breaks
  const ruleBreaks = dayTrades.filter(t => t.ruleBreak);
  if (ruleBreaks.length > 0) {
    const rbPnl = ruleBreaks.reduce((s, t) => s + (t.pnl || 0), 0);
    observations.push({
      type: 'warning',
      text: `${ruleBreaks.length} rule break${ruleBreaks.length > 1 ? 's' : ''}: ${fmtD(rbPnl)} impact. Review and recommit.`,
    });
  }

  // ─── Grade ────────────────────────────────────────────────
  let grade = 'B';
  const hasRevenges = observations.filter(o => o.text.includes('revenge')).length;
  if (totalPnl > 0 && winRate > 60 && hasRevenges === 0 && ruleBreaks.length === 0) grade = 'A';
  else if (totalPnl > 0 && hasRevenges === 0) grade = 'B+';
  else if (totalPnl < 0 && hasRevenges > 0) grade = 'D';
  else if (totalPnl < 0 && ruleBreaks.length > 0) grade = 'C';
  else if (totalPnl < 0) grade = 'C+';

  // ─── Strategy breakdown ───────────────────────────────────
  const byPlaybook = {};
  for (const t of dayTrades) {
    const pb = t.playbook || 'Unclassified';
    if (!byPlaybook[pb]) byPlaybook[pb] = { wins: 0, losses: 0, pnl: 0 };
    byPlaybook[pb].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) byPlaybook[pb].wins++;
    else byPlaybook[pb].losses++;
  }
  const pbEntries = Object.entries(byPlaybook);
  if (pbEntries.length > 1) {
    sections.push({
      title: 'By Strategy',
      items: pbEntries.map(([name, s]) =>
        `${name}: ${s.wins}W/${s.losses}L, ${fmtD(s.pnl)}`
      ),
    });
  }

  return {
    date: target,
    totalTrades: dayTrades.length,
    totalPnl,
    winRate,
    headline,
    sections,
    observations,
    grade,
    trades: dayTrades,
  };
}

/**
 * Generate a weekly debrief (last 7 days).
 *
 * @param {Object[]} trades
 * @returns {Object} Weekly summary
 */
export function generateWeeklyDebrief(trades) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const weekTrades = (trades || []).filter(t => {
    try { const d = new Date(t.date); return d >= weekAgo && d <= now; }
    catch { return false; }
  });

  const totalPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const winners = weekTrades.filter(t => (t.pnl || 0) > 0);
  const winRate = weekTrades.length > 0 ? (winners.length / weekTrades.length) * 100 : 0;

  // Daily breakdown
  const byDay = {};
  for (const t of weekTrades) {
    const d = new Date(t.date).toISOString().slice(0, 10);
    if (!byDay[d]) byDay[d] = { pnl: 0, count: 0 };
    byDay[d].pnl += t.pnl || 0;
    byDay[d].count++;
  }

  const bestDay = Object.entries(byDay).sort((a, b) => b[1].pnl - a[1].pnl)[0];
  const worstDay = Object.entries(byDay).sort((a, b) => a[1].pnl - b[1].pnl)[0];

  return {
    period: `${weekAgo.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`,
    totalTrades: weekTrades.length,
    totalPnl,
    winRate,
    tradingDays: Object.keys(byDay).length,
    avgPnlPerDay: Object.keys(byDay).length > 0 ? totalPnl / Object.keys(byDay).length : 0,
    bestDay: bestDay ? { date: bestDay[0], pnl: bestDay[1].pnl, trades: bestDay[1].count } : null,
    worstDay: worstDay ? { date: worstDay[0], pnl: worstDay[1].pnl, trades: worstDay[1].count } : null,
    dailyBreakdown: byDay,
  };
}

export default generateDebrief;
