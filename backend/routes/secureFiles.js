const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { requireBucketConnection } = require('../middleware/cloudConfig');
const { upload, handleUploadError } = require('../middleware/upload');
const rateLimit = require('express-rate-limit');
const { 
  verifyAccountPasswordForEncryption,
  uploadFilesSecure,
  downloadFileSecure
} = require('../controllers/secureFileController');

// Rate limiting for security-sensitive operations
const passwordVerificationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 password verification attempts per windowMs
  message: {
    success: false,
    message: 'Too many password verification attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const uploadLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 upload requests per minute
  message: {
    success: false,
    message: 'Too many upload attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const downloadLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 download requests per minute
  message: {
    success: false,
    message: 'Too many download attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Verify account password for encryption
router.post('/verify-password', 
  passwordVerificationLimit,
  auth, 
  verifyAccountPasswordForEncryption
);

// Upload files with secure encryption
router.post('/upload',
  uploadLimit,
  auth,
  requireBucketConnection,
  upload.array('files', 10), // Max 10 files per upload
  handleUploadError,
  uploadFilesSecure
);

// Download/preview file with secure decryption
router.post('/download/:fileId',
  downloadLimit,
  auth,
  requireBucketConnection,
  downloadFileSecure
);

module.exports = router;