// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Auth Store (Sprint 5.1)
//
// Global auth state. All components use this — never import
// Supabase/Clerk directly. Handles:
//   - Session initialization on app load
//   - Sign in (email + OAuth)
//   - Sign out
//   - Token access for API calls
//   - Auth state change listeners
//
// Usage:
//   const user = useAuthStore(s => s.user);
//   const signIn = useAuthStore(s => s.signIn);
//   const isAuthenticated = useAuthStore(s => s.isAuthenticated);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { initAuthProvider, getAuthProvider } from '../services/AuthService.js';

const useAuthStore = create((set, get) => ({
  // ─── State ──────────────────────────────────────────────────
  user: null,
  loading: true, // true until initial session check completes
  error: null,
  provider: 'local', // 'supabase' | 'clerk' | 'local'
  isAuthenticated: false,

  // ─── Initialize ─────────────────────────────────────────────
  // Call once on app startup (in App.jsx useEffect)
  init: async () => {
    try {
      const provider = await initAuthProvider();
      set({ provider: provider.name });

      // Check for existing session
      const user = await provider.getUser();
      if (user) {
        set({ user, isAuthenticated: true, loading: false, error: null });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }

      // Listen for auth changes (tab focus, token refresh, etc.)
      provider.onAuthStateChange(async (event, _session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const updatedUser = await provider.getUser();
          set({ user: updatedUser, isAuthenticated: !!updatedUser, error: null });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, isAuthenticated: false });
        }
      });
    } catch (err) {
      console.warn('[Auth] Init failed:', err.message);
      set({ loading: false, error: err.message });
    }
  },

  // ─── Sign In ────────────────────────────────────────────────
  signIn: async (method, credentials = {}) => {
    const provider = getAuthProvider();
    set({ loading: true, error: null });

    try {
      if (method === 'email') {
        await provider.signInEmail(credentials.email, credentials.password);
      } else if (method === 'google' || method === 'oauth') {
        await provider.signInOAuth(credentials.provider || 'google');
        // OAuth redirects — user will come back and init() will pick up session
        return;
      }

      const user = await provider.getUser();
      set({ user, isAuthenticated: !!user, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  // ─── Sign Up ────────────────────────────────────────────────
  signUp: async (email, password) => {
    const provider = getAuthProvider();
    set({ loading: true, error: null });

    try {
      await provider.signUpEmail(email, password);
      const user = await provider.getUser();
      set({ user, isAuthenticated: !!user, loading: false });
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  // ─── Sign Out ───────────────────────────────────────────────
  signOut: async () => {
    const provider = getAuthProvider();
    try {
      await provider.signOut();
    } catch { /* ignore sign out errors */ }
    set({ user: null, isAuthenticated: false, error: null });
  },

  // ─── Token Access ───────────────────────────────────────────
  // For authenticated API calls
  getToken: async () => {
    const provider = getAuthProvider();
    return provider.getToken();
  },

  // ─── Password Reset ────────────────────────────────────────
  resetPassword: async (email) => {
    const provider = getAuthProvider();
    set({ error: null });
    try {
      await provider.resetPassword(email);
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // ─── Helpers ────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  isPro: () => {
    const { user } = get();
    return user?.plan === 'pro';
  },

  isLocal: () => {
    const { provider } = get();
    return provider === 'local';
  },
}));

export { useAuthStore };
export default useAuthStore;
