// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Risk Presets
//
// Named risk parameter profiles that configure:
//   - Account size
//   - Risk per trade (% or $)
//   - Daily loss limit
//   - Max daily trades
//   - Max concurrent positions
//   - Risk-free rate (for Sharpe calculation)
//   - Position sizing method
//
// Presets can be switched quickly (e.g., "Aggressive", "Conservative")
// All values feed into DailyLossGuard, analytics, and position sizing.
//
// Includes a pure position sizing calculator:
//   calcPositionSize({ accountSize, riskPct, stopDistance, tickValue })
// ═══════════════════════════════════════════════════════════════════

// ─── Default Presets ────────────────────────────────────────────

const BUILT_IN_PRESETS = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Low risk, high discipline',
    icon: '🛡️',
    params: {
      riskPerTradePct: 0.5,
      riskPerTradeDollar: 0,
      dailyLossLimit: 500,
      maxDailyTrades: 5,
      maxOpenPositions: 1,
      riskFreeRate: 0.05,
      positionSizing: 'fixed_pct',
      kellyFraction: 0.25,   // quarter-Kelly
    },
  },
  {
    id: 'moderate',
    name: 'Moderate',
    description: 'Balanced risk-reward',
    icon: '⚖️',
    params: {
      riskPerTradePct: 1.0,
      riskPerTradeDollar: 0,
      dailyLossLimit: 1000,
      maxDailyTrades: 10,
      maxOpenPositions: 3,
      riskFreeRate: 0.05,
      positionSizing: 'fixed_pct',
      kellyFraction: 0.5,    // half-Kelly
    },
  },
  {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Higher risk, bigger targets',
    icon: '🔥',
    params: {
      riskPerTradePct: 2.0,
      riskPerTradeDollar: 0,
      dailyLossLimit: 2500,
      maxDailyTrades: 20,
      maxOpenPositions: 5,
      riskFreeRate: 0.05,
      positionSizing: 'fixed_pct',
      kellyFraction: 0.75,   // three-quarter Kelly
    },
  },
  {
    id: 'scalper',
    name: 'Scalper',
    description: 'High frequency, tight stops',
    icon: '⚡',
    params: {
      riskPerTradePct: 0.25,
      riskPerTradeDollar: 0,
      dailyLossLimit: 750,
      maxDailyTrades: 50,
      maxOpenPositions: 1,
      riskFreeRate: 0.05,
      positionSizing: 'fixed_dollar',
      kellyFraction: 0.25,
    },
  },
];

// ─── Default risk params (matches "Moderate") ──────────────────

const DEFAULT_RISK_PARAMS = {
  riskPerTradePct: 1.0,
  riskPerTradeDollar: 0,
  dailyLossLimit: 0,
  maxDailyTrades: 0,           // 0 = unlimited
  maxOpenPositions: 0,          // 0 = unlimited
  riskFreeRate: 0.05,           // 5% annualized (T-bill rate)
  positionSizing: 'fixed_pct', // 'fixed_pct' | 'fixed_dollar' | 'kelly'
  kellyFraction: 0.5,
};

// ─── Position Sizing Calculator ─────────────────────────────────

/**
 * Calculate position size based on risk parameters.
 *
 * @param {Object} opts
 * @param {number} opts.accountSize      - Account equity
 * @param {number} opts.riskPct          - Risk per trade as % (e.g. 1.0 = 1%)
 * @param {number} [opts.riskDollar]     - Fixed dollar risk (overrides riskPct if > 0)
 * @param {number} opts.stopDistance     - Distance to stop loss (in price units)
 * @param {number} [opts.tickValue=1]    - Dollar value per tick/point
 * @param {number} [opts.tickSize=1]     - Minimum price movement
 * @param {number} [opts.maxContracts]   - Hard max (if set)
 * @returns {{ contracts: number, riskDollars: number, riskPct: number }}
 */
function calcPositionSize({
  accountSize,
  riskPct = 1.0,
  riskDollar = 0,
  stopDistance,
  tickValue = 1,
  tickSize = 1,
  maxContracts = Infinity,
}) {
  if (!accountSize || accountSize <= 0 || !stopDistance || stopDistance <= 0) {
    return { contracts: 0, riskDollars: 0, riskPct: 0 };
  }

  // Determine dollar risk
  let riskDollars;
  if (riskDollar > 0) {
    riskDollars = riskDollar;
  } else {
    riskDollars = accountSize * (riskPct / 100);
  }

  // Calculate ticks in stop distance
  const ticks = stopDistance / tickSize;
  const dollarsPerContract = ticks * tickValue;

  if (dollarsPerContract <= 0) {
    return { contracts: 0, riskDollars, riskPct: (riskDollars / accountSize) * 100 };
  }

  let contracts = Math.floor(riskDollars / dollarsPerContract);
  contracts = Math.max(0, Math.min(contracts, maxContracts));

  // Recalculate actual risk
  const actualRisk = contracts * dollarsPerContract;
  const actualPct = (actualRisk / accountSize) * 100;

  return {
    contracts,
    riskDollars: actualRisk,
    riskPct: Math.round(actualPct * 100) / 100,
  };
}

/**
 * Kelly Criterion position sizing.
 *
 * Full Kelly: f* = (bp - q) / b
 * Where:
 *   b = avg win / avg loss (win/loss ratio)
 *   p = win probability
 *   q = loss probability (1 - p)
 *
 * @param {Object} opts
 * @param {number} opts.winRate          - Win probability (0-1)
 * @param {number} opts.avgWin           - Average winning trade
 * @param {number} opts.avgLoss          - Average losing trade (positive number)
 * @param {number} [opts.fraction=0.5]   - Kelly fraction (0.25=quarter, 0.5=half, 1.0=full)
 * @param {number} opts.accountSize      - Account equity
 * @returns {{ kellyPct: number, riskDollars: number, fullKellyPct: number }}
 */
function calcKelly({ winRate, avgWin, avgLoss, fraction = 0.5, accountSize }) {
  if (!winRate || winRate <= 0 || winRate >= 1 || !avgWin || avgWin <= 0 || !avgLoss || avgLoss <= 0) {
    return { kellyPct: 0, riskDollars: 0, fullKellyPct: 0 };
  }

  const b = avgWin / avgLoss; // payoff ratio
  const p = winRate;
  const q = 1 - p;

  const fullKelly = (b * p - q) / b;
  const clampedKelly = Math.max(0, Math.min(1, fullKelly));
  const fractionalKelly = clampedKelly * fraction;

  const riskDollars = accountSize ? accountSize * fractionalKelly : 0;

  return {
    kellyPct: Math.round(fractionalKelly * 10000) / 100, // e.g. 12.50%
    riskDollars: Math.round(riskDollars * 100) / 100,
    fullKellyPct: Math.round(clampedKelly * 10000) / 100,
  };
}

// ─── Risk Validation ────────────────────────────────────────────

/**
 * Validate a trade against current risk parameters.
 *
 * @param {Object} trade    - Proposed trade
 * @param {Object} params   - Current risk params
 * @param {Object} context  - { todayCount, todayPnl, openPositions }
 * @returns {{ allowed: boolean, warnings: string[] }}
 */
function validateTradeRisk(trade, params, context = {}) {
  const warnings = [];

  // Max daily trades
  if (params.maxDailyTrades > 0 && (context.todayCount || 0) >= params.maxDailyTrades) {
    warnings.push(`Max daily trades reached (${params.maxDailyTrades})`);
  }

  // Max open positions
  if (params.maxOpenPositions > 0 && (context.openPositions || 0) >= params.maxOpenPositions) {
    warnings.push(`Max open positions reached (${params.maxOpenPositions})`);
  }

  // Daily loss limit check
  if (params.dailyLossLimit > 0) {
    const todayLoss = Math.max(0, -(context.todayPnl || 0));
    if (todayLoss >= params.dailyLossLimit) {
      warnings.push(`Daily loss limit breached ($${params.dailyLossLimit})`);
    }
  }

  return {
    allowed: warnings.length === 0,
    warnings,
  };
}

// ─── Preset Management ──────────────────────────────────────────

/**
 * Get a built-in preset by ID.
 * @param {string} id
 * @returns {Object|null}
 */
function getPreset(id) {
  return BUILT_IN_PRESETS.find(p => p.id === id) || null;
}

/**
 * Get all built-in presets.
 * @returns {Array}
 */
function listPresets() {
  return [...BUILT_IN_PRESETS];
}

// ─── Exports ────────────────────────────────────────────────────

export {
  BUILT_IN_PRESETS,
  DEFAULT_RISK_PARAMS,
  calcPositionSize,
  calcKelly,
  validateTradeRisk,
  getPreset,
  listPresets,
};
export default calcPositionSize;
