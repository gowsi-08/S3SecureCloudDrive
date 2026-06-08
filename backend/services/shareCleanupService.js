/**
 * Share Cleanup Service
 * Handles PERMANENT DELETION of all share records when files or folders are deleted
 * Ensures complete removal of share links, tokens, and all related data
 */

const SharedFile = require('../models/SharedFile');
const { deleteFromUserS3 } = require('./dynamicS3Client');

/**
 * HARD DELETE all share links for a specific file
 * Permanently removes ALL share records, tokens, and data - NOT reversible
 * @param {ObjectId} fileId - The file ID to clean up
 * @param {string} reason - Reason for deletion (original_file_deleted, original_folder_deleted, etc.)
 */
const cleanupShareLinksForFile = async (fileId, reason = 'original_file_deleted') => {
  try {
    console.log(`🗑️ HARD DELETING all share links for file: ${fileId}, reason: ${reason}`);
    
    // STEP 1: Find ALL share records for this file (active or inactive)
    const sharedFiles = await SharedFile.find({ 
      fileId: fileId
    });

    console.log(`   📊 Found ${sharedFiles.length} total share link(s) to DELETE`);

    let deletedCount = 0;
    let tokensList = [];

    // STEP 2-7: For each share, permanently delete the record
    for (const share of sharedFiles) {
      try {
        // Collect share token for logging
        tokensList.push(share.shareToken);
        
        console.log(`   🗑️ DELETING share: ${share._id} (token: ${share.shareToken})`);
        
        // PERMANENTLY delete the record from database
        // This removes all data: password hash, tokens, access logs, file reference, everything
        const deleteResult = await SharedFile.deleteOne({ _id: share._id });
        
        if (deleteResult.deletedCount === 1) {
          console.log(`   ✅ PERMANENTLY DELETED share record: ${share._id}`);
          deletedCount++;
        } else {
          console.log(`   ⚠️ Share record not found or already deleted: ${share._id}`);
        }
        
      } catch (error) {
        console.error(`   ⚠️ Error deleting share ${share._id}:`, error.message);
        // Continue with other shares
      }
    }

    console.log(`   ✅ HARD DELETE COMPLETE: ${deletedCount} share link(s) permanently removed`);
    console.log(`   Deleted tokens:`, tokensList);

    return {
      success: true,
      deletedCount: deletedCount,
      totalShares: sharedFiles.length,
      deletedTokens: tokensList
    };

  } catch (error) {
    console.error(`❌ Critical error hard deleting share links for file ${fileId}:`, error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0,
      totalShares: 0
    };
  }
};

/**
 * Force permanent deletion of all share records for a file
 * This is the most aggressive delete - removes everything immediately
 * @param {ObjectId} fileId - The file ID
 */
const deleteShareRecordsForFile = async (fileId) => {
  try {
    console.log(`🔥 FORCE DELETING all share records for file: ${fileId}`);
    
    // Find and log all shares before deletion
    const sharesToDelete = await SharedFile.find({ fileId: fileId });
    console.log(`   Found ${sharesToDelete.length} share record(s) to force delete`);
    
    // Permanently delete all shares
    const result = await SharedFile.deleteMany({ fileId: fileId });
    
    console.log(`   ✅ Force deleted ${result.deletedCount} share record(s)`);
    
    return {
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} share record(s) permanently removed`
    };

  } catch (error) {
    console.error(`❌ Error force deleting share records for file ${fileId}:`, error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0
    };
  }
};

/**
 * HARD DELETE all share links for multiple files (used during folder deletion)
 * Permanently removes ALL share records, tokens, and data
 * @param {Array<ObjectId>} fileIds - Array of file IDs to clean up
 * @param {string} reason - Reason for deletion
 */
const cleanupShareLinksForFiles = async (fileIds, reason = 'original_folder_deleted') => {
  try {
    console.log(`🗑️ HARD DELETING share links for ${fileIds.length} file(s)`);
    
    // STEP 1: Find ALL share links for these files
    const sharedFiles = await SharedFile.find({ 
      fileId: { $in: fileIds }
    });

    console.log(`   📊 Found ${sharedFiles.length} total share link(s) to DELETE`);

    let deletedCount = 0;
    let tokensList = [];

    // STEP 2-7: For each share, permanently delete all data
    for (const share of sharedFiles) {
      try {
        tokensList.push(share.shareToken);
        
        console.log(`   🗑️ DELETING share: ${share._id} (token: ${share.shareToken})`);
        
        // PERMANENTLY delete the record from database
        const deleteResult = await SharedFile.deleteOne({ _id: share._id });
        
        if (deleteResult.deletedCount === 1) {
          console.log(`   ✅ PERMANENTLY DELETED share: ${share._id}`);
          deletedCount++;
        } else {
          console.log(`   ⚠️ Share record not found or already deleted: ${share._id}`);
        }
        
      } catch (error) {
        console.error(`   ⚠️ Error deleting share ${share._id}:`, error.message);
      }
    }

    console.log(`   ✅ HARD DELETE COMPLETE: ${deletedCount} share link(s) permanently removed`);

    return {
      success: true,
      deletedCount: deletedCount,
      totalShares: sharedFiles.length,
      deletedTokens: tokensList
    };

  } catch (error) {
    console.error(`❌ Critical error hard deleting share links:`, error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0
    };
  }
};

/**
 * Comprehensive cleanup when accessing a deleted file's share
 * Used when someone tries to access a share link that references a deleted file
 */
const handleDeletedFileShare = async (shareToken) => {
  try {
    console.log(`🔍 Checking if share links to deleted file: ${shareToken}`);
    
    const share = await SharedFile.findOne({ shareToken });
    
    if (!share) {
      return {
        success: false,
        exists: false,
        message: 'Share link not found'
      };
    }

    if (!share.isActive) {
      return {
        success: false,
        exists: true,
        isActive: false,
        deactivationReason: share.deactivationReason,
        message: `This shared file is no longer available. Reason: ${share.deactivationReason}`
      };
    }

    return {
      success: true,
      exists: true,
      isActive: true,
      share: share
    };

  } catch (error) {
    console.error(`❌ Error checking share status:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get all share links for a user's files (for management/audit)
 * @param {ObjectId} userId - User ID
 * @param {boolean} activeOnly - If true, only return active shares
 */
const getUserShareLinks = async (userId, activeOnly = true) => {
  try {
    const query = { ownerUserId: userId };
    if (activeOnly) {
      query.isActive = true;
    }

    const shares = await SharedFile.find(query)
      .populate('fileId', 'fileName originalName fileSize uploadedAt')
      .sort({ createdAt: -1 });

    return {
      success: true,
      count: shares.length,
      shares: shares
    };

  } catch (error) {
    console.error(`❌ Error getting user share links:`, error);
    return {
      success: false,
      error: error.message,
      shares: []
    };
  }
};

/**
 * Audit share links - find orphaned shares (shares for deleted files)
 * @param {ObjectId} userId - User ID
 */
const auditShareLinks = async (userId) => {
  try {
    const File = require('../models/File');
    
    const shares = await SharedFile.find({ ownerUserId: userId });
    const orphanedShares = [];

    for (const share of shares) {
      const file = await File.findById(share.fileId);
      if (!file || file.isDeleted) {
        orphanedShares.push({
          shareId: share._id,
          shareToken: share.shareToken,
          isActive: share.isActive,
          fileId: share.fileId,
          createdAt: share.createdAt
        });
      }
    }

    console.log(`⚠️ Audit found ${orphanedShares.length} orphaned share link(s)`);

    return {
      success: true,
      orphanedCount: orphanedShares.length,
      orphanedShares: orphanedShares
    };

  } catch (error) {
    console.error(`❌ Error auditing share links:`, error);
    return {
      success: false,
      error: error.message,
      orphanedShares: []
    };
  }
};

/**
 * Clean up orphaned shares (shares for deleted files)
 * @param {ObjectId} userId - User ID
 */
const cleanupOrphanedShares = async (userId) => {
  try {
    const File = require('../models/File');
    
    const shares = await SharedFile.find({ ownerUserId: userId });
    let deactivatedCount = 0;

    for (const share of shares) {
      const file = await File.findById(share.fileId);
      if (!file || file.isDeleted) {
        if (share.isActive) {
          share.isActive = false;
          share.deactivationReason = 'original_file_deleted';
          share.deactivatedAt = new Date();
          await share.save();
          deactivatedCount++;
        }
      }
    }

    console.log(`🧹 Cleaned up ${deactivatedCount} orphaned share link(s)`);

    return {
      success: true,
      cleanedCount: deactivatedCount
    };

  } catch (error) {
    console.error(`❌ Error cleaning up orphaned shares:`, error);
    return {
      success: false,
      error: error.message,
      cleanedCount: 0
    };
  }
};

module.exports = {
  cleanupShareLinksForFile,
  deleteShareRecordsForFile,
  cleanupShareLinksForFiles,
  handleDeletedFileShare,
  getUserShareLinks,
  auditShareLinks,
  cleanupOrphanedShares
};
