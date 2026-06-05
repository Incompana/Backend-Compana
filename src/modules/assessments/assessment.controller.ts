import { Request, Response } from "express";
import { AssessmentService } from "./assessment.service";
import { AuthRequest } from "../../middlewares/auth.middleware";

export class AssessmentController {
  static async analyze(req: Request, res: Response) {
    try {
      const result = await AssessmentService.analyze(req.body);

      return res.status(200).json({
        success: true,
        message: "Assessment analyzed successfully",
        data: result,
      });
    } catch (error) {
      console.error("Analyze assessment error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  static async save(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await AssessmentService.save(req.user.id, req.body);

      return res.status(200).json({
        success: true,
        message: "Assessment saved successfully",
        data: result,
      });
    } catch (error) {
      console.error("Save assessment error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}