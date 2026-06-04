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

  static async save(req: AuthRequest, res: Response) {
    try {
      const userId = req.user.id;

      const result = await AssessmentService.save(
        userId,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "Assessment saved successfully",
        data: result,
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