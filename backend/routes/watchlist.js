const router = require("express").Router();
const { listWatchlist, addToWatchlist, removeFromWatchlist } = require("../controllers/watchlistController");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);
router.get("/", listWatchlist);
router.post("/", addToWatchlist);
router.delete("/:id", removeFromWatchlist);

module.exports = router;
