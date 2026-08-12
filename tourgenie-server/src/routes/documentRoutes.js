import { Router } from "express";
import { addDocument, getMyDocuments, deleteDocument } from "../controllers/documentController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.use(protect);

router.post("/", addDocument);
router.get("/", getMyDocuments);
router.delete("/:id", deleteDocument);

export default router;
