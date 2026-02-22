// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — StorageService (MiniDB / IndexedDB)
// Replaces: localStorage, window.storage, raw storage.js
// Uses lightweight MiniDB that falls back to in-memory for Node/tests.
// In production: swap MiniDB for Dexie via `import Dexie from 'dexie'`
// ═══════════════════════════════════════════════════════════════════

import { STORAGE_KEY } from '../constants.js';

// ─── IndexedDB wrapper (Dexie-compatible subset) ────────────────
class MiniDB {
  constructor(name) {
    this._name = name;
    this._stores = {};
    this._db = null;
    this._ready = null;
    this._useIDB = typeof indexedDB !== 'undefined';
  }

  version(v) {
    this._version = v;
    return {
      stores: (schema) => {
        this._schema = schema;
        this._ready = this._open();
      },
    };
  }

  async _open() {
    if (!this._useIDB) {
      for (const table of Object.keys(this._schema)) {
        this._stores[table] = new Map();
      }
      return;
    }

    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._name, this._version);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const [table, keys] of Object.entries(this._schema)) {
          const parts = keys.split(',').map((k) => k.trim());
          const pk = parts[0].replace('&', '').replace('++', '');
          let store;
          if (!db.objectStoreNames.contains(table)) {
            store = db.createObjectStore(table, { keyPath: pk });
          } else {
            store = e.target.transaction.objectStore(table);
          }
          // Create indexes for non-primary-key fields
          for (let i = 1; i < parts.length; i++) {
            const idx = parts[i].replace('&', '').replace('++', '');
            if (idx && !store.indexNames.contains(idx)) {
              store.createIndex(idx, idx, { unique: false });
            }
          }
        }
      };

      req.onsuccess = (e) => {
        this._db = e.target.result;
        resolve();
      };

      req.onerror = () => {
        console.warn('[StorageService] IndexedDB failed, using in-memory fallback');
        this._useIDB = false;
        for (const table of Object.keys(this._schema)) {
          this._stores[table] = new Map();
        }
        resolve();
      };
    });
  }

  table(name) {
    return new TableAccessor(this, name);
  }
}

class TableAccessor {
  constructor(db, table) {
    this._db = db;
    this._table = table;
  }

  async put(item) {
    await this._db._ready;
    if (!this._db._useIDB) {
      const pk = this._getPK();
      this._db._stores[this._table].set(item[pk], item);
      return item[pk];
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readwrite');
      const store = tx.objectStore(this._table);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        const err = req.error || tx.error;
        if (err?.name === 'QuotaExceededError') {
          err.isQuotaError = true;
          err.message = `Storage quota exceeded writing to "${this._table}". Run quotaRecovery() to free space.`;
        }
        reject(err);
      };
    });
  }

  async bulkPut(items) {
    await this._db._ready;
    if (!this._db._useIDB) {
      const pk = this._getPK();
      for (const item of items) {
        this._db._stores[this._table].set(item[pk], item);
      }
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readwrite');
      const store = tx.objectStore(this._table);
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        const err = tx.error;
        if (err?.name === 'QuotaExceededError') {
          err.isQuotaError = true;
          err.message = `Storage quota exceeded during bulk write to "${this._table}".`;
        }
        reject(err);
      };
      tx.onabort = () => {
        const err = tx.error;
        if (err?.name === 'QuotaExceededError') {
          err.isQuotaError = true;
        }
        reject(err || new Error('Transaction aborted'));
      };
    });
  }

  async get(key) {
    await this._db._ready;
    if (!this._db._useIDB) {
      return this._db._stores[this._table].get(key) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readonly');
      const store = tx.objectStore(this._table);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll() {
    await this._db._ready;
    if (!this._db._useIDB) {
      return [...this._db._stores[this._table].values()];
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readonly');
      const store = tx.objectStore(this._table);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(key) {
    await this._db._ready;
    if (!this._db._useIDB) {
      this._db._stores[this._table].delete(key);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readwrite');
      const store = tx.objectStore(this._table);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear() {
    await this._db._ready;
    if (!this._db._useIDB) {
      this._db._stores[this._table].clear();
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readwrite');
      const store = tx.objectStore(this._table);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async count() {
    await this._db._ready;
    if (!this._db._useIDB) {
      return this._db._stores[this._table].size;
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readonly');
      const store = tx.objectStore(this._table);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _getPK() {
    const keys = this._db._schema[this._table];
    return keys.split(',')[0].trim().replace('&', '').replace('++', '');
  }

  /**
   * Query records by an indexed field value.
   * Falls back to full scan + filter in memory mode.
   * @param {string} field - Indexed field name
   * @param {*} value - Value to match
   * @returns {Promise<Object[]>}
   */
  async where(field, value) {
    await this._db._ready;
    if (!this._db._useIDB) {
      const all = [...this._db._stores[this._table].values()];
      return all.filter((item) => item[field] === value);
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readonly');
      const store = tx.objectStore(this._table);
      let req;
      try {
        const index = store.index(field);
        req = index.getAll(value);
      } catch {
        // Index doesn't exist — fall back to full scan
        req = store.getAll();
        req.onsuccess = () => resolve((req.result || []).filter((item) => item[field] === value));
        req.onerror = () => reject(req.error);
        return;
      }
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Query records within a range on an indexed field.
   * @param {string} field - Indexed field name
   * @param {*} lower - Lower bound (inclusive)
   * @param {*} upper - Upper bound (inclusive)
   * @returns {Promise<Object[]>}
   */
  async whereRange(field, lower, upper) {
    await this._db._ready;
    if (!this._db._useIDB) {
      const all = [...this._db._stores[this._table].values()];
      return all.filter((item) => item[field] >= lower && item[field] <= upper);
    }
    return new Promise((resolve, reject) => {
      const tx = this._db._db.transaction(this._table, 'readonly');
      const store = tx.objectStore(this._table);
      try {
        const index = store.index(field);
        const range = IDBKeyRange.bound(lower, upper);
        const req = index.getAll(range);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch {
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result || []).filter((item) => item[field] >= lower && item[field] <= upper));
        req.onerror = () => reject(req.error);
      }
    });
  }
}

// ─── Database Instance ──────────────────────────────────────────
const db = new MiniDB(STORAGE_KEY);

db.version(2).stores({
  trades: '&id, date, symbol, playbook',
  playbooks: '&id, name',
  notes: '&id, date',
  tradePlans: '&id, date',
  settings: '&key',
});

// ─── StorageService API ─────────────────────────────────────────
const StorageService = {
  trades: {
    async getAll() {
      try { const data = await db.table('trades').getAll(); return { ok: true, data }; }
      catch (e) { return { ok: false, data: [], error: e.message }; }
    },
    async put(trade) {
      try { await db.table('trades').put(trade); return { ok: true }; }
      catch (e) {
        if (e.isQuotaError) return { ok: false, error: e.message, quotaExceeded: true };
        return { ok: false, error: e.message };
      }
    },
    async bulkPut(trades) {
      try { await db.table('trades').bulkPut(trades); return { ok: true }; }
      catch (e) {
        if (e.isQuotaError) return { ok: false, error: e.message, quotaExceeded: true };
        return { ok: false, error: e.message };
      }
    },
    async delete(id) {
      try { await db.table('trades').delete(id); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async count() {
      try { const data = await db.table('trades').count(); return { ok: true, data }; }
      catch (e) { return { ok: false, data: 0, error: e.message }; }
    },
    async clear() {
      try { await db.table('trades').clear(); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async replaceAll(trades) {
      try {
        await db.table('trades').clear();
        if (trades.length) await db.table('trades').bulkPut(trades);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  playbooks: {
    async getAll() {
      try { const data = await db.table('playbooks').getAll(); return { ok: true, data }; }
      catch (e) { return { ok: false, data: [], error: e.message }; }
    },
    async put(pb) {
      try { await db.table('playbooks').put(pb); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async delete(id) {
      try { await db.table('playbooks').delete(id); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async replaceAll(items) {
      try {
        await db.table('playbooks').clear();
        if (items.length) await db.table('playbooks').bulkPut(items);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  notes: {
    async getAll() {
      try { const data = await db.table('notes').getAll(); return { ok: true, data }; }
      catch (e) { return { ok: false, data: [], error: e.message }; }
    },
    async put(note) {
      try { await db.table('notes').put(note); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async delete(id) {
      try { await db.table('notes').delete(id); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async replaceAll(items) {
      try {
        await db.table('notes').clear();
        if (items.length) await db.table('notes').bulkPut(items);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  tradePlans: {
    async getAll() {
      try { const data = await db.table('tradePlans').getAll(); return { ok: true, data }; }
      catch (e) { return { ok: false, data: [], error: e.message }; }
    },
    async put(plan) {
      try { await db.table('tradePlans').put(plan); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async delete(id) {
      try { await db.table('tradePlans').delete(id); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async replaceAll(items) {
      try {
        await db.table('tradePlans').clear();
        if (items.length) await db.table('tradePlans').bulkPut(items);
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
  },

  settings: {
    async get(key) {
      try {
        const row = await db.table('settings').get(key);
        return { ok: true, data: row?.value ?? null };
      } catch (e) { return { ok: false, data: null, error: e.message }; }
    },
    async set(key, value) {
      try { await db.table('settings').put({ key, value }); return { ok: true }; }
      catch (e) { return { ok: false, error: e.message }; }
    },
    async getAll() {
      try {
        const rows = await db.table('settings').getAll();
        const obj = {};
        rows.forEach((r) => { obj[r.key] = r.value; });
        return { ok: true, data: obj };
      } catch (e) { return { ok: false, data: {}, error: e.message }; }
    },
  },

  async clearAll() {
    try {
      await Promise.all([
        db.table('trades').clear(),
        db.table('playbooks').clear(),
        db.table('notes').clear(),
        db.table('tradePlans').clear(),
        db.table('settings').clear(),
      ]);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  // ─── Indexed Queries ─────────────────────────────────────
  async getTradesBySymbol(symbol) {
    try {
      const data = await db.table('trades').where('symbol', symbol);
      return { ok: true, data };
    } catch (e) { return { ok: false, data: [], error: e.message }; }
  },

  async getTradesByDateRange(from, to) {
    try {
      const data = await db.table('trades').whereRange('date', from, to);
      return { ok: true, data };
    } catch (e) { return { ok: false, data: [], error: e.message }; }
  },

  // ─── Quota Management ────────────────────────────────────

  /**
   * Check storage quota usage. Returns { used, quota, percent }.
   * Only works in browsers with StorageManager API.
   */
  async checkQuota() {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return { ok: true, data: { used: 0, quota: 0, percent: 0, available: true } };
    }
    try {
      const est = await navigator.storage.estimate();
      const used = est.usage || 0;
      const quota = est.quota || 0;
      const percent = quota > 0 ? Math.round((used / quota) * 100) : 0;
      return { ok: true, data: { used, quota, percent, available: percent < 95 } };
    } catch (e) {
      return { ok: false, data: { used: 0, quota: 0, percent: 0, available: true }, error: e.message };
    }
  },

  /**
   * Emergency cleanup when quota is near-full.
   * Removes oldest trades (by date) to free space.
   * @param {number} targetPercent - Reduce to this % of quota (default: 70)
   */
  async quotaRecovery(targetPercent = 70) {
    const quotaCheck = await this.checkQuota();
    if (!quotaCheck.ok || quotaCheck.data.percent < 90) {
      return { ok: true, freed: 0, message: 'Quota OK, no recovery needed' };
    }

    try {
      const allTrades = await db.table('trades').getAll();
      if (allTrades.length === 0) return { ok: true, freed: 0 };

      // Sort by date ascending (oldest first)
      allTrades.sort((a, b) => {
        const da = a.date || a.entryDate || 0;
        const db_ = b.date || b.entryDate || 0;
        return (typeof da === 'string' ? new Date(da).getTime() : da)
          - (typeof db_ === 'string' ? new Date(db_).getTime() : db_);
      });

      // Remove oldest 20% of trades
      const removeCount = Math.ceil(allTrades.length * 0.2);
      const toRemove = allTrades.slice(0, removeCount);

      for (const trade of toRemove) {
        await db.table('trades').delete(trade.id);
      }

      console.warn(`[StorageService] Quota recovery: removed ${removeCount} oldest trades`);
      return { ok: true, freed: removeCount, message: `Removed ${removeCount} oldest trades` };
    } catch (e) {
      return { ok: false, freed: 0, error: e.message };
    }
  },

  async migrateFromLegacy() {
    const migrated = { trades: 0, playbooks: 0, notes: 0 };
    if (typeof window !== 'undefined' && window.storage) {
      try {
        const r = await window.storage.get('tradeforge-os-v93');
        if (r) {
          const data = JSON.parse(r.value);
          if (data.trades?.length) { await db.table('trades').bulkPut(data.trades); migrated.trades = data.trades.length; }
          if (data.playbooks?.length) { await db.table('playbooks').bulkPut(data.playbooks); migrated.playbooks = data.playbooks.length; }
          if (data.notes?.length) { await db.table('notes').bulkPut(data.notes); migrated.notes = data.notes.length; }
        }
      } catch (e) { console.warn('[Storage] Legacy migration failed:', e); }
    }
    return migrated;
  },
};

export { StorageService, db };
export default StorageService;
