const derivService = require("../services/derivService");
const engine = require("../services/analysisEngine");
const AnalysisResult = require("../models/AnalysisResult");
const asyncHandler = require("../utils/asyncHandler");

function getBufferOr404(symbol, res) {
  const buffer = derivService.getTickBuffer(symbol);
  if (!buffer.length) {
    res.status(404).json({ error: `No live tick data yet for ${symbol}. Try again shortly.` });
    return null;
  }
  return buffer;
}

const getDigitDistribution = asyncHandler(async (req, res) => {
  const symbol = (req.query.symbol || "R_10").toUpperCase();
  const buffer = getBufferOr404(symbol, res);
  if (!buffer) return;
  res.json({
    symbol,
    sampleSize: buffer.length,
    distribution: engine.digitDistribution(buffer),
    evenOdd: engine.evenOddSplit(buffer),
  });
});

const getPatterns = asyncHandler(async (req, res) => {
  const symbol = (req.query.symbol || "R_10").toUpperCase();
  const buffer = getBufferOr404(symbol, res);
  if (!buffer) return;
  res.json({
    symbol,
    sampleSize: buffer.length,
    patterns: engine.patternScores(buffer),
    streaks: engine.currentStreaks(buffer),
  });
});

const runAnalysis = asyncHandler(async (req, res) => {
  const {
    symbol = "R_10",
    strategy = "Even/Odd",
    barrier,
    targetDigit,
    barrierPrice,
    save = true,
  } = req.body || {};

  const upperSymbol = symbol.toUpperCase();
  const buffer = derivService.getTickBuffer(upperSymbol);
  if (!buffer.length) {
    return res.status(404).json({ error: `No live tick data yet for ${upperSymbol}. Try again shortly.` });
  }

  const result = engine.generateSignal(buffer, strategy, { barrier, targetDigit, barrierPrice });
  const distribution = engine.digitDistribution(buffer);
  const patterns = engine.patternScores(buffer);

  const responseBody = {
    symbol: upperSymbol,
    strategy,
    ...result,
    digitDistribution: distribution,
    patternScores: patterns,
    source: "live",
    generatedAt: new Date().toISOString(),
  };

  if (save && result.signal !== "INSUFFICIENT_DATA") {
    const doc = await AnalysisResult.create({
      user: req.user ? req.user._id : undefined,
      symbol: upperSymbol,
      strategy,
      barrier: result.barrier,
      signal: result.signal,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      digitDistribution: distribution,
      patternScores: patterns,
      methodology: result.methodology,
      source: "live",
    });
    responseBody.id = doc._id;
  }

  res.json(responseBody);
});

module.exports = { getDigitDistribution, getPatterns, runAnalysis };
