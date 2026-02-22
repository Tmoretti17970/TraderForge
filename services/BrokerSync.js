// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Broker Sync Service (Sprint 5.4)
//
// Polls connected broker APIs for new trades and auto-imports them
// into the journal. Each broker has a specific API adapter.
//
// Architecture:
//   1. Scheduler runs every N minutes (configurable per broker)
//   2. For each connected broker, fetches trades since lastSyncAt
//   3. Normalizes to TradeSchema format
//   4. Deduplicates against existing trades (by broker execution ID)
//   5. Adds new trades to store via sync queue
//
// Usage:
//   import { BrokerSyncService } from './BrokerSync.js';
//   const syncer = new BrokerSyncService(getTokenFn, tradeStore);
//   syncer.start();
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} BrokerTrade
 * @property {string} brokerExecId - Broker's unique execution/fill ID
 * @property {string} symbol
 * @property {'long'|'short'} side
 * @property {number} qty
 * @property {number} entry - Fill price
 * @property {number} [exit] - Close price (if closed)
 * @property {number} [pnl]
 * @property {number} [fees]
 * @property {string} date - ISO string
 * @property {string} assetClass
 * @property {string} broker
 */

// ─── Broker API Adapters ────────────────────────────────────────

const ADAPTERS = {
  schwab: {
    name: 'Schwab / TD Ameritrade',
    pollInterval: 5 * 60 * 1000, // 5 min

    /**
     * Fetch trades from Schwab API.
     * @param {string} accessToken
     * @param {string} since - ISO date string
     * @returns {Promise<BrokerTrade[]>}
     */
    async fetchTrades(accessToken, since) {
      const sinceDate = since || new Date(Date.now() - 7 * 86400000).toISOString();
      const url = `https://api.schwabapi.com/trader/v1/accounts/transactions?startDate=${encodeURIComponent(sinceDate)}&types=TRADE`;

      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!resp.ok) throw new Error(`Schwab API ${resp.status}`);
      const data = await resp.json();

      return (data || [])
        .filter(tx => tx.type === 'TRADE' || tx.type === 'RECEIVE_AND_DELIVER')
        .map(tx => ({
          brokerExecId: tx.transactionId?.toString() || tx.orderId?.toString(),
          symbol: tx.transactionItem?.instrument?.symbol || 'UNKNOWN',
          side: tx.transactionItem?.instruction === 'BUY' ? 'long' : 'short',
          qty: Math.abs(tx.transactionItem?.amount || 0),
          entry: tx.transactionItem?.price || 0,
          exit: null,
          pnl: tx.netAmount || 0,
          fees: Math.abs(tx.fees?.commission || 0) + Math.abs(tx.fees?.regFee || 0),
          date: tx.transactionDate || tx.settlementDate,
          assetClass: mapSchwabAssetClass(tx.transactionItem?.instrument?.assetType),
          broker: 'schwab',
        }));
    },
  },

  ibkr: {
    name: 'Interactive Brokers',
    pollInterval: 10 * 60 * 1000, // 10 min

    async fetchTrades(accessToken, since) {
      const sinceDate = since || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const url = `https://localhost:5000/v1/api/iserver/account/trades?days=7`;

      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!resp.ok) throw new Error(`IBKR API ${resp.status}`);
      const data = await resp.json();

      return (data || []).map(trade => ({
        brokerExecId: trade.execution_id || trade.order_ref,
        symbol: trade.symbol || trade.contract?.symbol || 'UNKNOWN',
        side: (trade.side || '').toLowerCase().includes('buy') ? 'long' : 'short',
        qty: Math.abs(trade.size || trade.shares || 0),
        entry: trade.price || trade.avg_price || 0,
        exit: null,
        pnl: trade.realized_pnl || 0,
        fees: Math.abs(trade.commission || 0),
        date: trade.trade_time || trade.time,
        assetClass: mapIBKRAssetClass(trade.sec_type || trade.contract?.secType),
        broker: 'ibkr',
      }));
    },
  },

  tradovate: {
    name: 'Tradovate',
    pollInterval: 5 * 60 * 1000,

    async fetchTrades(accessToken, since) {
      const url = 'https://live.tradovateapi.com/v1/fill/list';

      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!resp.ok) throw new Error(`Tradovate API ${resp.status}`);
      const data = await resp.json();

      const sinceTime = since ? new Date(since).getTime() : 0;

      return (data || [])
        .filter(fill => new Date(fill.timestamp).getTime() > sinceTime)
        .map(fill => ({
          brokerExecId: fill.id?.toString(),
          symbol: fill.contractId?.toString() || 'UNKNOWN',
          side: fill.action === 'Buy' ? 'long' : 'short',
          qty: Math.abs(fill.qty || 0),
          entry: fill.price || 0,
          exit: null,
          pnl: fill.pnl || 0,
          fees: Math.abs(fill.commission || 0) + Math.abs(fill.fee || 0),
          date: fill.timestamp,
          assetClass: 'futures',
          broker: 'tradovate',
        }));
    },
  },
};

// ─── Asset Class Mappers ────────────────────────────────────────

function mapSchwabAssetClass(type) {
  const MAP = {
    EQUITY: 'stock', OPTION: 'options', MUTUAL_FUND: 'stock',
    FIXED_INCOME: 'stock', INDEX: 'stock', FOREX: 'forex',
    FUTURE: 'futures', FUTURE_OPTION: 'futures', CRYPTO: 'crypto',
  };
  return MAP[type] || 'stock';
}

function mapIBKRAssetClass(secType) {
  const MAP = {
    STK: 'stock', OPT: 'options', FUT: 'futures', CASH: 'forex',
    CRYPTO: 'crypto', BOND: 'stock', FOP: 'futures', WAR: 'options',
  };
  return MAP[secType] || 'stock';
}

// ─── BrokerSyncService ──────────────────────────────────────────

export class BrokerSyncService {
  /**
   * @param {Function} getTokenFn - (userId, broker) => accessToken | null
   * @param {Object} tradeStore - Zustand store with addTrade, trades
   * @param {string} userId
   */
  constructor(getTokenFn, tradeStore, userId) {
    this._getToken = getTokenFn;
    this._tradeStore = tradeStore;
    this._userId = userId;
    this._intervals = {};
    this._lastSync = {}; // broker → ISO string
    this._running = false;
  }

  /**
   * Start auto-sync for all connected brokers.
   */
  start() {
    if (this._running) return;
    this._running = true;

    for (const [brokerId, adapter] of Object.entries(ADAPTERS)) {
      this._intervals[brokerId] = setInterval(
        () => this.syncBroker(brokerId),
        adapter.pollInterval
      );
      // Initial sync after 5 seconds
      setTimeout(() => this.syncBroker(brokerId), 5000);
    }
  }

  /**
   * Stop all sync intervals.
   */
  stop() {
    this._running = false;
    for (const id of Object.values(this._intervals)) clearInterval(id);
    this._intervals = {};
  }

  /**
   * Sync a single broker.
   * @param {string} brokerId
   * @returns {Promise<{added: number, skipped: number}>}
   */
  async syncBroker(brokerId) {
    const adapter = ADAPTERS[brokerId];
    if (!adapter) return { added: 0, skipped: 0 };

    const token = this._getToken(this._userId, brokerId);
    if (!token) return { added: 0, skipped: 0 };

    try {
      const since = this._lastSync[brokerId] || null;
      const brokerTrades = await adapter.fetchTrades(token, since);

      if (!brokerTrades?.length) return { added: 0, skipped: 0 };

      // Deduplicate against existing trades
      const existing = this._tradeStore.getState().trades || [];
      const existingExecIds = new Set(
        existing.filter(t => t._brokerExecId).map(t => t._brokerExecId)
      );

      let added = 0, skipped = 0;

      for (const bt of brokerTrades) {
        if (!bt.brokerExecId || existingExecIds.has(bt.brokerExecId)) {
          skipped++;
          continue;
        }

        // Normalize to TradeSchema
        const trade = {
          id: `broker_${brokerId}_${bt.brokerExecId}`,
          symbol: bt.symbol,
          side: bt.side,
          qty: bt.qty,
          entry: bt.entry,
          exit: bt.exit || 0,
          pnl: bt.pnl || 0,
          fees: bt.fees || 0,
          date: bt.date,
          assetClass: bt.assetClass,
          source: `auto:${brokerId}`,
          _brokerExecId: bt.brokerExecId,
          _broker: brokerId,
          _importedAt: new Date().toISOString(),
          _updatedAt: new Date().toISOString(),
          // User can fill these in later
          playbook: '',
          emotion: '',
          notes: `Auto-imported from ${adapter.name}`,
          rating: 0,
          ruleBreak: false,
        };

        this._tradeStore.getState().addTrade(trade);
        added++;
      }

      this._lastSync[brokerId] = new Date().toISOString();
      console.log(`[BrokerSync] ${brokerId}: +${added} trades, ${skipped} skipped`);

      return { added, skipped };
    } catch (err) {
      console.warn(`[BrokerSync] ${brokerId} error:`, err.message);
      return { added: 0, skipped: 0, error: err.message };
    }
  }

  /**
   * Get sync status for all brokers.
   */
  getStatus() {
    return Object.entries(ADAPTERS).map(([id, adapter]) => ({
      id,
      name: adapter.name,
      lastSync: this._lastSync[id] || null,
      running: !!this._intervals[id],
    }));
  }
}

export { ADAPTERS, mapSchwabAssetClass, mapIBKRAssetClass };
export default BrokerSyncService;
