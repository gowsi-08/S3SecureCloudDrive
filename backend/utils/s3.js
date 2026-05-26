const AWS = require('aws-sdk');
const crypto = require('crypto');

// Configure AWS SDK with your credentials
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

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

    const result = await s3.upload(params).promise();
    return {
      success: true,
      location: result.Location,
      key: result.Key,
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

    const result = await s3.getObject(params).promise();
    return result.Body;
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

    await s3.deleteObject(params).promise();
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
const getSignedUrl = (key, expires = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expires
    };

    return s3.getSignedUrl('getObject', params);
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

    await s3.listObjectsV2(params).promise();
    
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

    const result = await s3.listObjectsV2(params).promise();
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
  getSignedUrl,
  validateS3Config,
  listFiles
};