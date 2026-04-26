/* Multer config for product image uploads. Saves to /assets/img/products/. */

'use strict';

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'assets', 'img', 'products');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext) ? ext : '.jpg';
    const stem = (file.fieldname || 'img') + '-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, stem + safeExt);
  },
});

const fileFilter = (req, file, cb) => {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, WEBP, AVIF allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 }, // 8 MB per file, max 8
});

module.exports = { upload, UPLOAD_DIR };
