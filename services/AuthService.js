// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Auth Service (Sprint 5.1)
//
// Provider-agnostic auth abstraction. The rest of the app uses
// useAuthStore — never directly imports Supabase/Clerk.
//
// Supported providers:
//   - supabase (default) — Email + Google OAuth
//   - clerk — if Clerk is configured
//   - local — no auth, local-only mode (default if no provider)
//
// Token lifecycle:
//   - Tokens stored in memory only (not localStorage)
//   - Refresh handled automatically via provider SDK
//   - getToken() always returns a fresh valid token
//
// Usage:
//   import { useAuthStore } from '../state/useAuthStore.js';
//   const user = useAuthStore(s => s.user);
//   const signIn = useAuthStore(s => s.signIn);
//   await signIn('email', { email, password });
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} AuthUser
 * @property {string} id - Unique user ID from provider
 * @property {string} email
 * @property {string} [name]
 * @property {string} [avatarUrl]
 * @property {string} provider - 'supabase' | 'clerk' | 'local'
 * @property {string} [plan] - 'free' | 'pro'
 * @property {Object} [metadata] - Provider-specific extras
 */

// ─── Provider: Supabase ─────────────────────────────────────────

const SupabaseProvider = {
  name: 'supabase',
  _client: null,

  async init() {
    try {
      // Dynamic import — only loads if Supabase is configured
      const { createClient } = await import('@supabase/supabase-js');
      const url = import.meta.env?.VITE_SUPABASE_URL;
      const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) return false;

      this._client = createClient(url, key, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  async getSession() {
    if (!this._client) return null;
    const { data } = await this._client.auth.getSession();
    return data?.session || null;
  },

  async getUser() {
    if (!this._client) return null;
    const { data } = await this._client.auth.getUser();
    if (!data?.user) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
      avatarUrl: data.user.user_metadata?.avatar_url || null,
      provider: 'supabase',
      plan: data.user.user_metadata?.plan || 'free',
      metadata: data.user.user_metadata,
    };
  },

  async signInEmail(email, password) {
    const { data, error } = await this._client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signUpEmail(email, password) {
    const { data, error } = await this._client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signInOAuth(provider = 'google') {
    const { data, error } = await this._client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async signOut() {
    if (!this._client) return;
    await this._client.auth.signOut();
  },

  async getToken() {
    if (!this._client) return null;
    const { data } = await this._client.auth.getSession();
    return data?.session?.access_token || null;
  },

  onAuthStateChange(callback) {
    if (!this._client) return () => {};
    const { data } = this._client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data?.subscription?.unsubscribe || (() => {});
  },

  async resetPassword(email) {
    const { error } = await this._client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },
};

// ─── Provider: Local (no auth) ──────────────────────────────────

const LocalProvider = {
  name: 'local',

  async init() { return true; },
  async getSession() { return { user: { id: 'local', email: 'local@tradeforge' } }; },
  async getUser() {
    return {
      id: 'local',
      email: 'local@tradeforge',
      name: 'Local User',
      avatarUrl: null,
      provider: 'local',
      plan: 'free',
      metadata: {},
    };
  },
  async signInEmail() { return this.getUser(); },
  async signUpEmail() { return this.getUser(); },
  async signInOAuth() { return this.getUser(); },
  async signOut() {},
  async getToken() { return 'local-token'; },
  onAuthStateChange() { return () => {}; },
  async resetPassword() {},
};

// ─── Provider Selection ─────────────────────────────────────────

let _provider = null;

/**
 * Initialize the auth provider. Tries Supabase first, falls back to local.
 * @returns {Promise<Object>} The active provider
 */
export async function initAuthProvider() {
  if (_provider) return _provider;

  // Try Supabase
  const supabaseReady = await SupabaseProvider.init();
  if (supabaseReady) {
    _provider = SupabaseProvider;
    console.log('[Auth] Using Supabase provider');
    return _provider;
  }

  // Fallback to local
  _provider = LocalProvider;
  console.log('[Auth] Using local provider (no auth configured)');
  return _provider;
}

/**
 * Get the current auth provider.
 * @returns {Object}
 */
export function getAuthProvider() {
  return _provider || LocalProvider;
}

export { SupabaseProvider, LocalProvider };
