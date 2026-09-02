import { Router } from "express";
import {
  register,
  login,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updateMe,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// Account settings — profile, preferences, and changing a known password.
router.patch("/me", protect, updateMe);
router.post("/change-password", protect, changePassword);

// Password recovery — /forgot-password doubles as the resend endpoint.
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

export default router;
