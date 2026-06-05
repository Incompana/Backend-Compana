import { Router } from "express";
import { ActionPlanController } from "./actionPlan.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  ActionPlanController.getMine
);

export default router;