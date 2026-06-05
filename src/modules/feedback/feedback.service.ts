import prisma from "../../config/prisma";

const parseJsonText = (value: string | null | undefined) => {
  if (!value) return [];

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

export class FeedbackService {
  static async getMyFeedback(userId: string) {
    const submission = await prisma.submissions.findFirst({
      where: {
        user_id: userId,
        feedback: {
          isNot: null,
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

    if (!submission || !submission.feedback) {
      return null;
    }

  

    return {
      submissionId: submission.id,
      taskTitle: submission.tasks.title,
      taskDescription: submission.tasks.description,
      status: submission.status,
      content: submission.content,
      fileUrl: submission.file_url,
      fileName: submission.file_name,
      createdAt: submission.created_at,
      feedback: {
        id: submission.feedback.id,
        strengths: parseJsonText(submission.feedback.strengths),
        weaknesses: parseJsonText(submission.feedback.weaknesses),
        suggestions: parseJsonText(submission.feedback.suggestions),
        score: submission.feedback.score,
        createdAt: submission.feedback.created_at,
      },
    };
  }
}