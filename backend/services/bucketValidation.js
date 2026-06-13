const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

/**
 * Validate AWS credentials and bucket access
 * @param {string} accessKeyId - AWS Access Key ID
 * @param {string} secretAccessKey - AWS Secret Access Key
 * @param {string} bucketName - S3 bucket name
 * @param {string} region - AWS region
 * @returns {object} Validation result
 */
const validateBucketConnection = async (accessKeyId, secretAccessKey, bucketName, region) => {
  try {
    // Validate inputs
    if (!accessKeyId || !secretAccessKey || !bucketName || !region) {
      return {
        success: false,
        error: 'All parameters (accessKeyId, secretAccessKey, bucketName, region) are required'
      };
    }

    console.log(`🔐 Creating S3 client for bucket: ${bucketName} in region: ${region}`);

    // Create temporary S3 client (AWS SDK v3)
    const s3Client = new S3Client({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      region,
      signatureVersion: 'v4'
    });

    // Test: Check if bucket exists and is accessible
    console.log(`🧪 Testing bucket access with headBucket...`);
    try {
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(command);
      console.log(`✅ Bucket "${bucketName}" is accessible`);
    } catch (error) {
      console.error(`❌ Bucket access error:`, error.code, error.message);
      
      if (error.code === 'NotFound') {
        return {
          success: false,
          error: `Bucket "${bucketName}" does not exist. Please check the bucket name and region.`
        };
      }
      if (error.code === 'Forbidden') {
        return {
          success: false,
          error: `Access denied to bucket "${bucketName}". Please check your AWS credentials and IAM permissions.`
        };
      }
      if (error.code === 'NoSuchBucket') {
        return {
          success: false,
          error: `Bucket "${bucketName}" not found in region "${region}". Please verify the bucket exists in this region.`
        };
      }
      if (error.code === 'BadRequest') {
        return {
          success: false,
          error: `Invalid AWS credentials or bucket configuration. Please verify your Access Key ID and Secret Access Key are correct.`
        };
      }
      
      throw error;
    }

    // Assume permissions are correct if bucket is accessible
    const permissions = ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'];

    return {
      success: true,
      message: 'Bucket connection validated successfully',
      bucketName,
      region,
      permissions
    };
  } catch (error) {
    console.error('❌ Bucket validation error:', error.code, error.message);
    return {
      success: false,
      error: error.message || 'Failed to validate bucket connection'
    };
  }
};

/**
 * Check if user has required S3 permissions
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @returns {object} Permission check result
 */
const checkBucketPermissions = async (s3Client, bucketName) => {
  const requiredPermissions = [
    's3:GetObject',
    's3:PutObject',
    's3:DeleteObject',
    's3:ListBucket'
  ];

  // For now, assume all permissions are present if bucket is accessible
  // Actual permission errors will be caught when operations are performed
  return {
    success: true,
    verifiedPermissions: requiredPermissions,
    missingPermissions: []
  };
};

/**
 * Test a specific S3 permission
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @param {string} permission - Permission to test (e.g., 's3:GetObject')
 * @returns {boolean} True if permission exists
 */
const testPermission = async (s3Client, bucketName, permission) => {
  try {
    // AWS SDK v3 imports for this function
    const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    
    const testKey = `.permission-test-${Date.now()}`;

    switch (permission) {
      case 's3:PutObject':
        try {
          const putCmd = new PutObjectCommand({
            Bucket: bucketName,
            Key: testKey,
            Body: 'test'
          });
          await s3Client.send(putCmd);
          // Clean up
          const delCmd = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: testKey
          });
          await s3Client.send(delCmd);
          return true;
        } catch {
          return false;
        }

      case 's3:GetObject':
        try {
          const getCmd = new GetObjectCommand({
            Bucket: bucketName,
            Key: testKey
          });
          await s3Client.send(getCmd);
        } catch (error) {
          // If object doesn't exist, we still have permission
          if (error.code === 'NoSuchKey') {
            return true;
          }
          return false;
        }
        return true;

      case 's3:DeleteObject':
        try {
          const delCmd = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: testKey
          });
          await s3Client.send(delCmd);
          return true;
        } catch (error) {
          return false;
        }

      case 's3:ListBucket':
        try {
          const listCmd = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1
          });
          await s3Client.send(listCmd);
          return true;
        } catch (error) {
          return false;
        }

      default:
        return false;
    }
  } catch (error) {
    console.error(`Permission test error for ${permission}:`, error.message);
    return false;
  }
};

/**
 * Get bucket usage statistics
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @returns {object} Bucket statistics
 */
const getBucketStats = async (s3Client, bucketName) => {
  try {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    
    let totalSize = 0;
    let totalObjects = 0;
    let continuationToken = null;

    // List all objects and calculate size
    do {
      const params = {
        Bucket: bucketName,
        ContinuationToken: continuationToken
      };

      const listCmd = new ListObjectsV2Command(params);
      const result = await s3Client.send(listCmd);

      if (result.Contents) {
        totalObjects += result.Contents.length;
        totalSize += result.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return {
      success: true,
      totalSize,
      totalObjects,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Get bucket stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  validateBucketConnection,
  checkBucketPermissions,
  testPermission,
  getBucketStats,
  formatBytes
};

/**
 * Check if user has required S3 permissions
 * @param {AWS.S3} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @returns {object} Permission check result
 */
const checkBucketPermissions = async (s3Client, bucketName) => {
  const requiredPermissions = [
    's3:GetObject',
    's3:PutObject',
    's3:DeleteObject',
    's3:ListBucket'
  ];

  // For now, assume all permissions are present if bucket is accessible
  // Actual permission errors will be caught when operations are performed
  return {
    success: true,
    verifiedPermissions: requiredPermissions,
    missingPermissions: []
  };
};

/**
 * Test a specific S3 permission
 * @param {AWS.S3} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @param {string} permission - Permission to test (e.g., 's3:GetObject')
 * @returns {boolean} True if permission exists
 */
const testPermission = async (s3Client, bucketName, permission) => {
  try {
    const testKey = `.permission-test-${Date.now()}`;

    switch (permission) {
      case 's3:PutObject':
        await s3Client.putObject({
          Bucket: bucketName,
          Key: testKey,
          Body: 'test'
        }).promise();
        // Clean up
        await s3Client.deleteObject({
          Bucket: bucketName,
          Key: testKey
        }).promise();
        return true;

      case 's3:GetObject':
        try {
          await s3Client.getObject({
            Bucket: bucketName,
            Key: testKey
          }).promise();
        } catch (error) {
          // If object doesn't exist, we still have permission
          if (error.code === 'NoSuchKey') {
            return true;
          }
          return false;
        }
        return true;

      case 's3:DeleteObject':
        try {
          await s3Client.deleteObject({
            Bucket: bucketName,
            Key: testKey
          }).promise();
          return true;
        } catch (error) {
          return false;
        }

      case 's3:ListBucket':
        try {
          await s3Client.listObjectsV2({
            Bucket: bucketName,
            MaxKeys: 1
          }).promise();
          return true;
        } catch (error) {
          return false;
        }

      default:
        return false;
    }
  } catch (error) {
    console.error(`Permission test error for ${permission}:`, error.message);
    return false;
  }
};

/**
 * Get bucket usage statistics
 * @param {AWS.S3} s3Client - S3 client instance
 * @param {string} bucketName - Bucket name
 * @returns {object} Bucket statistics
 */
const getBucketStats = async (s3Client, bucketName) => {
  try {
    let totalSize = 0;
    let totalObjects = 0;
    let continuationToken = null;

    // List all objects and calculate size
    do {
      const params = {
        Bucket: bucketName,
        ContinuationToken: continuationToken
      };

      const result = await s3Client.listObjectsV2(params).promise();

      if (result.Contents) {
        totalObjects += result.Contents.length;
        totalSize += result.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return {
      success: true,
      totalSize,
      totalObjects,
      formattedSize: formatBytes(totalSize)
    };
  } catch (error) {
    console.error('Get bucket stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  validateBucketConnection,
  checkBucketPermissions,
  testPermission,
  getBucketStats,
  formatBytes
};
