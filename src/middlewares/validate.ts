import { ZodSchema } from "zod";
import {
  Request,
  Response,
  NextFunction,
} from "express";

export const validate =
  (schema: ZodSchema) =>
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {

    try {

      console.log("BODY:");
      console.log(req.body);

      schema.parse(req.body);

      next();

    } catch (error: any) {

      console.log(error);

      return res.status(400).json({
        success: false,
        message: "Validation error",

        errors:
          error?.issues || error,
      });
    }
  };