import { UserContextService } from "../user-context/userContext.service";

export class SkillGapService {
  static async getMySkillGap(userId: string) {
    const context = await UserContextService.getLatest(userId);

    if (!context) {
      return null;
    }

    return {
      targetRole: context.targetRole,
      problemCategory: context.problemCategory,
      confidenceScore: context.confidenceScore,
      skillGap: context.skillGap,
    };
  }
}