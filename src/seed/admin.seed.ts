// src/seed/admin.seed.ts

import bcrypt from "bcryptjs";
import prisma from "../config/prisma";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@compana.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

async function seedAdmin() {
  try {
    console.log("Seeding admin...");

    const existingAdmin = await prisma.users.findUnique({
      where: {
        email: ADMIN_EMAIL,
      },
    });

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (existingAdmin) {
      await prisma.users.update({
        where: {
          email: ADMIN_EMAIL,
        },
        data: {
          password: hashedPassword,
          role: "admin",
        },
      });

      console.log("Admin already exists. Admin data updated.");
      return;
    }

    await prisma.users.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
        is_assessment_done: true,
      },
    });

    console.log("Admin created successfully.");
  } catch (error) {
    console.error("Failed to seed admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();