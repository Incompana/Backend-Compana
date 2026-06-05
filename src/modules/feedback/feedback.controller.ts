import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { FeedbackService } from "./feedback.service";

export class FeedbackController {
  private static async handleGetMyFeedback(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await FeedbackService.getMyFeedback(req.user.id);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: "Feedback belum tersedia",
        });
      }

     return res.status(200).json({
  success: true,
  message: "Feedback fetched successfully ",
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

  static async getMyFeedback(req: AuthRequest, res: Response) {
    return FeedbackController.handleGetMyFeedback(req, res);
  }

  static async getMine(req: AuthRequest, res: Response) {
    return FeedbackController.handleGetMyFeedback(req, res);
  }
}