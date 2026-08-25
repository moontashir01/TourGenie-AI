import { Router } from "express";
import {
  compareDestinations,
  getDestination,
  getDestinationClimate,
  listDestinations,
} from "../controllers/destinationController.js";

const router = Router();

router.get("/", listDestinations);
// "/compare" must be declared before "/:idOrSlug", or it is swallowed as a slug.
router.get("/compare", compareDestinations);
router.get("/:idOrSlug", getDestination);
router.get("/:idOrSlug/climate", getDestinationClimate);

export default router;
