import { Router } from "express";
import { UserContextController } from "./userContext.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get(
  "/latest",
  authMiddleware,
  UserContextController.getLatest
);

export default router;