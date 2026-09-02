import { Router } from "express";
import {
  listUsers,
  setUserStatus,
  setUserRole,
  getUserFootprint,
  deleteUser,
  listTrips,
  createAttraction,
  updateAttraction,
  deleteAttraction,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  listTransportOptions,
  createTransportOption,
  updateTransportOption,
  deleteTransportOption,
  listCommunityPosts,
  moderatePost,
  listReviews,
  moderateReview,
  listAuditLogs,
  getAnalytics,
} from "../controllers/adminController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = Router();

// Anyone on staff may reach the portal; each route below declares the floor
// it actually needs on top of that.
router.use(protect, requireRole("moderator", "admin", "owner"));

const staffRead = requireRole("moderator", "admin", "owner");
const adminWrite = requireRole("admin", "owner");
const ownerOnly = requireRole("owner");

// — dashboards —
router.get("/analytics", staffRead, getAnalytics);
router.get("/audit-logs", staffRead, listAuditLogs);

// — users —
router.get("/users", staffRead, listUsers);
router.get("/users/:id/footprint", adminWrite, getUserFootprint);
router.patch("/users/:id/status", adminWrite, setUserStatus);
// Granting staff access is the one thing an admin cannot do to another
// account: it is what stops one compromised admin minting more.
router.patch("/users/:id/role", ownerOnly, setUserRole);
router.delete("/users/:id", ownerOnly, deleteUser);

// — trips —
router.get("/trips", staffRead, listTrips);

// — catalogue —
router.post("/attractions", adminWrite, createAttraction);
router.patch("/attractions/:id", adminWrite, updateAttraction);
router.delete("/attractions/:id", adminWrite, deleteAttraction);

router.get("/hotels", staffRead, listHotels);
router.post("/hotels", adminWrite, createHotel);
router.patch("/hotels/:id", adminWrite, updateHotel);
router.delete("/hotels/:id", adminWrite, deleteHotel);

router.get("/transport", staffRead, listTransportOptions);
router.post("/transport", adminWrite, createTransportOption);
router.patch("/transport/:id", adminWrite, updateTransportOption);
router.delete("/transport/:id", adminWrite, deleteTransportOption);

// — moderation —
router.get("/community-posts", staffRead, listCommunityPosts);
router.patch("/community-posts/:id/moderate", staffRead, moderatePost);
router.get("/reviews", staffRead, listReviews);
router.patch("/reviews/:id/moderate", staffRead, moderateReview);

export default router;
