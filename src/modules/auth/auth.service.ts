import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

export const registerService = async (
  email: string,
  password: string
) => {

  const existingUser = await prisma.users.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.users.create({
  data: {
    email,
    password: hashedPassword,
    is_assessment_done: false
  }
});

  return {
  id: user.id,
  email: user.email,
  role: user.role,
  created_at: user.created_at
};
};
export const loginService = async (
  email: string,
  password: string
) => {

  const user =
    await prisma.users.findUnique({
      where: { email }
    });

  if (!user) {
    throw new Error("Email not found");
  }

  const isPasswordValid =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!isPasswordValid) {
    throw new Error("Wrong password");
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "7d"
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_assessment_done: user.is_assessment_done
    }
  };
};
export const googleLoginService = async (
  access_token: string
) => {

  // ambil data user google
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  const googleUser = await response.json();

  const {
    email,
    name,
    picture,
    sub
  } = googleUser;

  if (!email) {
    throw new Error("Google login failed");
  }

  // cek user
  let user = await prisma.users.findUnique({
    where: {
      email,
    },
  });

  // register otomatis
  if (!user) {

    const randomPassword =
      await bcrypt.hash(sub, 10);

    user = await prisma.users.create({
      data: {
        email,
        password: randomPassword,
        is_assessment_done: false
      },
    });
  }

  // JWT
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_assessment_done: user.is_assessment_done
    },
  };
};


export const forgotPasswordService = async (email: string) => {
  const user = await prisma.users.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Email not found");
  }

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "10m" }
  );

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  // 🔥 WAJIB INI
  console.log("RESET LINK:", resetLink);

  await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Reset Password",
    html: `<a href="${resetLink}">Reset Password</a>`,
  });

  return true;
};
export const resetPasswordService = async (
  token: string,
  password: string
) => {
  try {
    if (!token || !password) {
      throw new Error("Token dan password wajib diisi");
    }

    if (password.length < 6) {
      throw new Error("Password minimal 6 karakter");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as any;

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.users.update({
      where: { id: decoded.id },
      data: { password: hashedPassword },
    });

    return true;

  } catch (error) {
    throw new Error("Token invalid or expired");
  }
};