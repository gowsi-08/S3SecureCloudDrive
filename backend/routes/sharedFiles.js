const express = require('express');
const router = express.Router();

const {
  createShareLink,
  generateShareLink,
  getShareDetails,
  verifySharePassword,
  downloadSharedFile,
  getMyShares,
  deactivateShare,
  deleteShare
} = require('../controllers/sharedFileController');

const { protect } = require('../middleware/auth');
const { requireBucketConnection } = require('../middleware/cloudConfig');

// Public routes (no authentication required) - MUST BE FIRST
router.get('/:shareToken/details', getShareDetails);
router.post('/:shareToken/verify-password', verifySharePassword);
router.post('/:shareToken/download', downloadSharedFile);
router.post('/:shareToken/preview', downloadSharedFile); // Preview uses same endpoint with preview flag

// Protected routes (authentication required)
router.post('/create', protect, requireBucketConnection, createShareLink);
router.post('/generate', protect, requireBucketConnection, generateShareLink);
router.get('/my-shares', protect, getMyShares);
router.put('/:shareId/deactivate', protect, deactivateShare);
router.delete('/:shareId', protect, deleteShare);

module.exports = router;
