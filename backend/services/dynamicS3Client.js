const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const UserCloudConfig = require('../models/UserCloudConfig');
const { decryptCredentials } = require('./credentialEncryption');

/**
 * Get S3 client for a specific user
 * Creates a dynamic S3 client using user's encrypted AWS credentials (AWS SDK v3)
 * @param {string} userId - User ID
 * @param {string} bucketId - Bucket ID (optional - uses first connected if not provided)
 * @returns {object} S3 client or error
 */
const getS3ClientForUser = async (userId, bucketId = null) => {
  try {
    console.log(`\n🔍 getS3ClientForUser called`);
    console.log(`   userId: ${userId}`);
    console.log(`   bucketId param: ${bucketId}`);
    
    if (!userId) {
      console.log(`❌ User ID is required`);
      return {
        success: false,
        error: 'User ID is required'
      };
    }

    // Fetch user's cloud config
    console.log(`📊 Fetching from UserCloudConfig...`);
    let cloudConfig;

    if (bucketId) {
      // Use specific bucket
      console.log(`   Query: { _id: ${bucketId}, userId: ${userId}, isConnected: true }`);
      cloudConfig = await UserCloudConfig.findOne({ 
        _id: bucketId,
        userId, 
        isConnected: true 
      });
      console.log(`   Result: ${cloudConfig ? cloudConfig.bucketName : 'NOT FOUND'}`);
    } else {
      // Use first connected bucket
      console.log(`   Query: { userId: ${userId}, isConnected: true } (FIRST)`);
      cloudConfig = await UserCloudConfig.findOne({ userId, isConnected: true });
      console.log(`   Result: ${cloudConfig ? cloudConfig.bucketName : 'NOT FOUND'}`);
    }

    if (!cloudConfig) {
      console.log(`❌ No AWS bucket connected for user: ${userId}`);
      return {
        success: false,
        error: 'No AWS bucket connected for this user'
      };
    }

    console.log(`✅ Using bucket: ${cloudConfig.bucketName} (ID: ${cloudConfig._id})`);

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

    // Create S3 client with user's credentials (AWS SDK v3)
    console.log(`🔧 Creating S3 client with decrypted credentials...`);
    const s3Client = new S3Client({
      credentials: {
        accessKeyId: decryptResult.accessKeyId,
        secretAccessKey: decryptResult.secretAccessKey,
      },
      region: cloudConfig.region,
      signatureVersion: 'v4'
    });

    console.log(`✅ S3 client created successfully for bucket: ${cloudConfig.bucketName}`);

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
 * Supports direct file uploads while maintaining folder structure
 * @param {string} userId - User ID
 * @param {string} fileName - File name
 * @param {string} folderId - Folder ID (optional)
 * @param {string} folderPath - Folder path/structure (optional, for preserving directory structure)
 * @returns {string} S3 key
 */
const generateUserS3Key = (userId, fileName, folderId = null, folderPath = '') => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const uniqueFileName = `${timestamp}-${randomStr}-${fileName}`;

  // If folderPath provided (from directory upload), use it
  if (folderPath && folderPath.trim()) {
    return `${userId}/${folderPath}/${uniqueFileName}`;
  }

  // Otherwise use folder structure
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
 * @param {string} bucketId - Bucket ID (optional - uses first connected if not provided)
 * @returns {object} Upload result
 */
const uploadToUserS3 = async (userId, fileBuffer, s3Key, contentType = 'application/octet-stream', bucketId = null) => {
  try {
    console.log(`☁️ uploadToUserS3 called for user: ${userId}, key: ${s3Key}, bucketId: ${bucketId}`);
    
    // Get S3 client for user (with optional bucket ID)
    const clientResult = await getS3ClientForUser(userId, bucketId);
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

    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);

    console.log(`✅ S3 upload successful:`, {
      Key: s3Key,
      ETag: result.ETag
    });

    return {
      success: true,
      s3Key: s3Key,
      etag: result.ETag
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
 * @param {string} bucketId - Bucket ID (optional - uses first connected if not provided)
 * @returns {object} File buffer or error
 */
const downloadFromUserS3 = async (userId, s3Key, bucketId = null) => {
  try {
    console.log(`📥 downloadFromUserS3 called for user: ${userId}, key: ${s3Key}, bucketId: ${bucketId}`);
    
    // Validate inputs
    if (!userId || !s3Key) {
      console.log(`❌ Invalid parameters: userId=${userId}, s3Key=${s3Key}`);
      return {
        success: false,
        error: 'User ID and S3 key are required'
      };
    }
    
    // Get S3 client for user
    const clientResult = await getS3ClientForUser(userId, bucketId);
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

    const command = new GetObjectCommand(params);
    const result = await s3Client.send(command);

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
 * @param {string} bucketId - Bucket ID (optional - uses first connected if not provided)
 * @returns {object} Delete result
 */
const deleteFromUserS3 = async (userId, s3Key, bucketId = null) => {
  try {
    // Get S3 client for user (with optional bucket ID)
    const clientResult = await getS3ClientForUser(userId, bucketId);
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

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);

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

    const command = new ListObjectsV2Command(params);
    const result = await s3Client.send(command);

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
