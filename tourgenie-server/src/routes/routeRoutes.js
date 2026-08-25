import { Router } from "express";
import { getRoute, getRouteOptions } from "../controllers/routeController.js";

const router = Router();

// Specific path first — otherwise "/options" never matches "/".
router.get("/options", getRouteOptions);
router.get("/", getRoute);

export default router;
