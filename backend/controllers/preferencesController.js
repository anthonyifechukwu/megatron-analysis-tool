const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const getPreferences = asyncHandler(async (req, res) => {
  res.json({ preferences: req.user.preferences });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const allowed = ["theme", "defaultMarket", "defaultStrategy", "notifications", "riskWarningsAcknowledged"];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[`preferences.${key}`] = req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });
  res.json({ preferences: user.preferences });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
  req.user.name = name.trim();
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = { getPreferences, updatePreferences, updateProfile };
