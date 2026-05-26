const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { 
  deleteFileSecure,
  deleteFolderSecure,
  getFolderDeletionPreview
} = require('../controllers/secureDeleteController');

// Rate limiting for delete operations (more restrictive)
const deleteLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 delete requests per minute
  message: {
    success: false,
    message: 'Too many delete attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All routes require authentication
router.use(auth);

// Secure file deletion
router.delete('/files/:fileId', 
  deleteLimit,
  deleteFileSecure
);

// Secure folder deletion
router.delete('/folders/:folderId',
  deleteLimit, 
  deleteFolderSecure
);

// Get folder delete preview (to show what will be deleted)
router.get('/folders/:folderId/preview',
  getFolderDeletionPreview
);

module.exports = router;