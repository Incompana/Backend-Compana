import { randomUUID } from "crypto";
import prisma from "../../config/prisma";
import type { Prisma } from "@prisma/client";
import {
  AssessmentPayload,
  AiQuestion,
  AiSubmitAssessmentResponse,
} from "./assessment.types";
import { postAi } from "../../services/aiService";

type NormalizedActionTask = {
  task_id?: string;
  task_title: string;
  task_description: string;
  output_format: string;
  difficulty?: string;
};

const normalizeRoleToAi = (role: string) => {
  const value = role.toLowerCase().trim();

  if (value.includes("frontend")) return "frontend_developer";
  if (value.includes("backend")) return "backend_developer";
  if (value.includes("fullstack")) return "frontend_developer";
  if (value.includes("ui") || value.includes("ux")) return "ui_ux_designer";
  if (value.includes("soc") || value.includes("security") || value.includes("cyber")) {
    return "soc_analyst";
  }
  if (value.includes("machine") || value.includes("ml") || value.includes("ai")) {
    return "machine_learning_engineer";
  }
  if (value.includes("data")) return "data_analyst";

  return "general_learner";
};

const normalizeRoleLabel = (role: string) => {
  const value = normalizeRoleToAi(role);

  const labels: Record<string, string> = {
    frontend_developer: "Frontend Developer",
    backend_developer: "Backend Developer",
    ui_ux_designer: "UI/UX Designer",
    soc_analyst: "SOC Analyst",
    machine_learning_engineer: "Machine Learning Engineer",
    data_analyst: "Data Analyst",
    general_learner: "General Learner",
  };

  return labels[value] || role;
};

const normalizeDifficulty = (difficulty?: string) => {
  if (difficulty === "advanced") return "advanced";
  if (difficulty === "intermediate") return "intermediate";

  return "basic";
};

const getProblemCategory = (data: AssessmentPayload) => {
  if (data.problemCategory) return data.problemCategory;

  const joinedAnswers = data.answers
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ")
    .toLowerCase();

  if (joinedAnswers.includes("portfolio")) return "Belum punya portfolio";
  if (joinedAnswers.includes("bingung")) return "Bingung mulai belajar dari mana";
  if (joinedAnswers.includes("skill")) return "Skill belum cukup";
  if (joinedAnswers.includes("kerja")) return "Ingin siap kerja";

  return "Bingung mulai belajar dari mana";
};

const getBlockerAnswer = (data: AssessmentPayload) => {
  if (data.blockerType) return data.blockerType;

  const joinedAnswers = data.answers
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ")
    .toLowerCase();

  if (joinedAnswers.includes("role")) return "belum_tahu_role";
  if (joinedAnswers.includes("portfolio")) return "belum_ada_portfolio";
  if (joinedAnswers.includes("skill")) return "skill_belum_cukup";
  if (joinedAnswers.includes("salah")) return "takut_salah_pilih";

  return "belum_tahu_mulai";
};

const getCurrentLevel = (data: AssessmentPayload) => {
  if (data.currentLevel) return data.currentLevel.toLowerCase();

  const joinedAnswers = data.answers
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ")
    .toLowerCase();

  if (joinedAnswers.includes("advanced") || joinedAnswers.includes("mahir")) {
    return "advanced";
  }

  if (
    joinedAnswers.includes("intermediate") ||
    joinedAnswers.includes("menengah")
  ) {
    return "intermediate";
  }

  return "beginner";
};

const buildAiAssessmentPayload = async (
  userId: string,
  data: AssessmentPayload
) => {
  const targetRole = normalizeRoleToAi(data.targetRole);
  const currentLevel = getCurrentLevel(data);
  const problemCategory = getProblemCategory(data);
  const blockerAnswer = getBlockerAnswer(data);

  const pretextAnalysis = {
    target_role: targetRole,
    current_level: currentLevel,
    problem_category: problemCategory,
    confidence_score: 60,
  };

  let selectedQuestions: AiQuestion[] = [];

  try {
    const selectQuestionResult = await postAi<{ questions?: AiQuestion[] }>(
      "/select-questions",
      {
        user_id: userId,
        pretext_analysis: pretextAnalysis,
        max_questions: data.maxQuestions || 3,
      }
    );

    selectedQuestions = selectQuestionResult.questions || [];
  } catch (error) {
    console.error("AI select-questions failed, using fallback:", error);
  }

  if (!selectedQuestions.length) {
    selectedQuestions = [
      {
        question_id: "Q_CLARIFY_ROLE",
        skill_id: "career_direction_clarity",
        question:
          "Aku belum bisa menangkap target role-mu dengan jelas. Kamu ingin diarahkan ke jalur apa dulu?",
        category: "career_direction",
      },
      {
        question_id: "Q_CLARIFY_BLOCKER",
        skill_id: "career_direction_clarity",
        question: "Bagian mana yang paling bikin kamu bingung sekarang?",
        category: "career_direction",
      },
    ];
  }

  const answers = selectedQuestions.map((question) => {
    if (question.question_id === "Q_CLARIFY_ROLE") {
      return {
        question_id: question.question_id,
        answer: targetRole,
        answer_value: targetRole,
        answer_text: normalizeRoleLabel(data.targetRole),
      };
    }

    if (question.question_id === "Q_CLARIFY_BLOCKER") {
      return {
        question_id: question.question_id,
        answer: blockerAnswer,
        answer_value: blockerAnswer,
        answer_text: problemCategory,
      };
    }

    const matchingAnswer = data.answers.find((item) => {
      const questionText = question.question || question.prompt || "";

      return (
        item.question.toLowerCase().trim() ===
        questionText.toLowerCase().trim()
      );
    });

    return {
      question_id: question.question_id,
      answer: matchingAnswer?.answer || blockerAnswer,
      answer_value: matchingAnswer?.answer || blockerAnswer,
      answer_text: matchingAnswer?.answer || problemCategory,
    };
  });

  return {
    user_id: userId,
    pretext_analysis: pretextAnalysis,
    questions: selectedQuestions.map((question) => ({
      question_id: question.question_id,
      skill_id: question.skill_id,
      question: question.question || question.prompt,
      category: question.category || question.skill_id || "assessment",
    })),
    answers,
    max_questions: data.maxQuestions || selectedQuestions.length,
  };
};

const convertAiResultToLegacyResult = (
  targetRole: string,
  aiResult: AiSubmitAssessmentResponse
) => {
  const validatedAnalysis =
    aiResult.validated_context?.validated_analysis || {};

  const missingSkills = aiResult.skill_gap?.missing_skills || [];
  const recommendedTasks = aiResult.action_plan?.recommended_tasks || [];

  const skillGap = missingSkills.map((skill) => skill.skill_name);
  const recommendedTaskTitles = recommendedTasks.map((task) => task.task_title);

  return {
    analysis: {
      role:
        validatedAnalysis.target_role ||
        aiResult.skill_gap?.target_role ||
        normalizeRoleToAi(targetRole),
      confidence: validatedAnalysis.confidence_score ?? 60,
      strengths: [],
      weaknesses: skillGap,
      problemCategory:
        validatedAnalysis.problem_category ||
        aiResult.skill_gap?.problem_category ||
        "skill_gap",
      blockerType:
        validatedAnalysis.blocker_type ||
        aiResult.skill_gap?.blocker_type ||
        null,
      personaType: validatedAnalysis.persona_type || null,
      summary: validatedAnalysis.summary || null,
    },
    skillGap,
    recommendedTasks: recommendedTaskTitles,
    ai: aiResult,
  };
};

const generateLocalFallbackResult = (targetRole: string) => {
  switch (targetRole) {
    case "Data Scientist":
    case "Data Analyst":
      return {
        analysis: {
          role: normalizeRoleToAi(targetRole),
          confidence: 80,
          strengths: ["Spreadsheet"],
          weaknesses: ["Data Cleaning", "Visualization", "Analysis"],
        },
        skillGap: ["Data Cleaning", "Visualization", "Analysis"],
        recommendedTasks: ["Bersihkan Dataset Spreadsheet Kecil"],
      };

    case "Machine Learning Engineer":
      return {
        analysis: {
          role: normalizeRoleToAi(targetRole),
          confidence: 80,
          strengths: ["Python"],
          weaknesses: ["Text Cleaning", "Model Evaluation", "Experiment Tracking"],
        },
        skillGap: ["Text Cleaning", "Model Evaluation", "Experiment Tracking"],
        recommendedTasks: ["Buat Script Python untuk Membersihkan Teks"],
      };

    case "Fullstack Developer":
      return {
        analysis: {
          role: "frontend_developer",
          confidence: 84,
          strengths: ["HTML", "CSS"],
          weaknesses: ["React", "Node.js", "Database"],
        },
        skillGap: ["React", "Node.js", "MySQL"],
        recommendedTasks: ["Bangun Landing Page Portfolio Pertamamu"],
      };

    default:
      return {
        analysis: {
          role: normalizeRoleToAi(targetRole),
          confidence: 75,
          strengths: ["HTML", "CSS"],
          weaknesses: ["JavaScript", "React"],
        },
        skillGap: ["JavaScript", "React"],
        recommendedTasks: ["Bangun Landing Page Portfolio Pertamamu"],
      };
  }
};

const buildTasksFromAiResult = (
  aiResult: AiSubmitAssessmentResponse,
  fallbackTaskTitles: string[]
): NormalizedActionTask[] => {
  const recommendedTasks = aiResult.action_plan?.recommended_tasks || [];
  const missingSkills = aiResult.skill_gap?.missing_skills || [];

  const normalizedTasks: NormalizedActionTask[] = [];
  const usedTaskIds = new Set<string>();
  const usedTitles = new Set<string>();

  for (const task of recommendedTasks) {
    if (!task.task_title) continue;

    if (task.task_id) {
      usedTaskIds.add(task.task_id);
    }

    usedTitles.add(task.task_title.toLowerCase());

    normalizedTasks.push({
      task_id: task.task_id,
      task_title: task.task_title,
      task_description:
        task.task_description || "Task dibuat otomatis dari rekomendasi AI.",
      output_format:
        task.output_format ||
        task.assessment_checklist ||
        "File project, screenshot, link, atau catatan pengerjaan.",
      difficulty: task.difficulty,
    });
  }

  for (const skill of missingSkills) {
    if (!skill.next_task_id) continue;
    if (usedTaskIds.has(skill.next_task_id)) continue;

    const title = `Pelajari ${skill.skill_name}`;
    const lowerTitle = title.toLowerCase();

    if (usedTitles.has(lowerTitle)) continue;

    usedTaskIds.add(skill.next_task_id);
    usedTitles.add(lowerTitle);

    normalizedTasks.push({
      task_id: skill.next_task_id,
      task_title: title,
      task_description:
        skill.reason ||
        `Latihan untuk memperkuat skill ${skill.skill_name}.`,
      output_format:
        "File project, screenshot, link, atau catatan pengerjaan.",
      difficulty: "basic",
    });
  }

  if (normalizedTasks.length) {
    return normalizedTasks;
  }

  return fallbackTaskTitles.map((title) => ({
    task_title: title,
    task_description: "Task dibuat otomatis dari hasil assessment user.",
    output_format:
      "Catatan belajar, screenshot, link project, file project, atau dokumen pendukung.",
    difficulty: "basic",
  }));
};

const saveActionPlanTasks = async (
  tx: Prisma.TransactionClient,
  params: {
    actionPlanId: string;
    role: string;
    tasks: NormalizedActionTask[];
  }
) => {
  const { actionPlanId, role, tasks } = params;

  for (let index = 0; index < tasks.length; index++) {
    const aiTask = tasks[index];

    let task = await tx.tasks.findFirst({
      where: {
        title: aiTask.task_title,
        role,
      },
      select: {
        id: true,
        description: true,
        expected_output: true,
        ai_task_id: true,
      },
    });

    if (task) {
      const updatedTask = await tx.tasks.update({
        where: {
          id: task.id,
        },
        data: {
          description: aiTask.task_description || task.description,
          expected_output: aiTask.output_format || task.expected_output,
          difficulty: normalizeDifficulty(aiTask.difficulty),
          ai_task_id: aiTask.task_id || task.ai_task_id,
        },
        select: {
          id: true,
        },
      });

      await tx.action_plan_steps.create({
        data: {
          id: randomUUID(),
          action_plan_id: actionPlanId,
          task_id: updatedTask.id,
          step_order: index + 1,
          is_completed: false,
        },
        select: {
          id: true,
        },
      });

      continue;
    }

    const createdTask = await tx.tasks.create({
      data: {
        id: randomUUID(),
        role,
        title: aiTask.task_title,
        description:
          aiTask.task_description ||
          "Task dibuat otomatis dari rekomendasi AI.",
        expected_output:
          aiTask.output_format ||
          "File project, screenshot, link, atau catatan pengerjaan.",
        difficulty: normalizeDifficulty(aiTask.difficulty),
        ai_task_id: aiTask.task_id || null,
      },
      select: {
        id: true,
      },
    });

    await tx.action_plan_steps.create({
      data: {
        id: randomUUID(),
        action_plan_id: actionPlanId,
        task_id: createdTask.id,
        step_order: index + 1,
        is_completed: false,
      },
      select: {
        id: true,
      },
    });
  }
};

export class AssessmentService {
  static async analyze(data: AssessmentPayload) {
    try {
      const aiPayload = await buildAiAssessmentPayload("guest-user", data);

      const aiResult = await postAi<AiSubmitAssessmentResponse>(
        "/submit-assessment",
        aiPayload
      );

      return convertAiResultToLegacyResult(data.targetRole, aiResult);
    } catch (error) {
      console.error("AI assessment analyze failed, using fallback:", error);

      return generateLocalFallbackResult(data.targetRole);
    }
  }

  static async save(userId: string, data: AssessmentPayload) {
    try {
      const aiPayload = await buildAiAssessmentPayload(userId, data);

      const aiResult = await postAi<AiSubmitAssessmentResponse>(
        "/submit-assessment",
        aiPayload
      );

      const result = convertAiResultToLegacyResult(data.targetRole, aiResult);
      const role = result.analysis.role || normalizeRoleToAi(data.targetRole);

      const normalizedTasks = buildTasksFromAiResult(
        aiResult,
        result.recommendedTasks
      );

      const savedResult = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          await tx.assessments.createMany({
            data: data.answers.map((item) => ({
              user_id: userId,
              question: item.question,
              answer: item.answer,
            })),
          });

          const context = await tx.user_context.create({
            data: {
              id: randomUUID(),
              user_id: userId,
              target_role: role,
              problem_category:
                result.analysis.problemCategory || "skill_gap",
              confidence_score: Number(result.analysis.confidence || 0),
              extracted_keywords: JSON.stringify(result.skillGap),
            },
            select: {
              id: true,
            },
          });

          await tx.action_plans.updateMany({
            where: {
              user_id: userId,
              status: "active",
            },
            data: {
              status: "archived",
            },
          });

          const actionPlan = await tx.action_plans.create({
            data: {
              id: randomUUID(),
              user_id: userId,
              generated_from_context_id: context.id,
              target_role: role,
              title: `Action Plan ${normalizeRoleLabel(data.targetRole)}`,
              status: "active",
            },
            select: {
              id: true,
            },
          });

          await saveActionPlanTasks(tx, {
            actionPlanId: actionPlan.id,
            role,
            tasks: normalizedTasks,
          });

          await tx.progress.upsert({
            where: {
              user_id: userId,
            },
            update: {
              total_tasks: normalizedTasks.length,
              completed_tasks: 0,
              progress_percentage: 0,
              last_updated: new Date(),
            },
            create: {
              id: randomUUID(),
              user_id: userId,
              total_tasks: normalizedTasks.length,
              completed_tasks: 0,
              progress_percentage: 0,
            },
            select: {
              id: true,
            },
          });

          await tx.users.update({
            where: {
              id: userId,
            },
            data: {
              is_assessment_done: true,
            },
            select: {
              id: true,
            },
          });

          return {
            context,
            actionPlan,
          };
        }
      );

      return {
        ...result,
        saved: {
          contextId: savedResult.context.id,
          actionPlanId: savedResult.actionPlan.id,
        },
      };
    } catch (error) {
      console.error("AI assessment save failed, using fallback:", error);

      const result = generateLocalFallbackResult(data.targetRole);
      const role = result.analysis.role || normalizeRoleToAi(data.targetRole);

      const fallbackTasks = result.recommendedTasks.map((title) => ({
        task_title: title,
        task_description: "Task dibuat otomatis dari hasil assessment user.",
        output_format:
          "Catatan belajar, screenshot, link project, file project, atau dokumen pendukung.",
        difficulty: "basic",
      }));

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.assessments.createMany({
          data: data.answers.map((item) => ({
            user_id: userId,
            question: item.question,
            answer: item.answer,
          })),
        });

        const context = await tx.user_context.create({
          data: {
            id: randomUUID(),
            user_id: userId,
            target_role: role,
            problem_category: "skill_gap",
            confidence_score: Number(result.analysis.confidence || 0),
            extracted_keywords: JSON.stringify(result.skillGap),
          },
          select: {
            id: true,
          },
        });

        await tx.action_plans.updateMany({
          where: {
            user_id: userId,
            status: "active",
          },
          data: {
            status: "archived",
          },
        });

        const actionPlan = await tx.action_plans.create({
          data: {
            id: randomUUID(),
            user_id: userId,
            generated_from_context_id: context.id,
            target_role: role,
            title: `Action Plan ${normalizeRoleLabel(data.targetRole)}`,
            status: "active",
          },
          select: {
            id: true,
          },
        });

        await saveActionPlanTasks(tx, {
          actionPlanId: actionPlan.id,
          role,
          tasks: fallbackTasks,
        });

        await tx.progress.upsert({
          where: {
            user_id: userId,
          },
          update: {
            total_tasks: fallbackTasks.length,
            completed_tasks: 0,
            progress_percentage: 0,
            last_updated: new Date(),
          },
          create: {
            id: randomUUID(),
            user_id: userId,
            total_tasks: fallbackTasks.length,
            completed_tasks: 0,
            progress_percentage: 0,
          },
          select: {
            id: true,
          },
        });

        await tx.users.update({
          where: {
            id: userId,
          },
          data: {
            is_assessment_done: true,
          },
          select: {
            id: true,
          },
        });
      });

      return result;
    }
  }
}
