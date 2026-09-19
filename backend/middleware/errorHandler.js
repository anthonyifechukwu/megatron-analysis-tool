const logger = require("../utils/logger");

function notFound(req, res, _next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.message}\n${err.stack || ""}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${err.message}`);
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: "Validation failed", details: err.errors });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate value", details: err.keyValue });
  }

  res.status(status).json({
    error: err.publicMessage || (status >= 500 ? "Internal server error" : err.message),
  });
}

module.exports = { notFound, errorHandler };
