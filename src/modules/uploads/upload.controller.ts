import { Response } from "express";
import prisma from "../../config/prisma";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { getPublicFileUrl } from "../../middlewares/upload.middleware";

export class UploadController {
  static async uploadAvatar(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File avatar wajib diupload",
        });
      }

      const avatarUrl = getPublicFileUrl(req.file.path);

      const user = await prisma.users.update({
        where: {
          id: req.user.id,
        },
        data: {
          avatar_url: avatarUrl,
        },
        select: {
          id: true,
          email: true,
          role: true,
          is_assessment_done: true,
          avatar_url: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Avatar uploaded successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            isAssessmentDone: user.is_assessment_done,
            is_assessment_done: user.is_assessment_done,
            avatarUrl: user.avatar_url,
            avatar_url: user.avatar_url,
          },
        },
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