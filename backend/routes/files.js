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
// Note: handleUploadError must be placed AFTER the upload middleware to catch multer errors
router.post('/upload', (req, res, next) => {
  console.log('📨 Upload route handler called');
  console.log('Headers:', req.headers);
  console.log('Content-Type:', req.get('content-type'));
  
  upload.array('files', 10)(req, res, (err) => {
    console.log('📨 After multer middleware');
    console.log('req.files:', req.files ? `${req.files.length} files` : 'undefined');
    console.log('Error:', err);
    
    if (err) {
      console.log('🔍 Multer error caught in route handler:', err);
      return handleUploadError(err, req, res, next);
    }
    next();
  });
}, uploadFiles);

// File management routes
router.get('/', getFiles);
router.get('/search', searchFiles);
router.get('/:fileId', getFileDetails);
router.post('/:fileId/download', downloadFile);
router.put('/:fileId/rename', renameFile);
router.delete('/:fileId', deleteFile);

module.exports = router;