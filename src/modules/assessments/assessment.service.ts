import prisma from "../../config/prisma";
import { AssessmentPayload } from "./assessment.types";
import { UserContextService } from "../user-context/userContext.service";

export class AssessmentService {
  static generateResult(targetRole: string) {
    switch (targetRole) {
      case "Data Scientist":
        return {
          analysis: {
            role: targetRole,
            confidence: 85,
            strengths: ["Python"],
            weaknesses: [
              "Statistics",
              "Machine Learning",
              "Pandas",
            ],
          },
          skillGap: [
            "Statistics",
            "Machine Learning",
            "Pandas",
          ],
          recommendedTasks: [
            "EDA Project",
            "Data Cleaning",
            "Classification Model",
          ],
        };

      case "Machine Learning Engineer":
        return {
          analysis: {
            role: targetRole,
            confidence: 80,
            strengths: ["Python"],
            weaknesses: [
              "Tensorflow",
              "Deep Learning",
              "Model Deployment",
            ],
          },
          skillGap: [
            "Tensorflow",
            "Deep Learning",
            "Deployment",
          ],
          recommendedTasks: [
            "Image Classification",
            "Build CNN",
            "Deploy Model",
          ],
        };

      case "Fullstack Developer":
        return {
          analysis: {
            role: targetRole,
            confidence: 84,
            strengths: ["HTML", "CSS"],
            weaknesses: [
              "React",
              "Node.js",
              "Database",
            ],
          },
          skillGap: ["React", "Node.js", "MySQL"],
          recommendedTasks: [
            "CRUD App",
            "REST API",
            "Fullstack Project",
          ],
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
          recommendedTasks: [
            "Landing Page",
            "React Project",
          ],
        };
    }
  }

  static async analyze(data: AssessmentPayload) {
    const { targetRole } = data;

    return this.generateResult(targetRole);
  }

  static async save(
    userId: string,
    data: AssessmentPayload
  ) {
    const { targetRole, answers } = data;

    const result = this.generateResult(targetRole);

    await prisma.$transaction(async (tx) => {
      await tx.assessments.createMany({
        data: answers.map((item) => ({
          user_id: userId,
          question: item.question,
          answer: item.answer,
        })),
      });

      await tx.user_context.create({
        data: {
          user_id: userId,
          target_role: targetRole,
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