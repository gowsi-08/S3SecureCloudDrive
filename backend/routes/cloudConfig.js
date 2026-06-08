const express = require('express');
const router = express.Router();

const {
  connectBucket,
  getConnectionStatus,
  testConnection,
  disconnectBucket,
  getIAMPolicy,
  getBucketStatistics,
  updateBucketConfig,
  fixCredentials
} = require('../controllers/cloudConfigController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Cloud configuration routes
router.post('/connect', connectBucket);
router.get('/status', getConnectionStatus);
router.post('/test', testConnection);
router.post('/disconnect/:bucketId', disconnectBucket);
router.get('/iam-policy', getIAMPolicy);
router.get('/stats', getBucketStatistics);
router.put('/update', updateBucketConfig);
router.post('/fix-credentials', fixCredentials);

module.exports = router;
