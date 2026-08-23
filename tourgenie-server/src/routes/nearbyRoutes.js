import { Router } from "express";
import { getNearbyServices } from "../controllers/nearbyController.js";

const router = Router();

// Public, like attractions — the catalogue is not user data.
router.get("/", getNearbyServices);

export default router;
