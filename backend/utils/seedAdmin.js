/*
  Admin bootstrap. Runs automatically every time the server starts (see
  server.js) — safe to run repeatedly, it only creates the account once
  and never overwrites an existing password. Can also still be run by
  hand with: npm run seed:admin
  Reads ADMIN_SEED_NAME / ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD from .env.
*/
const User = require("../models/User");

async function ensureAdminAccount(logger) {
  const email = (process.env.ADMIN_SEED_EMAIL || "").toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME || "Site Owner";
  const log = logger || console;

  if (!email || !password) {
    log.warn ? log.warn("ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping admin auto-create.")
             : console.warn("ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — skipping admin auto-create.");
    return;
  }

  if (password.length < 8) {
    log.warn ? log.warn("ADMIN_SEED_PASSWORD must be at least 8 characters — skipping admin auto-create.")
             : console.warn("ADMIN_SEED_PASSWORD must be at least 8 characters — skipping admin auto-create.");
    return;
  }

  let user = await User.findOne({ email });

  if (user) {
    if (user.role !== "admin") {
      user.role = "admin";
      await user.save();
      (log.info || console.log)(`Existing user ${email} promoted to admin.`);
    }
    return;
  }

  user = new User({ name, email, role: "admin" });
  await user.setPassword(password);
  await user.save();
  (log.info || console.log)(`Admin account created: ${email}`);
}

module.exports = ensureAdminAccount;

// Still runnable directly: `node utils/seedAdmin.js`
if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => ensureAdminAccount())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
