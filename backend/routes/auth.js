const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { register, login, refresh, logout, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// Tighter limit on auth endpoints to slow credential stuffing / brute force
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);

module.exports = router;
