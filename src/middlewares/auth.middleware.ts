import { Request, Response, NextFunction } from "express";

import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {

  try {

    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        status: "failed",
        message: "Unauthorized"
      });
    }

    const token =
      authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        status: "failed",
        message: "Token not found"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    req.user = decoded;

    next();

  } catch (error) {

    return res.status(401).json({
      status: "failed",
      message: "Invalid token"
    });

  }
};