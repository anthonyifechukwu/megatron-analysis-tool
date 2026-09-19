const Watchlist = require("../models/Watchlist");
const asyncHandler = require("../utils/asyncHandler");

const listWatchlist = asyncHandler(async (req, res) => {
  const items = await Watchlist.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ items });
});

const addToWatchlist = asyncHandler(async (req, res) => {
  const { symbol, label, note } = req.body;
  if (!symbol) return res.status(400).json({ error: "symbol is required" });

  const item = await Watchlist.findOneAndUpdate(
    { user: req.user._id, symbol: symbol.toUpperCase() },
    { $set: { label, note } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ item });
});

const removeFromWatchlist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await Watchlist.findOneAndDelete({ _id: id, user: req.user._id });
  if (!deleted) return res.status(404).json({ error: "Watchlist item not found" });
  res.json({ message: "Removed", id });
});

module.exports = { listWatchlist, addToWatchlist, removeFromWatchlist };
