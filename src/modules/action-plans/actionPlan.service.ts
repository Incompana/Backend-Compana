import prisma from "../../config/prisma";

const normalizeStatus = (
  isCompleted: boolean | null | undefined,
  hasPassedSubmission: boolean,
  hasRevisionSubmission: boolean,
  isActive: boolean
) => {
  if (isCompleted || hasPassedSubmission) return "selesai";
  if (hasRevisionSubmission) return "revision";
  if (isActive) return "berjalan";
  return "terkunci";
};

export class ActionPlanService {
  static async getMyActionPlan(userId: string) {
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
      return null;
    }

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

    const stepsBase = actionPlan.action_plan_steps.map((step) => {
      const hasPassedSubmission = passedTaskIds.has(step.task_id);
      const hasRevisionSubmission = revisionTaskIds.has(step.task_id);

      return {
        step,
        hasPassedSubmission,
        hasRevisionSubmission,
        isCompleted: Boolean(step.is_completed) || hasPassedSubmission,
      };
    });

    const firstActiveIndex = stepsBase.findIndex((item) => !item.isCompleted);

    const steps = stepsBase.map((item, index) => {
      const { step, hasPassedSubmission, hasRevisionSubmission } = item;
      const isActive = index === firstActiveIndex || firstActiveIndex === -1;

      const status = normalizeStatus(
        step.is_completed,
        hasPassedSubmission,
        hasRevisionSubmission,
        isActive
      );

      return {
        id: step.id,
        order: step.step_order,
        stepOrder: step.step_order,

        title: step.tasks.title,
        description: step.tasks.description,
        expectedOutput: step.tasks.expected_output,
        difficulty: step.tasks.difficulty,

        taskId: step.tasks.id,
        aiTaskId: step.tasks.ai_task_id,
        targetRole: step.tasks.role,

        isCompleted: status === "selesai",
        status,
        isLocked: status === "terkunci",
      };
    });

    return {
      id: actionPlan.id,
      targetRole: actionPlan.target_role,
      title: actionPlan.title,
      status: actionPlan.status,
      createdAt: actionPlan.created_at,
      steps,
    };
  }
}