import { Router } from "express";
import {
  listUsers,
  setUserStatus,
  setUserRole,
  getUserFootprint,
  deleteUser,
  listTrips,
  listCommunityPosts,
  moderatePost,
  listReviews,
  moderateReview,
  listAuditLogs,
  getAnalytics,
} from "../controllers/adminController.js";
import {
  getUserDetail,
  getTripDetail,
  listBookings,
  listHotelBookings,
  cancelBookingForTraveller,
  cancelHotelBookingForTraveller,
  getDepartureSeatMap,
  globalSearch,
} from "../controllers/adminDetailController.js";
import {
  listResource,
  createResource,
  updateResource,
  deleteResource,
  restoreResource,
  getReferences,
  bulkAction,
  getRateCacheStats,
  clearRateCache,
} from "../controllers/adminCatalogueController.js";
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

// — one box, every subject —
router.get("/search", staffRead, globalSearch);

// — users —
router.get("/users", staffRead, listUsers);
router.get("/users/:id", staffRead, getUserDetail);
router.get("/users/:id/footprint", adminWrite, getUserFootprint);
router.patch("/users/:id/status", adminWrite, setUserStatus);
// Granting staff access is the one thing an admin cannot do to another
// account: it is what stops one compromised admin minting more.
router.patch("/users/:id/role", ownerOnly, setUserRole);
router.delete("/users/:id", ownerOnly, deleteUser);

// — trips —
router.get("/trips", staffRead, listTrips);
router.get("/trips/:id", staffRead, getTripDetail);

// — bookings —
router.get("/bookings", staffRead, listBookings);
router.get("/bookings/seat-map", staffRead, getDepartureSeatMap);
router.patch("/bookings/:id/cancel", adminWrite, cancelBookingForTraveller);
router.get("/hotel-bookings", staffRead, listHotelBookings);
router.patch("/hotel-bookings/:id/cancel", adminWrite, cancelHotelBookingForTraveller);

// — catalogue —
// Seven collections behind one set of routes: destinations, countries,
// attractions, hotels, transport, flights and airports. Deleting is soft by
// default and refused outright while anything still points at the record.
router.get("/catalogue/hotel-rates", staffRead, getRateCacheStats);
router.delete("/catalogue/hotel-rates", adminWrite, clearRateCache);

router.get("/catalogue/:resource", staffRead, listResource);
router.post("/catalogue/:resource", adminWrite, createResource);
router.post("/catalogue/:resource/bulk", adminWrite, bulkAction);
router.get("/catalogue/:resource/:id/references", staffRead, getReferences);
router.patch("/catalogue/:resource/:id", adminWrite, updateResource);
router.delete("/catalogue/:resource/:id", adminWrite, deleteResource);
router.post("/catalogue/:resource/:id/restore", adminWrite, restoreResource);

// — moderation —
router.get("/community-posts", staffRead, listCommunityPosts);
router.patch("/community-posts/:id/moderate", staffRead, moderatePost);
router.get("/reviews", staffRead, listReviews);
router.patch("/reviews/:id/moderate", staffRead, moderateReview);

export default router;
