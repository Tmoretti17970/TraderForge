// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — StorageAdapter (Sprint 7)
//
// I1.1: Abstract storage behind a provider interface so IndexedDB
//       and Supabase are interchangeable.
// I1.2: Supabase auth shell (email/password + OAuth).
// I1.3: Optimistic writes with last-write-wins conflict resolution.
//
// Architecture:
//   StorageAdapter wraps the existing MiniDB-based StorageService
//   and adds a cloud sync layer. Writes are always local-first
//   (optimistic) and sync to Supabase in the background.
//
// Usage:
//   import { storageAdapter } from './StorageAdapter.js';
//   await storageAdapter.trades.put(trade);  // writes local + queues sync
//   await storageAdapter.sync();             // push/pull with cloud
// ═══════════════════════════════════════════════════════════════════

import StorageService from './StorageService.js';

// ─── I1.2: Auth State ───────────────────────────────────────────

const AUTH_KEY = 'tradeforge-auth';

let _authState = {
  user: null,
  session: null,
  supabaseUrl: '',
  supabaseKey: '',
  isAuthenticated: false,
  provider: 'local', // 'local' | 'supabase'
};

/** Load persisted auth from localStorage */
function _loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(_authState, saved);
    }
  } catch { /* ignore */ }
}

/** Persist auth to localStorage */
function _saveAuth() {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      user: _authState.user,
      session: _authState.session,
      supabaseUrl: _authState.supabaseUrl,
      supabaseKey: _authState.supabaseKey,
      isAuthenticated: _authState.isAuthenticated,
      provider: _authState.provider,
    }));
  } catch { /* ignore */ }
}

// ─── I1.2: Auth API ─────────────────────────────────────────────

/**
 * Configure Supabase connection.
 * Call this from Settings page when user enters their Supabase credentials.
 */
function configureSupabase(url, anonKey) {
  _authState.supabaseUrl = url;
  _authState.supabaseKey = anonKey;
  _saveAuth();
}

/**
 * Sign in with email/password via Supabase Auth REST API.
 * No Supabase SDK dependency — uses raw fetch.
 */
async function signIn(email, password) {
  if (!_authState.supabaseUrl || !_authState.supabaseKey) {
    return { ok: false, error: 'Supabase not configured. Set URL and anon key in Settings.' };
  }

  try {
    const res = await fetch(`${_authState.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': _authState.supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error_description || err.msg || `Auth failed (${res.status})` };
    }

    const data = await res.json();
    _authState.user = data.user;
    _authState.session = { access_token: data.access_token, refresh_token: data.refresh_token };
    _authState.isAuthenticated = true;
    _authState.provider = 'supabase';
    _saveAuth();

    return { ok: true, user: data.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Sign up with email/password.
 */
async function signUp(email, password) {
  if (!_authState.supabaseUrl || !_authState.supabaseKey) {
    return { ok: false, error: 'Supabase not configured.' };
  }

  try {
    const res = await fetch(`${_authState.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': _authState.supabaseKey,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error_description || err.msg || `Signup failed (${res.status})` };
    }

    const data = await res.json();
    return { ok: true, user: data.user || data, message: 'Check email for confirmation link.' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Sign out — clear session, revert to local-only mode.
 */
function signOut() {
  _authState.user = null;
  _authState.session = null;
  _authState.isAuthenticated = false;
  _authState.provider = 'local';
  _saveAuth();
  // Clear sync queue
  _syncQueue.length = 0;
}

function getAuth() {
  return { ..._authState };
}

function isCloudEnabled() {
  return _authState.isAuthenticated && _authState.provider === 'supabase';
}

// ─── I1.3: Sync Queue (Optimistic Writes) ───────────────────────

/**
 * Sync queue stores pending writes that haven't been pushed to cloud.
 * Format: { table, op, data, timestamp }
 * Persisted in localStorage so writes survive page refresh.
 */
const SYNC_QUEUE_KEY = 'tradeforge-sync-queue';
let _syncQueue = [];
let _syncing = false;
let _lastSyncTime = 0;

function _loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (raw) _syncQueue = JSON.parse(raw);
  } catch { _syncQueue = []; }
}

function _saveSyncQueue() {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(_syncQueue));
  } catch { /* quota */ }
}

function _enqueue(table, op, data) {
  if (!isCloudEnabled()) return;
  _syncQueue.push({ table, op, data, ts: Date.now() });
  _saveSyncQueue();
  // Auto-sync after short delay (debounce)
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => sync(), 2000);
}

let _syncTimer = null;

// ─── I1.3: Supabase REST Helpers ────────────────────────────────

async function _supabaseRequest(method, table, body = null, query = '') {
  const url = `${_authState.supabaseUrl}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': _authState.supabaseKey,
    'Authorization': `Bearer ${_authState.session?.access_token}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'resolution=merge-duplicates' : 'return=minimal',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${err}`);
  }

  if (method === 'GET') return res.json();
  return null;
}

// ─── I1.3: Sync Engine ──────────────────────────────────────────

/**
 * Push queued writes to Supabase, then pull latest from cloud.
 * Uses last-write-wins conflict resolution:
 *   - Local writes include a `_updatedAt` timestamp
 *   - On conflict (same id), the later timestamp wins
 *   - Supabase upsert with `on_conflict=id` handles this server-side
 *
 * @returns {{ ok: boolean, pushed: number, pulled: number, errors: string[] }}
 */
async function sync() {
  if (!isCloudEnabled() || _syncing) return { ok: true, pushed: 0, pulled: 0, errors: [] };
  _syncing = true;
  const errors = [];
  let pushed = 0;
  let pulled = 0;

  try {
    // ─── PUSH: Send queued writes ───────────────────────
    const queue = [..._syncQueue];
    for (const item of queue) {
      try {
        const record = { ...item.data, _updatedAt: new Date(item.ts).toISOString() };
        // Add user_id for RLS
        if (_authState.user?.id) record.user_id = _authState.user.id;

        if (item.op === 'delete') {
          await _supabaseRequest('DELETE', item.table, null, `?id=eq.${item.data.id}`);
        } else {
          // Upsert (POST with merge-duplicates)
          await _supabaseRequest('POST', item.table, record);
        }
        pushed++;
      } catch (e) {
        errors.push(`Push ${item.table}/${item.op}: ${e.message}`);
      }
    }

    // Clear processed items from queue
    if (pushed > 0) {
      _syncQueue = _syncQueue.slice(queue.length);
      _saveSyncQueue();
    }

    // ─── PULL: Fetch latest from cloud ──────────────────
    // Only pull records updated after our last sync
    const since = _lastSyncTime
      ? `&_updatedAt=gte.${new Date(_lastSyncTime).toISOString()}`
      : '';

    for (const table of ['trades', 'playbooks', 'notes']) {
      try {
        const userFilter = _authState.user?.id
          ? `?user_id=eq.${_authState.user.id}${since.replace('&', '&')}`
          : `?select=*${since}`;

        const remote = await _supabaseRequest('GET', table, null, userFilter);
        if (!remote?.length) continue;

        // Last-write-wins merge: compare _updatedAt timestamps
        const local = await StorageService[table].getAll();
        const localMap = new Map();
        if (local.ok) {
          for (const item of local.data) {
            localMap.set(item.id, item);
          }
        }

        const toWrite = [];
        for (const remoteItem of remote) {
          const localItem = localMap.get(remoteItem.id);
          if (!localItem) {
            // New from cloud
            toWrite.push(remoteItem);
          } else {
            // Conflict: compare timestamps
            const remoteTime = new Date(remoteItem._updatedAt || 0).getTime();
            const localTime = new Date(localItem._updatedAt || 0).getTime();
            if (remoteTime > localTime) {
              toWrite.push(remoteItem); // Cloud wins
            }
            // else: local wins (already there)
          }
        }

        if (toWrite.length > 0) {
          if (StorageService[table].bulkPut) {
            await StorageService[table].bulkPut(toWrite);
          } else {
            for (const item of toWrite) {
              await StorageService[table].put(item);
            }
          }
          pulled += toWrite.length;
        }
      } catch (e) {
        errors.push(`Pull ${table}: ${e.message}`);
      }
    }

    _lastSyncTime = Date.now();
  } finally {
    _syncing = false;
  }

  return { ok: errors.length === 0, pushed, pulled, errors };
}

/** Get sync status for UI display */
function getSyncStatus() {
  return {
    isCloudEnabled: isCloudEnabled(),
    pending: _syncQueue.length,
    syncing: _syncing,
    lastSync: _lastSyncTime ? new Date(_lastSyncTime).toISOString() : null,
  };
}

// ─── I1.1: StorageAdapter (Wraps StorageService + Sync) ─────────

/**
 * StorageAdapter proxies all reads through local StorageService
 * and enqueues writes for cloud sync when authenticated.
 *
 * This is the single interface all stores should use instead of
 * importing StorageService directly.
 */
const storageAdapter = {
  trades: {
    async getAll() { return StorageService.trades.getAll(); },
    async put(trade) {
      const result = await StorageService.trades.put(trade);
      if (result.ok) _enqueue('trades', 'upsert', trade);
      return result;
    },
    async bulkPut(trades) {
      const result = await StorageService.trades.bulkPut(trades);
      if (result.ok) {
        for (const t of trades) _enqueue('trades', 'upsert', t);
      }
      return result;
    },
    async delete(id) {
      const result = await StorageService.trades.delete(id);
      if (result.ok) _enqueue('trades', 'delete', { id });
      return result;
    },
    async count() { return StorageService.trades.count(); },
    async clear() { return StorageService.trades.clear(); },
    async replaceAll(trades) {
      const result = await StorageService.trades.replaceAll(trades);
      // Full replace: enqueue all as upserts
      if (result.ok) {
        for (const t of trades) _enqueue('trades', 'upsert', t);
      }
      return result;
    },
  },

  playbooks: {
    async getAll() { return StorageService.playbooks.getAll(); },
    async put(pb) {
      const result = await StorageService.playbooks.put(pb);
      if (result.ok) _enqueue('playbooks', 'upsert', pb);
      return result;
    },
    async delete(id) {
      const result = await StorageService.playbooks.delete(id);
      if (result.ok) _enqueue('playbooks', 'delete', { id });
      return result;
    },
    async replaceAll(items) { return StorageService.playbooks.replaceAll(items); },
  },

  notes: {
    async getAll() { return StorageService.notes.getAll(); },
    async put(note) {
      const result = await StorageService.notes.put(note);
      if (result.ok) _enqueue('notes', 'upsert', note);
      return result;
    },
    async delete(id) {
      const result = await StorageService.notes.delete(id);
      if (result.ok) _enqueue('notes', 'delete', { id });
      return result;
    },
    async replaceAll(items) { return StorageService.notes.replaceAll(items); },
  },

  tradePlans: {
    async getAll() { return StorageService.tradePlans.getAll(); },
    async put(plan) { return StorageService.tradePlans.put(plan); },
    async delete(id) { return StorageService.tradePlans.delete(id); },
    async replaceAll(items) { return StorageService.tradePlans.replaceAll(items); },
  },

  settings: {
    async get(key) { return StorageService.settings.get(key); },
    async set(key, value) { return StorageService.settings.set(key, value); },
    async getAll() { return StorageService.settings.getAll(); },
  },

  async clearAll() { return StorageService.clearAll(); },
  async checkQuota() { return StorageService.checkQuota(); },
  async getTradesBySymbol(sym) { return StorageService.getTradesBySymbol(sym); },
  async getTradesByDateRange(from, to) { return StorageService.getTradesByDateRange(from, to); },
};

// ─── Initialize ─────────────────────────────────────────────────

_loadAuth();
_loadSyncQueue();

// ─── Exports ────────────────────────────────────────────────────

export {
  storageAdapter,
  // Auth
  configureSupabase,
  signIn,
  signUp,
  signOut,
  getAuth,
  isCloudEnabled,
  // Sync
  sync,
  getSyncStatus,
};

export default storageAdapter;
