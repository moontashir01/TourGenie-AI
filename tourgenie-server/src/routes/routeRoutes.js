import { Router } from "express";
import { getRoute } from "../controllers/routeController.js";

const router = Router();

router.get("/", getRoute);

export default router;
