const router = require("express").Router();
const {
  listUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  recentAnalyses,
  systemStatus,
  getLogs,
  platformStats,
} = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.use(requireAuth, requireAdmin);

router.get("/users", listUsers);
router.patch("/users/:id/status", updateUserStatus);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

router.get("/analyses", recentAnalyses);
router.get("/status", systemStatus);
router.get("/logs", getLogs);
router.get("/stats", platformStats);

module.exports = router;
