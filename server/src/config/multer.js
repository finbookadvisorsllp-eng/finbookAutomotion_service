import multer from 'multer';
import path from 'path';

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
];

const ALLOWED_CSV_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

// Store files in memory for processing
const storage = multer.memoryStorage();

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, TIFF`), false);
    }
  },
});

export const uploadCSV = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_CSV_TYPES.includes(file.mimetype) || ext === '.csv' || ext === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: CSV, XLSX`), false);
    }
  },
});
