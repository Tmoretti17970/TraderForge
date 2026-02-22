// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Social Store (Zustand)
//
// Client-side state for social features. Coordinates with
// SocialService for data fetching. Caches profiles and feed
// locally for responsive UI.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { LOCAL_USER_ID } from '../data/socialMockData.js';
import SocialService from '../data/SocialService.js';

const useSocialStore = create((set, get) => ({
  // Current user
  myUserId: LOCAL_USER_ID,
  myProfile: null,
  profileLoading: false,

  // Feed
  feed: [],
  feedLoading: false,
  feedSort: 'recent', // recent | popular
  feedTotal: 0,

  // Leaderboard
  leaderboard: [],
  leaderboardLoading: false,
  leaderboardMetric: 'pnl', // pnl | winRate | sharpe | profitFactor
  leaderboardPeriod: '30d',

  // Profile cache (other users)
  profileCache: {},

  // Active snapshot (viewing detail)
  activeSnapshotId: null,

  // ─── Profile ──────────────────────────────────────────

  loadMyProfile: async () => {
    set({ profileLoading: true });
    const res = await SocialService.getProfile(get().myUserId);
    if (res.ok) {
      set({ myProfile: res.data, profileLoading: false });
    } else {
      set({ profileLoading: false });
    }
  },

  updateMyProfile: async (updates) => {
    const res = await SocialService.updateProfile(get().myUserId, updates);
    if (res.ok) set({ myProfile: res.data });
    return res;
  },

  getCachedProfile: (userId) => get().profileCache[userId] || null,

  fetchProfile: async (userId) => {
    // Check cache first
    if (get().profileCache[userId]) return get().profileCache[userId];
    const res = await SocialService.getProfile(userId);
    if (res.ok) {
      set((s) => ({
        profileCache: { ...s.profileCache, [userId]: res.data },
      }));
      return res.data;
    }
    return null;
  },

  // ─── Feed ─────────────────────────────────────────────

  loadFeed: async ({ reset = false } = {}) => {
    const { feed, feedSort } = get();
    const offset = reset ? 0 : feed.length;
    set({ feedLoading: true });

    const res = await SocialService.getFeed({
      limit: 20,
      offset,
      sortBy: feedSort,
    });

    if (res.ok) {
      set({
        feed: reset ? res.data : [...feed, ...res.data],
        feedTotal: res.total,
        feedLoading: false,
      });
    } else {
      set({ feedLoading: false });
    }
  },

  setFeedSort: (sort) => {
    set({ feedSort: sort, feed: [] });
    get().loadFeed({ reset: true });
  },

  // ─── Snapshots ────────────────────────────────────────

  createSnapshot: async (snapshot) => {
    const res = await SocialService.createSnapshot({
      ...snapshot,
      authorId: get().myUserId,
    });
    if (res.ok) {
      // Prepend to feed
      set((s) => ({ feed: [res.data, ...s.feed] }));
    }
    return res;
  },

  deleteSnapshot: async (snapshotId) => {
    const res = await SocialService.deleteSnapshot(snapshotId, get().myUserId);
    if (res.ok) {
      set((s) => ({ feed: s.feed.filter((f) => f.id !== snapshotId) }));
    }
    return res;
  },

  toggleLike: async (snapshotId) => {
    const res = await SocialService.toggleLike(snapshotId, get().myUserId);
    if (res.ok) {
      set((s) => ({
        feed: s.feed.map((f) =>
          f.id === snapshotId ? { ...f, likes: res.data.count } : f
        ),
      }));
    }
    return res;
  },

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

  // ─── Leaderboard ──────────────────────────────────────

  loadLeaderboard: async () => {
    const { leaderboardMetric, leaderboardPeriod } = get();
    set({ leaderboardLoading: true });

    const res = await SocialService.getLeaderboard({
      metric: leaderboardMetric,
      period: leaderboardPeriod,
      limit: 20,
    });

    if (res.ok) {
      set({ leaderboard: res.data, leaderboardLoading: false });
    } else {
      set({ leaderboardLoading: false });
    }
  },

  setLeaderboardMetric: (metric) => {
    set({ leaderboardMetric: metric });
    get().loadLeaderboard();
  },

  setLeaderboardPeriod: (period) => {
    set({ leaderboardPeriod: period });
    get().loadLeaderboard();
  },
}));

export { useSocialStore };
export default useSocialStore;
