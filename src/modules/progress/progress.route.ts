import { Router } from "express";
import { ProgressController } from "./progress.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/me", authMiddleware, ProgressController.getMine);

export default router;