import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/summary", authMiddleware, AdminController.getSummary);
router.get("/users", authMiddleware, AdminController.getUsers);
router.get("/submissions", authMiddleware, AdminController.getSubmissions);
router.get("/feedback", authMiddleware, AdminController.getFeedback);

export default router;