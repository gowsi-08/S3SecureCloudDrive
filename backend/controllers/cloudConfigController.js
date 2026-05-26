const UserCloudConfig = require('../models/UserCloudConfig');
const { encryptCredentials, decryptCredentials } = require('../services/credentialEncryption');
const { validateBucketConnection, getBucketStats } = require('../services/bucketValidation');
const { getS3ClientForUser } = require('../services/dynamicS3Client');

/**
 * Connect user's AWS S3 bucket
 * POST /api/cloud-config/connect
 */
const connectBucket = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bucketName, region, accessKeyId, secretAccessKey } = req.body;

    console.log('🔍 Connect bucket request:', { bucketName, region, userId });

    // Validate inputs
    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      console.log('❌ Missing parameters');
      return res.status(400).json({
        success: false,
        message: 'Bucket name, region, access key ID, and secret access key are required'
      });
    }

    console.log('✅ Parameters validated');
    console.log('🔐 Validating bucket connection...');

    // Validate bucket connection
    const validationResult = await validateBucketConnection(
      accessKeyId,
      secretAccessKey,
      bucketName,
      region
    );

    console.log('📊 Validation result:', validationResult);

    if (!validationResult.success) {
      console.log('❌ Validation failed:', validationResult.error);
      return res.status(400).json({
        success: false,
        message: validationResult.error,
        missingPermissions: validationResult.missingPermissions
      });
    }

    console.log('✅ Bucket validation passed');
    console.log('🔐 Encrypting credentials...');

    // Encrypt credentials
    const encryptionResult = encryptCredentials(accessKeyId, secretAccessKey);

    if (!encryptionResult.success) {
      console.log('❌ Encryption failed:', encryptionResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to encrypt credentials: ' + encryptionResult.error
      });
    }

    console.log('✅ Credentials encrypted');

    // Check if user already has a config
    let cloudConfig = await UserCloudConfig.findOne({ userId });

    if (cloudConfig) {
      console.log('📝 Updating existing config');
      // Update existing config
      cloudConfig.bucketName = bucketName;
      cloudConfig.region = region;
      cloudConfig.encryptedCredentials = encryptionResult.encryptedCredentials;
      cloudConfig.encryptionIV = encryptionResult.encryptionIV;
      cloudConfig.encryptionAuthTag = encryptionResult.encryptionAuthTag;
      cloudConfig.isConnected = true;
      cloudConfig.connectionStatus = 'connected';
      cloudConfig.connectedAt = new Date();
      cloudConfig.lastValidated = new Date();
      cloudConfig.validationError = null;
      cloudConfig.permissionsVerified = true;
      cloudConfig.verifiedPermissions = validationResult.permissions;
    } else {
      console.log('📝 Creating new config');
      // Create new config
      cloudConfig = new UserCloudConfig({
        userId,
        bucketName,
        region,
        encryptedCredentials: encryptionResult.encryptedCredentials,
        encryptionIV: encryptionResult.encryptionIV,
        encryptionAuthTag: encryptionResult.encryptionAuthTag,
        isConnected: true,
        connectionStatus: 'connected',
        connectedAt: new Date(),
        lastValidated: new Date(),
        permissionsVerified: true,
        verifiedPermissions: validationResult.permissions
      });
    }

    await cloudConfig.save();
    console.log('✅ Config saved to database');

    // Clear sensitive data from response
    res.status(201).json({
      success: true,
      message: 'AWS S3 bucket connected successfully',
      data: {
        bucketName: cloudConfig.bucketName,
        region: cloudConfig.region,
        isConnected: cloudConfig.isConnected,
        connectedAt: cloudConfig.connectedAt,
        permissions: cloudConfig.verifiedPermissions
      }
    });

  } catch (error) {
    console.error('❌ Connect bucket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error connecting bucket: ' + error.message
    });
  }
};

/**
 * Get connection status
 * GET /api/cloud-config/status
 */
const getConnectionStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const cloudConfig = await UserCloudConfig.findOne({ userId });

    if (!cloudConfig) {
      return res.json({
        success: true,
        data: {
          isConnected: false,
          message: 'No bucket connected'
        }
      });
    }

    res.json({
      success: true,
      data: {
        isConnected: cloudConfig.isConnected,
        bucketName: cloudConfig.bucketName,
        region: cloudConfig.region,
        connectionStatus: cloudConfig.connectionStatus,
        connectedAt: cloudConfig.connectedAt,
        lastValidated: cloudConfig.lastValidated,
        permissionsVerified: cloudConfig.permissionsVerified,
        verifiedPermissions: cloudConfig.verifiedPermissions
      }
    });

  } catch (error) {
    console.error('Get connection status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching connection status'
    });
  }
};

/**
 * Test bucket connection
 * POST /api/cloud-config/test
 */
const testConnection = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's cloud config
    const cloudConfig = await UserCloudConfig.findOne({ userId });

    if (!cloudConfig || !cloudConfig.isConnected) {
      return res.status(400).json({
        success: false,
        message: 'No bucket connected'
      });
    }

    // Decrypt credentials
    const decryptResult = decryptCredentials(
      cloudConfig.encryptedCredentials,
      cloudConfig.encryptionIV,
      cloudConfig.encryptionAuthTag
    );

    if (!decryptResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt credentials'
      });
    }

    // Validate connection
    const validationResult = await validateBucketConnection(
      decryptResult.accessKeyId,
      decryptResult.secretAccessKey,
      cloudConfig.bucketName,
      cloudConfig.region
    );

    if (!validationResult.success) {
      // Update connection status
      cloudConfig.connectionStatus = 'error';
      cloudConfig.validationError = validationResult.error;
      await cloudConfig.save();

      return res.status(400).json({
        success: false,
        message: validationResult.error
      });
    }

    // Update connection status
    cloudConfig.connectionStatus = 'connected';
    cloudConfig.lastValidated = new Date();
    cloudConfig.validationError = null;
    await cloudConfig.save();

    res.json({
      success: true,
      message: 'Bucket connection is valid',
      data: {
        bucketName: cloudConfig.bucketName,
        region: cloudConfig.region,
        permissions: validationResult.permissions
      }
    });

  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error testing connection'
    });
  }
};

/**
 * Disconnect bucket
 * POST /api/cloud-config/disconnect
 */
const disconnectBucket = async (req, res) => {
  try {
    const userId = req.user._id;

    const cloudConfig = await UserCloudConfig.findOne({ userId });

    if (!cloudConfig) {
      return res.status(404).json({
        success: false,
        message: 'No bucket configuration found'
      });
    }

    // Mark as disconnected
    cloudConfig.isConnected = false;
    cloudConfig.connectionStatus = 'disconnected';
    await cloudConfig.save();

    res.json({
      success: true,
      message: 'Bucket disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect bucket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error disconnecting bucket'
    });
  }
};

/**
 * Get IAM policy template
 * GET /api/cloud-config/iam-policy?bucketName=my-bucket
 */
const getIAMPolicy = async (req, res) => {
  try {
    const { bucketName } = req.query;

    if (!bucketName) {
      return res.status(400).json({
        success: false,
        message: 'Bucket name is required'
      });
    }

    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'SecureDriveS3Access',
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket'
          ],
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ]
        }
      ]
    };

    res.json({
      success: true,
      data: {
        policy,
        instructions: [
          '1. Go to AWS IAM Console',
          '2. Create a new IAM user',
          '3. Attach this policy to the user',
          '4. Generate access keys',
          '5. Use the access keys in SecureDrive'
        ]
      }
    });

  } catch (error) {
    console.error('Get IAM policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating IAM policy'
    });
  }
};

/**
 * Get bucket statistics
 * GET /api/cloud-config/stats
 */
const getBucketStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId);

    if (!clientResult.success) {
      return res.status(400).json({
        success: false,
        message: clientResult.error
      });
    }

    const { s3Client, bucketName } = clientResult;

    // Get bucket stats
    const statsResult = await getBucketStats(s3Client, bucketName);

    if (!statsResult.success) {
      return res.status(500).json({
        success: false,
        message: statsResult.error
      });
    }

    res.json({
      success: true,
      data: {
        bucketName,
        totalSize: statsResult.totalSize,
        formattedSize: statsResult.formattedSize,
        totalObjects: statsResult.totalObjects
      }
    });

  } catch (error) {
    console.error('Get bucket statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bucket statistics'
    });
  }
};

/**
 * Update bucket configuration
 * PUT /api/cloud-config/update
 */
const updateBucketConfig = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bucketName, region } = req.body;

    const cloudConfig = await UserCloudConfig.findOne({ userId });

    if (!cloudConfig) {
      return res.status(404).json({
        success: false,
        message: 'No bucket configuration found'
      });
    }

    // Update only non-sensitive fields
    if (bucketName) cloudConfig.bucketName = bucketName;
    if (region) cloudConfig.region = region;

    await cloudConfig.save();

    res.json({
      success: true,
      message: 'Bucket configuration updated successfully',
      data: {
        bucketName: cloudConfig.bucketName,
        region: cloudConfig.region
      }
    });

  } catch (error) {
    console.error('Update bucket config error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating bucket configuration'
    });
  }
};

module.exports = {
  connectBucket,
  getConnectionStatus,
  testConnection,
  disconnectBucket,
  getIAMPolicy,
  getBucketStatistics,
  updateBucketConfig
};
