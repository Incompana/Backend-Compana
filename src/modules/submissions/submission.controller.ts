import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { SubmissionService } from "./submission.service";
import { getPublicFileUrl } from "../../middlewares/upload.middleware";

const normalizeBodyKeys = (body: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key.trim(),
      typeof value === "string" ? value.trim() : value,
    ])
  );
};

export class SubmissionController {
  static async submitTask(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const body = normalizeBodyKeys(req.body);

      const taskTitle = body.taskTitle as string | undefined;
      const taskDescription = body.taskDescription as string | undefined;
      const targetRole = body.targetRole as string | undefined;
      const content = body.content as string | undefined;

      const fileUrl = req.file ? getPublicFileUrl(req.file.path) : null;
      const filePath = req.file ? req.file.path : null;
      const fileName = req.file ? req.file.originalname : null;
      const fileMimeType = req.file ? req.file.mimetype : null;
      const fileSize = req.file ? req.file.size : null;

      if (!taskTitle) {
        return res.status(400).json({
          success: false,
          message: "taskTitle wajib dikirim",
        });
      }

      if (!targetRole) {
        return res.status(400).json({
          success: false,
          message: "targetRole wajib dikirim",
        });
      }

      if (!content && !fileUrl) {
        return res.status(400).json({
          success: false,
          message: "content atau file wajib dikirim",
        });
      }

      const data = await SubmissionService.submitTask(req.user.id, {
        taskTitle,
        taskDescription,
        targetRole,
        content,
        fileUrl,
        filePath,
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
      console.error("Submit task error:", error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}