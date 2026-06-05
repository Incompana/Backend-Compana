import prisma from "../../config/prisma";
import {
  AssessmentPayload,
  AiQuestion,
  AiSubmitAssessmentResponse,
} from "./assessment.types";
import { postAi } from "../../services/aiService";

const normalizeRoleToAi = (role: string) => {
  const value = role.toLowerCase().trim();

  if (value.includes("frontend")) return "frontend_developer";
  if (value.includes("backend")) return "backend_developer";
  if (value.includes("fullstack")) return "frontend_developer";
  if (value.includes("ui") || value.includes("ux")) return "ui_ux_designer";
  if (value.includes("soc") || value.includes("security")) return "soc_analyst";
  if (value.includes("machine") || value.includes("ml")) {
    return "machine_learning_engineer";
  }

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
    general_learner: "General Learner",
  };

  return labels[value] || role;
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
      return {
        analysis: {
          role: targetRole,
          confidence: 85,
          strengths: ["Python"],
          weaknesses: ["Statistics", "Machine Learning", "Pandas"],
        },
        skillGap: ["Statistics", "Machine Learning", "Pandas"],
        recommendedTasks: ["EDA Project", "Data Cleaning", "Classification Model"],
      };

    case "Machine Learning Engineer":
      return {
        analysis: {
          role: targetRole,
          confidence: 80,
          strengths: ["Python"],
          weaknesses: ["Tensorflow", "Deep Learning", "Model Deployment"],
        },
        skillGap: ["Tensorflow", "Deep Learning", "Deployment"],
        recommendedTasks: ["Image Classification", "Build CNN", "Deploy Model"],
      };

    case "Fullstack Developer":
      return {
        analysis: {
          role: targetRole,
          confidence: 84,
          strengths: ["HTML", "CSS"],
          weaknesses: ["React", "Node.js", "Database"],
        },
        skillGap: ["React", "Node.js", "MySQL"],
        recommendedTasks: ["CRUD App", "REST API", "Fullstack Project"],
      };

    default:
      return {
        analysis: {
          role: "Frontend Developer",
          confidence: 75,
          strengths: ["HTML", "CSS"],
          weaknesses: ["JavaScript", "React"],
        },
        skillGap: ["JavaScript", "React"],
        recommendedTasks: ["Landing Page", "React Project"],
      };
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

      const savedResult = await prisma.$transaction(async (tx) => {
        await tx.assessments.createMany({
          data: data.answers.map((item) => ({
            user_id: userId,
            question: item.question,
            answer: item.answer,
          })),
        });

        const context = await tx.user_context.create({
          data: {
            user_id: userId,
            target_role:
              result.analysis.role || normalizeRoleToAi(data.targetRole),
            problem_category:
              result.analysis.problemCategory || "skill_gap",
            confidence_score: result.analysis.confidence,
            extracted_keywords: JSON.stringify(result.skillGap),
          },
        });

        const actionPlan = await tx.action_plans.create({
          data: {
            user_id: userId,
            generated_from_context_id: context.id,
            target_role:
              result.analysis.role || normalizeRoleToAi(data.targetRole),
            title: `Action Plan ${normalizeRoleLabel(data.targetRole)}`,
            status: "active",
          },
        });

        const recommendedTasks =
          aiResult.action_plan?.recommended_tasks || [];

        if (recommendedTasks.length) {
          for (let index = 0; index < recommendedTasks.length; index++) {
            const aiTask = recommendedTasks[index];

            let task = await tx.tasks.findFirst({
              where: {
                title: aiTask.task_title,
                role: result.analysis.role || normalizeRoleToAi(data.targetRole),
              },
            });

            if (task) {
              task = await tx.tasks.update({
                where: {
                  id: task.id,
                },
                data: {
                  description:
                    aiTask.task_description || task.description,
                  expected_output:
                    aiTask.output_format ||
                    aiTask.assessment_checklist ||
                    task.expected_output,
                  difficulty:
                    aiTask.difficulty === "advanced"
                      ? "advanced"
                      : aiTask.difficulty === "intermediate"
                      ? "intermediate"
                      : "basic",
                  ai_task_id: aiTask.task_id,
                },
              });
            } else {
              task = await tx.tasks.create({
                data: {
                  role:
                    result.analysis.role || normalizeRoleToAi(data.targetRole),
                  title: aiTask.task_title,
                  description:
                    aiTask.task_description ||
                    "Task dibuat otomatis dari rekomendasi AI.",
                  expected_output:
                    aiTask.output_format ||
                    aiTask.assessment_checklist ||
                    "File project, screenshot, link, atau catatan pengerjaan.",
                  difficulty:
                    aiTask.difficulty === "advanced"
                      ? "advanced"
                      : aiTask.difficulty === "intermediate"
                      ? "intermediate"
                      : "basic",
                  ai_task_id: aiTask.task_id,
                },
              });
            }

            await tx.action_plan_steps.create({
              data: {
                action_plan_id: actionPlan.id,
                task_id: task.id,
                step_order: index + 1,
                is_completed: false,
              },
            });
          }
        } else {
          for (let index = 0; index < result.recommendedTasks.length; index++) {
            const taskTitle = result.recommendedTasks[index];

            const task = await tx.tasks.create({
              data: {
                role:
                  result.analysis.role || normalizeRoleToAi(data.targetRole),
                title: taskTitle,
                description:
                  "Task dibuat otomatis dari hasil assessment user.",
                expected_output:
                  "Catatan belajar, screenshot, link project, file project, atau dokumen pendukung.",
                difficulty: "basic",
              },
            });

            await tx.action_plan_steps.create({
              data: {
                action_plan_id: actionPlan.id,
                task_id: task.id,
                step_order: index + 1,
                is_completed: false,
              },
            });
          }
        }

        await tx.progress.upsert({
          where: {
            user_id: userId,
          },
          update: {
            total_tasks:
              recommendedTasks.length || result.recommendedTasks.length || 0,
            completed_tasks: 0,
            progress_percentage: 0,
            last_updated: new Date(),
          },
          create: {
            user_id: userId,
            total_tasks:
              recommendedTasks.length || result.recommendedTasks.length || 0,
            completed_tasks: 0,
            progress_percentage: 0,
          },
        });

        await tx.users.update({
          where: {
            id: userId,
          },
          data: {
            is_assessment_done: true,
          },
        });

        return {
          context,
          actionPlan,
        };
      });

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

      await prisma.$transaction(async (tx) => {
        await tx.assessments.createMany({
          data: data.answers.map((item) => ({
            user_id: userId,
            question: item.question,
            answer: item.answer,
          })),
        });

        await tx.user_context.create({
          data: {
            user_id: userId,
            target_role: data.targetRole,
            problem_category: "skill_gap",
            confidence_score: result.analysis.confidence,
            extracted_keywords: JSON.stringify(result.skillGap),
          },
        });

        await tx.users.update({
          where: {
            id: userId,
          },
          data: {
            is_assessment_done: true,
          },
        });
      });

      return result;
    }
  }
}