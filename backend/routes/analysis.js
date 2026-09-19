const router = require("express").Router();
const { getDigitDistribution, getPatterns, runAnalysis } = require("../controllers/analysisController");
const { optionalAuth } = require("../middleware/auth");

// Analysis can run for logged-out (demo) users; if a token is present the
// result is attached to that user's history.
router.get("/digits", getDigitDistribution);
router.get("/patterns", getPatterns);
router.post("/", optionalAuth, runAnalysis);

module.exports = router;
