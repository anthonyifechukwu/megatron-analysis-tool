const mongoose = require("mongoose");

const watchlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    label: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

watchlistSchema.index({ user: 1, symbol: 1 }, { unique: true });

module.exports = mongoose.model("Watchlist", watchlistSchema);
