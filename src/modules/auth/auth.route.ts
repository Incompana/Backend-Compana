import { Router } from "express";
import {registerController, loginController, googleLoginController, meController, forgotPasswordController, resetPasswordController} from "./auth.controller";
import { authMiddleware }from "../../middlewares/auth.middleware";


const router = Router();

router.post("/register",registerController);
router.post("/login",loginController);
router.get("/me",authMiddleware,meController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);
router.post("/google", googleLoginController);

export default router;