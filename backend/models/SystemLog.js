const mongoose = require("mongoose");

const systemLogSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ["info", "warn", "error"], default: "info" },
    category: {
      type: String,
      enum: ["auth", "deriv", "analysis", "admin", "system"],
      default: "system",
    },
    message: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

systemLogSchema.index({ createdAt: -1 });

// Cap growth: keep at most the most recent 50k entries via TTL is not exact,
// so a scheduled cleanup job (see utils/cleanup.js) trims old rows instead.
module.exports = mongoose.model("SystemLog", systemLogSchema);
