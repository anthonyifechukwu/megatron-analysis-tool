require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const { connectDB } = require("./config/db");
const derivService = require("./services/derivService");
const ensureAdminAccount = require("./utils/seedAdmin");
const logger = require("./utils/logger");
const { notFound, errorHandler } = require("./middleware/errorHandler");


const adminRoutes = require("./routes/admin");
const derivAuthRoutes = require("./routes/derivAuth");
const authRoutes = require("./routes/auth");
const marketRoutes = require("./routes/markets");
const analysisRoutes = require("./routes/analysis");
const watchlistRoutes = require("./routes/watchlist");
const historyRoutes = require("./routes/history");
const preferencesRoutes = require("./routes/preferences");

const app = express();

// ---- Security & core middleware ----
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/auth/deriv", derivAuthRoutes);

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin header
      if (!origin) {
        return callback(null, true);
      }

      // Development: allow localhost and 127.0.0.1
      const isLocalhost =
        origin === "http://localhost:5500" ||
        origin === "http://127.0.0.1:5500" ||
        origin === "http://localhost:3000" ||
        origin === "http://127.0.0.1:3000";

      const isProductionSite =
        origin === "https://megatron-analysis-tool.onrender.com";

      if (isLocalhost || isProductionSite || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ---- Global rate limiting (auth routes have their own tighter limit) ----
app.use(
  "/api",
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---- Health check (no auth, used by uptime monitors / load balancers) ----
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---- API routes ----
app.use("/api/auth", authRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/admin", adminRoutes);

// ---- Static frontend (serves the existing HTML/CSS/JS as-is) ----
const frontendDir = path.join(__dirname, "..");
app.use(express.static(frontendDir));
app.get(["/", "/pages/:page"], (req, res, next) => {
  const target = req.params.page ? path.join(frontendDir, "pages", req.params.page) : path.join(frontendDir, "index.html");
  res.sendFile(target, (err) => (err ? next() : undefined));
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  await ensureAdminAccount(logger).catch((err) => {
    logger.warn(`Could not auto-create admin account: ${err.message}`);
  });

  // Listening here is now just for clear logging/visibility — since the
  // service uses a plain "apiError" event (not Node's special "error"),
  // the server would no longer crash even without this listener.
  derivService.on("apiError", (err) => {
    logger.warn(`Deriv API error (non-fatal): ${err.message || JSON.stringify(err)}`);
  });

  derivService.start();
  app.listen(PORT, () => {
    logger.info(`Megatron backend listening on port ${PORT}`);
  });
}

start();

process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled rejection: ${err.message}\n${err.stack || ""}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.message}\n${err.stack || ""}`);
  process.exit(1);
});

module.exports = app;
