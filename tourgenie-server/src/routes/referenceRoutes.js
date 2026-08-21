import { Router } from "express";
import { getCurrencies, getExpenseCategories } from "../controllers/referenceController.js";

const router = Router();

router.get("/currencies", getCurrencies);
router.get("/expense-categories", getExpenseCategories);

export default router;
