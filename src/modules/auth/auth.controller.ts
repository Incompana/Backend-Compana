import { Request, Response } from "express";
import { registerService, loginService, googleLoginService, forgotPasswordService,resetPasswordService } from "./auth.service";
import { AuthRequest } from "../../middlewares/auth.middleware";



export const registerController = async (
    req: Request,
    res: Response
) => {
    try {

        const { email, password } = req.body;

        const user = await registerService(
            email,
            password
        );

        res.status(201).json({
            status: "success",
            data: user,
        });

    } catch (error: any) {

        res.status(400).json({
            status: "failed",
            message: error.message,
        });

    }
};
export const loginController = async (
    req: Request,
    res: Response
) => {

    try {

        const { email, password } = req.body;

        const result =
            await loginService(
                email,
                password
            );

        res.status(200).json({
            status: "success",
            data: result
        });

    } catch (error: any) {

        res.status(400).json({
            status: "failed",
            message: error.message
        });

    }
};
export const meController = async (
    req: AuthRequest,
    res: Response
) => {

    try {

        res.status(200).json({
            status: "success",
            data: req.user
        });

    } catch (error) {

        res.status(500).json({
            status: "failed",
            message: "Server error"
        });

    }
};
export const googleLoginController = async (
  req: Request,
  res: Response
) => {

  try {

    const { access_token } = req.body;

    const result =
      await googleLoginService(access_token);

    res.status(200).json({
      status: "success",
      data: result,
    });

  } catch (error: any) {

    res.status(400).json({
      status: "failed",
      message: error.message,
    });

  }
};
/* ================= FORGOT PASSWORD ================= */
export const forgotPasswordController = async (
  req: Request,
  res: Response
) => {
  try {
    const { email } = req.body;

    await forgotPasswordService(email);

    res.status(200).json({
      status: "success",
      message: "Link reset password terkirim ke email",
    });
  } catch (error: any) {
    res.status(400).json({
      status: "failed",
      message: error.message,
    });
  }
};

/* ================= RESET PASSWORD ================= */
export const resetPasswordController = async (
  req: Request,
  res: Response
) => {
  try {
    const { token, password } = req.body;

    await resetPasswordService(token, password);

    res.status(200).json({
      status: "success",
      message: "Password berhasil direset",
    });
  } catch (error: any) {
    res.status(400).json({
      status: "failed",
      message: error.message,
    });
  }
};