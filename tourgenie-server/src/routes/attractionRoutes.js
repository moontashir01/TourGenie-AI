import { Router } from "express";
import { getAttractions, getAttractionById } from "../controllers/attractionController.js";

const router = Router();

router.get("/", getAttractions);
router.get("/:id", getAttractionById);

export default router;
