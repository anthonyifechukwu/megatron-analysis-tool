const derivService = require("../services/derivService");
const asyncHandler = require("../utils/asyncHandler");

const getMarkets = asyncHandler(async (_req, res) => {
  res.json({ markets: derivService.getMarkets(), live: derivService.isConnected() });
});

const getQuote = asyncHandler(async (req, res) => {
  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol query parameter is required" });
  const quote = derivService.getQuote(symbol.toUpperCase());
  if (!quote) return res.status(404).json({ error: `No live data yet for ${symbol}` });
  res.json(quote);
});

const getStatus = asyncHandler(async (_req, res) => {
  res.json(derivService.getStatus());
});

module.exports = { getMarkets, getQuote, getStatus };
