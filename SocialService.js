// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Social Service
//
// Abstraction layer for all social features. Currently backed by
// local mock data. Designed for clean swap to REST API:
//   - Every method returns { ok, data, error }
//   - All methods are async
//   - Data shapes match expected API contracts
//
// To switch to real backend:
//   1. Replace mock implementations with fetch() calls
//   2. Keep the same method signatures
//   3. Components won't need changes
// ═══════════════════════════════════════════════════════════════════

import { MOCK_PROFILES, MOCK_SNAPSHOTS, MOCK_COMMENTS } from './socialMockData.js';

// Simulate network delay
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

// In-memory stores (mock backend)
let profiles = [...MOCK_PROFILES];
let snapshots = [...MOCK_SNAPSHOTS];
let comments = [...MOCK_COMMENTS];
let likes = new Set(); // snapshotId:userId pairs

// ─── Profile ──────────────────────────────────────────────────

export async function getProfile(userId) {
  await delay(80);
  const profile = profiles.find((p) => p.id === userId);
  return profile
    ? { ok: true, data: profile }
    : { ok: false, error: 'Profile not found' };
}

export async function getProfiles(userIds) {
  await delay(100);
  const found = profiles.filter((p) => userIds.includes(p.id));
  return { ok: true, data: found };
}

export async function updateProfile(userId, updates) {
  await delay(100);
  const idx = profiles.findIndex((p) => p.id === userId);
  if (idx === -1) return { ok: false, error: 'Profile not found' };
  profiles[idx] = { ...profiles[idx], ...updates, updatedAt: Date.now() };
  return { ok: true, data: profiles[idx] };
}

export async function getAllProfiles() {
  await delay(120);
  return { ok: true, data: [...profiles] };
}

// ─── Snapshots (Shared Charts) ────────────────────────────────

export async function createSnapshot(snapshot) {
  await delay(150);
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const created = {
    ...snapshot,
    id,
    likes: 0,
    commentCount: 0,
    createdAt: Date.now(),
  };
  snapshots.unshift(created);
  return { ok: true, data: created };
}

export async function getSnapshot(snapshotId) {
  await delay(80);
  const snap = snapshots.find((s) => s.id === snapshotId);
  return snap
    ? { ok: true, data: snap }
    : { ok: false, error: 'Snapshot not found' };
}

export async function getFeed({ limit = 20, offset = 0, sortBy = 'recent' } = {}) {
  await delay(200);
  let sorted = [...snapshots];

  if (sortBy === 'recent') {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sortBy === 'popular') {
    sorted.sort((a, b) => b.likes - a.likes);
  }

  const page = sorted.slice(offset, offset + limit);
  return { ok: true, data: page, total: sorted.length };
}

export async function getUserSnapshots(userId, { limit = 20, offset = 0 } = {}) {
  await delay(120);
  const userSnaps = snapshots
    .filter((s) => s.authorId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  return { ok: true, data: userSnaps.slice(offset, offset + limit), total: userSnaps.length };
}

export async function deleteSnapshot(snapshotId, userId) {
  await delay(100);
  const idx = snapshots.findIndex((s) => s.id === snapshotId && s.authorId === userId);
  if (idx === -1) return { ok: false, error: 'Not found or unauthorized' };
  snapshots.splice(idx, 1);
  return { ok: true };
}

// ─── Likes ────────────────────────────────────────────────────

export async function toggleLike(snapshotId, userId) {
  await delay(80);
  const key = `${snapshotId}:${userId}`;
  const snap = snapshots.find((s) => s.id === snapshotId);
  if (!snap) return { ok: false, error: 'Snapshot not found' };

  if (likes.has(key)) {
    likes.delete(key);
    snap.likes = Math.max(0, snap.likes - 1);
    return { ok: true, data: { liked: false, count: snap.likes } };
  } else {
    likes.add(key);
    snap.likes += 1;
    return { ok: true, data: { liked: true, count: snap.likes } };
  }
}

export async function isLiked(snapshotId, userId) {
  return likes.has(`${snapshotId}:${userId}`);
}

// ─── Comments ─────────────────────────────────────────────────

export async function getComments(snapshotId) {
  await delay(120);
  const filtered = comments
    .filter((c) => c.snapshotId === snapshotId)
    .sort((a, b) => a.createdAt - b.createdAt);
  return { ok: true, data: filtered };
}

export async function addComment(snapshotId, userId, text) {
  await delay(100);
  const id = `comment_${Date.now()}`;
  const comment = {
    id,
    snapshotId,
    authorId: userId,
    text,
    createdAt: Date.now(),
  };
  comments.push(comment);

  // Update comment count on snapshot
  const snap = snapshots.find((s) => s.id === snapshotId);
  if (snap) snap.commentCount = (snap.commentCount || 0) + 1;

  return { ok: true, data: comment };
}

// ─── Leaderboard ──────────────────────────────────────────────

export async function getLeaderboard({ metric = 'pnl', period = '30d', limit = 20 } = {}) {
  await delay(200);

  // In production, this would be a server-computed ranking.
  // For mock, we generate rankings from profile stats.
  const ranked = profiles
    .filter((p) => p.stats)
    .map((p) => ({
      userId: p.id,
      username: p.username,
      avatar: p.avatar,
      value: getStatForMetric(p.stats, metric, period),
      tradeCount: p.stats.tradeCount || 0,
    }))
    .filter((r) => r.value != null)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return { ok: true, data: ranked };
}

function getStatForMetric(stats, metric, period) {
  // Simplified: mock data has flat stats, not period-specific
  switch (metric) {
    case 'pnl': return stats.totalPnl || 0;
    case 'winRate': return stats.winRate || 0;
    case 'sharpe': return stats.sharpe || 0;
    case 'profitFactor': return stats.profitFactor || 0;
    case 'tradeCount': return stats.tradeCount || 0;
    default: return 0;
  }
}

// ─── Default export as namespace ──────────────────────────────

export default {
  getProfile, getProfiles, updateProfile, getAllProfiles,
  createSnapshot, getSnapshot, getFeed, getUserSnapshots, deleteSnapshot,
  toggleLike, isLiked,
  getComments, addComment,
  getLeaderboard,
};
