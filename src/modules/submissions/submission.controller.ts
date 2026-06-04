import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { SubmissionService } from "./submission.service";
import { getPublicFileUrl } from "../../middlewares/upload.middleware";

export class SubmissionController {
  static async submitTask(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const fileUrl = req.file ? getPublicFileUrl(req.file.path) : null;
      const fileName = req.file ? req.file.originalname : null;
      const fileMimeType = req.file ? req.file.mimetype : null;
      const fileSize = req.file ? req.file.size : null;

      const data = await SubmissionService.submitTask(req.user.id, {
        taskTitle: req.body.taskTitle,
        taskDescription: req.body.taskDescription,
        targetRole: req.body.targetRole,
        content: req.body.content,
        fileUrl,
        fileName,
        fileMimeType,
        fileSize,
      });

      return res.status(201).json({
        success: true,
        message: "Task submitted successfully",
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