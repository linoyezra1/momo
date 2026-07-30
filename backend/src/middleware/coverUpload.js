import multer from "multer";

const storage = multer.memoryStorage();

export const coverUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      const error = new Error("יש להעלות קובץ תמונה בלבד");
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  }
});
