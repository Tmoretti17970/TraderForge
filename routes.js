// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — API Routes
//
// RESTful endpoints for the public API. All routes are prefixed
// with /api/v1/. Authentication required via API key middleware.
//
// Endpoints:
//   GET    /api/v1/profile            — Get own profile
//   PATCH  /api/v1/profile            — Update own profile
//   GET    /api/v1/trades             — List trades (paginated)
//   POST   /api/v1/trades             — Create trade
//   GET    /api/v1/trades/:id         — Get single trade
//   PUT    /api/v1/trades/:id         — Update trade
//   DELETE /api/v1/trades/:id         — Delete trade
//   GET    /api/v1/analytics          — Get analytics summary
//   GET    /api/v1/analytics/equity   — Equity curve data
//   GET    /api/v1/snapshots          — List feed
//   POST   /api/v1/snapshots          — Create snapshot
//   GET    /api/v1/snapshots/:id      — Get snapshot
//   DELETE /api/v1/snapshots/:id      — Delete snapshot
//   POST   /api/v1/snapshots/:id/like — Toggle like
//   GET    /api/v1/leaderboard        — Get leaderboard
//   POST   /api/v1/webhooks           — Create webhook
//   GET    /api/v1/webhooks           — List webhooks
//   DELETE /api/v1/webhooks/:id       — Delete webhook
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import { parsePagination, okResponse, errorResponse } from './middleware.js';
import SocialService from '../data/SocialService.js';

export function createApiRouter(services = {}) {
  const router = Router();
  const { webhookEmitter, keyStore } = services;

  // ─── Profile ────────────────────────────────────────────

  router.get('/profile', async (req, res) => {
    const result = await SocialService.getProfile(req.userId);
    if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', 'Profile not found');
    okResponse(res, result.data);
  });

  router.patch('/profile', async (req, res) => {
    const allowed = ['username', 'displayName', 'bio', 'avatar'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'No valid fields to update');
    }

    const result = await SocialService.updateProfile(req.userId, updates);
    if (!result.ok) return errorResponse(res, 400, 'UPDATE_FAILED', result.error);
    okResponse(res, result.data);
  });

  // ─── Trades ─────────────────────────────────────────────

  // In-memory trade store for API (mirrors what useTradeStore manages client-side)
  // In production, this would hit a real database.
  const tradeStore = new Map();

  router.get('/trades', (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const userTrades = getUserTrades(tradeStore, req.userId);

    // Optional filters
    const { symbol, side, dateFrom, dateTo } = req.query;
    let filtered = userTrades;

    if (symbol) filtered = filtered.filter((t) => t.symbol?.toLowerCase() === symbol.toLowerCase());
    if (side) filtered = filtered.filter((t) => t.side === side);
    if (dateFrom) filtered = filtered.filter((t) => new Date(t.entryDate) >= new Date(dateFrom));
    if (dateTo) filtered = filtered.filter((t) => new Date(t.entryDate) <= new Date(dateTo));

    // Sort by entry date descending
    filtered.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

    const page = filtered.slice(offset, offset + limit);
    okResponse(res, page, {
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
    });
  });

  router.post('/trades', (req, res) => {
    const { symbol, side, entryPrice, exitPrice, entryDate, exitDate, size, pnl, notes, tags, setup } = req.body;

    if (!symbol || !side || !entryPrice) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Required fields: symbol, side, entryPrice');
    }

    if (!['long', 'short'].includes(side)) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'side must be "long" or "short"');
    }

    const trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: req.userId,
      symbol: symbol.toUpperCase(),
      side,
      entryPrice: Number(entryPrice),
      exitPrice: exitPrice != null ? Number(exitPrice) : null,
      entryDate: entryDate || new Date().toISOString(),
      exitDate: exitDate || null,
      size: size != null ? Number(size) : 1,
      pnl: pnl != null ? Number(pnl) : null,
      notes: notes || '',
      tags: tags || [],
      setup: setup || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (!tradeStore.has(req.userId)) tradeStore.set(req.userId, []);
    tradeStore.get(req.userId).push(trade);

    // Emit webhook
    if (webhookEmitter) {
      webhookEmitter.emit('trade.created', req.userId, trade);
    }

    res.status(201).json({ ok: true, data: trade });
  });

  router.get('/trades/:id', (req, res) => {
    const trade = findTrade(tradeStore, req.userId, req.params.id);
    if (!trade) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');
    okResponse(res, trade);
  });

  router.put('/trades/:id', (req, res) => {
    const trade = findTrade(tradeStore, req.userId, req.params.id);
    if (!trade) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');

    const mutable = ['symbol', 'side', 'entryPrice', 'exitPrice', 'entryDate', 'exitDate', 'size', 'pnl', 'notes', 'tags', 'setup'];
    for (const key of mutable) {
      if (req.body[key] !== undefined) trade[key] = req.body[key];
    }
    trade.updatedAt = Date.now();

    if (webhookEmitter) {
      webhookEmitter.emit('trade.updated', req.userId, trade);
    }

    okResponse(res, trade);
  });

  router.delete('/trades/:id', (req, res) => {
    const trades = getUserTrades(tradeStore, req.userId);
    const idx = trades.findIndex((t) => t.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Trade not found');

    const [deleted] = trades.splice(idx, 1);

    if (webhookEmitter) {
      webhookEmitter.emit('trade.deleted', req.userId, { id: deleted.id });
    }

    okResponse(res, { id: deleted.id, deleted: true });
  });

  // ─── Analytics ──────────────────────────────────────────

  router.get('/analytics', (req, res) => {
    const trades = getUserTrades(tradeStore, req.userId);
    const closedTrades = trades.filter((t) => t.exitPrice != null);

    const stats = computeBasicStats(closedTrades);
    okResponse(res, stats);
  });

  router.get('/analytics/equity', (req, res) => {
    const trades = getUserTrades(tradeStore, req.userId);
    const closedTrades = trades
      .filter((t) => t.pnl != null)
      .sort((a, b) => new Date(a.exitDate || a.entryDate) - new Date(b.exitDate || b.entryDate));

    let cumulative = 0;
    const curve = closedTrades.map((t) => {
      cumulative += t.pnl;
      return {
        date: t.exitDate || t.entryDate,
        pnl: t.pnl,
        cumulative,
        tradeId: t.id,
      };
    });

    okResponse(res, curve);
  });

  // ─── Snapshots (Feed) ───────────────────────────────────

  router.get('/snapshots', async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const sortBy = req.query.sort === 'popular' ? 'popular' : 'recent';

    const result = await SocialService.getFeed({ limit, offset, sortBy });
    if (!result.ok) return errorResponse(res, 500, 'FETCH_FAILED', 'Could not load feed');

    okResponse(res, result.data, {
      total: result.total,
      limit,
      offset,
      sortBy,
    });
  });

  router.post('/snapshots', async (req, res) => {
    const { title, description, symbol, timeframe, chartType, indicators, tags } = req.body;

    if (!title || !symbol) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Required: title, symbol');
    }

    const result = await SocialService.createSnapshot({
      authorId: req.userId,
      title,
      description: description || '',
      symbol: symbol.toUpperCase(),
      timeframe: timeframe || '1d',
      chartType: chartType || 'candles',
      indicators: indicators || [],
      tags: tags || [],
    });

    if (!result.ok) return errorResponse(res, 500, 'CREATE_FAILED', 'Could not create snapshot');

    if (webhookEmitter) {
      webhookEmitter.emit('snapshot.created', req.userId, result.data);
    }

    res.status(201).json({ ok: true, data: result.data });
  });

  router.get('/snapshots/:id', async (req, res) => {
    const result = await SocialService.getSnapshot(req.params.id);
    if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', 'Snapshot not found');
    okResponse(res, result.data);
  });

  router.delete('/snapshots/:id', async (req, res) => {
    const result = await SocialService.deleteSnapshot(req.params.id, req.userId);
    if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', result.error);
    okResponse(res, { id: req.params.id, deleted: true });
  });

  router.post('/snapshots/:id/like', async (req, res) => {
    const result = await SocialService.toggleLike(req.params.id, req.userId);
    if (!result.ok) return errorResponse(res, 404, 'NOT_FOUND', result.error);
    okResponse(res, result.data);
  });

  // ─── Leaderboard ────────────────────────────────────────

  router.get('/leaderboard', async (req, res) => {
    const metric = req.query.metric || 'pnl';
    const period = req.query.period || '30d';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const validMetrics = ['pnl', 'winRate', 'sharpe', 'profitFactor', 'tradeCount'];
    if (!validMetrics.includes(metric)) {
      return errorResponse(res, 400, 'BAD_REQUEST', `Invalid metric. Use: ${validMetrics.join(', ')}`);
    }

    const result = await SocialService.getLeaderboard({ metric, period, limit });
    if (!result.ok) return errorResponse(res, 500, 'FETCH_FAILED', 'Could not load leaderboard');

    okResponse(res, result.data, { metric, period });
  });

  // ─── Webhooks ───────────────────────────────────────────

  router.get('/webhooks', (req, res) => {
    if (!webhookEmitter) return okResponse(res, []);
    const hooks = webhookEmitter.getSubscriptions(req.userId);
    okResponse(res, hooks);
  });

  router.post('/webhooks', (req, res) => {
    if (!webhookEmitter) return errorResponse(res, 503, 'UNAVAILABLE', 'Webhook service not available');

    const { url, events } = req.body;
    if (!url) return errorResponse(res, 400, 'BAD_REQUEST', 'url is required');

    const validEvents = ['trade.created', 'trade.updated', 'trade.deleted', 'snapshot.created'];
    const selectedEvents = events?.length
      ? events.filter((e) => validEvents.includes(e))
      : validEvents;

    if (selectedEvents.length === 0) {
      return errorResponse(res, 400, 'BAD_REQUEST', `No valid events. Use: ${validEvents.join(', ')}`);
    }

    const hook = webhookEmitter.subscribe(req.userId, url, selectedEvents);
    res.status(201).json({ ok: true, data: hook });
  });

  router.delete('/webhooks/:id', (req, res) => {
    if (!webhookEmitter) return errorResponse(res, 503, 'UNAVAILABLE', 'Webhook service not available');

    const removed = webhookEmitter.unsubscribe(req.userId, req.params.id);
    if (!removed) return errorResponse(res, 404, 'NOT_FOUND', 'Webhook not found');
    okResponse(res, { id: req.params.id, deleted: true });
  });

  return router;
}

// ─── Trade Helpers ────────────────────────────────────────────

function getUserTrades(store, userId) {
  return store.get(userId) || [];
}

function findTrade(store, userId, tradeId) {
  return getUserTrades(store, userId).find((t) => t.id === tradeId) || null;
}

function computeBasicStats(trades) {
  if (trades.length === 0) {
    return {
      totalTrades: 0, wins: 0, losses: 0, winRate: 0,
      totalPnl: 0, avgPnl: 0, largestWin: 0, largestLoss: 0,
      profitFactor: 0, avgRR: 0,
    };
  }

  const wins = trades.filter((t) => (t.pnl || 0) > 0);
  const losses = trades.filter((t) => (t.pnl || 0) < 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? +(wins.length / trades.length * 100).toFixed(1) : 0,
    totalPnl: +totalPnl.toFixed(2),
    avgPnl: +(totalPnl / trades.length).toFixed(2),
    largestWin: wins.length > 0 ? +Math.max(...wins.map((t) => t.pnl)).toFixed(2) : 0,
    largestLoss: losses.length > 0 ? +Math.min(...losses.map((t) => t.pnl)).toFixed(2) : 0,
    profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? Infinity : 0,
  };
}
