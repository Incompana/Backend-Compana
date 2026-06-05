import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { UserContextService } from "./userContext.service";

export class UserContextController {
  static async getLatest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await UserContextService.getLatest(userId);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "User context not found",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Latest user context fetched successfully",
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