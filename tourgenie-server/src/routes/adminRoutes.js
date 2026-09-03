import { Router } from "express";
import {
  listUsers,
  setUserStatus,
  setUserRole,
  getUserFootprint,
  deleteUser,
  listTrips,
  listAuditLogs,
  getAnalytics,
  getAnalyticsTrends,
} from "../controllers/adminController.js";
import {
  getModerationQueue,
  listReports,
  resolveReport,
  listCommunityPosts,
  moderatePost,
  listReviews,
  moderateReview,
  getModerationStats,
} from "../controllers/adminModerationController.js";
import { listExports, runExport } from "../controllers/adminExportController.js";
import { getSystemHealth } from "../controllers/adminHealthController.js";
import {
  listSettings,
  updateSetting,
  listNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  listTranslations,
  getTranslation,
  updateTranslation,
} from "../controllers/adminSettingsController.js";
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
import { adminReadLimiter, adminExportLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Anyone on staff may reach the portal; each route below declares the floor
// it actually needs on top of that.
// The limiter is per account and sits after `protect` for that reason. An
// unpaginated export loop is the cheapest denial of service in the app.
router.use(protect, requireRole("moderator", "admin", "owner"), adminReadLimiter);

const staffRead = requireRole("moderator", "admin", "owner");
const adminWrite = requireRole("admin", "owner");
const ownerOnly = requireRole("owner");

// — dashboards —
router.get("/analytics", staffRead, getAnalytics);
// The time series, read from AnalyticsSnapshot; reading either endpoint is
// what keeps today's snapshot current, since there is no cron.
router.get("/analytics/trends", staffRead, getAnalyticsTrends);
router.get("/audit-logs", staffRead, listAuditLogs);
// Which providers have keys, whether their last call worked, and what the
// database is actually holding.
router.get("/health", staffRead, getSystemHealth);

// — exports —
// Streamed from a cursor server-side, and each one writes an audit entry
// naming the report and its row count. Personal columns are opt-in.
router.get("/exports", adminWrite, listExports);
router.get("/exports/:report", adminWrite, adminExportLimiter, runExport);

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

// — configuration —
// Three collections that are read at runtime and had no screen: the limits
// the booking code enforces, the copy of every notification, and the UI
// string tables. Changing one meant editing a seed file and re-seeding.
//
// Settings are owner-only because they change how the app behaves for
// everyone; content is editable by an admin, being copy rather than policy.
router.get("/settings", staffRead, listSettings);
router.patch("/settings/:key", ownerOnly, updateSetting);

router.get("/notification-templates", staffRead, listNotificationTemplates);
router.post("/notification-templates", adminWrite, createNotificationTemplate);
router.patch("/notification-templates/:id", adminWrite, updateNotificationTemplate);
router.delete("/notification-templates/:id", ownerOnly, deleteNotificationTemplate);

router.get("/translations", staffRead, listTranslations);
router.get("/translations/:lang", staffRead, getTranslation);
router.patch("/translations/:lang", adminWrite, updateTranslation);

// — moderation —
// The queue is the entry point: content the posting rules held, plus anything
// a traveller reported. The two lists below are still there for looking
// something up after the fact.
router.get("/moderation/queue", staffRead, getModerationQueue);
router.get("/moderation/stats", staffRead, getModerationStats);
router.get("/reports", staffRead, listReports);
router.patch("/reports/:id", staffRead, resolveReport);

router.get("/community-posts", staffRead, listCommunityPosts);
router.patch("/community-posts/:id/moderate", staffRead, moderatePost);
router.get("/reviews", staffRead, listReviews);
router.patch("/reviews/:id/moderate", staffRead, moderateReview);

export default router;
