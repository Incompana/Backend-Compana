import prisma from "../../config/prisma";

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

  const isPdf =
    mime === "application/pdf" ||
    lowerName.endsWith(".pdf");

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

export class SubmissionService {
  static async submitTask(userId: string, payload: SubmitTaskPayload) {
    const taskTitle = payload.taskTitle || "Task Belajar";
    const targetRole = payload.targetRole || "General";

    const taskDescription =
      payload.taskDescription ||
      "Task dibuat otomatis dari action plan user.";

    const hasUploadedFile = Boolean(payload.fileUrl);

    const content =
      payload.content?.trim() ||
      (hasUploadedFile
        ? "User mengupload file sebagai bukti pengerjaan task."
        : "");

    if (!content && !hasUploadedFile) {
      throw new Error("Content atau file wajib diisi");
    }

    const result = determineSubmissionResult(
      content,
      taskTitle,
      payload.fileName,
      payload.fileMimeType,
      payload.fileSize
    );

    const feedbackContent = buildFeedbackContent(
      result.isPassed,
      taskTitle,
      result.score,
      result.fileLabel,
      result.fileReason,
      result.fileType
    );

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

    const submission = await prisma.submissions.create({
      data: {
        user_id: userId,
        task_id: task.id,
        content,
        status: result.status,
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
        strengths: stringifyList(feedbackContent.strengths),
        weaknesses: stringifyList(feedbackContent.weaknesses),
        suggestions: stringifyList(feedbackContent.suggestions),
        score: feedbackContent.score,
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
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

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
        xpEarned: result.xpEarned,
        createdAt: feedback.created_at,
      },
      evaluation: {
        wordCount: result.wordCount,
        rawScore: result.finalScore,
        isPassed: result.isPassed,
        fileType: result.fileType,
        fileLabel: result.fileLabel,
        fileReason: result.fileReason,
        fileScore: result.fileScore,
      },
      progress: {
        completedTasks,
        totalTasks,
        progressPercentage,
      },
    };
  }
}