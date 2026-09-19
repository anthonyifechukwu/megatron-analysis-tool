const mongoose = require("mongoose");
const logger = require("../utils/logger");

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.error("MONGO_URI is not set. Add it to your .env file.");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    isConnected = true;
    logger.info("MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });
  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected");
  });

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (err) {
    logger.error(`Initial MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}

function dbStatus() {
  const state = mongoose.connection.readyState; // 0,1,2,3
  const map = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };
  return { state: map[state] || "unknown", connected: isConnected };
}

module.exports = { connectDB, dbStatus };
