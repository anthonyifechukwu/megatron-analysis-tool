const router = require("express").Router();
const { listHistory, clearHistory, deleteHistoryItem } = require("../controllers/historyController");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);
router.get("/", listHistory);
router.delete("/", clearHistory);
router.delete("/:id", deleteHistoryItem);

module.exports = router;
