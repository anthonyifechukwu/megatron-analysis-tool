/*
  Deriv WebSocket integration.

  Connects once, on the server, to Deriv's public market-data WebSocket API
  and keeps a rolling in-memory tick buffer per symbol. The frontend never
  talks to Deriv directly — it only calls our REST endpoints, which read
  from these buffers. This keeps any future authenticated Deriv calls
  (e.g. account-level features) off the browser entirely.

  Docs: https://api.deriv.com  (public "ticks" / "ticks_history" endpoints
  require no API token — an app_id is sufficient for market-data access).
*/

const WebSocket = require("ws");
const EventEmitter = require("events");
const logger = require("../utils/logger");

const APP_ID = process.env.DERIV_APP_ID || "1089";
const WS_URL = process.env.DERIV_WS_URL || "wss://ws.derivws.com/websockets/v3";
const SYMBOLS = (process.env.DERIV_SYMBOLS || "R_10,R_25,R_50,R_75,R_100")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const BUFFER_SIZE = parseInt(process.env.TICK_BUFFER_SIZE || "1000", 10);

const MARKET_NAMES = {
  R_10: "Volatility 10 Index",
  R_25: "Volatility 25 Index",
  R_50: "Volatility 50 Index",
  R_75: "Volatility 75 Index",
  R_100: "Volatility 100 Index",
  R_10_1S: "Volatility 10 (1s) Index",
  R_25_1S: "Volatility 25 (1s) Index",
  R_50_1S: "Volatility 50 (1s) Index",
  R_75_1S: "Volatility 75 (1s) Index",
  R_100_1S: "Volatility 100 (1s) Index",
};

class DerivService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
    this.buffers = new Map(); // symbol -> array of { quote, epoch }
    this.lastQuote = new Map(); // symbol -> latest tick
    this.lastError = null;
    this.pingInterval = null;
    this.invalidSymbols = new Set(); // symbols Deriv has rejected — stop retrying these
    for (const s of SYMBOLS) this.buffers.set(s, []);
  }

  start() {
    this._connect();
  }

  _connect() {
    const url = `${WS_URL}?app_id=${APP_ID}`;
    logger.info(`Connecting to Deriv WS: ${url}`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      this.lastError = err.message;
      logger.error(`Deriv WS construction failed: ${err.message}`);
      this._scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.lastError = null;
      logger.info("Deriv WS connected");
      for (const symbol of SYMBOLS) {
        if (this.invalidSymbols.has(symbol)) {
          logger.warn(`Skipping "${symbol}" — Deriv previously rejected this symbol for this app_id/account.`);
          continue;
        }
        this._send({ ticks: symbol, subscribe: 1 });
      }
      // Deriv requires periodic activity or it will time the socket out on some networks
      this.pingInterval = setInterval(() => this._send({ ping: 1 }), 25000);
      this.emit("connected");
    });

    this.ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        logger.warn(`Deriv WS: unparseable message: ${err.message}`);
        return;
      }
      this._handleMessage(msg);
    });

    this.ws.on("close", (code) => {
      this.connected = false;
      clearInterval(this.pingInterval);
      logger.warn(`Deriv WS closed (code ${code}). Reconnecting…`);
      this._scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.lastError = err.message;
      logger.error(`Deriv WS error: ${err.message}`);
      // 'close' will also fire after 'error' in most cases; reconnect handled there
    });
  }

  _scheduleReconnect() {
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    setTimeout(() => this._connect(), delay);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _handleMessage(msg) {
    if (msg.error) {
      this.lastError = msg.error.message || "Deriv API error";
      logger.warn(`Deriv API error: ${this.lastError}`);

      // If this error is tied to a specific symbol (e.g. "Symbol R_10 is
      // invalid"), stop trying to use that symbol going forward instead
      // of letting it keep failing on every reconnect, while everything
      // else keeps working normally.
      const badSymbol = this._extractSymbolFromError(msg);
      if (badSymbol) {
        this.invalidSymbols.add(badSymbol);
        logger.warn(`Deriv rejected symbol "${badSymbol}" — no longer requesting it. ` +
          `This usually means your app_id/account doesn't have access to synthetic ` +
          `indices (a regulatory restriction tied to the Deriv entity the app_id is ` +
          `registered under), not a typo in the symbol name.`);
      }

      // IMPORTANT: never emit Node's built-in "error" event here. It has
      // special behaviour — if nothing is listening for it, Node treats
      // it as fatal and crashes the whole process. That was happening on
      // every single Deriv API error (not just this one), which is far
      // more serious than any one bad symbol. Using a differently-named
      // event means listeners are optional, as they should be for a
      // recoverable, expected condition like this.
      this.emit("apiError", msg.error);
      return;
    }

    if (msg.msg_type === "tick" && msg.tick) {
      const { symbol, quote, epoch } = msg.tick;
      this._pushTick(symbol, quote, epoch);
      this.emit("tick", { symbol, quote, epoch });
    }
  }

  _extractSymbolFromError(msg) {
    // Deriv's echo_req on an error response includes the original
    // request, which is the reliable way to know which symbol a
    // "Symbol X is invalid" error was actually about.
    if (msg.echo_req && msg.echo_req.ticks) {
      return msg.echo_req.ticks;
    }
    // Fall back to parsing the message text itself if echo_req isn't present.
    const match = (msg.error && msg.error.message || "").match(/Symbol (\S+) is invalid/i);
    return match ? match[1] : null;
  }

  _pushTick(symbol, quote, epoch) {
    if (!this.buffers.has(symbol)) this.buffers.set(symbol, []);
    const buf = this.buffers.get(symbol);
    buf.push({ quote, epoch });
    if (buf.length > BUFFER_SIZE) buf.shift();
    this.lastQuote.set(symbol, { quote, epoch });
  }

  // ---- Public read API used by controllers ----

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      connected: this.connected,
      symbols: SYMBOLS,
      invalidSymbols: Array.from(this.invalidSymbols),
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError,
      bufferedSymbols: Array.from(this.buffers.entries()).map(([symbol, buf]) => ({
        symbol,
        ticks: buf.length,
      })),
    };
  }

  getMarkets() {
    return SYMBOLS.map((symbol) => {
      const last = this.lastQuote.get(symbol);
      const buf = this.buffers.get(symbol) || [];
      const prev = buf.length > 1 ? buf[buf.length - 2].quote : last?.quote;
      const change = last && prev ? (((last.quote - prev) / prev) * 100).toFixed(2) : "0.00";
      return {
        name: MARKET_NAMES[symbol] || symbol,
        symbol,
        price: last ? last.quote : null,
        change: Number(change),
        volatility: this._impliedVolatility(symbol),
        ticks: buf.length,
        live: !!last,
      };
    });
  }

  getQuote(symbol) {
    const last = this.lastQuote.get(symbol);
    if (!last) return null;
    return { symbol, ...last };
  }

  getTickBuffer(symbol) {
    return this.buffers.get(symbol) || [];
  }

  _impliedVolatility(symbol) {
    const match = symbol.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }
}

module.exports = new DerivService();
