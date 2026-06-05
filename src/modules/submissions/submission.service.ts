import prisma from "../../config/prisma";
import { postAi } from "../../services/aiService";

type SubmitTaskPayload = {
  taskTitle: string;
  taskDescription?: string;
  targetRole?: string;
  content?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSize?: number | null;
};

type AiEvaluateTaskResponse = {
  task_id: string;
  score: number | null;
  status: string;
  feedback?: string[];
  positive_feedback?: string[];
  revision_feedback?: string[];
  validated_skill?: string;
  target_role?: string;
  score_format?: unknown[];
  dimension_scores?: unknown[];
  criteria_results?: unknown[];
  skill_updates?: unknown[];
};

type NormalizedEvaluation = {
  source: "ai" | "local";
  status: "passed" | "revision";
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  xpEarned: number;
  rawScore: number;
  isPassed: boolean;
  aiResult?: AiEvaluateTaskResponse | null;
};

const parseJsonText = (value: string | null | undefined) => {
  if (!value) return [];

  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const stringifyList = (value: string[]) => {
  return JSON.stringify(value);
};

const countWords = (text: string) => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};

const normalizeText = (text: string) => {
  return text.toLowerCase().trim();
};

const getTaskKeyword = (taskTitle: string) => {
  return taskTitle.replace("Pelajari", "").trim().toLowerCase();
};

const getFileScore = (
  fileName?: string | null,
  fileMimeType?: string | null,
  fileSize?: number | null
) => {
  if (!fileName && !fileMimeType) {
    return {
      score: 0,
      type: "none",
      label: "Tanpa file",
      reason:
        "Tidak ada file pendukung, sehingga penilaian lebih bergantung pada catatan.",
    };
  }

  const lowerName = fileName?.toLowerCase() || "";
  const mime = fileMimeType || "";
  const size = fileSize || 0;

  const isZip =
    mime.includes("zip") ||
    lowerName.endsWith(".zip") ||
    lowerName.endsWith(".rar") ||
    lowerName.endsWith(".7z");

  const isPdf = mime === "application/pdf" || lowerName.endsWith(".pdf");

  const isText =
    mime === "text/plain" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md");

  const isImage =
    mime.startsWith("image/") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp");

  if (isZip) {
    let score = 60;

    if (size >= 50 * 1024) {
      score += 5;
    }

    if (size >= 200 * 1024) {
      score += 5;
    }

    return {
      score,
      type: "project",
      label: "File project ZIP",
      reason:
        "File ZIP biasanya berisi project atau source code, sehingga bobot penilaiannya tinggi.",
    };
  }

  if (isPdf || isText) {
    return {
      score: 35,
      type: "document",
      label: isPdf ? "File PDF/laporan" : "File TXT/catatan",
      reason:
        "File dokumen biasanya berisi catatan atau laporan, jadi nilainya sedang dan tetap butuh bukti pengerjaan yang jelas.",
    };
  }

  if (isImage) {
    return {
      score: 25,
      type: "screenshot",
      label: "File gambar/screenshot",
      reason:
        "File gambar biasanya hanya menunjukkan bukti visual, jadi nilainya lebih kecil dibanding project ZIP.",
    };
  }

  return {
    score: 20,
    type: "other",
    label: "File pendukung",
    reason:
      "File terdeteksi sebagai bukti pendukung, tetapi jenisnya belum cukup kuat sebagai project.",
  };
};

const determineSubmissionResult = (
  content: string,
  taskTitle: string,
  fileName?: string | null,
  fileMimeType?: string | null,
  fileSize?: number | null
) => {
  const lowerContent = normalizeText(content);
  const wordCount = countWords(content);
  const taskKeyword = getTaskKeyword(taskTitle);
  const fileInfo = getFileScore(fileName, fileMimeType, fileSize);

  const hasEnoughExplanation = wordCount >= 25;
  const hasMediumExplanation = wordCount >= 12;
  const hasShortExplanation = wordCount >= 5;

  const hasTaskKeyword =
    Boolean(taskKeyword) && lowerContent.includes(taskKeyword);

  const hasReflection =
    lowerContent.includes("saya belajar") ||
    lowerContent.includes("saya memahami") ||
    lowerContent.includes("kendala") ||
    lowerContent.includes("masalah") ||
    lowerContent.includes("solusi") ||
    lowerContent.includes("mencoba") ||
    lowerContent.includes("memperbaiki");

  const hasOutput =
    lowerContent.includes("project") ||
    lowerContent.includes("latihan") ||
    lowerContent.includes("hasil") ||
    lowerContent.includes("catatan") ||
    lowerContent.includes("mini project") ||
    lowerContent.includes("contoh") ||
    lowerContent.includes("dokumentasi") ||
    lowerContent.includes("source code");

  const hasLink =
    lowerContent.includes("github") ||
    lowerContent.includes("gitlab") ||
    lowerContent.includes("vercel") ||
    lowerContent.includes("netlify") ||
    lowerContent.includes("http");

  let score = 0;

  score += fileInfo.score;

  if (hasEnoughExplanation) {
    score += 12;
  } else if (hasMediumExplanation) {
    score += 8;
  } else if (hasShortExplanation) {
    score += 4;
  }

  if (hasTaskKeyword) score += 10;
  if (hasReflection) score += 8;
  if (hasOutput) score += 10;
  if (hasLink) score += 10;

  const finalScore = Math.min(score, 100);
  const isPassed = finalScore >= 70;

  return {
    isPassed,
    status: isPassed ? "passed" : "revision",
    score: isPassed ? Math.max(finalScore, 80) : Math.max(finalScore, 55),
    xpEarned: isPassed ? 120 : 60,
    wordCount,
    finalScore,
    fileType: fileInfo.type,
    fileLabel: fileInfo.label,
    fileReason: fileInfo.reason,
    fileScore: fileInfo.score,
  } as const;
};

const buildFeedbackContent = (
  isPassed: boolean,
  taskTitle: string,
  score: number,
  fileLabel: string,
  fileReason: string,
  fileType: string
) => {
  if (isPassed) {
    return {
      strengths: [
        "Task sudah dikerjakan dengan cukup baik.",
        `Bukti submission terdeteksi sebagai ${fileLabel}.`,
        fileReason,
        `Materi ${taskTitle} sudah terlihat mulai dikerjakan dan dikaitkan dengan output yang dikirim.`,
      ],
      weaknesses: [
        "Dokumentasi proses pengerjaan masih bisa dibuat lebih rapi.",
        "Penjelasan tambahan tetap berguna agar evaluator memahami isi file dengan lebih jelas.",
      ],
      suggestions: [
        "Lanjutkan ke langkah berikutnya di action plan.",
        "Simpan file project dan dokumentasi agar bisa dipakai sebagai portofolio.",
        "Tambahkan README atau catatan singkat agar hasil pengerjaan lebih mudah dipahami.",
      ],
      score,
    };
  }

  const fileSpecificWeakness =
    fileType === "none"
      ? "Belum ada file pendukung yang dikirim."
      : fileType === "screenshot"
      ? "File yang dikirim masih berupa gambar/screenshot, sehingga belum cukup kuat untuk membuktikan project secara lengkap."
      : fileType === "document"
      ? "File yang dikirim berupa dokumen/catatan, sehingga belum sepenuhnya menunjukkan bentuk project atau source code."
      : "Bukti file masih perlu diperkuat dengan penjelasan atau output project yang lebih jelas.";

  return {
    strengths: [
      "Kamu sudah mulai mengerjakan task sesuai arahan.",
      `Submission memiliki bukti berupa ${fileLabel}.`,
      "Submit awal ini bisa menjadi dasar untuk perbaikan berikutnya.",
    ],
    weaknesses: [
      fileSpecificWeakness,
      "Bukti pengerjaan belum cukup kuat untuk dianggap selesai sepenuhnya.",
      `Keterkaitan dengan materi ${taskTitle} masih perlu dibuat lebih jelas.`,
    ],
    suggestions: [
      "Kalau ada project, upload file ZIP project atau sertakan link GitHub.",
      "Tambahkan penjelasan singkat tentang isi file yang kamu upload.",
      "Ceritakan hasil yang sudah dibuat, kendala yang muncul, dan cara kamu menyelesaikannya.",
      "Submit ulang setelah bukti pengerjaan lebih lengkap.",
    ],
    score,
  };
};

const normalizeAiEvaluation = (
  aiResult: AiEvaluateTaskResponse
): NormalizedEvaluation => {
  if (
    aiResult.score === null ||
    aiResult.status === "no_rubric_for_task" ||
    aiResult.status === "no_rubric"
  ) {
    throw new Error(
      `AI tidak menemukan rubric untuk task_id: ${aiResult.task_id}`
    );
  }

  const score = Math.round(aiResult.score || 0);
  const isPassed = aiResult.status === "passed" || score >= 80;
  const status: "passed" | "revision" = isPassed ? "passed" : "revision";

  const strengths =
    aiResult.positive_feedback && aiResult.positive_feedback.length > 0
      ? aiResult.positive_feedback
      : aiResult.feedback && aiResult.feedback.length > 0
      ? aiResult.feedback
      : ["Submission berhasil diterima dan sudah dievaluasi oleh AI."];

  const weaknesses =
    aiResult.revision_feedback && aiResult.revision_feedback.length > 0
      ? aiResult.revision_feedback
      : status === "passed"
      ? ["Tidak ada kekurangan besar berdasarkan rubric AI."]
      : ["Beberapa kriteria task belum terpenuhi berdasarkan evaluasi AI."];

  const suggestions =
    status === "passed"
      ? [
          "Lanjutkan ke task berikutnya di action plan.",
          "Simpan hasil pekerjaan ini sebagai bukti portofolio.",
          aiResult.validated_skill
            ? `Skill ${aiResult.validated_skill} sudah mulai tervalidasi.`
            : "Pertahankan kualitas pengerjaan task berikutnya.",
        ]
      : [
          "Perbaiki bagian yang belum memenuhi kriteria.",
          "Lengkapi bukti hasil seperti screenshot, link, atau file project.",
          "Submit ulang setelah revisi selesai.",
        ];

  return {
    source: "ai",
    status,
    score,
    strengths,
    weaknesses,
    suggestions,
    xpEarned: status === "passed" ? 120 : 60,
    rawScore: score,
    isPassed,
    aiResult,
  };
};

const buildLocalEvaluation = (
  content: string,
  taskTitle: string,
  fileName?: string | null,
  fileMimeType?: string | null,
  fileSize?: number | null
): NormalizedEvaluation & {
  wordCount: number;
  fileType: string;
  fileLabel: string;
  fileReason: string;
  fileScore: number;
} => {
  const result = determineSubmissionResult(
    content,
    taskTitle,
    fileName,
    fileMimeType,
    fileSize
  );

  const feedbackContent = buildFeedbackContent(
    result.isPassed,
    taskTitle,
    result.score,
    result.fileLabel,
    result.fileReason,
    result.fileType
  );

  return {
    source: "local",
    status: result.status,
    score: feedbackContent.score,
    strengths: feedbackContent.strengths,
    weaknesses: feedbackContent.weaknesses,
    suggestions: feedbackContent.suggestions,
    xpEarned: result.xpEarned,
    rawScore: result.finalScore,
    isPassed: result.isPassed,
    aiResult: null,
    wordCount: result.wordCount,
    fileType: result.fileType,
    fileLabel: result.fileLabel,
    fileReason: result.fileReason,
    fileScore: result.fileScore,
  };
};

export class SubmissionService {
  static async submitTask(userId: string, payload: SubmitTaskPayload) {
    const taskTitle = payload.taskTitle || "Task Belajar";
    const targetRole = payload.targetRole || "General";

    const taskDescription =
      payload.taskDescription || "Task dibuat otomatis dari action plan user.";

    const hasUploadedFile = Boolean(payload.fileUrl);

    const content =
      payload.content?.trim() ||
      (hasUploadedFile
        ? "User mengupload file sebagai bukti pengerjaan task."
        : "");

    if (!content && !hasUploadedFile) {
      throw new Error("Content atau file wajib diisi");
    }

    let task = await prisma.tasks.findFirst({
      where: {
        title: taskTitle,
        role: targetRole,
      },
    });

    if (!task) {
      task = await prisma.tasks.create({
        data: {
          role: targetRole,
          title: taskTitle,
          description: taskDescription,
          expected_output:
            "Catatan belajar, screenshot, link project, file project, atau dokumen pendukung.",
          difficulty: "basic",
        },
      });
    }

    const localEvaluation = buildLocalEvaluation(
      content,
      taskTitle,
      payload.fileName,
      payload.fileMimeType,
      payload.fileSize
    );

    let evaluation: NormalizedEvaluation = localEvaluation;

    if (task.ai_task_id) {
      try {
        const submissionFiles = payload.fileName
          ? [payload.fileName]
          : payload.fileUrl
          ? [payload.fileUrl]
          : [];

        const aiResult = await postAi<AiEvaluateTaskResponse>(
          "/evaluate-task",
          {
            task_id: task.ai_task_id,
            submission_text: [
              `Task: ${task.title}`,
              `Deskripsi task: ${task.description}`,
              content ? `Catatan user: ${content}` : "",
              payload.fileName ? `File dikirim: ${payload.fileName}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            submission_files: submissionFiles,
          }
        );

        evaluation = normalizeAiEvaluation(aiResult);
      } catch (error) {
        console.error("AI evaluate-task failed, using local fallback:", error);
        evaluation = localEvaluation;
      }
    }

    const submission = await prisma.submissions.create({
      data: {
        user_id: userId,
        task_id: task.id,
        content,
        status: evaluation.status,
        file_url: payload.fileUrl || null,
        file_name: payload.fileName || null,
      },
      include: {
        tasks: true,
      },
    });

    const feedback = await prisma.feedback.create({
      data: {
        submission_id: submission.id,
        strengths: stringifyList(evaluation.strengths),
        weaknesses: stringifyList(evaluation.weaknesses),
        suggestions: stringifyList(evaluation.suggestions),
        score: evaluation.score,
      },
    });

    const latestContext = await prisma.user_context.findFirst({
      where: {
        user_id: userId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    let skillGap: string[] = [];

    try {
      skillGap = JSON.parse(latestContext?.extracted_keywords || "[]");
    } catch {
      skillGap = [];
    }

    const planTaskTitles = skillGap.length
      ? skillGap.map((skill) => `Pelajari ${skill}`)
      : [taskTitle];

    const allUserSubmissions = await prisma.submissions.findMany({
      where: {
        user_id: userId,
      },
      include: {
        tasks: true,
      },
    });

    const passedTaskTitles = new Set(
      allUserSubmissions
        .filter(
          (item) =>
            item.status === "passed" &&
            planTaskTitles.includes(item.tasks.title)
        )
        .map((item) => item.tasks.title)
    );

    const totalTasks = Math.max(planTaskTitles.length, 1);
    const completedTasks = passedTaskTitles.size;

    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
      submission: {
        id: submission.id,
        taskId: submission.task_id,
        taskTitle: submission.tasks.title,
        content: submission.content,
        status: submission.status,
        fileUrl: submission.file_url,
        fileName: submission.file_name,
        createdAt: submission.created_at,
      },
      feedback: {
        id: feedback.id,
        status: submission.status,
        strengths: parseJsonText(feedback.strengths),
        weaknesses: parseJsonText(feedback.weaknesses),
        suggestions: parseJsonText(feedback.suggestions),
        score: feedback.score,
        xpEarned: evaluation.xpEarned,
        createdAt: feedback.created_at,
      },
      evaluation: {
        source: evaluation.source,
        wordCount: countWords(content),
        rawScore: evaluation.rawScore,
        isPassed: evaluation.isPassed,
        fileType: localEvaluation.fileType,
        fileLabel: localEvaluation.fileLabel,
        fileReason: localEvaluation.fileReason,
        fileScore: localEvaluation.fileScore,
        aiTaskId: task.ai_task_id,
        aiResult: evaluation.aiResult,
      },
      progress: {
        completedTasks,
        totalTasks,
        progressPercentage,
      },
    };
  }
}