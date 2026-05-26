const express = require('express');
const router = express.Router();

const {
  createFolder,
  getFolderContents,
  deleteFolder,
  getStorageStats
} = require('../controllers/folderController');

const { protect } = require('../middleware/auth');
const { requireBucketConnection } = require('../middleware/cloudConfig');

// All routes require authentication
router.use(protect);

// Bucket connection required for folder operations
router.use(requireBucketConnection);

// Folder management routes
router.post('/', createFolder);
router.get('/stats', getStorageStats);
router.get('/:folderId/contents', getFolderContents);
router.delete('/:folderId', deleteFolder);

module.exports = router;