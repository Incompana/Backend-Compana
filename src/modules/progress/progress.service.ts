import prisma from "../../config/prisma";

export class ProgressService {
  static async getMyProgress(userId: string) {
    const actionPlan = await prisma.action_plans.findFirst({
      where: {
        user_id: userId,
        status: "active",
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        action_plan_steps: {
          orderBy: {
            step_order: "asc",
          },
          include: {
            tasks: true,
          },
        },
      },
    });

    if (!actionPlan) {
      return {
        completedTasks: 0,
        totalTasks: 0,
        progressPercentage: 0,
        totalXp: 0,
        allCompleted: false,
        currentTask: null,
        latestTask: null,
      };
    }

    const actionPlanTaskIds = actionPlan.action_plan_steps.map(
      (step) => step.task_id
    );

    const submissions = await prisma.submissions.findMany({
      where: {
        user_id: userId,
        task_id: {
          in: actionPlanTaskIds,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        tasks: true,
        feedback: true,
      },
    });

    const passedTaskIds = new Set(
      submissions
        .filter((submission) => submission.status === "passed")
        .map((submission) => submission.task_id)
    );

    const revisionTaskIds = new Set(
      submissions
        .filter((submission) => submission.status === "revision")
        .map((submission) => submission.task_id)
    );

    const totalTasks = actionPlan.action_plan_steps.length;

    const completedTasks = actionPlan.action_plan_steps.filter((step) => {
      return Boolean(step.is_completed) || passedTaskIds.has(step.task_id);
    }).length;

    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const currentStep =
      actionPlan.action_plan_steps.find((step) => {
        return !step.is_completed && !passedTaskIds.has(step.task_id);
      }) || null;

    const latestSubmission = submissions[0] || null;

    const totalXp = submissions.reduce((total, submission) => {
      if (submission.status === "passed") return total + 120;
      if (submission.status === "revision") return total + 60;

      return total;
    }, 0);

    await prisma.progress.upsert({
      where: {
        user_id: userId,
      },
      update: {
        completed_tasks: completedTasks,
        total_tasks: totalTasks,
        progress_percentage: progressPercentage,
        last_updated: new Date(),
      },
      create: {
        user_id: userId,
        completed_tasks: completedTasks,
        total_tasks: totalTasks,
        progress_percentage: progressPercentage,
      },
    });

    return {
      completedTasks,
      totalTasks,
      progressPercentage,
      totalXp,
      allCompleted: totalTasks > 0 && completedTasks === totalTasks,

      currentTask: currentStep
        ? {
            id: currentStep.id,
            taskId: currentStep.task_id,
            title: currentStep.tasks.title,
            description: currentStep.tasks.description,
            expectedOutput: currentStep.tasks.expected_output,
            difficulty: currentStep.tasks.difficulty,
            aiTaskId: currentStep.tasks.ai_task_id,
            order: currentStep.step_order,
            stepOrder: currentStep.step_order,
            targetRole: currentStep.tasks.role,
            isCompleted: false,
            status: revisionTaskIds.has(currentStep.task_id)
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
