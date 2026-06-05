import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { uploadAvatar } from "../../middlewares/upload.middleware";
import { UploadController } from "./upload.controller";

const router = Router();

router.post(
  "/avatar",
  authMiddleware,
  uploadAvatar,
  UploadController.uploadAvatar
);

export default router;