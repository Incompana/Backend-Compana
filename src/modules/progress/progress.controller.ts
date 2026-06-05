import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { ProgressService } from "./progress.service";

export class ProgressController {
  static async getMine(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await ProgressService.getMyProgress(userId);

      return res.status(200).json({
        success: true,
        message: "Progress fetched successfully",
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