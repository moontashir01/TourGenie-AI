import { Router } from "express";
import { createReport, listMyReports } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Reporting is never anonymous to the moderator: the queue names who
// objected, which is what keeps the threshold in reportController honest.
router.post("/", protect, createReport);
router.get("/mine", protect, listMyReports);

export default router;
