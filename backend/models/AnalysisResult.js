const mongoose = require("mongoose");

const analysisResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // null for anonymous/demo
    symbol: { type: String, required: true, uppercase: true, trim: true },
    strategy: {
      type: String,
      enum: ["Even/Odd", "Over/Under", "Matches/Differs", "Rise/Fall", "Higher/Lower"],
      required: true,
    },
    barrier: { type: Number }, // used for Over/Under and Matches/Differs
    signal: { type: String, required: true }, // e.g. "ODD", "OVER", "RISE"
    confidence: { type: Number, min: 0, max: 100, required: true },
    sampleSize: { type: Number, required: true }, // number of ticks the signal was computed from
    digitDistribution: { type: [Number], default: undefined }, // 10 buckets, percentages
    patternScores: [
      {
        name: String,
        score: Number,
      },
    ],
    methodology: { type: String }, // short description of how the signal was derived
    source: { type: String, enum: ["live", "demo"], default: "live" },
  },
  { timestamps: true }
);

analysisResultSchema.index({ user: 1, createdAt: -1 });
analysisResultSchema.index({ symbol: 1, createdAt: -1 });

module.exports = mongoose.model("AnalysisResult", analysisResultSchema);
