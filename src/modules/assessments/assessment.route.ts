import { Router } from "express";
import { AssessmentController } from "./assessment.controller";
import { validate } from "../../middlewares/validate";
import { assessmentSchema } from "./assessment.validation";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

// Guest boleh akses
router.post(
  "/analyze",
  validate(assessmentSchema),
  AssessmentController.analyze
);

// Hanya user login yang boleh simpan
router.post(
  "/save",
  authMiddleware,
  validate(assessmentSchema),
  AssessmentController.save
);

export default router;