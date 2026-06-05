import * as fs from "fs";
import * as path from "path";
import AdmZip = require("adm-zip");

export type SubmissionFileInspection = {
  fileType: "zip" | "text" | "unsupported" | "none";
  summary: string;
  readableFileCount: number;
  files: Array<{
    name: string;
    size: number;
    excerpt: string;
  }>;
};

const MAX_TOTAL_CHARS = 16000;
const MAX_FILE_CHARS = 4000;
const MAX_FILES = 25;

const allowedTextExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".txt",

  ".py",
  ".ipynb",
  ".csv",

  ".sql",
  ".prisma",
  ".log",
  ".yaml",
  ".yml",
]);

const ignoredPathParts = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
];

const normalizePath = (fileName: string) => {
  return fileName.replace(/\\/g, "/");
};

const isIgnored = (fileName: string) => {
  const normalized = normalizePath(fileName).toLowerCase();

  return ignoredPathParts.some((part) =>
    normalized.includes(part.toLowerCase())
  );
};

const getExtension = (fileName: string) => {
  return path.extname(fileName).toLowerCase();
};

const isAllowedTextFile = (fileName: string) => {
  return allowedTextExtensions.has(getExtension(fileName));
};

const cleanText = (text: string) => {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const truncate = (text: string, max = MAX_FILE_CHARS) => {
  if (text.length <= max) return text;

  return `${text.slice(0, max)}\n\n...[dipotong karena file terlalu panjang]`;
};

const safeReadBufferAsText = (buffer: Buffer) => {
  try {
    return buffer.toString("utf8");
  } catch {
    return "";
  }
};

const summarizeNotebook = (rawText: string) => {
  try {
    const notebook = JSON.parse(rawText);

    if (!Array.isArray(notebook.cells)) {
      return cleanText(rawText);
    }

    const cells = notebook.cells
      .slice(0, 20)
      .map((cell: any, index: number) => {
        const cellType = cell.cell_type || "cell";
        const source = Array.isArray(cell.source)
          ? cell.source.join("")
          : String(cell.source || "");

        return `# Cell ${index + 1} (${cellType})\n${source}`;
      })
      .join("\n\n");

    return cleanText(cells);
  } catch {
    return cleanText(rawText);
  }
};

const buildSummary = (files: SubmissionFileInspection["files"]) => {
  if (!files.length) {
    return "Tidak ada file teks/kode yang berhasil dibaca dari submission.";
  }

  const fileList = files
    .map((file, index) => `${index + 1}. ${file.name} (${file.size} bytes)`)
    .join("\n");

  const content = files
    .map((file) => `\n--- FILE: ${file.name} ---\n${file.excerpt}`)
    .join("\n");

  return [
    "Berikut hasil inspeksi file submission user.",
    "",
    "Daftar file yang berhasil dibaca:",
    fileList,
    "",
    "Isi/ringkasan file:",
    content,
  ].join("\n");
};

const inspectTextFile = (
  filePath: string,
  fileName?: string | null
): SubmissionFileInspection => {
  const actualName = fileName || path.basename(filePath);
  const rawText = fs.readFileSync(filePath, "utf8");

  const ext = getExtension(actualName);

  const cleaned =
    ext === ".ipynb" ? summarizeNotebook(rawText) : cleanText(rawText);

  const stat = fs.statSync(filePath);

  const files = [
    {
      name: actualName,
      size: stat.size,
      excerpt: truncate(cleaned),
    },
  ];

  return {
    fileType: "text",
    files,
    readableFileCount: files.length,
    summary: buildSummary(files),
  };
};

const inspectZipFile = (filePath: string): SubmissionFileInspection => {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const readableFiles: SubmissionFileInspection["files"] = [];
  let totalChars = 0;

  for (const entry of entries) {
    if (readableFiles.length >= MAX_FILES) break;
    if (entry.isDirectory) continue;

    const entryName = normalizePath(entry.entryName);

    if (isIgnored(entryName)) continue;
    if (!isAllowedTextFile(entryName)) continue;

    const buffer = entry.getData();
    const rawText = safeReadBufferAsText(buffer);

    if (!rawText) continue;

    const ext = getExtension(entryName);

    const cleaned =
      ext === ".ipynb" ? summarizeNotebook(rawText) : cleanText(rawText);

    if (!cleaned) continue;

    const remainingChars = MAX_TOTAL_CHARS - totalChars;

    if (remainingChars <= 0) break;

    const excerpt = truncate(cleaned, Math.min(MAX_FILE_CHARS, remainingChars));

    totalChars += excerpt.length;

    readableFiles.push({
      name: entryName,
      size: entry.header.size,
      excerpt,
    });
  }

  return {
    fileType: "zip",
    files: readableFiles,
    readableFileCount: readableFiles.length,
    summary: buildSummary(readableFiles),
  };
};

export const inspectSubmissionFile = async (
  filePath?: string | null,
  fileName?: string | null,
  fileMimeType?: string | null
): Promise<SubmissionFileInspection> => {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      fileType: "none",
      summary: "Tidak ada file fisik yang bisa dibaca oleh backend.",
      readableFileCount: 0,
      files: [],
    };
  }

  const lowerName = (fileName || filePath).toLowerCase();
  const mime = fileMimeType || "";

  const isZip =
    lowerName.endsWith(".zip") ||
    mime.includes("zip") ||
    mime === "application/x-zip-compressed";

  if (isZip) {
    return inspectZipFile(filePath);
  }

  if (isAllowedTextFile(fileName || filePath)) {
    return inspectTextFile(filePath, fileName);
  }

  return {
    fileType: "unsupported",
    summary:
      "File berhasil diupload, tetapi jenis file ini belum bisa dibaca sebagai teks/kode oleh backend. AI hanya akan memakai catatan user dan nama file.",
    readableFileCount: 0,
    files: [],
  };
};