const AnalysisResult = require("../models/AnalysisResult");
const asyncHandler = require("../utils/asyncHandler");

const listHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const query = { user: req.user._id };
  if (req.query.symbol) query.symbol = req.query.symbol.toUpperCase();
  if (req.query.strategy) query.strategy = req.query.strategy;

  const [items, total] = await Promise.all([
    AnalysisResult.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AnalysisResult.countDocuments(query),
  ]);

  res.json({ items, total, page, limit });
});

const clearHistory = asyncHandler(async (req, res) => {
  const result = await AnalysisResult.deleteMany({ user: req.user._id });
  res.json({ message: "History cleared", deletedCount: result.deletedCount });
});

const deleteHistoryItem = asyncHandler(async (req, res) => {
  const deleted = await AnalysisResult.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!deleted) return res.status(404).json({ error: "History item not found" });
  res.json({ message: "Deleted", id: req.params.id });
});

module.exports = { listHistory, clearHistory, deleteHistoryItem };
