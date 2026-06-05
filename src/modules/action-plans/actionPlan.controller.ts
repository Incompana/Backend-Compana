import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ActionPlanService } from "./actionPlan.service";

export class ActionPlanController {
  static async getMine(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await ActionPlanService.getMyActionPlan(userId);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Action plan not found. Please complete assessment first.",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Action plan fetched successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Internal server error",
      });
    }
  }
}