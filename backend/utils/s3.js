const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// Configure S3 Client (AWS SDK v3)
const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION
});

// Upload file to S3
const uploadToS3 = async (buffer, key, contentType) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256'
    };

    const command = new PutObjectCommand(params);
    const result = await s3Client.send(command);
    
    return {
      success: true,
      location: `s3://${process.env.AWS_S3_BUCKET}/${key}`,
      key: key,
      etag: result.ETag
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Download file from S3
const downloadFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    const command = new GetObjectCommand(params);
    const result = await s3Client.send(command);
    
    // Convert Body stream to Buffer
    if (result.Body) {
      if (Buffer.isBuffer(result.Body)) {
        return result.Body;
      }
      
      const chunks = [];
      for await (const chunk of result.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    
    throw new Error('Empty S3 response body');
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

// Delete file from S3
const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('S3 delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate S3 key for file
const generateS3Key = (userId, fileName, folderId = null) => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const folderPath = folderId ? folderId : 'root';
  return `${userId}/${folderPath}/${timestamp}-${random}-${fileName}`;
};

// Get signed URL for temporary access
const getSignedUrlForS3 = async (key, expires = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expires
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3Client, command, { expiresIn: expires });
    return url;
  } catch (error) {
    console.error('Signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

// Validate S3 configuration
const validateS3Config = async () => {
  try {
    // Test bucket access
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      MaxKeys: 1
    };

    const command = new ListObjectsV2Command(params);
    await s3Client.send(command);
    
    return {
      success: true,
      message: 'S3 configuration is valid',
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION
    };
  } catch (error) {
    console.error('S3 validation error:', error);
    return {
      success: false,
      error: error.message,
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION
    };
  }
};

// List files in bucket (for debugging)
const listFiles = async (prefix = '') => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 100
    };

    const command = new ListObjectsV2Command(params);
    const result = await s3Client.send(command);
    
    return {
      success: true,
      files: result.Contents || [],
      count: result.KeyCount || 0
    };
  } catch (error) {
    console.error('S3 list error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  uploadToS3,
  downloadFromS3,
  deleteFromS3,
  generateS3Key,
  getSignedUrlForS3,
  validateS3Config,
  listFiles
};