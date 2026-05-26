const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Local storage directory
const STORAGE_DIR = path.join(__dirname, '..', 'local-storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  console.log('📁 Created local storage directory:', STORAGE_DIR);
}

/**
 * Upload encrypted file to local storage
 * @param {Buffer} fileBuffer - Encrypted file buffer
 * @param {string} fileKey - File key/path
 * @param {string} contentType - File content type
 * @returns {Promise<Object>} - Upload result
 */
const uploadToLocal = async (fileBuffer, fileKey, contentType) => {
  try {
    const filePath = path.join(STORAGE_DIR, fileKey);
    const fileDir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filePath, fileBuffer);
    
    // Create metadata file
    const metadataPath = filePath + '.meta';
    const metadata = {
      contentType,
      uploadedAt: new Date().toISOString(),
      encrypted: true,
      size: fileBuffer.length
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    return {
      success: true,
      location: filePath,
      key: fileKey,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('Local storage upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Download file from local storage
 * @param {string} fileKey - File key/path
 * @returns {Promise<Object>} - Download result with file buffer
 */
const downloadFromLocal = async (fileKey) => {
  try {
    const filePath = path.join(STORAGE_DIR, fileKey);
    const metadataPath = filePath + '.meta';
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    
    const buffer = fs.readFileSync(filePath);
    
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    return {
      success: true,
      buffer: buffer,
      contentType: metadata.contentType || 'application/octet-stream',
      metadata: metadata
    };
  } catch (error) {
    console.error('Local storage download error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete file from local storage
 * @param {string} fileKey - File key/path
 * @returns {Promise<Object>} - Delete result
 */
const deleteFromLocal = async (fileKey) => {
  try {
    const filePath = path.join(STORAGE_DIR, fileKey);
    const metadataPath = filePath + '.meta';
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('Local storage delete error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if file exists in local storage
 * @param {string} fileKey - File key/path
 * @returns {Promise<Object>} - Existence check result
 */
const fileExistsInLocal = async (fileKey) => {
  try {
    const filePath = path.join(STORAGE_DIR, fileKey);
    const exists = fs.existsSync(filePath);
    
    return {
      success: true,
      exists: exists
    };
  } catch (error) {
    console.error('Local storage file existence check error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate unique file key for local storage
 * @param {string} userId - User ID
 * @param {string} folderId - Folder ID (optional)
 * @param {string} fileName - Original file name
 * @returns {string} - Unique file key
 */
const generateLocalKey = (userId, folderId, fileName) => {
  const timestamp = Date.now();
  const uuid = uuidv4();
  const folderPath = folderId || 'root';
  
  // Clean filename to remove invalid characters
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  return `${userId}/${folderPath}/${timestamp}-${uuid}-${cleanFileName}`;
};

module.exports = {
  uploadToLocal,
  downloadFromLocal,
  deleteFromLocal,
  fileExistsInLocal,
  generateLocalKey,
  STORAGE_DIR
};