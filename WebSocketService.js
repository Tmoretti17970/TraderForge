// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — WebSocketService (Compatibility Shim)
// Real-time data is now handled by chartEngine/feeds/BinanceFeed.js
// This shim preserves the API for useWebSocket.js and LiveTicker.jsx
// ═══════════════════════════════════════════════════════════════════

export const WS_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
};

const BINANCE_SYMBOLS = new Set([
  'BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','UNI',
  'ATOM','FTM','NEAR','APT','ARB','OP','SUI','SEI','TIA','JUP','WIF','PEPE',
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT',
]);

const TF_MAP = {
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','2h':'2h','4h':'4h','6h':'6h','8h':'8h','12h':'12h',
  '1D':'1d','1d':'1d','3D':'3d','1W':'1w','1w':'1w','1M':'1M',
};

function toSymbol(s) {
  const u = (s || '').toUpperCase();
  if (u.endsWith('USDT')) return u;
  return u + 'USDT';
}

class _WebSocketService {
  constructor() {
    this._ws = null;
    this._status = WS_STATUS.DISCONNECTED;
    this._callbacks = {};
    this._retryCount = 0;
    this._retryTimer = null;
    this._lastSymbol = null;
    this._lastTf = null;
    this._maxRetries = 5;
    this._intentionalClose = false;
  }

  static isSupported(symbol) {
    const u = (symbol || '').toUpperCase();
    return BINANCE_SYMBOLS.has(u) || BINANCE_SYMBOLS.has(u.replace('USDT',''));
  }

  /** Exponential backoff: 1s, 2s, 4s, 8s, 16s (capped) */
  _getRetryDelay() {
    return Math.min(1000 * Math.pow(2, this._retryCount), 16000);
  }

  _scheduleReconnect() {
    if (this._intentionalClose || this._retryCount >= this._maxRetries) {
      this._status = WS_STATUS.DISCONNECTED;
      if (this._callbacks.onStatus) this._callbacks.onStatus(this._status);
      return;
    }

    this._status = WS_STATUS.RECONNECTING;
    if (this._callbacks.onStatus) this._callbacks.onStatus(this._status);

    const delay = this._getRetryDelay();
    this._retryTimer = setTimeout(() => {
      this._retryCount++;
      if (this._lastSymbol && this._lastTf) {
        this._connect(this._lastSymbol, this._lastTf);
      }
    }, delay);
  }

  _connect(symbol, tf) {
    const sym = toSymbol(symbol).toLowerCase();
    const interval = TF_MAP[tf] || '1h';

    this._status = WS_STATUS.CONNECTING;
    if (this._callbacks.onStatus) this._callbacks.onStatus(this._status);

    try {
      this._ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@kline_${interval}`);

      this._ws.onopen = () => {
        this._status = WS_STATUS.CONNECTED;
        this._retryCount = 0; // Reset on successful connection
        if (this._callbacks.onStatus) this._callbacks.onStatus(this._status);
      };

      this._ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.e === 'kline' && msg.k && this._callbacks.onBar) {
            const k = msg.k;
            this._callbacks.onBar({
              time: k.t,
              open: +k.o,
              high: +k.h,
              low: +k.l,
              close: +k.c,
              volume: +k.v,
              isClosed: k.x,
            });
          }
        } catch { /* ignore malformed messages */ }
      };

      this._ws.onclose = () => {
        this._ws = null;
        if (!this._intentionalClose) {
          this._scheduleReconnect();
        } else {
          this._status = WS_STATUS.DISCONNECTED;
          if (this._callbacks.onStatus) this._callbacks.onStatus(this._status);
        }
      };

      this._ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  subscribe(symbol, tf, callbacks = {}) {
    this.unsubscribe();
    this._callbacks = callbacks;
    this._lastSymbol = symbol;
    this._lastTf = tf;
    this._retryCount = 0;
    this._intentionalClose = false;
    this._connect(symbol, tf);
  }

  unsubscribe() {
    this._intentionalClose = true;
    clearTimeout(this._retryTimer);
    this._retryTimer = null;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._status = WS_STATUS.DISCONNECTED;
    this._callbacks = {};
  }

  get status() { return this._status; }
}

export const WebSocketService = _WebSocketService;
export const wsService = new _WebSocketService();
export default wsService;
