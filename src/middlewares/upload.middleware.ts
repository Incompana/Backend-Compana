import multer from "multer";
import path from "path";
import fs from "fs";

const uploadRoot = path.join(process.cwd(), "uploads");
const avatarDir = path.join(uploadRoot, "avatars");
const submissionDir = path.join(uploadRoot, "submissions");

[uploadRoot, avatarDir, submissionDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const safeFileName = (originalName: string) => {
  const ext = path.extname(originalName);
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 40);

  return `${base}-${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${ext}`;
};

const createStorage = (folder: string) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, folder);
    },
    filename: (_req, file, cb) => {
      cb(null, safeFileName(file.originalname));
    },
  });

const imageMimes = ["image/jpeg", "image/png", "image/webp"];

const submissionMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

export const uploadAvatar = multer({
  storage: createStorage(avatarDir),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!imageMimes.includes(file.mimetype)) {
      cb(new Error("Foto profil harus berupa JPG, PNG, atau WEBP"));
      return;
    }

    cb(null, true);
  },
}).single("avatar");

export const uploadSubmissionFile = multer({
  storage: createStorage(submissionDir),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!submissionMimes.includes(file.mimetype)) {
      cb(
        new Error(
          "File submission harus berupa gambar, PDF, TXT, atau ZIP. Maksimal 10MB."
        )
      );
      return;
    }

    cb(null, true);
  },
}).single("file");

export const getPublicFileUrl = (filePath: string) => {
  const relativePath = path
    .relative(uploadRoot, filePath)
    .replace(/\\/g, "/");

  return `/uploads/${relativePath}`;
};