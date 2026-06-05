import { Router } from "express";
import { SubmissionController } from "./submission.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { uploadSubmissionFile } from "../../middlewares/upload.middleware";

const router = Router();

router.post(
  "/submit",
  authMiddleware,
  uploadSubmissionFile,
  SubmissionController.submitTask
);

export default router;