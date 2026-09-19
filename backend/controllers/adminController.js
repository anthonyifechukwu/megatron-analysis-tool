const User = require("../models/User");
const AnalysisResult = require("../models/AnalysisResult");
const SystemLog = require("../models/SystemLog");
const derivService = require("../services/derivService");
const { dbStatus } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const listUsers = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const filter = {};
  if (req.query.q) {
    filter.$or = [
      { name: { $regex: req.query.q, $options: "i" } },
      { email: { $regex: req.query.q, $options: "i" } },
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ items: items.map((u) => u.toSafeJSON()), total, page, limit });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "suspended"].includes(status)) {
    return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!user) return res.status(404).json({ error: "User not found" });
  await SystemLog.create({
    level: "info",
    category: "admin",
    message: `Admin set ${user.email} status to ${status}`,
    user: req.user._id,
  });
  res.json({ user: user.toSafeJSON() });
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "role must be 'user' or 'admin'" });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ error: "User not found" });
  await SystemLog.create({
    level: "info",
    category: "admin",
    message: `Admin set ${user.email} role to ${role}`,
    user: req.user._id,
  });
  res.json({ user: user.toSafeJSON() });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  await SystemLog.create({
    level: "warn",
    category: "admin",
    message: `Admin deleted user ${user.email}`,
    user: req.user._id,
  });
  res.json({ message: "User deleted", id: req.params.id });
});

const recentAnalyses = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const items = await AnalysisResult.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "name email");
  res.json({ items });
});

const systemStatus = asyncHandler(async (_req, res) => {
  res.json({
    database: dbStatus(),
    deriv: derivService.getStatus(),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

const getLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const filter = {};
  if (req.query.level) filter.level = req.query.level;
  if (req.query.category) filter.category = req.query.category;
  const items = await SystemLog.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ items });
});

const platformStats = asyncHandler(async (_req, res) => {
  const [userCount, activeUsers, analysisCount, last24hAnalyses] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: "active" }),
    AnalysisResult.countDocuments({}),
    AnalysisResult.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
  ]);

  const strategyBreakdown = await AnalysisResult.aggregate([
    { $group: { _id: "$strategy", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({
    users: { total: userCount, active: activeUsers },
    analyses: { total: analysisCount, last24h: last24hAnalyses, byStrategy: strategyBreakdown },
    deriv: derivService.getStatus(),
  });
});

module.exports = {
  listUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  recentAnalyses,
  systemStatus,
  getLogs,
  platformStats,
};
