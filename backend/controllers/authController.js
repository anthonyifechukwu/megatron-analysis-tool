const jwt = require("jsonwebtoken");
const User = require("../models/User");
const SystemLog = require("../models/SystemLog");
const asyncHandler = require("../utils/asyncHandler");
const { signAccessToken, signRefreshToken } = require("../middleware/auth");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: "Invalid email address" });
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: "An account with that email already exists" });

  const user = new User({ name, email: email.toLowerCase() });
  await user.setPassword(password);
  await user.save();

  await SystemLog.create({ level: "info", category: "auth", message: `New registration: ${user.email}`, user: user._id });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.status(201).json({ user: user.toSafeJSON(), accessToken, refreshToken });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  if (user.status === "suspended") return res.status(403).json({ error: "Account suspended" });

  const valid = await user.comparePassword(password);
  if (!valid) {
    await SystemLog.create({ level: "warn", category: "auth", message: `Failed login: ${email}` });
    return res.status(401).json({ error: "Invalid credentials" });
  }

  user.lastLoginAt = new Date();
  await user.save();
  await SystemLog.create({ level: "info", category: "auth", message: `Login: ${user.email}`, user: user._id });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.json({ user: user.toSafeJSON(), accessToken, refreshToken });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const user = await User.findById(payload.sub);
  if (!user || user.refreshTokenVersion !== payload.tv) {
    return res.status(401).json({ error: "Refresh token no longer valid" });
  }

  const accessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  res.json({ accessToken, refreshToken: newRefreshToken });
});

/** Invalidate all outstanding refresh tokens for this user. */
const logout = asyncHandler(async (req, res) => {
  req.user.refreshTokenVersion += 1;
  await req.user.save();
  res.json({ message: "Logged out" });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

module.exports = { register, login, refresh, logout, me };
