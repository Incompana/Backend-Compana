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
      },
    ];
  }

  return skillGap.map((skill, index) => ({
    order: index + 1,
    title: `Pelajari ${skill}`,
    description: `Fokus memahami dasar ${skill}, lalu buat latihan kecil untuk menguatkan pemahamanmu.`,
    estimatedDays: 3 + index,
  }));
};

export class ProgressService {
  static async getMyProgress(userId: string) {
    const context = await UserContextService.getLatest(userId);

    const steps = generateStepsFromSkillGap(context?.skillGap || []);

    const submissions = await prisma.submissions.findMany({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        tasks: true,
        feedback: true,
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

    const completedTasks = steps.filter((step) =>
      passedTaskTitles.has(step.title)
    ).length;

    const totalTasks = steps.length;

    const progressPercentage =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    const totalXp = submissions.reduce((total, submission) => {
      if (submission.status === "passed") return total + 120;
      if (submission.status === "revision") return total + 60;

      return total;
    }, 0);

    const currentStep = steps.find(
      (step) => !passedTaskTitles.has(step.title)
    );

    const latestSubmission = submissions[0] || null;

    return {
      completedTasks,
      totalTasks,
      progressPercentage,
      totalXp,
      allCompleted: totalTasks > 0 && completedTasks === totalTasks,

      currentTask: currentStep
        ? {
            title: currentStep.title,
            description: currentStep.description,
            order: currentStep.order,
            estimatedDays: currentStep.estimatedDays,
            status: revisionTaskTitles.has(currentStep.title)
              ? "revision"
              : "active",
          }
        : null,

      latestTask: latestSubmission
        ? {
            submissionId: latestSubmission.id,
            taskId: latestSubmission.task_id,
            title: latestSubmission.tasks.title,
            description: latestSubmission.tasks.description,
            status: latestSubmission.status,
            score: latestSubmission.feedback?.score ?? null,
            submittedAt: latestSubmission.created_at,
          }
        : null,
    };
  }
}