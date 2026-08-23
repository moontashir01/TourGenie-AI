import { Router } from "express";
import { getCurrencies, getExpenseCategories, getLanguages, getTranslation } from "../controllers/referenceController.js";

const router = Router();

router.get("/currencies", getCurrencies);
router.get("/expense-categories", getExpenseCategories);
router.get("/languages", getLanguages); // FR-17
router.get("/translations/:lang", getTranslation); // FR-17

export default router;
