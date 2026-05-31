const AWS = require('aws-sdk');
const UserCloudConfig = require('../models/UserCloudConfig');
const { decryptCredentials } = require('./credentialEncryption');

/**
 * Get S3 client for a specific user
 * Creates a dynamic S3 client using user's encrypted AWS credentials
 * @param {string} userId - User ID
 * @returns {object} S3 client or error
 */
const getS3ClientForUser = async (userId) => {
  try {
    console.log(`🔍 getS3ClientForUser called for user: ${userId}`);
    
    if (!userId) {
      console.log(`❌ User ID is required`);
      return {
        success: false,
        error: 'User ID is required'
      };
    }

    // Fetch user's cloud config
    console.log(`📊 Fetching cloud config from database...`);
    const cloudConfig = await UserCloudConfig.findOne({ userId, isConnected: true });

    if (!cloudConfig) {
      console.log(`❌ No AWS bucket connected for user: ${userId}`);
      return {
        success: false,
        error: 'No AWS bucket connected for this user'
      };
    }

    console.log(`✅ Cloud config found:`, {
      bucketName: cloudConfig.bucketName,
      region: cloudConfig.region,
      isConnected: cloudConfig.isConnected
    });

    // Decrypt credentials
    console.log(`🔐 Decrypting AWS credentials...`);
    const decryptResult = decryptCredentials(
      cloudConfig.encryptedCredentials,
      cloudConfig.encryptionIV,
      cloudConfig.encryptionAuthTag
    );

    if (!decryptResult.success) {
      console.log(`❌ Failed to decrypt credentials: ${decryptResult.error}`);
      return {
        success: false,
        error: 'Failed to decrypt AWS credentials'
      };
    }

    console.log(`✅ Credentials decrypted successfully`);

    // Create S3 client with user's credentials
    console.log(`🔧 Creating S3 client with decrypted credentials...`);
    const s3Client = new AWS.S3({
      accessKeyId: decryptResult.accessKeyId,
      secretAccessKey: decryptResult.secretAccessKey,
      region: cloudConfig.region,
      signatureVersion: 'v4'
    });

    console.log(`✅ S3 client created successfully`);

    return {
      success: true,
      s3Client,
      bucketName: cloudConfig.bucketName,
      region: cloudConfig.region,
      userId
    };
  } catch (error) {
    console.error('❌ Get S3 client error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get user's bucket configuration
 * @param {string} userId - User ID
 * @returns {object} Bucket config or error
 */
const getUserBucketConfig = async (userId) => {
  try {
    const cloudConfig = await UserCloudConfig.findOne({ userId });

    if (!cloudConfig) {
      return {
        success: false,
        error: 'No bucket configuration found'
      };
    }

    return {
      success: true,
      bucketName: cloudConfig.bucketName,
      region: cloudConfig.region,
      isConnected: cloudConfig.isConnected,
      connectionStatus: cloudConfig.connectionStatus,
      lastValidated: cloudConfig.lastValidated,
      permissionsVerified: cloudConfig.permissionsVerified,
      verifiedPermissions: cloudConfig.verifiedPermissions
    };
  } catch (error) {
    console.error('Get bucket config error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if user has connected bucket
 * @param {string} userId - User ID
 * @returns {boolean} True if connected
 */
const isUserBucketConnected = async (userId) => {
  try {
    const cloudConfig = await UserCloudConfig.findOne({ 
      userId, 
      isConnected: true 
    });
    return !!cloudConfig;
  } catch (error) {
    console.error('Check bucket connection error:', error);
    return false;
  }
};

/**
 * Generate S3 key for user's bucket
 * @param {string} userId - User ID
 * @param {string} fileName - File name
 * @param {string} folderId - Folder ID (optional)
 * @returns {string} S3 key
 */
const generateUserS3Key = (userId, fileName, folderId = null) => {
  // Structure: userId/folders/folderId/fileName or userId/root/fileName
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const uniqueFileName = `${timestamp}-${randomStr}-${fileName}`;

  if (folderId && folderId !== 'root') {
    return `${userId}/folders/${folderId}/${uniqueFileName}`;
  }
  return `${userId}/root/${uniqueFileName}`;
};

/**
 * Upload file to user's S3 bucket
 * @param {string} userId - User ID
 * @param {Buffer} fileBuffer - File content
 * @param {string} s3Key - S3 key
 * @param {string} contentType - MIME type
 * @returns {object} Upload result
 */
const uploadToUserS3 = async (userId, fileBuffer, s3Key, contentType = 'application/octet-stream') => {
  try {
    console.log(`☁️ uploadToUserS3 called for user: ${userId}, key: ${s3Key}`);
    
    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId);
    if (!clientResult.success) {
      console.log(`❌ Failed to get S3 client: ${clientResult.error}`);
      return {
        success: false,
        error: clientResult.error
      };
    }

    const { s3Client, bucketName } = clientResult;
    console.log(`✅ S3 client created for bucket: ${bucketName}`);

    // Upload to S3
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256' // S3-side encryption
    };

    console.log(`📤 Uploading to S3 with params:`, {
      Bucket: params.Bucket,
      Key: params.Key,
      ContentType: params.ContentType,
      BodySize: fileBuffer.length,
      ServerSideEncryption: params.ServerSideEncryption
    });

    const result = await s3Client.upload(params).promise();

    console.log(`✅ S3 upload successful:`, {
      Key: result.Key,
      ETag: result.ETag,
      Location: result.Location
    });

    return {
      success: true,
      s3Key: result.Key,
      etag: result.ETag,
      location: result.Location
    };
  } catch (error) {
    console.error('❌ Upload to user S3 error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Unknown S3 upload error'
    };
  }
};

/**
 * Download file from user's S3 bucket
 * @param {string} userId - User ID
 * @param {string} s3Key - S3 key
 * @returns {object} File buffer or error
 */
const downloadFromUserS3 = async (userId, s3Key) => {
  try {
    console.log(`📥 downloadFromUserS3 called for user: ${userId}, key: ${s3Key}`);
    
    // Validate inputs
    if (!userId || !s3Key) {
      console.log(`❌ Invalid parameters: userId=${userId}, s3Key=${s3Key}`);
      return {
        success: false,
        error: 'User ID and S3 key are required'
      };
    }
    
    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId);
    if (!clientResult.success) {
      console.log(`❌ Failed to get S3 client: ${clientResult.error}`);
      return {
        success: false,
        error: clientResult.error
      };
    }

    const { s3Client, bucketName } = clientResult;
    console.log(`✅ S3 client ready for bucket: ${bucketName}`);

    // Download from S3
    const params = {
      Bucket: bucketName,
      Key: s3Key
    };

    console.log(`📥 Downloading from S3:`, {
      Bucket: params.Bucket,
      Key: params.Key
    });

    const result = await s3Client.getObject(params).promise();

    // Validate result
    if (!result) {
      console.log(`❌ S3 getObject returned empty result`);
      return {
        success: false,
        error: 'S3 returned empty result'
      };
    }

    console.log(`✅ S3 response received:`, {
      ContentType: result.ContentType,
      ContentLength: result.ContentLength,
      BodyType: typeof result.Body,
      BodyIsBuffer: Buffer.isBuffer(result.Body),
      BodyExists: !!result.Body
    });

    // Convert Body to Buffer - handle all possible types
    let fileBuffer;
    
    if (!result.Body) {
      console.log(`❌ S3 Body is undefined or null`);
      return {
        success: false,
        error: 'S3 returned empty file body'
      };
    }

    if (Buffer.isBuffer(result.Body)) {
      fileBuffer = result.Body;
      console.log(`✅ Body is already a Buffer (${fileBuffer.length} bytes)`);
    } else if (result.Body instanceof Uint8Array) {
      fileBuffer = Buffer.from(result.Body);
      console.log(`✅ Converted Uint8Array to Buffer (${fileBuffer.length} bytes)`);
    } else if (typeof result.Body === 'string') {
      fileBuffer = Buffer.from(result.Body, 'utf8');
      console.log(`✅ Converted string to Buffer (${fileBuffer.length} bytes)`);
    } else if (result.Body && typeof result.Body.read === 'function') {
      // It's a stream - read all data
      console.log(`📖 Body is a stream, reading data...`);
      
      // Use a proper stream-to-buffer conversion with error handling
      const chunks = [];
      
      try {
        for await (const chunk of result.Body) {
          if (chunk) {
            console.log(`📖 Received chunk: ${chunk.length} bytes`);
            chunks.push(chunk);
          }
        }
        
        fileBuffer = Buffer.concat(chunks);
        console.log(`✅ Stream read complete (${fileBuffer.length} bytes)`);
      } catch (streamError) {
        console.error(`❌ Stream reading error:`, streamError.message);
        return {
          success: false,
          error: 'Failed to read file stream: ' + streamError.message
        };
      }
    } else {
      // Try to convert whatever it is to a buffer
      console.log(`⚠️ Unknown Body type: ${typeof result.Body}, attempting conversion...`);
      try {
        fileBuffer = Buffer.from(result.Body);
        console.log(`✅ Converted unknown type to Buffer (${fileBuffer.length} bytes)`);
      } catch (conversionError) {
        console.error(`❌ Failed to convert Body to Buffer:`, conversionError);
        return {
          success: false,
          error: 'Failed to convert S3 response to buffer'
        };
      }
    }

    // Validate buffer
    if (!fileBuffer || fileBuffer.length === 0) {
      console.log(`❌ File buffer is empty`);
      return {
        success: false,
        error: 'Downloaded file is empty'
      };
    }

    console.log(`✅ S3 download successful (${fileBuffer.length} bytes)`);

    return {
      success: true,
      fileBuffer: fileBuffer,
      contentType: result.ContentType,
      size: result.ContentLength
    };
  } catch (error) {
    console.error('❌ Download from user S3 error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Unknown S3 download error'
    };
  }
};

/**
 * Delete file from user's S3 bucket
 * @param {string} userId - User ID
 * @param {string} s3Key - S3 key
 * @returns {object} Delete result
 */
const deleteFromUserS3 = async (userId, s3Key) => {
  try {
    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId);
    if (!clientResult.success) {
      return {
        success: false,
        error: clientResult.error
      };
    }

    const { s3Client, bucketName } = clientResult;

    // Delete from S3
    const params = {
      Bucket: bucketName,
      Key: s3Key
    };

    await s3Client.deleteObject(params).promise();

    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('Delete from user S3 error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * List objects in user's S3 bucket folder
 * @param {string} userId - User ID
 * @param {string} prefix - S3 prefix (folder path)
 * @returns {object} List of objects or error
 */
const listUserS3Objects = async (userId, prefix = '') => {
  try {
    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId);
    if (!clientResult.success) {
      return {
        success: false,
        error: clientResult.error
      };
    }

    const { s3Client, bucketName } = clientResult;

    // List objects
    const params = {
      Bucket: bucketName,
      Prefix: prefix || `${userId}/`,
      Delimiter: '/'
    };

    const result = await s3Client.listObjectsV2(params).promise();

    return {
      success: true,
      objects: result.Contents || [],
      commonPrefixes: result.CommonPrefixes || [],
      isTruncated: result.IsTruncated
    };
  } catch (error) {
    console.error('List user S3 objects error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  getS3ClientForUser,
  getUserBucketConfig,
  isUserBucketConnected,
  generateUserS3Key,
  uploadToUserS3,
  downloadFromUserS3,
  deleteFromUserS3,
  listUserS3Objects
};
