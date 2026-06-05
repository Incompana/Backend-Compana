import { Router } from "express";
import { FeedbackController } from "./feedback.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/me", authMiddleware, FeedbackController.getMine);

export default router;