// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Trade Schema (Sprint 7)
//
// I1.4: Strict schema definition with runtime validation.
// Every trade must pass validateTrade() before writing to storage.
// normalizeTrade() fills defaults and coerces types.
//
// This prevents malformed data from entering IndexedDB/Supabase
// and ensures consistent shape across imports, manual entry, and sync.
// ═══════════════════════════════════════════════════════════════════

// ─── Schema Definition ──────────────────────────────────────────

const TRADE_SCHEMA = {
  // Required
  id:         { type: 'string',  required: true },
  date:       { type: 'string',  required: true },   // ISO 8601
  symbol:     { type: 'string',  required: true },
  pnl:        { type: 'number',  required: true },

  // Core optional
  closeDate:  { type: 'string',  required: false, default: null },
  side:       { type: 'string',  required: false, default: 'long', enum: ['long', 'short'] },
  entry:      { type: 'number',  required: false, default: 0 },
  exit:       { type: 'number',  required: false, default: 0 },
  qty:        { type: 'number',  required: false, default: 1 },
  fees:       { type: 'number',  required: false, default: 0 },
  stopLoss:   { type: 'number',  required: false, default: null },
  takeProfit: { type: 'number',  required: false, default: null },
  rMultiple:  { type: 'number',  required: false, default: null },

  // Classification
  assetClass: { type: 'string',  required: false, default: 'futures',
                enum: ['futures', 'stocks', 'crypto', 'forex', 'options', 'etf', 'other'] },
  playbook:   { type: 'string',  required: false, default: '' },
  tags:       { type: 'array',   required: false, default: [] },

  // Journal
  emotion:    { type: 'string',  required: false, default: '' },
  notes:      { type: 'string',  required: false, default: '' },
  rating:     { type: 'number',  required: false, default: null, min: 1, max: 5 },
  ruleBreak:  { type: 'boolean', required: false, default: false },

  // Metadata
  _updatedAt:    { type: 'string',  required: false, default: null },
  _importedFrom: { type: 'string',  required: false, default: null },
  _importedAt:   { type: 'string',  required: false, default: null },
};

// ─── Validation ─────────────────────────────────────────────────

/**
 * Validate a trade object against the schema.
 *
 * @param {Object} trade - Trade to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTrade(trade) {
  if (!trade || typeof trade !== 'object') {
    return { valid: false, errors: ['Trade must be a non-null object'] };
  }

  const errors = [];

  for (const [field, def] of Object.entries(TRADE_SCHEMA)) {
    const val = trade[field];

    // Required check
    if (def.required && (val == null || val === '')) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }

    // Skip null/undefined optional fields
    if (val == null) continue;

    // Type check
    if (def.type === 'string' && typeof val !== 'string') {
      errors.push(`${field}: expected string, got ${typeof val}`);
    } else if (def.type === 'number' && typeof val !== 'number') {
      // Try coercing
      if (typeof val === 'string' && !isNaN(parseFloat(val))) {
        // Will be coerced in normalize
      } else {
        errors.push(`${field}: expected number, got ${typeof val}`);
      }
    } else if (def.type === 'boolean' && typeof val !== 'boolean') {
      if (val !== 'true' && val !== 'false' && val !== 0 && val !== 1) {
        errors.push(`${field}: expected boolean, got ${typeof val}`);
      }
    } else if (def.type === 'array' && !Array.isArray(val)) {
      errors.push(`${field}: expected array, got ${typeof val}`);
    }

    // Enum check
    if (def.enum && val != null && !def.enum.includes(val)) {
      errors.push(`${field}: "${val}" not in allowed values [${def.enum.join(', ')}]`);
    }

    // Range check
    if (def.min != null && typeof val === 'number' && val < def.min) {
      errors.push(`${field}: ${val} below minimum ${def.min}`);
    }
    if (def.max != null && typeof val === 'number' && val > def.max) {
      errors.push(`${field}: ${val} above maximum ${def.max}`);
    }
  }

  // Date format validation
  if (trade.date && typeof trade.date === 'string') {
    const d = new Date(trade.date);
    if (isNaN(d.getTime())) {
      errors.push(`date: "${trade.date}" is not a valid date`);
    }
  }

  if (trade.closeDate && typeof trade.closeDate === 'string') {
    const d = new Date(trade.closeDate);
    if (isNaN(d.getTime())) {
      errors.push(`closeDate: "${trade.closeDate}" is not a valid date`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Normalization ──────────────────────────────────────────────

/**
 * Normalize a trade object: fill defaults, coerce types, trim strings.
 * Does NOT mutate the input — returns a new clean object.
 *
 * @param {Object} trade - Raw trade (from import, form, or sync)
 * @returns {Object} Normalized trade
 */
function normalizeTrade(trade) {
  const out = {};

  for (const [field, def] of Object.entries(TRADE_SCHEMA)) {
    let val = trade[field];

    // Apply default if missing
    if (val == null || val === '') {
      if (def.default != null) {
        out[field] = typeof def.default === 'object' && Array.isArray(def.default)
          ? [...def.default]
          : def.default;
      } else {
        out[field] = null;
      }
      continue;
    }

    // Type coercion
    if (def.type === 'number' && typeof val === 'string') {
      val = parseFloat(val);
      if (isNaN(val)) val = def.default ?? 0;
    }

    if (def.type === 'boolean' && typeof val !== 'boolean') {
      val = val === 'true' || val === true || val === 1;
    }

    if (def.type === 'string' && typeof val !== 'string') {
      val = String(val);
    }

    if (def.type === 'array' && !Array.isArray(val)) {
      val = typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
    }

    // Trim strings
    if (typeof val === 'string') val = val.trim();

    // Clamp to enum
    if (def.enum && !def.enum.includes(val)) {
      val = def.default ?? def.enum[0];
    }

    // Clamp to range
    if (def.min != null && typeof val === 'number') val = Math.max(def.min, val);
    if (def.max != null && typeof val === 'number') val = Math.min(def.max, val);

    out[field] = val;
  }

  // Ensure id
  if (!out.id) {
    out.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Ensure date is ISO string
  if (out.date && !out.date.includes('T')) {
    try { out.date = new Date(out.date).toISOString(); } catch { /* keep as-is */ }
  }

  // Stamp update time
  out._updatedAt = new Date().toISOString();

  // Pass through any extra fields not in schema (forward-compat)
  for (const key of Object.keys(trade)) {
    if (!(key in TRADE_SCHEMA) && trade[key] != null) {
      out[key] = trade[key];
    }
  }

  return out;
}

/**
 * Normalize an array of trades. Skips invalid trades, returns
 * normalized trades + any validation errors.
 *
 * @param {Object[]} trades
 * @returns {{ trades: Object[], errors: Array<{index: number, errors: string[]}> }}
 */
function normalizeBatch(trades) {
  const normalized = [];
  const errors = [];

  for (let i = 0; i < trades.length; i++) {
    const clean = normalizeTrade(trades[i]);
    const { valid, errors: fieldErrors } = validateTrade(clean);

    if (valid) {
      normalized.push(clean);
    } else {
      errors.push({ index: i, errors: fieldErrors });
    }
  }

  return { trades: normalized, errors };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  TRADE_SCHEMA,
  validateTrade,
  normalizeTrade,
  normalizeBatch,
};
