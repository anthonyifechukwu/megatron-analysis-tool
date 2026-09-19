const router = require("express").Router();
const { getPreferences, updatePreferences, updateProfile } = require("../controllers/preferencesController");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);
router.get("/", getPreferences);
router.put("/", updatePreferences);
router.put("/profile", updateProfile);

module.exports = router;
