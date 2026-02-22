// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Behavioral Pattern Detector (Sprint 4.1)
//
// Pure-function rules engine that scans trade history and generates
// actionable insights. No LLM needed — all pattern matching + stats.
//
// Categories:
//   - Timing patterns (time of day, day of week)
//   - Revenge/tilt detection (rapid losses after a loss)
//   - Streak analysis (win/loss streaks and behavior after)
//   - Strategy performance (which setups actually work)
//   - Emotional patterns (emotions correlated with outcomes)
//   - Risk management (overtrading, oversizing)
//   - Symbol performance (which instruments you trade best)
//
// Usage:
//   import { detectPatterns } from './PatternDetector.js';
//   const insights = detectPatterns(trades); // returns sorted by impact
// ═══════════════════════════════════════════════════════════════════

// ─── Helpers ────────────────────────────────────────────────────

function safeDiv(a, b) { return b === 0 ? 0 : a / b; }
function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10; }
function fmtPnl(n) { return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toFixed(0); }
function fmtPct(n) { return n.toFixed(1) + '%'; }

function getHour(trade) {
  try { return new Date(trade.date).getHours(); } catch { return -1; }
}
function getDayOfWeek(trade) {
  try { return new Date(trade.date).getDay(); } catch { return -1; }
}
function getDateStr(trade) {
  try { return new Date(trade.date).toISOString().slice(0, 10); } catch { return ''; }
}
function minutesBetween(t1, t2) {
  try {
    return Math.abs(new Date(t1.date) - new Date(t2.date)) / 60000;
  } catch { return Infinity; }
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Insight Object Builder ─────────────────────────────────────

/**
 * @typedef {Object} Insight
 * @property {string} id - Unique key for dedup
 * @property {'positive'|'warning'|'danger'|'info'} severity
 * @property {string} category - Pattern category
 * @property {string} title - Short headline
 * @property {string} body - Detailed explanation
 * @property {number} impact - Estimated $ impact (for sorting)
 * @property {number} confidence - 0-1 confidence score
 * @property {number} sampleSize - Number of trades analyzed
 */

function insight(id, severity, category, title, body, impact = 0, confidence = 0.5, sampleSize = 0) {
  return { id, severity, category, title, body, impact: Math.abs(impact), confidence, sampleSize };
}

// ─── Pattern Rules ──────────────────────────────────────────────

function ruleTimeOfDay(trades) {
  const results = [];
  if (trades.length < 15) return results;

  // Bucket by hour
  const hourBuckets = {};
  for (const t of trades) {
    const h = getHour(t);
    if (h < 0) continue;
    if (!hourBuckets[h]) hourBuckets[h] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    hourBuckets[h].count++;
    hourBuckets[h].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) hourBuckets[h].wins++;
    else hourBuckets[h].losses++;
  }

  // Find worst hour (min 3 trades)
  let worstHour = null, worstPnl = 0;
  let bestHour = null, bestPnl = -Infinity;
  for (const [h, b] of Object.entries(hourBuckets)) {
    if (b.count < 3) continue;
    if (b.pnl < worstPnl) { worstPnl = b.pnl; worstHour = { h: +h, ...b }; }
    if (b.pnl > bestPnl) { bestPnl = b.pnl; bestHour = { h: +h, ...b }; }
  }

  if (worstHour && worstHour.pnl < -50 && worstHour.count >= 3) {
    const wr = pct(worstHour.wins, worstHour.count);
    results.push(insight(
      'time_worst_hour',
      'warning',
      'Timing',
      `${worstHour.h}:00 is your worst trading hour`,
      `You've taken ${worstHour.count} trades at ${worstHour.h}:00 with a ${fmtPct(wr)} win rate and ${fmtPnl(worstHour.pnl)} P&L. Consider avoiding this hour.`,
      worstHour.pnl, 0.7, worstHour.count
    ));
  }

  if (bestHour && bestHour.pnl > 50 && bestHour.count >= 3) {
    const wr = pct(bestHour.wins, bestHour.count);
    results.push(insight(
      'time_best_hour',
      'positive',
      'Timing',
      `${bestHour.h}:00 is your best trading hour`,
      `${bestHour.count} trades at ${bestHour.h}:00 → ${fmtPct(wr)} win rate, ${fmtPnl(bestHour.pnl)} total. Focus your best setups here.`,
      bestHour.pnl, 0.7, bestHour.count
    ));
  }

  // First 30 min vs rest
  const earlyTrades = trades.filter(t => { const h = getHour(t); return h >= 9 && h < 10; });
  if (earlyTrades.length >= 5) {
    const earlyPnl = earlyTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const earlyWR = pct(earlyTrades.filter(t => (t.pnl || 0) > 0).length, earlyTrades.length);
    if (earlyPnl < -100 && earlyWR < 45) {
      results.push(insight(
        'time_early_danger',
        'danger',
        'Timing',
        `Early trading is costing you ${fmtPnl(earlyPnl)}`,
        `${earlyTrades.length} trades in the first hour: ${fmtPct(earlyWR)} win rate. The market open is volatile — consider waiting 30+ minutes.`,
        earlyPnl, 0.8, earlyTrades.length
      ));
    }
  }

  return results;
}

function ruleDayOfWeek(trades) {
  const results = [];
  if (trades.length < 20) return results;

  const dayBuckets = {};
  for (const t of trades) {
    const d = getDayOfWeek(t);
    if (d < 0) continue;
    if (!dayBuckets[d]) dayBuckets[d] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    dayBuckets[d].count++;
    dayBuckets[d].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) dayBuckets[d].wins++;
    else dayBuckets[d].losses++;
  }

  let worstDay = null, worstPnl = 0;
  for (const [d, b] of Object.entries(dayBuckets)) {
    if (b.count < 3 && b.pnl < worstPnl) { worstPnl = b.pnl; worstDay = { d: +d, ...b }; }
    if (b.count >= 3 && b.pnl < worstPnl) { worstPnl = b.pnl; worstDay = { d: +d, ...b }; }
  }

  if (worstDay && worstDay.pnl < -100 && worstDay.count >= 3) {
    const wr = pct(worstDay.wins, worstDay.count);
    results.push(insight(
      'dow_worst',
      'warning',
      'Timing',
      `${DOW_NAMES[worstDay.d]}s are your worst day`,
      `${worstDay.count} trades on ${DOW_NAMES[worstDay.d]}s: ${fmtPct(wr)} win rate, ${fmtPnl(worstDay.pnl)} total.`,
      worstDay.pnl, 0.6, worstDay.count
    ));
  }

  return results;
}

function ruleRevengeTrading(trades) {
  const results = [];
  if (trades.length < 10) return results;

  // Sort by date ascending
  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  let revengeCount = 0;
  let revengePnl = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevPnl = prev.pnl || 0;
    const currPnl = curr.pnl || 0;

    // Revenge pattern: loss followed by another trade within 10 minutes
    if (prevPnl < 0 && minutesBetween(prev, curr) < 10) {
      revengeCount++;
      revengePnl += currPnl;
    }
  }

  if (revengeCount >= 3) {
    const avgRevengePnl = safeDiv(revengePnl, revengeCount);
    results.push(insight(
      'revenge_trading',
      revengePnl < 0 ? 'danger' : 'warning',
      'Discipline',
      `${revengeCount} probable revenge trades detected`,
      `You entered ${revengeCount} trades within 10 minutes of a loss. These "revenge trades" averaged ${fmtPnl(avgRevengePnl)} each (${fmtPnl(revengePnl)} total). Take a break after losses.`,
      revengePnl, 0.75, revengeCount
    ));
  }

  return results;
}

function ruleStreaks(trades) {
  const results = [];
  if (trades.length < 10) return results;

  const sorted = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Track behavior after 3+ loss streaks
  let streak = 0;
  let afterStreakTrades = [];

  for (let i = 0; i < sorted.length; i++) {
    if ((sorted[i].pnl || 0) < 0) {
      streak++;
    } else {
      if (streak >= 3 && i < sorted.length) {
        afterStreakTrades.push(sorted[i]);
      }
      streak = 0;
    }
  }

  if (afterStreakTrades.length >= 3) {
    const afterPnl = afterStreakTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const afterWR = pct(afterStreakTrades.filter(t => (t.pnl || 0) > 0).length, afterStreakTrades.length);

    results.push(insight(
      'after_loss_streak',
      afterPnl > 0 ? 'positive' : 'warning',
      'Psychology',
      afterPnl > 0
        ? `You recover well after losing streaks`
        : `Losing streaks compound — ${fmtPnl(afterPnl)} on recovery trades`,
      `${afterStreakTrades.length} trades taken after 3+ loss streaks: ${fmtPct(afterWR)} win rate, ${fmtPnl(afterPnl)} total. ${afterPnl < 0 ? 'Consider stopping after 3 consecutive losses.' : 'You stay disciplined under pressure.'}`,
      afterPnl, 0.6, afterStreakTrades.length
    ));
  }

  return results;
}

function ruleStrategyPerformance(trades) {
  const results = [];
  const byPlaybook = {};

  for (const t of trades) {
    const pb = t.playbook || 'Unclassified';
    if (!byPlaybook[pb]) byPlaybook[pb] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    byPlaybook[pb].count++;
    byPlaybook[pb].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) byPlaybook[pb].wins++;
    else byPlaybook[pb].losses++;
  }

  const entries = Object.entries(byPlaybook).filter(([, b]) => b.count >= 3);
  if (entries.length < 2) return results;

  // Sort by P&L
  entries.sort((a, b) => b[1].pnl - a[1].pnl);

  const best = entries[0];
  const worst = entries[entries.length - 1];

  if (best[1].pnl > 0) {
    results.push(insight(
      'strategy_best',
      'positive',
      'Strategy',
      `"${best[0]}" is your best strategy`,
      `${best[1].count} trades, ${fmtPct(pct(best[1].wins, best[1].count))} win rate, ${fmtPnl(best[1].pnl)} total. Trade more of this setup.`,
      best[1].pnl, 0.7, best[1].count
    ));
  }

  if (worst[1].pnl < -50) {
    results.push(insight(
      'strategy_worst',
      'warning',
      'Strategy',
      `"${worst[0]}" is dragging your performance`,
      `${worst[1].count} trades, ${fmtPct(pct(worst[1].wins, worst[1].count))} win rate, ${fmtPnl(worst[1].pnl)} total. Consider refining or dropping this setup.`,
      worst[1].pnl, 0.7, worst[1].count
    ));
  }

  return results;
}

function ruleEmotionCorrelation(trades) {
  const results = [];
  const byEmotion = {};

  for (const t of trades) {
    const em = (t.emotion || '').toLowerCase().trim();
    if (!em) continue;
    if (!byEmotion[em]) byEmotion[em] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    byEmotion[em].count++;
    byEmotion[em].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) byEmotion[em].wins++;
    else byEmotion[em].losses++;
  }

  for (const [em, b] of Object.entries(byEmotion)) {
    if (b.count < 3) continue;
    const wr = pct(b.wins, b.count);

    if (wr < 35 && b.pnl < -50) {
      results.push(insight(
        `emotion_neg_${em}`,
        'danger',
        'Psychology',
        `Trading while "${em}" costs you ${fmtPnl(b.pnl)}`,
        `${b.count} trades logged with "${em}" emotion: ${fmtPct(wr)} win rate, ${fmtPnl(b.pnl)}. Recognize this state and step away.`,
        b.pnl, 0.65, b.count
      ));
    }

    if (wr > 65 && b.pnl > 50) {
      results.push(insight(
        `emotion_pos_${em}`,
        'positive',
        'Psychology',
        `You trade best when "${em}"`,
        `${b.count} trades with "${em}" emotion: ${fmtPct(wr)} win rate, ${fmtPnl(b.pnl)}. More of this mindset.`,
        b.pnl, 0.65, b.count
      ));
    }
  }

  return results;
}

function ruleSideBias(trades) {
  const results = [];
  if (trades.length < 10) return results;

  const longs = trades.filter(t => t.side === 'long');
  const shorts = trades.filter(t => t.side === 'short');

  if (longs.length >= 3 && shorts.length >= 3) {
    const longWR = pct(longs.filter(t => (t.pnl || 0) > 0).length, longs.length);
    const shortWR = pct(shorts.filter(t => (t.pnl || 0) > 0).length, shorts.length);
    const longPnl = longs.reduce((s, t) => s + (t.pnl || 0), 0);
    const shortPnl = shorts.reduce((s, t) => s + (t.pnl || 0), 0);

    if (Math.abs(longWR - shortWR) > 15) {
      const better = longWR > shortWR ? 'long' : 'short';
      const worse = better === 'long' ? 'short' : 'long';
      const betterWR = better === 'long' ? longWR : shortWR;
      const worseWR = better === 'long' ? shortWR : longWR;

      results.push(insight(
        'side_bias',
        'info',
        'Strategy',
        `Strong ${better}-side bias: ${fmtPct(betterWR)} vs ${fmtPct(worseWR)}`,
        `Longs: ${longs.length} trades (${fmtPct(longWR)} WR, ${fmtPnl(longPnl)}). Shorts: ${shorts.length} trades (${fmtPct(shortWR)} WR, ${fmtPnl(shortPnl)}). Consider sizing down on ${worse} trades.`,
        Math.abs(longPnl - shortPnl), 0.6, trades.length
      ));
    }
  }

  return results;
}

function ruleSymbolPerformance(trades) {
  const results = [];
  const bySymbol = {};

  for (const t of trades) {
    const sym = (t.symbol || 'UNKNOWN').toUpperCase();
    if (!bySymbol[sym]) bySymbol[sym] = { wins: 0, losses: 0, pnl: 0, count: 0 };
    bySymbol[sym].count++;
    bySymbol[sym].pnl += t.pnl || 0;
    if ((t.pnl || 0) > 0) bySymbol[sym].wins++;
    else bySymbol[sym].losses++;
  }

  const entries = Object.entries(bySymbol).filter(([, b]) => b.count >= 3);
  entries.sort((a, b) => a[1].pnl - b[1].pnl);

  if (entries.length >= 1 && entries[0][1].pnl < -100) {
    const [sym, b] = entries[0];
    results.push(insight(
      'symbol_worst',
      'warning',
      'Instruments',
      `${sym} is your biggest loser: ${fmtPnl(b.pnl)}`,
      `${b.count} trades on ${sym}: ${fmtPct(pct(b.wins, b.count))} win rate, ${fmtPnl(b.pnl)}. Consider paper trading this instrument or reducing size.`,
      b.pnl, 0.7, b.count
    ));
  }

  if (entries.length >= 1) {
    const best = entries[entries.length - 1];
    if (best[1].pnl > 100) {
      results.push(insight(
        'symbol_best',
        'positive',
        'Instruments',
        `${best[0]} is your most profitable: ${fmtPnl(best[1].pnl)}`,
        `${best[1].count} trades: ${fmtPct(pct(best[1].wins, best[1].count))} win rate. Focus on what works.`,
        best[1].pnl, 0.7, best[1].count
      ));
    }
  }

  return results;
}

function ruleOvertrading(trades) {
  const results = [];
  if (trades.length < 10) return results;

  // Group by calendar date
  const byDate = {};
  for (const t of trades) {
    const d = getDateStr(t);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  }

  const dayCounts = Object.values(byDate).map(arr => arr.length);
  const avgPerDay = safeDiv(dayCounts.reduce((s, c) => s + c, 0), dayCounts.length);

  // Find overtrading days (>2x average)
  const overDays = Object.entries(byDate).filter(([, arr]) => arr.length > avgPerDay * 2 && arr.length > 5);

  if (overDays.length >= 2) {
    const overPnl = overDays.reduce((s, [, arr]) => s + arr.reduce((ss, t) => ss + (t.pnl || 0), 0), 0);

    results.push(insight(
      'overtrading',
      overPnl < 0 ? 'danger' : 'warning',
      'Discipline',
      `${overDays.length} overtrading days detected`,
      `On ${overDays.length} days you took 2x+ your average (${avgPerDay.toFixed(1)}/day). Those days netted ${fmtPnl(overPnl)}. ${overPnl < 0 ? 'Set a daily trade limit.' : 'More trades didn\'t hurt, but watch for fatigue.'}`,
      overPnl, 0.65, overDays.reduce((s, [, a]) => s + a.length, 0)
    ));
  }

  return results;
}

function ruleRuleBreaks(trades) {
  const results = [];
  const breaks = trades.filter(t => t.ruleBreak);
  if (breaks.length < 2) return results;

  const breakPnl = breaks.reduce((s, t) => s + (t.pnl || 0), 0);
  const breakWR = pct(breaks.filter(t => (t.pnl || 0) > 0).length, breaks.length);

  results.push(insight(
    'rule_breaks',
    breakPnl < 0 ? 'danger' : 'warning',
    'Discipline',
    `${breaks.length} rule-break trades: ${fmtPnl(breakPnl)}`,
    `Trades flagged as rule breaks: ${fmtPct(breakWR)} win rate, ${fmtPnl(breakPnl)} total. Following your rules is statistically the right call.`,
    breakPnl, 0.8, breaks.length
  ));

  return results;
}

// ─── Main Detector ──────────────────────────────────────────────

const ALL_RULES = [
  ruleTimeOfDay,
  ruleDayOfWeek,
  ruleRevengeTrading,
  ruleStreaks,
  ruleStrategyPerformance,
  ruleEmotionCorrelation,
  ruleSideBias,
  ruleSymbolPerformance,
  ruleOvertrading,
  ruleRuleBreaks,
];

/**
 * Run all pattern detection rules against a trade history.
 *
 * @param {Object[]} trades - Array of trade objects from useTradeStore
 * @param {Object} [options] - { minTrades: 5 }
 * @returns {Insight[]} - Array of insights, sorted by impact (highest first)
 */
export function detectPatterns(trades, options = {}) {
  if (!trades?.length || trades.length < (options.minTrades || 5)) {
    return [];
  }

  const insights = [];

  for (const rule of ALL_RULES) {
    try {
      const ruleInsights = rule(trades);
      insights.push(...ruleInsights);
    } catch (err) {
      console.warn(`[PatternDetector] Rule failed:`, err.message);
    }
  }

  // Sort by impact (highest first), then by confidence
  insights.sort((a, b) => (b.impact * b.confidence) - (a.impact * a.confidence));

  return insights;
}

/**
 * Get a human-readable grade based on patterns.
 * @param {Insight[]} insights
 * @returns {{ grade: string, emoji: string, summary: string }}
 */
export function gradePatterns(insights) {
  const dangers = insights.filter(i => i.severity === 'danger').length;
  const warnings = insights.filter(i => i.severity === 'warning').length;
  const positives = insights.filter(i => i.severity === 'positive').length;

  if (dangers >= 3) return { grade: 'D', emoji: '🔴', summary: 'Significant behavioral issues detected' };
  if (dangers >= 1 && warnings >= 2) return { grade: 'C', emoji: '🟠', summary: 'Some patterns need attention' };
  if (warnings >= 2 && positives < 2) return { grade: 'C+', emoji: '🟡', summary: 'Room for improvement' };
  if (positives > warnings) return { grade: 'A', emoji: '🟢', summary: 'Strong trading discipline' };
  if (positives >= 1) return { grade: 'B', emoji: '🔵', summary: 'Mostly good habits' };
  return { grade: 'B-', emoji: '🔵', summary: 'Average discipline' };
}

export default detectPatterns;
