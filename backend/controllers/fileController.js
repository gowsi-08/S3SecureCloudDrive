const File = require('../models/File');
const Folder = require('../models/Folder');
const { encryptFile, decryptFile } = require('../utils/encryption');
const { uploadToUserS3, downloadFromUserS3, deleteFromUserS3, generateUserS3Key } = require('../services/dynamicS3Client');

// Helper functions
const validateFileContent = (buffer, mimetype) => {
  // Basic validation - you can enhance this
  return buffer && buffer.length > 0 && mimetype;
};

const sanitizeFilename = (filename) => {
  // Remove dangerous characters and limit length
  return filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 255);
};

const getFileCategory = (mimetype) => {
  if (!mimetype) return 'other';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('text/')) return 'text';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
  if (mimetype.includes('excel') || mimetype.includes('sheet')) return 'spreadsheet';
  return 'other';
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Upload single or multiple files
const uploadFiles = async (req, res) => {
  try {
    console.log('📤 ===== UPLOAD FILES REQUEST START =====');
    console.log('📤 Files received:', req.files ? req.files.length : 0);
    console.log('📤 Files array:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })) : 'NONE');
    console.log('📤 Body:', req.body);
    console.log('📤 User ID:', req.user?._id);
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ NO FILES PROVIDED - returning 400');
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const { folderId, password, isCustomPassword } = req.body;
    const userId = req.user._id;

    if (!password) {
      console.log('❌ NO PASSWORD PROVIDED - returning 400');
      return res.status(400).json({
        success: false,
        message: 'Password required for file encryption'
      });
    }

    // Determine if this is a custom password (stricter validation)
    const isCustom = isCustomPassword === 'true' || isCustomPassword === true;
    console.log(`📝 Password type: ${isCustom ? 'CUSTOM (12+ chars required)' : 'ACCOUNT (8+ chars required)'}`);

    // Validate folder if provided
    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, userId, isDeleted: false });
      if (!folder) {
        console.log('❌ FOLDER NOT FOUND - returning 404');
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
    }

    const uploadResults = [];
    const errors = [];

    // Process each file
    for (const file of req.files) {
      try {
        console.log(`\n📄 Processing file: ${file.originalname}`);
        
        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.originalname);
        console.log(`✅ Sanitized name: ${sanitizedName}`);
        
        // Validate file content
        if (!validateFileContent(file.buffer, file.mimetype)) {
          console.log(`❌ Invalid file content for ${file.originalname}`);
          errors.push({
            filename: file.originalname,
            error: 'Invalid file content'
          });
          continue;
        }

        // Check for duplicate filename in the same folder
        const existingFile = await File.findOne({
          userId,
          folderId: folderId || null,
          fileName: sanitizedName,
          isDeleted: false
        });

        let finalFileName = sanitizedName;
        if (existingFile) {
          // Generate unique filename
          const timestamp = Date.now();
          const ext = sanitizedName.substring(sanitizedName.lastIndexOf('.'));
          const nameWithoutExt = sanitizedName.substring(0, sanitizedName.lastIndexOf('.'));
          finalFileName = `${nameWithoutExt}_${timestamp}${ext}`;
          console.log(`⚠️ Duplicate found, using: ${finalFileName}`);
        }

        // Encrypt file
        console.log(`🔐 Encrypting file...`);
        const encryptionResult = encryptFile(file.buffer, password, null, !isCustom);
        
        if (!encryptionResult.success) {
          console.log(`❌ Encryption failed: ${encryptionResult.error}`);
          errors.push({
            filename: file.originalname,
            error: 'File encryption failed: ' + encryptionResult.error
          });
          continue;
        }
        console.log(`✅ Encryption successful`);

        // Generate S3 key using user's bucket structure
        const s3Key = generateUserS3Key(userId, finalFileName, folderId);
        console.log(`📍 S3 Key: ${s3Key}`);

        // Upload to user's S3 bucket
        console.log(`☁️ Uploading to S3...`);
        const uploadResult = await uploadToUserS3(
          userId,
          encryptionResult.encryptedBuffer,
          s3Key,
          'application/octet-stream'
        );

        if (!uploadResult.success) {
          console.log(`❌ S3 upload failed: ${uploadResult.error}`);
          errors.push({
            filename: file.originalname,
            error: 'Failed to upload to cloud storage: ' + uploadResult.error
          });
          continue;
        }
        console.log(`✅ S3 upload successful`);

        // Save file metadata to database
        console.log(`💾 Saving metadata to database...`);
        const fileDoc = new File({
          userId,
          fileName: finalFileName,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          s3Key,
          folderId: folderId || null,
          isEncrypted: true,
          encryptionIV: encryptionResult.iv
        });

        await fileDoc.save();
        console.log(`✅ Metadata saved, File ID: ${fileDoc._id}`);

        uploadResults.push({
          id: fileDoc._id,
          fileName: finalFileName,
          originalName: file.originalname,
          fileSize: formatFileSize(file.size),
          fileType: file.mimetype,
          category: getFileCategory(file.mimetype),
          uploadedAt: fileDoc.uploadedAt
        });

      } catch (error) {
        console.error(`❌ Error processing file ${file.originalname}:`, error);
        console.error(`Error stack:`, error.stack);
        errors.push({
          filename: file.originalname,
          error: error.message || 'Unknown processing error'
        });
      }
    }

    // Prepare response
    const totalFiles = req.files.length;
    const successCount = uploadResults.length;
    const errorCount = errors.length;

    console.log(`\n📊 UPLOAD SUMMARY:`);
    console.log(`Total: ${totalFiles}, Success: ${successCount}, Failed: ${errorCount}`);

    if (successCount === 0) {
      console.log(`❌ ALL FILES FAILED - returning 400`);
      console.log(`Errors:`, errors);
      return res.status(400).json({
        success: false,
        message: `All ${totalFiles} file(s) failed to upload`,
        data: {
          uploadedFiles: [],
          errors: errors
        }
      });
    }

    console.log(`✅ UPLOAD COMPLETE - returning 201`);
    res.status(201).json({
      success: true,
      message: errorCount === 0 
        ? `${successCount} file(s) uploaded successfully`
        : `${successCount} file(s) uploaded successfully, ${errorCount} failed`,
      data: {
        uploadedFiles: uploadResults,
        errors: errorCount > 0 ? errors : undefined,
        summary: {
          total: totalFiles,
          success: successCount,
          failed: errorCount
        }
      }
    });

  } catch (error) {
    console.error('❌ UPLOAD FILES ERROR:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during file upload: ' + error.message
    });
  }
};

// Get files in a folder
const getFiles = async (req, res) => {
  try {
    const { folderId } = req.query;
    const userId = req.user._id;

    // Validate folder if provided
    if (folderId && folderId !== 'null') {
      const folder = await Folder.findOne({ _id: folderId, userId, isDeleted: false });
      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
    }

    const files = await File.find({
      userId,
      folderId: folderId && folderId !== 'null' ? folderId : null,
      isDeleted: false
    }).sort({ uploadedAt: -1 });

    const formattedFiles = files.map(file => ({
      id: file._id,
      fileName: file.fileName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: formatFileSize(file.fileSize),
      fileSizeBytes: file.fileSize,
      category: getFileCategory(file.fileType),
      uploadedAt: file.uploadedAt,
      lastAccessed: file.lastAccessed,
      downloadCount: file.downloadCount
    }));

    res.json({
      success: true,
      data: {
        files: formattedFiles,
        totalFiles: formattedFiles.length
      }
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching files'
    });
  }
};

// Download/preview file
const downloadFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { password, preview = false } = req.body;
    const userId = req.user._id;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password required for file decryption'
      });
    }

    // Find file
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Download from user's S3 bucket
    let downloadBuffer;
    try {
      const downloadResult = await downloadFromUserS3(userId, file.s3Key);
      if (!downloadResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to download file from storage: ' + downloadResult.error
        });
      }
      downloadBuffer = downloadResult.buffer;
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to download file from storage: ' + error.message
      });
    }

    // Decrypt file
    const decryptionResult = decryptFile(downloadBuffer, password);
    
    if (!decryptionResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Failed to decrypt file. Please check your password and try again.'
      });
    }

    // Update access statistics
    if (file.updateLastAccessed) {
      await file.updateLastAccessed();
    }

    // Set response headers
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Length', decryptionResult.decryptedBuffer.length);
    
    if (!preview) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    }

    // Send decrypted file
    res.send(decryptionResult.decryptedBuffer);

  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error downloading file'
    });
  }
};

// Delete file
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Find file
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete from user's S3 bucket
    const deleteResult = await deleteFromUserS3(userId, file.s3Key);
    if (!deleteResult.success) {
      console.error('Failed to delete from S3:', deleteResult.error);
    }

    // Mark as deleted in database
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting file'
    });
  }
};

// Rename file
const renameFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { newName } = req.body;
    const userId = req.user._id;

    if (!newName || newName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'New filename is required'
      });
    }

    // Find file
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Sanitize new filename
    const sanitizedName = sanitizeFilename(newName);

    // Check for duplicate filename in the same folder
    const existingFile = await File.findOne({
      userId,
      folderId: file.folderId,
      fileName: sanitizedName,
      isDeleted: false,
      _id: { $ne: fileId }
    });

    if (existingFile) {
      return res.status(400).json({
        success: false,
        message: 'A file with this name already exists in the folder'
      });
    }

    // Update filename
    file.fileName = sanitizedName;
    await file.save();

    res.json({
      success: true,
      message: 'File renamed successfully',
      data: {
        id: file._id,
        fileName: file.fileName,
        originalName: file.originalName
      }
    });

  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error renaming file'
    });
  }
};

// Get file details
const getFileDetails = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    // Find file
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false })
      .populate('folderId', 'folderName path');

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: file._id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileType: file.fileType,
        fileSize: formatFileSize(file.fileSize),
        fileSizeBytes: file.fileSize,
        category: getFileCategory(file.fileType),
        folder: file.folderId ? {
          id: file.folderId._id,
          name: file.folderId.folderName,
          path: file.folderId.path
        } : null,
        uploadedAt: file.uploadedAt,
        lastAccessed: file.lastAccessed,
        downloadCount: file.downloadCount,
        isEncrypted: file.isEncrypted
      }
    });

  } catch (error) {
    console.error('Get file details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching file details'
    });
  }
};

// Search files
const searchFiles = async (req, res) => {
  try {
    const { query, fileType, folderId } = req.query;
    const userId = req.user._id;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Build search criteria
    const searchCriteria = {
      userId,
      isDeleted: false,
      $or: [
        { fileName: { $regex: query, $options: 'i' } },
        { originalName: { $regex: query, $options: 'i' } }
      ]
    };

    if (fileType) {
      searchCriteria.fileType = { $regex: fileType, $options: 'i' };
    }

    if (folderId && folderId !== 'null') {
      searchCriteria.folderId = folderId;
    }

    const files = await File.find(searchCriteria)
      .populate('folderId', 'folderName path')
      .sort({ uploadedAt: -1 })
      .limit(50);

    const formattedFiles = files.map(file => ({
      id: file._id,
      fileName: file.fileName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: formatFileSize(file.fileSize),
      fileSizeBytes: file.fileSize,
      category: getFileCategory(file.fileType),
      folder: file.folderId ? {
        id: file.folderId._id,
        name: file.folderId.folderName,
        path: file.folderId.path
      } : null,
      uploadedAt: file.uploadedAt,
      lastAccessed: file.lastAccessed
    }));

    res.json({
      success: true,
      data: {
        files: formattedFiles,
        totalResults: formattedFiles.length,
        query
      }
    });

  } catch (error) {
    console.error('Search files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error searching files'
    });
  }
};

module.exports = {
  uploadFiles,
  getFiles,
  downloadFile,
  deleteFile,
  renameFile,
  getFileDetails,
  searchFiles
};