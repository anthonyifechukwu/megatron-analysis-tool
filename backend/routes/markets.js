const router = require("express").Router();
const { getMarkets, getQuote, getStatus } = require("../controllers/marketController");

router.get("/", getMarkets);
router.get("/status", getStatus);
router.get("/quote", getQuote);

module.exports = router;
