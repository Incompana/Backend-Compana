// src/modules/admin/admin.service.ts

import prisma from "../../config/prisma";

const parseJsonText = (value: string | null | undefined) => {
  if (!value) return [];

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

export class AdminService {
  static async getSummary() {
    const [
      totalUsers,
      totalAdmins,
      totalAssessedUsers,
      totalAssessments,
      totalSubmissions,
      totalPassedSubmissions,
      totalRevisionSubmissions,
      totalFeedback,
      totalTasks,
    ] = await Promise.all([
      prisma.users.count({
        where: {
          role: "user",
        },
      }),

      prisma.users.count({
        where: {
          role: "admin",
        },
      }),

      prisma.users.count({
        where: {
          is_assessment_done: true,
        },
      }),

      prisma.assessments.count(),

      prisma.submissions.count(),

      prisma.submissions.count({
        where: {
          status: "passed",
        },
      }),

      prisma.submissions.count({
        where: {
          status: "revision",
        },
      }),

      prisma.feedback.count(),

      prisma.tasks.count(),
    ]);

    return {
      totalUsers,
      totalAdmins,
      totalAssessedUsers,
      totalAssessments,
      totalSubmissions,
      totalPassedSubmissions,
      totalRevisionSubmissions,
      totalFeedback,
      totalTasks,
    };
  }

  static async getUsers() {
    const users = await prisma.users.findMany({
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        email: true,
        role: true,
        avatar_url: true,
        is_assessment_done: true,
        created_at: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url,
      avatar_url: user.avatar_url,
      isAssessmentDone: user.is_assessment_done,
      is_assessment_done: user.is_assessment_done,
      createdAt: user.created_at,
    }));
  }

  static async getSubmissionsWithFeedback() {
    const submissions = await prisma.submissions.findMany({
      orderBy: {
        created_at: "desc",
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            avatar_url: true,
            is_assessment_done: true,
            created_at: true,
          },
        },
        tasks: true,
        feedback: true,
      },
    });

    return submissions.map((submission) => ({
      id: submission.id,

      user: {
        id: submission.users.id,
        email: submission.users.email,
        role: submission.users.role,
        avatarUrl: submission.users.avatar_url,
        avatar_url: submission.users.avatar_url,
        isAssessmentDone: submission.users.is_assessment_done,
        is_assessment_done: submission.users.is_assessment_done,
        createdAt: submission.users.created_at,
      },

      task: {
        id: submission.tasks.id,
        title: submission.tasks.title,
        description: submission.tasks.description,
        expectedOutput: submission.tasks.expected_output,
        expected_output: submission.tasks.expected_output,
        role: submission.tasks.role,
        difficulty: submission.tasks.difficulty,
        createdAt: submission.tasks.created_at,
      },

      content: submission.content,
      status: submission.status,
      fileUrl: submission.file_url,
      fileName: submission.file_name,
      createdAt: submission.created_at,

      feedback: submission.feedback
        ? {
            id: submission.feedback.id,
            strengths: parseJsonText(submission.feedback.strengths),
            weaknesses: parseJsonText(submission.feedback.weaknesses),
            suggestions: parseJsonText(submission.feedback.suggestions),
            score: submission.feedback.score,
            createdAt: submission.feedback.created_at,
          }
        : null,
    }));
  }

  static async getFeedback() {
    const feedbackList = await prisma.feedback.findMany({
      orderBy: {
        created_at: "desc",
      },
      include: {
        submissions: {
          include: {
            users: {
              select: {
                id: true,
                email: true,
                role: true,
                avatar_url: true,
              },
            },
            tasks: true,
          },
        },
      },
    });

    return feedbackList.map((feedback) => ({
      id: feedback.id,
      score: feedback.score,
      strengths: parseJsonText(feedback.strengths),
      weaknesses: parseJsonText(feedback.weaknesses),
      suggestions: parseJsonText(feedback.suggestions),
      createdAt: feedback.created_at,

      submission: {
        id: feedback.submissions.id,
        content: feedback.submissions.content,
        status: feedback.submissions.status,
        fileUrl: feedback.submissions.file_url,
        fileName: feedback.submissions.file_name,
        createdAt: feedback.submissions.created_at,
      },

      user: {
        id: feedback.submissions.users.id,
        email: feedback.submissions.users.email,
        role: feedback.submissions.users.role,
        avatarUrl: feedback.submissions.users.avatar_url,
        avatar_url: feedback.submissions.users.avatar_url,
      },

      task: {
        id: feedback.submissions.tasks.id,
        title: feedback.submissions.tasks.title,
        description: feedback.submissions.tasks.description,
        role: feedback.submissions.tasks.role,
      },
    }));
  }
}