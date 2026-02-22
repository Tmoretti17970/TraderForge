// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — API Middleware
//
// Express middleware stack for the public API:
//   - API key authentication
//   - Rate limiting (in-memory, swap to Redis for production)
//   - CORS headers
//   - Request logging
//   - Error formatting
//
// All middleware returns JSON responses with consistent shape:
//   { ok: true, data: ... } or { ok: false, error: { code, message } }
// ═══════════════════════════════════════════════════════════════════

// ─── API Key Authentication ───────────────────────────────────

const API_KEY_HEADER = 'x-api-key';
const API_KEY_QUERY = 'api_key';

/**
 * Validates API key from header or query param.
 * In production, this would check against a database.
 * Currently validates against the in-memory key store.
 */
export function apiKeyAuth(keyStore) {
  return (req, res, next) => {
    const key = req.headers[API_KEY_HEADER]
      || req.query[API_KEY_QUERY];

    if (!key) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_MISSING',
          message: 'API key required. Pass via x-api-key header or api_key query param.',
        },
      });
    }

    const keyData = keyStore.validate(key);
    if (!keyData) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'AUTH_INVALID',
          message: 'Invalid or revoked API key.',
        },
      });
    }

    // Attach key metadata to request
    req.apiKey = keyData;
    req.userId = keyData.userId;
    next();
  };
}

// ─── Rate Limiter ─────────────────────────────────────────────

/**
 * In-memory sliding window rate limiter.
 * @param {Object} opts
 * @param {number} opts.windowMs - Time window in ms (default: 60000 = 1 min)
 * @param {number} opts.max - Max requests per window (default: 60)
 */
export function rateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  // Cleanup expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      if (v.resetAt < now) hits.delete(k);
    }
  }, 300_000);

  return (req, res, next) => {
    const key = req.apiKey?.id || req.ip || 'anonymous';
    const now = Date.now();
    let entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
          retryAfter,
        },
      });
    }

    next();
  };
}

// ─── CORS ─────────────────────────────────────────────────────

/**
 * CORS middleware for API routes.
 * @param {Object} opts
 * @param {string[]} opts.origins - Allowed origins (default: ['*'])
 */
export function cors({ origins = ['*'] } = {}) {
  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origins.includes('*') || origins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin || '*');
    }

    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
    res.set('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}

// ─── Request Logger ───────────────────────────────────────────

export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    const { method, originalUrl } = req;

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;
      const keyId = req.apiKey?.id?.slice(0, 8) || 'no-key';
      console.log(`[API] ${method} ${originalUrl} → ${status} (${ms}ms) [${keyId}]`);
    });

    next();
  };
}

// ─── Error Handler ────────────────────────────────────────────

/**
 * Final error handler for API routes.
 * Catches thrown errors and formats as JSON.
 */
export function apiErrorHandler() {
  return (err, req, res, _next) => {
    console.error('[API Error]', err.stack || err.message);

    const status = err.status || err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = status === 500
      ? 'An internal error occurred.'
      : err.message || 'Unknown error';

    res.status(status).json({
      ok: false,
      error: { code, message },
    });
  };
}

// ─── Pagination Helper ────────────────────────────────────────

/**
 * Extract pagination params from query string.
 * @returns {{ limit: number, offset: number }}
 */
export function parsePagination(query, defaults = { limit: 20, maxLimit: 100 }) {
  let limit = parseInt(query.limit, 10) || defaults.limit;
  let offset = parseInt(query.offset, 10) || 0;
  limit = Math.min(Math.max(1, limit), defaults.maxLimit);
  offset = Math.max(0, offset);
  return { limit, offset };
}

// ─── Response Helpers ─────────────────────────────────────────

export function okResponse(res, data, meta) {
  const body = { ok: true, data };
  if (meta) body.meta = meta;
  return res.json(body);
}

export function errorResponse(res, status, code, message) {
  return res.status(status).json({
    ok: false,
    error: { code, message },
  });
}
