const File = require('../models/File');
const Folder = require('../models/Folder');
const User = require('../models/User');
const UserCloudConfig = require('../models/UserCloudConfig');
const { 
  encryptFile, 
  decryptFile, 
  verifyAccountPassword, 
  hashCustomPassword,
  clearPasswordFromMemory,
  validateEncryption,
  createEncryptionMetadata,
  validatePassword
} = require('../utils/encryption');
const { uploadToUserS3, downloadFromUserS3, deleteFromUserS3, generateUserS3Key } = require('../services/dynamicS3Client');
const { validateFileContent, sanitizeFilename, getFileCategory, formatFileSize } = require('../middleware/upload');
const bcrypt = require('bcryptjs');

/**
 * Verify account password for encryption
 */
const verifyAccountPasswordForEncryption = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user._id;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Get user from database to access hashed password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password against stored bcrypt hash
    const isPasswordValid = await verifyAccountPassword(password, user.password);
    
    if (!isPasswordValid) {
      // Clear password from memory
      clearPasswordFromMemory(password);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid account password'
      });
    }

    // Password is valid - return success (don't return the password)
    clearPasswordFromMemory(password);
    
    res.json({
      success: true,
      message: 'Account password verified successfully'
    });

  } catch (error) {
    console.error('Account password verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password verification'
    });
  }
};

/**
 * Upload files with secure encryption
 */
const uploadFilesSecure = async (req, res) => {
  try {
    console.log('Secure file upload request:', {
      userId: req.user._id,
      filesCount: req.files?.length || 0,
      folderId: req.body.folderId,
      encryptionType: req.body.encryptionType
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const { folderId, encryptionType, password } = req.body;
    const userId = req.user._id;

    // Validate encryption type
    if (!encryptionType || !['account', 'custom'].includes(encryptionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid encryption type. Must be "account" or "custom"'
      });
    }

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for file encryption'
      });
    }

    let encryptionPassword = password;
    let customPasswordHash = null;

    // Handle account password verification
    if (encryptionType === 'account') {
      // Get user from database to verify password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        clearPasswordFromMemory(password);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify account password
      const isPasswordValid = await verifyAccountPassword(password, user.password);
      if (!isPasswordValid) {
        clearPasswordFromMemory(password);
        return res.status(401).json({
          success: false,
          message: 'Invalid account password'
        });
      }

      console.log('Account password verified for encryption');
    } else if (encryptionType === 'custom') {
      // Validate custom password strength
      const passwordValidation = validatePassword(password, true); // true for custom password
      if (!passwordValidation.isValid) {
        clearPasswordFromMemory(password);
        return res.status(400).json({
          success: false,
          message: 'Custom password validation failed: ' + passwordValidation.errors.join(', ')
        });
      }

      // Optionally create hash of custom password for future verification
      try {
        customPasswordHash = await hashCustomPassword(password);
        console.log('Custom password hash created for optional storage');
      } catch (error) {
        console.error('Failed to hash custom password:', error);
        // Continue without hash - not critical for encryption
      }
    }

    // Validate folder if provided
    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, userId, isDeleted: false });
      if (!folder) {
        clearPasswordFromMemory(password);
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
        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.originalname);
        
        // Validate file content
        if (!validateFileContent(file.buffer, file.mimetype)) {
          errors.push({
            filename: file.originalname,
            error: 'Invalid file content or potentially malicious file'
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
        }

        // Encrypt file with user's password
        console.log('Encrypting file:', finalFileName, 'with', encryptionType, 'password');
        const skipValidation = encryptionType === 'account'; // Skip validation for account passwords
        const encryptionResult = encryptFile(file.buffer, encryptionPassword, null, skipValidation);
        
        if (!encryptionResult.success) {
          errors.push({
            filename: file.originalname,
            error: 'File encryption failed: ' + encryptionResult.error
          });
          continue;
        }

        // Validate encryption was successful
        const encryptionValidation = validateEncryption(encryptionResult.encryptedBuffer);
        if (!encryptionValidation.isValid) {
          errors.push({
            filename: file.originalname,
            error: 'Encryption validation failed: ' + encryptionValidation.error
          });
          continue;
        }

        // Generate S3 key for user's bucket
        const s3Key = generateUserS3Key(userId, finalFileName, folderId);

        // Upload encrypted file to user's S3 bucket
        console.log('Uploading encrypted file to user S3 bucket:', s3Key);
        const uploadResult = await uploadToUserS3(
          userId,
          encryptionResult.encryptedBuffer,
          s3Key,
          'application/octet-stream' // Store as binary since it's encrypted
        );

        if (!uploadResult.success) {
          errors.push({
            filename: file.originalname,
            error: 'Failed to upload to cloud storage: ' + uploadResult.error
          });
          continue;
        }

        // Create encryption metadata
        const encryptionMetadata = createEncryptionMetadata(userId, finalFileName, encryptionType);

        // Save file metadata to database
        const fileDoc = new File({
          userId,
          fileName: finalFileName,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          s3Key,
          folderId: folderId || null,
          isEncrypted: true,
          encryptionType: encryptionType,
          encryptionVersion: encryptionMetadata.version,
          encryptionAlgorithm: encryptionMetadata.algorithm,
          customPasswordHash: encryptionType === 'custom' ? customPasswordHash : null,
          encryptionIV: encryptionResult.iv
        });

        await fileDoc.save();

        uploadResults.push({
          id: fileDoc._id,
          fileName: finalFileName,
          originalName: file.originalname,
          fileSize: formatFileSize(file.size),
          fileType: file.mimetype,
          category: getFileCategory(file.mimetype),
          encryptionType: encryptionType,
          uploadedAt: fileDoc.uploadedAt
        });

        console.log('File uploaded and encrypted successfully:', finalFileName);

      } catch (error) {
        console.error('Error processing file:', file.originalname, error);
        errors.push({
          filename: file.originalname,
          error: error.message || 'Unknown processing error'
        });
      }
    }

    // Clear password from memory after processing all files
    clearPasswordFromMemory(encryptionPassword);

    // Prepare response
    const totalFiles = req.files.length;
    const successCount = uploadResults.length;
    const errorCount = errors.length;

    if (successCount === 0) {
      // All files failed
      return res.status(400).json({
        success: false,
        message: `All ${totalFiles} file(s) failed to upload`,
        data: {
          uploadedFiles: [],
          errors: errors
        }
      });
    }

    // Some or all files succeeded
    res.status(201).json({
      success: true,
      message: errorCount === 0 
        ? `${successCount} file(s) encrypted and uploaded successfully`
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
    console.error('Secure upload files error:', error);
    
    // Clear any passwords from memory in case of error
    if (req.body.password) {
      clearPasswordFromMemory(req.body.password);
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during secure file upload: ' + error.message
    });
  }
};

/**
 * Download/preview file with secure decryption
 */
const downloadFileSecure = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { encryptionType, password, preview = false } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!encryptionType || !['account', 'custom'].includes(encryptionType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid encryption type. Must be "account" or "custom"'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for file decryption'
      });
    }

    // Find file
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
    if (!file) {
      clearPasswordFromMemory(password);
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    let decryptionPassword = password;

    // Handle account password verification
    if (encryptionType === 'account') {
      // Get user from database to verify password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        clearPasswordFromMemory(password);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Verify account password
      const isPasswordValid = await verifyAccountPassword(password, user.password);
      if (!isPasswordValid) {
        clearPasswordFromMemory(password);
        return res.status(401).json({
          success: false,
          message: 'Invalid account password'
        });
      }
    } else if (encryptionType === 'custom') {
      // For custom passwords, we can optionally verify against stored hash
      if (file.customPasswordHash) {
        const isPasswordValid = await bcrypt.compare(password, file.customPasswordHash);
        if (!isPasswordValid) {
          clearPasswordFromMemory(password);
          return res.status(401).json({
            success: false,
            message: 'Invalid custom password'
          });
        }
      }
    }

    // Download encrypted file from user's S3 bucket
    let downloadResult;
    try {
      const encryptedBuffer = await downloadFromUserS3(userId, file.s3Key);
      downloadResult = {
        success: true,
        buffer: encryptedBuffer
      };
    } catch (error) {
      clearPasswordFromMemory(password);
      return res.status(500).json({
        success: false,
        message: 'Failed to download file from your storage: ' + error.message
      });
    }

    // Decrypt file with provided password
    const decryptionResult = decryptFile(downloadResult.buffer, decryptionPassword);
    
    // Clear password from memory after decryption attempt
    clearPasswordFromMemory(decryptionPassword);

    if (!decryptionResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Decryption failed: ' + decryptionResult.error
      });
    }

    // Update access statistics
    await file.updateLastAccessed();

    // Set response headers
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Length', decryptionResult.decryptedBuffer.length);
    
    if (!preview) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    }

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Send decrypted file
    res.send(decryptionResult.decryptedBuffer);

  } catch (error) {
    console.error('Secure download error:', error);
    
    // Clear any passwords from memory in case of error
    if (req.body.password) {
      clearPasswordFromMemory(req.body.password);
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during secure file download: ' + error.message
    });
  }
};

module.exports = {
  verifyAccountPasswordForEncryption,
  uploadFilesSecure,
  downloadFileSecure
};