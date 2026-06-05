import prisma from "../../config/prisma";

export class UserContextService {
  static async getLatest(userId: string) {
    const context = await prisma.user_context.findFirst({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!context) {
      return null;
    }

    let skillGap: string[] = [];

    try {
      skillGap = JSON.parse(context.extracted_keywords || "[]");
    } catch {
      skillGap = [];
    }

    return {
      id: context.id,
      userId: context.user_id,
      targetRole: context.target_role,
      problemCategory: context.problem_category,
      confidenceScore: context.confidence_score,
      skillGap,
      createdAt: context.created_at,
    };
  }
}