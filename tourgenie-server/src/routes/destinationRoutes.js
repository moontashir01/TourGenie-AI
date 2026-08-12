import { Router } from "express";
import { getDestination, listDestinations } from "../controllers/destinationController.js";

const router = Router();

router.get("/", listDestinations);
router.get("/:idOrSlug", getDestination);

export default router;
