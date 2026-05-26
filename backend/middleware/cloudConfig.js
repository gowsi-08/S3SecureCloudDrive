const UserCloudConfig = require('../models/UserCloudConfig');

/**
 * Middleware to check if user has connected AWS bucket
 * Used for file operations that require bucket connection
 */
const requireBucketConnection = async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log(`🔍 Checking bucket connection for user: ${userId}`);

    // Check if user has connected bucket
    const cloudConfig = await UserCloudConfig.findOne({
      userId,
      isConnected: true
    });

    if (!cloudConfig) {
      console.log(`❌ No bucket connected for user: ${userId}`);
      return res.status(403).json({
        success: false,
        message: 'AWS S3 bucket not connected. Please connect your bucket first.',
        code: 'NO_BUCKET_CONNECTED'
      });
    }

    console.log(`✅ Bucket connected: ${cloudConfig.bucketName}`);

    // Attach cloud config to request for use in controllers
    req.cloudConfig = cloudConfig;

    next();
  } catch (error) {
    console.error('❌ Bucket connection check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking bucket connection'
    });
  }
};

module.exports = {
  requireBucketConnection
};
