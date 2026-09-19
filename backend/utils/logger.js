/* Lightweight leveled logger. No external dependency required.
   Swap in winston/pino later without changing call sites elsewhere. */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function stamp() {
  return new Date().toISOString();
}

function log(level, msg) {
  if (LEVELS[level] > currentLevel) return;
  const line = `[${stamp()}] [${level.toUpperCase()}] ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

module.exports = {
  error: (msg) => log("error", msg),
  warn: (msg) => log("warn", msg),
  info: (msg) => log("info", msg),
  debug: (msg) => log("debug", msg),
};
