const express = require('express');
const router = express.Router();

const {
  uploadFiles,
  getFiles,
  downloadFile,
  deleteFile,
  renameFile,
  getFileDetails,
  searchFiles
} = require('../controllers/fileController');

const { protect } = require('../middleware/auth');
const { upload, handleUploadError } = require('../middleware/upload');
const { requireBucketConnection } = require('../middleware/cloudConfig');

// All routes require authentication
router.use(protect);

// Bucket connection required for file operations
router.use(requireBucketConnection);

// File upload routes
// Custom error handling middleware for multer
const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    console.log('🔍 Multer error caught:', err);
    return handleUploadError(err, req, res, next);
  }
  next();
};

router.post('/upload', upload.array('files', 10), multerErrorHandler, uploadFiles);

// File management routes
router.get('/', getFiles);
router.get('/search', searchFiles);
router.get('/:fileId', getFileDetails);
router.post('/:fileId/download', downloadFile);
router.put('/:fileId/rename', renameFile);
router.delete('/:fileId', deleteFile);

module.exports = router;