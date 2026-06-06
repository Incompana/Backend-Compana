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

type AssessmentAnswer = {
  question: string;
  answer: string;
};

const normalizeRoleToAi = (role: string) => {
  const value = role.toLowerCase().trim();

  if (value.includes("frontend")) return "frontend_developer";
  if (value.includes("backend")) return "backend_developer";
  if (value.includes("fullstack")) return "frontend_developer";
  if (value.includes("ui") || value.includes("ux")) return "ui_ux_designer";
  if (
    value.includes("soc") ||
    value.includes("security") ||
    value.includes("cyber")
  ) {
    return "soc_analyst";
  }
  if (
    value.includes("machine") ||
    value.includes("ml") ||
    value.includes("ai")
  ) {
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

const normalizeAssessmentLevel = (level?: string) => {
  const value = String(level || "").toLowerCase().trim();

  if (
    value.includes("advanced") ||
    value.includes("mahir") ||
    value.includes("lanjut") ||
    value.includes("expert")
  ) {
    return "advanced";
  }

  if (
    value.includes("intermediate") ||
    value.includes("menengah") ||
    value.includes("cukup")
  ) {
    return "intermediate";
  }

  return "beginner";
};

const getProblemCategory = (data: AssessmentPayload) => {
  if (data.problemCategory) return data.problemCategory;

  const joinedAnswers = (data.answers || [])
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

  const joinedAnswers = (data.answers || [])
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
  if (data.currentLevel) {
    return normalizeAssessmentLevel(data.currentLevel);
  }

  const joinedAnswers = (data.answers || [])
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ")
    .toLowerCase();

  return normalizeAssessmentLevel(joinedAnswers);
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

    const matchingAnswer = (data.answers || []).find((item) => {
      const questionText = question.question || question.prompt || "";

      return (
        item.question.toLowerCase().trim() ===
        questionText.toLowerCase().trim()
      );
    });

    const isRuntimeSkillQuestion =
      question.question_id?.startsWith("Q_RUNTIME_");

    const fallbackAnswer = isRuntimeSkillQuestion
      ? currentLevel
      : blockerAnswer;

    const fallbackText = isRuntimeSkillQuestion
      ? currentLevel
      : problemCategory;

    return {
      question_id: question.question_id,
      answer: matchingAnswer?.answer || fallbackAnswer,
      answer_value: matchingAnswer?.answer || fallbackAnswer,
      answer_text: matchingAnswer?.answer || fallbackText,
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
          problemCategory: "skill_gap",
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
          problemCategory: "skill_gap",
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
          problemCategory: "skill_gap",
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
          problemCategory: "skill_gap",
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

const insertUserContext = async (
  tx: Prisma.TransactionClient,
  params: {
    id: string;
    userId: string;
    role: string;
    problemCategory: string;
    confidenceScore: number;
    extractedKeywords: string;
  }
) => {
  await tx.$executeRaw`
    INSERT INTO user_context
      (id, user_id, target_role, problem_category, confidence_score, extracted_keywords, created_at)
    VALUES
      (
        ${params.id},
        ${params.userId},
        ${params.role},
        ${params.problemCategory},
        ${params.confidenceScore},
        ${params.extractedKeywords},
        NOW()
      )
  `;
};

const insertActionPlan = async (
  tx: Prisma.TransactionClient,
  params: {
    id: string;
    userId: string;
    contextId: string;
    role: string;
    title: string;
  }
) => {
  await tx.$executeRaw`
    INSERT INTO action_plans
      (id, user_id, generated_from_context_id, target_role, title, status, created_at)
    VALUES
      (
        ${params.id},
        ${params.userId},
        ${params.contextId},
        ${params.role},
        ${params.title},
        'active',
        NOW()
      )
  `;
};

const upsertProgress = async (
  tx: Prisma.TransactionClient,
  params: {
    id: string;
    userId: string;
    totalTasks: number;
  }
) => {
  await tx.$executeRaw`
    INSERT INTO progress
      (id, user_id, completed_tasks, total_tasks, progress_percentage, last_updated)
    VALUES
      (${params.id}, ${params.userId}, 0, ${params.totalTasks}, 0, NOW())
    ON DUPLICATE KEY UPDATE
      completed_tasks = 0,
      total_tasks = VALUES(total_tasks),
      progress_percentage = 0,
      last_updated = NOW()
  `;
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

    const existingTask = await tx.tasks.findFirst({
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

    const taskId = existingTask?.id || randomUUID();

    if (existingTask) {
      await tx.tasks.updateMany({
        where: {
          id: existingTask.id,
        },
        data: {
          description: aiTask.task_description || existingTask.description,
          expected_output: aiTask.output_format || existingTask.expected_output,
          difficulty: normalizeDifficulty(aiTask.difficulty),
          ai_task_id: aiTask.task_id || existingTask.ai_task_id,
        },
      });
    } else {
      await tx.$executeRaw`
        INSERT INTO tasks
          (id, role, title, description, expected_output, difficulty, ai_task_id, created_at)
        VALUES
          (
            ${taskId},
            ${role},
            ${aiTask.task_title},
            ${aiTask.task_description || "Task dibuat otomatis dari rekomendasi AI."},
            ${aiTask.output_format || "File project, screenshot, link, atau catatan pengerjaan."},
            ${normalizeDifficulty(aiTask.difficulty)},
            ${aiTask.task_id || null},
            NOW()
          )
      `;
    }

    await tx.$executeRaw`
      INSERT INTO action_plan_steps
        (id, action_plan_id, task_id, step_order, is_completed)
      VALUES
        (${randomUUID()}, ${actionPlanId}, ${taskId}, ${index + 1}, false)
    `;
  }
};

const saveAssessmentTransaction = async (params: {
  userId: string;
  targetRole: string;
  result: any;
  tasks: NormalizedActionTask[];
  answers: AssessmentAnswer[];
}) => {
  const { userId, targetRole, result, tasks, answers } = params;
  const role = result.analysis.role || normalizeRoleToAi(targetRole);
  const contextId = randomUUID();
  const actionPlanId = randomUUID();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (answers.length) {
      await tx.assessments.createMany({
        data: answers.map((item) => ({
          user_id: userId,
          question: item.question,
          answer: item.answer,
        })),
      });
    }

    await insertUserContext(tx, {
      id: contextId,
      userId,
      role,
      problemCategory: (result.analysis as any).problemCategory || "skill_gap",
      confidenceScore: Number(result.analysis.confidence || 0),
      extractedKeywords: JSON.stringify(result.skillGap || []),
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

    await insertActionPlan(tx, {
      id: actionPlanId,
      userId,
      contextId,
      role,
      title: `Action Plan ${normalizeRoleLabel(targetRole)}`,
    });

    await saveActionPlanTasks(tx, {
      actionPlanId,
      role,
      tasks,
    });

    await upsertProgress(tx, {
      id: randomUUID(),
      userId,
      totalTasks: tasks.length,
    });

    await tx.users.updateMany({
      where: {
        id: userId,
      },
      data: {
        is_assessment_done: true,
      },
    });
  });

  return {
    contextId,
    actionPlanId,
  };
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

      const normalizedTasks = buildTasksFromAiResult(
        aiResult,
        result.recommendedTasks
      );

      const saved = await saveAssessmentTransaction({
        userId,
        targetRole: data.targetRole,
        result,
        tasks: normalizedTasks,
        answers: data.answers || [],
      });

      return {
        ...result,
        saved,
      };
    } catch (error) {
      console.error("AI assessment save failed, using fallback:", error);

      const result = generateLocalFallbackResult(data.targetRole);

      const fallbackTasks = result.recommendedTasks.map((title) => ({
        task_title: title,
        task_description: "Task dibuat otomatis dari hasil assessment user.",
        output_format:
          "Catatan belajar, screenshot, link project, file project, atau dokumen pendukung.",
        difficulty: "basic",
      }));

      const saved = await saveAssessmentTransaction({
        userId,
        targetRole: data.targetRole,
        result,
        tasks: fallbackTasks,
        answers: data.answers || [],
      });

      return {
        ...result,
        saved,
      };
    }
  }
}
