import { Router } from "express";

import authRouter from "../modules/auth/auth.route";
import assessmentRouter from "../modules/assessments/assessment.route";
import userContextRouter from "../modules/user-context/userContext.route";
import skillGapRouter from "../modules/skill-gap/skillGap.route";
import actionPlanRouter from "../modules/action-plans/actionPlan.route";
import submissionRouter from "../modules/submissions/submission.route";
import feedbackRouter from "../modules/feedback/feedback.route";
import progressRouter from "../modules/progress/progress.route";
import adminRouter from "../modules/admin/admin.route";
import uploadRouter from "../modules/uploads/upload.route";
import aiRouter from "./ai";

import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use("/auth", authRouter);
router.use("/assessments", assessmentRouter);
router.use("/user-context", userContextRouter);
router.use("/skill-gap", skillGapRouter);
router.use("/action-plans", actionPlanRouter);
router.use("/submissions", submissionRouter);
router.use("/feedback", feedbackRouter);
router.use("/progress", progressRouter);
router.use("/admin", adminRouter);
router.use("/uploads", uploadRouter);
router.use("/ai", aiRouter);



router.get(
  "/profile",
  authMiddleware,
  (req, res) => {
    res.json({
      status: "success",
      message: "Protected route accessed"
    });
  }
);

export default router;