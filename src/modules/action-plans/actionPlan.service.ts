import prisma from "../../config/prisma";
import { UserContextService } from "../user-context/userContext.service";

const generateStepsFromSkillGap = (skillGap: string[]) => {
  if (!skillGap.length) {
    return [
      {
        order: 1,
        title: "Mulai dari dasar karier digital",
        description:
          "Pelajari dasar-dasar skill yang relevan dengan target kariermu.",
        estimatedDays: 3,
        isCompleted: false,
      },
    ];
  }

  return skillGap.map((skill, index) => ({
    order: index + 1,
    title: `Pelajari ${skill}`,
    description: `Fokus memahami dasar ${skill}, lalu buat latihan kecil untuk menguatkan pemahamanmu.`,
    estimatedDays: 3 + index,
    isCompleted: false,
  }));
};

export class ActionPlanService {
  static async getMyActionPlan(userId: string) {
    const context = await UserContextService.getLatest(userId);

    if (!context) {
      return null;
    }

    const baseSteps = generateStepsFromSkillGap(context.skillGap);

    const submissions = await prisma.submissions.findMany({
      where: {
        user_id: userId,
      },
      include: {
        tasks: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const passedTaskTitles = new Set(
      submissions
        .filter((submission) => submission.status === "passed")
        .map((submission) => submission.tasks.title)
    );

    const revisionTaskTitles = new Set(
      submissions
        .filter((submission) => submission.status === "revision")
        .map((submission) => submission.tasks.title)
    );

    const firstActiveIndex = baseSteps.findIndex(
      (step) => !passedTaskTitles.has(step.title)
    );

    const steps = baseSteps.map((step, index) => {
      const isCompleted = passedTaskTitles.has(step.title);
      const isRevision = revisionTaskTitles.has(step.title);
      const isActive = index === firstActiveIndex;

      return {
        ...step,
        isCompleted,
        status: isCompleted
          ? "selesai"
          : isRevision
          ? "revision"
          : isActive
          ? "berjalan"
          : "terkunci",
        isLocked: !isCompleted && !isActive,
      };
    });

    return {
      targetRole: context.targetRole,
      confidenceScore: context.confidenceScore,
      steps,
    };
  }
}