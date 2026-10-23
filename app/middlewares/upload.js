const multer = require('multer');
const fs = require('fs');
const path = require('path'); 


const storage = multer.memoryStorage(); // Files will be kept in memory as Buffer

// This middleware is shared across profile/vehicle image uploads and chat
// attachments, so it allows images, common documents, and video/audio —
// the goal is just to block arbitrary/executable content and unbounded size.
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5 MB per file, 5 files max
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});


module.exports = { upload};
