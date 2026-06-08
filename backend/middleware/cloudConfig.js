const UserCloudConfig = require('../models/UserCloudConfig');

/**
 * Middleware to check if user has connected AWS bucket
 * Used for file operations that require bucket connection
 * 
 * Priority for bucketId:
 * 1. Query parameter: ?bucketId=...
 * 2. FormData/Body field: formData.append('bucketId', ...)
 * 3. First connected bucket (fallback)
 */
const requireBucketConnection = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Check bucketId from multiple sources (priority order)
    let bucketIdToUse = req.query.bucketId || (req.body && req.body.bucketId);

    console.log(`\n🔍 ===== requireBucketConnection middleware START =====`);
    console.log(`   Method: ${req.method}`);
    console.log(`   URL: ${req.originalUrl}`);
    console.log(`   User: ${userId}`);
    console.log(`   Query bucketId: ${req.query.bucketId}`);
    console.log(`   Body bucketId: ${req.body ? req.body.bucketId : 'N/A (GET request)'}`);
    console.log(`   Final bucketId to use: ${bucketIdToUse}`);

    let cloudConfig = null;

    // If bucketId is provided, use that specific bucket
    if (bucketIdToUse) {
      console.log(`   Looking for specific bucket: ${bucketIdToUse}`);
      try {
        cloudConfig = await UserCloudConfig.findOne({
          _id: bucketIdToUse,
          userId,
          isConnected: true
        });

        if (!cloudConfig) {
          console.log(`   ❌ Bucket ${bucketIdToUse} not found or not connected`);
          return res.status(403).json({
            success: false,
            message: 'Specified AWS S3 bucket not found or not connected',
            code: 'BUCKET_NOT_FOUND'
          });
        }
        console.log(`   ✅ Found specific bucket: ${cloudConfig.bucketName}`);
      } catch (dbError) {
        console.log(`   ❌ Database error finding bucket: ${dbError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Error checking bucket configuration',
          code: 'DB_ERROR'
        });
      }
    } else {
      // Fallback: Use the first connected bucket
      console.log(`   No bucketId provided, using first connected bucket`);
      try {
        cloudConfig = await UserCloudConfig.findOne({
          userId,
          isConnected: true
        }).lean();

        if (!cloudConfig) {
          console.log(`   ❌ No bucket connected for user: ${userId}`);
          // Check if user has ANY buckets (connected or not)
          const allBuckets = await UserCloudConfig.find({ userId }).lean();
          if (allBuckets.length === 0) {
            return res.status(403).json({
              success: false,
              message: 'No AWS S3 bucket connected. Please connect your bucket first.',
              code: 'NO_BUCKET_CONNECTED',
              details: 'No bucket found. Please go to Cloud Config and connect an S3 bucket.'
            });
          } else {
            // User has buckets but none are connected
            return res.status(403).json({
              success: false,
              message: 'Your AWS S3 buckets are not properly connected or the connection is invalid.',
              code: 'BUCKET_NOT_CONNECTED',
              details: 'Found buckets but none are in "connected" state. Please verify your AWS credentials.'
            });
          }
        }
        console.log(`   ✅ Using first bucket: ${cloudConfig.bucketName}`);
      } catch (dbError) {
        console.log(`   ❌ Database error finding first bucket: ${dbError.message}`);
        return res.status(500).json({
          success: false,
          message: 'Error checking bucket configuration',
          code: 'DB_ERROR',
          details: dbError.message
        });
      }
    }

    if (!cloudConfig) {
      console.log(`   ❌ No valid bucket configuration found`);
      return res.status(403).json({
        success: false,
        message: 'AWS S3 bucket not configured. Please connect your bucket first.',
        code: 'NO_BUCKET_CONFIGURED'
      });
    }

    console.log(`   Setting req.bucketId = ${cloudConfig._id}`);
    console.log(`🔍 ===== requireBucketConnection middleware END =====\n`);

    // Attach cloud config to request for use in controllers
    req.cloudConfig = cloudConfig;
    req.bucketId = cloudConfig._id;

    next();
  } catch (error) {
    console.error('❌ Bucket connection check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking bucket connection',
      error: error.message
    });
  }
};

module.exports = {
  requireBucketConnection
};
