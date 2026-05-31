const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const SharedFile = require('../models/SharedFile');
const File = require('../models/File');
const User = require('../models/User');
const { downloadFromUserS3 } = require('../services/dynamicS3Client');
const { decryptFile } = require('../utils/encryption');

// Constants
const SHARE_PASSWORD_MIN_LENGTH = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Create share link (new endpoint for frontend)
 * POST /api/shared-files/create
 */
const createShareLink = async (req, res) => {
  try {
    console.log('📤 ===== CREATE SHARE LINK REQUEST START =====');
    
    const { fileId, sharePassword, expirationOption, maxDownloads, allowPreview, allowDownload } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!fileId || !sharePassword) {
      return res.status(400).json({
        success: false,
        message: 'File ID and share password are required'
      });
    }

    // Validate share password (minimum 8 characters)
    if (sharePassword.length < SHARE_PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: 'Share password must be at least 8 characters long'
      });
    }

    // Verify file exists and belongs to user
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false }).select('+encryptionPassword');
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Get the file's encryption password
    const fileEncryptionPassword = file.encryptionPassword;
    if (!fileEncryptionPassword) {
      return res.status(400).json({
        success: false,
        message: 'File encryption password not found. Please re-upload the file.'
      });
    }

    // Calculate expiration date
    let expiresAt = null;
    if (expirationOption && expirationOption !== 'never') {
      const now = new Date();
      switch (expirationOption) {
        case '1hour':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '24hours':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7days':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          expiresAt = null;
      }
    }

    // Hash the share password using bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedSharePassword = await bcrypt.hash(sharePassword, salt);

    // Generate secure share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    // Create shared file record
    const sharedFile = new SharedFile({
      fileId,
      ownerUserId: userId,
      shareToken,
      hashedSharePassword,
      fileEncryptionPassword: fileEncryptionPassword,
      expiresAt,
      maxDownloads: maxDownloads || null,
      allowPreview: allowPreview !== false,
      allowDownload: allowDownload !== false,
      isActive: true
    });

    await sharedFile.save();

    console.log(`✅ Share link created successfully for file: ${file.fileName}`);

    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareToken}`;

    res.status(201).json({
      success: true,
      message: 'Share link created successfully',
      data: {
        shareToken,
        shareUrl,
        expiresAt,
        maxDownloads,
        allowPreview,
        allowDownload,
        createdAt: sharedFile.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Create share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create share link',
      error: error.message
    });
  }
};

/**
 * Generate secure share link
 * POST /api/shared-files/generate
 */
const generateShareLink = async (req, res) => {
  try {
    console.log('📤 ===== GENERATE SHARE LINK REQUEST START =====');
    
    const { fileId, sharePassword, confirmPassword, expiresIn, maxDownloads, allowPreview, allowDownload } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!fileId) {
      return res.status(400).json({
        success: false,
        message: 'File ID is required'
      });
    }
    
    if (!sharePassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Share password and confirmation are required'
      });
    }
    
    // Validate password length
    if (sharePassword.length < SHARE_PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Share password must be at least ${SHARE_PASSWORD_MIN_LENGTH} characters`
      });
    }
    
    // Validate passwords match
    if (sharePassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }
    
    // Check if file exists and belongs to user
    const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Check if share already exists for this file
    const existingShare = await SharedFile.findOne({ fileId, ownerUserId: userId, isActive: true });
    if (existingShare) {
      return res.status(400).json({
        success: false,
        message: 'This file is already shared. Deactivate the existing share first.'
      });
    }
    
    // Hash the share password
    console.log('🔐 Hashing share password...');
    const hashedPassword = await bcrypt.hash(sharePassword, 12);
    
    // Calculate expiration date
    let expiresAt = null;
    if (expiresIn) {
      const expirationMap = {
        '1h': 1 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        'custom': null
      };
      
      const expirationMs = expirationMap[expiresIn];
      if (expirationMs) {
        expiresAt = new Date(Date.now() + expirationMs);
      }
    }
    
    // Validate maxDownloads
    if (maxDownloads && (maxDownloads < 1 || !Number.isInteger(maxDownloads))) {
      return res.status(400).json({
        success: false,
        message: 'Max downloads must be a positive integer'
      });
    }
    
    // Create shared file record
    console.log('💾 Creating shared file record...');
    const sharedFile = new SharedFile({
      fileId,
      ownerUserId: userId,
      hashedSharePassword: hashedPassword,
      expiresAt,
      maxDownloads: maxDownloads || null,
      allowPreview: allowPreview !== false,
      allowDownload: allowDownload !== false,
      isActive: true
    });
    
    await sharedFile.save();
    
    console.log('✅ Share link generated successfully');
    
    // Generate share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${sharedFile.shareToken}`;
    
    res.status(201).json({
      success: true,
      message: 'Share link generated successfully',
      data: {
        shareToken: sharedFile.shareToken,
        shareUrl,
        expiresAt: sharedFile.expiresAt,
        maxDownloads: sharedFile.maxDownloads,
        allowPreview: sharedFile.allowPreview,
        allowDownload: sharedFile.allowDownload,
        createdAt: sharedFile.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Generate share link error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate share link',
      error: error.message
    });
  }
};

/**
 * Get share link details (without password verification)
 * GET /api/shared-files/:shareToken/details
 */
const getShareDetails = async (req, res) => {
  try {
    console.log('📖 ===== GET SHARE DETAILS REQUEST START =====');
    
    const { shareToken } = req.params;
    
    if (!shareToken) {
      return res.status(400).json({
        success: false,
        message: 'Share token is required'
      });
    }
    
    // Find shared file
    const sharedFile = await SharedFile.findOne({ shareToken })
      .populate('fileId', 'fileName fileSize fileType originalName')
      .populate('ownerUserId', 'name email');
    
    if (!sharedFile) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found'
      });
    }
    
    // Check if share is active
    if (!sharedFile.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This share link is no longer active'
      });
    }
    
    // Check if share is expired
    if (sharedFile.isExpired) {
      return res.status(410).json({
        success: false,
        message: 'This share link has expired'
      });
    }
    
    // Check if download limit reached
    if (sharedFile.downloadLimitReached) {
      return res.status(410).json({
        success: false,
        message: 'Download limit has been reached for this share'
      });
    }
    
    console.log('✅ Share details retrieved successfully');
    
    res.status(200).json({
      success: true,
      data: {
        shareToken: sharedFile.shareToken,
        file: {
          name: sharedFile.fileId.fileName,
          originalName: sharedFile.fileId.originalName,
          size: sharedFile.fileId.fileSize,
          type: sharedFile.fileId.fileType
        },
        owner: {
          name: sharedFile.ownerUserId.name
        },
        settings: {
          allowPreview: sharedFile.allowPreview,
          allowDownload: sharedFile.allowDownload,
          expiresAt: sharedFile.expiresAt,
          maxDownloads: sharedFile.maxDownloads,
          currentDownloads: sharedFile.currentDownloads
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get share details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve share details',
      error: error.message
    });
  }
};

/**
 * Verify share password
 * POST /api/shared-files/:shareToken/verify-password
 */
const verifySharePassword = async (req, res) => {
  try {
    console.log('🔐 ===== VERIFY SHARE PASSWORD REQUEST START =====');
    
    const { shareToken } = req.params;
    const { password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    
    if (!shareToken || !password) {
      return res.status(400).json({
        success: false,
        message: 'Share token and password are required'
      });
    }
    
    // Find shared file with password hash
    const sharedFile = await SharedFile.findOne({ shareToken }).select('+hashedSharePassword');
    
    if (!sharedFile) {
      return res.status(404).json({
        success: false,
        message: 'Share link not found'
      });
    }
    
    // Check if share is active
    if (!sharedFile.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This share link is no longer active'
      });
    }
    
    // Check if share is expired
    if (sharedFile.isExpired) {
      return res.status(410).json({
        success: false,
        message: 'This share link has expired'
      });
    }
    
    // Check if download limit reached
    if (sharedFile.downloadLimitReached) {
      return res.status(410).json({
        success: false,
        message: 'Download limit has been reached for this share'
      });
    }
    
    // Check if locked due to failed attempts
    if (sharedFile.isLockedDueToFailedAttempts()) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please try again later.'
      });
    }
    
    // Verify password
    console.log('🔍 Comparing passwords...');
    const isPasswordValid = await bcrypt.compare(password, sharedFile.hashedSharePassword);
    
    if (!isPasswordValid) {
      console.log('❌ Password verification failed');
      
      // Record failed attempt
      await sharedFile.recordFailedAttempt();
      
      const remainingAttempts = MAX_FAILED_ATTEMPTS - sharedFile.failedPasswordAttempts;
      
      return res.status(401).json({
        success: false,
        message: 'Invalid share password',
        attemptsRemaining: remainingAttempts > 0 ? remainingAttempts : 0
      });
    }
    
    console.log('✅ Password verified successfully');
    
    // Reset failed attempts on successful verification
    await sharedFile.resetFailedAttempts();
    
    // Record access
    await sharedFile.recordAccess(clientIp, userAgent, 'password_attempt');
    
    res.status(200).json({
      success: true,
      message: 'Password verified successfully',
      data: {
        shareToken: sharedFile.shareToken,
        accessToken: crypto.randomBytes(32).toString('hex'),
        expiresIn: 3600
      }
    });
    
  } catch (error) {
    console.error('❌ Verify share password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify password',
      error: error.message
    });
  }
};

/**
 * Download shared file - PRODUCTION GRADE SECURE DOWNLOAD
 * POST /api/shared-files/:shareToken/download
 */
const downloadSharedFile = async (req, res) => {
  let decryptedBuffer = null;
  
  try {
    console.log('📥 ===== DOWNLOAD SHARED FILE REQUEST START =====');
    
    const { shareToken } = req.params;
    const { password, preview } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    
    // STEP 1: Verify share access (no auth required for shared files)
    console.log('🔐 STEP 1: Verifying share access...');
    if (!shareToken || !password) {
      return res.status(400).json({
        success: false,
        message: 'Share token and password are required'
      });
    }
    console.log('✅ Share token and password provided');

    // STEP 2: Verify valid share token
    console.log('🔐 STEP 2: Verifying share token...');
    const sharedFile = await SharedFile.findOne({ shareToken })
      .select('+hashedSharePassword +fileEncryptionPassword')
      .populate({
        path: 'fileId',
        select: 's3Key fileType originalName +encryptionPassword'
      })
      .populate('ownerUserId', '_id');
    
    if (!sharedFile) {
      console.log('❌ Share link not found');
      return res.status(404).json({
        success: false,
        message: 'Share link not found'
      });
    }
    console.log('✅ Share token verified');

    // STEP 3: Verify share is active
    console.log('🔐 STEP 3: Verifying share is active...');
    if (!sharedFile.isActive) {
      console.log('❌ Share link is no longer active');
      return res.status(403).json({
        success: false,
        message: 'This share link is no longer active'
      });
    }
    console.log('✅ Share is active');

    // STEP 4: Check if share is expired
    console.log('🔐 STEP 4: Checking expiration...');
    if (sharedFile.isExpired) {
      console.log('❌ Share link has expired');
      return res.status(410).json({
        success: false,
        message: 'This share link has expired'
      });
    }
    console.log('✅ Share is not expired');

    // STEP 5: Check download limit
    console.log('🔐 STEP 5: Checking download limit...');
    if (sharedFile.downloadLimitReached) {
      console.log('❌ Download limit reached');
      return res.status(410).json({
        success: false,
        message: 'Download limit has been reached for this share'
      });
    }
    console.log('✅ Download limit not reached');

    // STEP 6: Check permissions
    console.log('🔐 STEP 6: Checking permissions...');
    if (preview && !sharedFile.allowPreview) {
      console.log('❌ Preview not allowed');
      return res.status(403).json({
        success: false,
        message: 'Preview is not allowed for this share'
      });
    }
    
    if (!preview && !sharedFile.allowDownload) {
      console.log('❌ Download not allowed');
      return res.status(403).json({
        success: false,
        message: 'Download is not allowed for this share'
      });
    }
    console.log('✅ Permissions verified');

    // STEP 7: Check if locked due to failed attempts
    console.log('🔐 STEP 7: Checking brute force protection...');
    if (sharedFile.isLockedDueToFailedAttempts()) {
      console.log('❌ Share is locked due to failed attempts');
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please try again later.'
      });
    }
    console.log('✅ Not locked');

    // STEP 8: Verify share password
    console.log('🔐 STEP 8: Verifying share password...');
    const isPasswordValid = await bcrypt.compare(password, sharedFile.hashedSharePassword);
    
    if (!isPasswordValid) {
      console.log('❌ Password verification failed');
      await sharedFile.recordFailedAttempt();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid share password'
      });
    }
    console.log('✅ Password verified successfully');

    // Reset failed attempts on successful verification
    await sharedFile.resetFailedAttempts();

    // STEP 9: Retrieve encrypted file from S3
    console.log('📥 STEP 9: Retrieving encrypted file from AWS S3...');
    
    // Verify fileId is populated
    if (!sharedFile.fileId) {
      console.log('❌ File not found in share');
      return res.status(404).json({
        success: false,
        message: 'File associated with this share not found'
      });
    }
    
    if (!sharedFile.fileId.s3Key) {
      console.log('❌ S3 key not found for file');
      return res.status(500).json({
        success: false,
        message: 'File storage key not found'
      });
    }
    
    let s3Result;
    try {
      s3Result = await downloadFromUserS3(sharedFile.ownerUserId._id, sharedFile.fileId.s3Key);
      
      console.log('📥 S3 Result:', {
        success: s3Result?.success,
        hasBuffer: !!s3Result?.fileBuffer,
        bufferLength: s3Result?.fileBuffer?.length,
        error: s3Result?.error
      });
      
      if (!s3Result || !s3Result.success) {
        console.log('❌ S3 download failed:', s3Result?.error || 'Unknown error');
        return res.status(500).json({
          success: false,
          message: 'Failed to download file from storage: ' + (s3Result?.error || 'Unknown error')
        });
      }
      
      if (!s3Result.fileBuffer) {
        console.log('❌ S3 returned success but no file buffer');
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve file from storage: Empty file buffer'
        });
      }
      
      console.log(`✅ File retrieved from S3 (${s3Result.fileBuffer.length} bytes)`);
    } catch (error) {
      console.log('❌ S3 download error:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(500).json({
        success: false,
        message: 'Failed to download file from storage: ' + error.message
      });
    }

    // STEP 10: Get file's encryption password
    console.log('🔓 STEP 10: Retrieving file encryption password...');
    let fileEncryptionPassword = sharedFile.fileEncryptionPassword;
    
    // Fallback: If not stored in SharedFile, try to get from File model
    if (!fileEncryptionPassword) {
      console.log('⚠️ Encryption password not in SharedFile, checking File model...');
      const fileRecord = await File.findById(sharedFile.fileId).select('+encryptionPassword');
      fileEncryptionPassword = fileRecord?.encryptionPassword;
      
      if (fileEncryptionPassword) {
        console.log('✅ Found encryption password in File model, storing in SharedFile for future use...');
        // Store it for future use
        sharedFile.fileEncryptionPassword = fileEncryptionPassword;
        await sharedFile.save().catch(err => console.log('⚠️ Failed to update SharedFile:', err.message));
      }
    }
    
    if (!fileEncryptionPassword) {
      console.log('❌ File encryption password not found anywhere');
      return res.status(500).json({
        success: false,
        message: 'Unable to decrypt file - encryption password not available. Please contact the file owner.'
      });
    }
    console.log('✅ File encryption password retrieved');

    // STEP 11: Decrypt file temporarily in backend memory
    console.log('🔓 STEP 11: Decrypting file in memory...');
    const decryptResult = decryptFile(s3Result.fileBuffer, fileEncryptionPassword);
    
    if (!decryptResult.success) {
      console.log('❌ Decryption failed:', decryptResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt file: ' + decryptResult.error
      });
    }
    
    decryptedBuffer = decryptResult.decryptedBuffer;
    console.log(`✅ File decrypted successfully (${decryptedBuffer.length} bytes)`);

    // STEP 12: Stream decrypted file securely to browser
    console.log('📤 STEP 12: Streaming file to browser...');
    
    // Set secure response headers
    res.setHeader('Content-Type', sharedFile.fileId.fileType || 'application/octet-stream');
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    
    // STEP 13: Set correct filename and extension
    const sanitizedFilename = sharedFile.fileId.originalName.replace(/"/g, '\\"');
    if (!preview) {
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    }

    // Record access and increment download count using atomic operation (don't wait for this)
    // Use findByIdAndUpdate to avoid parallel save conflicts when preview and download happen simultaneously
    SharedFile.findByIdAndUpdate(
      sharedFile._id,
      {
        $inc: { currentDownloads: 1 },
        $push: {
          accessLog: {
            timestamp: new Date(),
            ipAddress: clientIp,
            userAgent: userAgent,
            action: preview ? 'preview' : 'download',
            success: true
          }
        },
        $set: { lastAccessedAt: new Date() }
      },
      { new: false }
    ).catch(err => console.log('⚠️ Failed to update download count and access log:', err.message));

    // Send decrypted file
    console.log('📤 Sending file to client...');
    res.send(decryptedBuffer);
    console.log('✅ File sent successfully');
    
  } catch (error) {
    console.error('❌ Download shared file error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Ensure decrypted buffer is cleared from memory
    decryptedBuffer = null;
    
    // Send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to download file: ' + error.message,
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  } finally {
    // Clear sensitive data from memory
    decryptedBuffer = null;
    console.log('📥 ===== DOWNLOAD SHARED FILE REQUEST END =====\n');
  }
};

/**
 * Get user's shared files
 * GET /api/shared-files/my-shares
 */
const getMyShares = async (req, res) => {
  try {
    console.log('📋 ===== GET MY SHARES REQUEST START =====');
    
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Get shared files
    const sharedFiles = await SharedFile.find({ ownerUserId: userId })
      .populate('fileId', 'fileName fileSize fileType originalName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count
    const total = await SharedFile.countDocuments({ ownerUserId: userId });
    
    console.log('✅ Shares retrieved successfully');
    
    res.status(200).json({
      success: true,
      data: sharedFiles.map(share => ({
        id: share._id,
        shareToken: share.shareToken,
        fileName: share.fileId.fileName,
        fileSize: share.fileId.fileSize,
        fileType: share.fileId.fileType,
        isActive: share.isActive,
        isExpired: share.isExpired,
        expiresAt: share.expiresAt,
        maxDownloads: share.maxDownloads,
        currentDownloads: share.currentDownloads,
        allowPreview: share.allowPreview,
        allowDownload: share.allowDownload,
        createdAt: share.createdAt,
        lastAccessedAt: share.lastAccessedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Get my shares error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shares',
      error: error.message
    });
  }
};

/**
 * Deactivate share link
 * PUT /api/shared-files/:shareId/deactivate
 */
const deactivateShare = async (req, res) => {
  try {
    console.log('🔒 ===== DEACTIVATE SHARE REQUEST START =====');
    
    const { shareId } = req.params;
    const userId = req.user._id;
    
    // Find and verify ownership
    const sharedFile = await SharedFile.findOne({ _id: shareId, ownerUserId: userId });
    
    if (!sharedFile) {
      return res.status(404).json({
        success: false,
        message: 'Share not found'
      });
    }
    
    // Deactivate share
    await sharedFile.deactivate();
    
    console.log('✅ Share deactivated successfully');
    
    res.status(200).json({
      success: true,
      message: 'Share link deactivated successfully'
    });
    
  } catch (error) {
    console.error('❌ Deactivate share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate share',
      error: error.message
    });
  }
};

/**
 * Delete share link
 * DELETE /api/shared-files/:shareId
 */
const deleteShare = async (req, res) => {
  try {
    console.log('🗑️ ===== DELETE SHARE REQUEST START =====');
    
    const { shareId } = req.params;
    const userId = req.user._id;
    
    // Find and verify ownership
    const sharedFile = await SharedFile.findOne({ _id: shareId, ownerUserId: userId });
    
    if (!sharedFile) {
      return res.status(404).json({
        success: false,
        message: 'Share not found'
      });
    }
    
    // Delete share
    await SharedFile.deleteOne({ _id: shareId });
    
    console.log('✅ Share deleted successfully');
    
    res.status(200).json({
      success: true,
      message: 'Share link deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete share',
      error: error.message
    });
  }
};

module.exports = {
  createShareLink,
  generateShareLink,
  getShareDetails,
  verifySharePassword,
  downloadSharedFile,
  getMyShares,
  deactivateShare,
  deleteShare
};
