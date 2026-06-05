import { Router } from "express";
import { SkillGapController } from "./skillGap.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get(
  "/me",
  authMiddleware,
  SkillGapController.getMine
);

export default router;