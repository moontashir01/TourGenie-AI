import { Router } from "express";
import { getTransportOptions } from "../controllers/transportController.js";

const router = Router();

router.get("/", getTransportOptions);

export default router;
