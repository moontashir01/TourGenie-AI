import { Router } from "express";
import {
  getBudgetSummary,
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// See itineraryRoutes.js for why protect is applied per-route here rather
// than via router.use — this router is also mounted at the bare "/api"
// prefix in server.js.
router.get("/trips/:tripId/budget", protect, getBudgetSummary);
router.get("/trips/:tripId/expenses", protect, getExpenses);
router.post("/trips/:tripId/expenses", protect, addExpense);
router.patch("/trips/:tripId/expenses/:expenseId", protect, updateExpense);
router.delete("/trips/:tripId/expenses/:expenseId", protect, deleteExpense);

export default router;
