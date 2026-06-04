// src/modules/admin/admin.controller.ts

import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AdminService } from "./admin.service";

const ensureAdmin = (req: AuthRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return false;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Forbidden: admin only",
    });
    return false;
  }

  return true;
};

export class AdminController {
  static async getSummary(req: AuthRequest, res: Response) {
    try {
      if (!ensureAdmin(req, res)) return;

      const data = await AdminService.getSummary();

      return res.status(200).json({
        success: true,
        message: "Admin summary fetched successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  static async getUsers(req: AuthRequest, res: Response) {
    try {
      if (!ensureAdmin(req, res)) return;

      const data = await AdminService.getUsers();

      return res.status(200).json({
        success: true,
        message: "Admin users fetched successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  static async getSubmissions(req: AuthRequest, res: Response) {
    try {
      if (!ensureAdmin(req, res)) return;

      const data = await AdminService.getSubmissionsWithFeedback();

      return res.status(200).json({
        success: true,
        message: "Admin submissions fetched successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  static async getFeedback(req: AuthRequest, res: Response) {
    try {
      if (!ensureAdmin(req, res)) return;

      const data = await AdminService.getFeedback();

      return res.status(200).json({
        success: true,
        message: "Admin feedback fetched successfully",
        data,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
}