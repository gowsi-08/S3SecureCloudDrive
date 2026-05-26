const File = require('../models/File');
const Folder = require('../models/Folder');
const { deleteFromS3, deleteMultipleFromS3, listS3Objects } = require('../utils/s3');
const { clearPasswordFromMemory } = require('../utils/encryption');
const mongoose = require('mongoose');

/**
 * Securely delete a file with ownership verification and name confirmation
 */
const deleteFileSecure = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { confirmationName } = req.body;
    const userId = req.user._id;

    console.log('Secure file deletion request:', {
      fileId,
      userId,
      confirmationName: confirmationName ? 'provided' : 'missing'
    });

    // Validate input
    if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID provided'
      });
    }

    if (!confirmationName || confirmationName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation name is required for secure deletion'
      });
    }

    // Find file and verify ownership
    const file = await File.findOne({ 
      _id: fileId, 
      userId, 
      isDeleted: false 
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found or you do not have permission to delete it'
      });
    }

    // Verify confirmation name matches exactly (case-sensitive)
    if (confirmationName.trim() !== file.fileName) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation name does not match the file name exactly. Please type the exact file name.',
        expectedName: file.fileName,
        providedName: confirmationName.trim()
      });
    }

    console.log('File ownership and name verification passed');

    // Prepare file info for response
    const fileInfo = {
      id: file._id,
      fileName: file.fileName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      s3Key: file.s3Key,
      folderId: file.folderId
    };

    // Delete from S3 first (critical for security)
    console.log('Deleting file from S3:', file.s3Key);
    const s3DeleteResult = await deleteFromS3(file.s3Key);
    
    if (!s3DeleteResult.success) {
      console.error('S3 deletion failed:', s3DeleteResult.error);
      // Log but continue - file might already be deleted from S3
      console.log('Continuing with database deletion despite S3 error');
    } else {
      console.log('File successfully deleted from S3');
    }

    // Permanent deletion from database
    const deleteResult = await File.deleteOne({ _id: fileId, userId });
    
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found or already deleted'
      });
    }

    console.log('File permanently deleted from database');

    // Clear any cached encryption keys for this file
    try {
      clearPasswordFromMemory(fileId);
    } catch (error) {
      console.log('No cached password to clear for file:', fileId);
    }

    res.json({
      success: true,
      message: 'File permanently deleted successfully',
      data: {
        deletedFile: fileInfo,
        deletionTimestamp: new Date(),
        s3Deleted: s3DeleteResult.success,
        s3Error: s3DeleteResult.success ? null : s3DeleteResult.error
      }
    });

  } catch (error) {
    console.error('Secure file deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during secure file deletion: ' + error.message
    });
  }
};

/**
 * Securely delete a folder and all its contents recursively
 */
const deleteFolderSecure = async (req, res) => {
  try {
    const { folderId } = req.params;
    const { confirmationName } = req.body;
    const userId = req.user._id;

    console.log('Secure folder deletion request:', {
      folderId,
      userId,
      confirmationName: confirmationName ? 'provided' : 'missing'
    });

    // Validate input
    if (!folderId || !mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder ID provided'
      });
    }

    if (!confirmationName || confirmationName.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation name is required for secure deletion'
      });
    }

    // Find folder and verify ownership
    const folder = await Folder.findOne({ 
      _id: folderId, 
      userId, 
      isDeleted: false 
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found or you do not have permission to delete it'
      });
    }

    // Verify confirmation name matches exactly (case-sensitive)
    if (confirmationName.trim() !== folder.folderName) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation name does not match the folder name exactly. Please type the exact folder name.',
        expectedName: folder.folderName,
        providedName: confirmationName.trim()
      });
    }

    console.log('Folder ownership and name verification passed');

    // Get all nested folders recursively
    const nestedFolders = await getAllNestedFolders(folderId, userId);
    const allFolderIds = [folderId, ...nestedFolders.map(f => f._id)];

    console.log('Found nested folders:', allFolderIds.length);

    // Get all files in this folder and nested folders
    const filesToDelete = await File.find({
      userId,
      folderId: { $in: allFolderIds },
      isDeleted: false
    });

    console.log('Found files to delete:', filesToDelete.length);

    // Prepare deletion summary
    const deletionSummary = {
      folder: {
        id: folder._id,
        name: folder.folderName,
        path: folder.path
      },
      stats: {
        totalFolders: allFolderIds.length,
        totalFiles: filesToDelete.length,
        totalSize: filesToDelete.reduce((sum, file) => sum + (file.fileSize || 0), 0)
      }
    };

    // Delete all files from S3 first
    const s3Keys = filesToDelete.map(file => file.s3Key);
    let s3DeleteResults = { success: true, errors: [] };
    
    if (s3Keys.length > 0) {
      console.log(`Deleting ${s3Keys.length} files from S3`);
      
      // Delete files in batches (S3 allows max 1000 objects per batch)
      const batchSize = 1000;
      for (let i = 0; i < s3Keys.length; i += batchSize) {
        const batch = s3Keys.slice(i, i + batchSize);
        try {
          const batchResult = await deleteMultipleFromS3(batch);
          if (!batchResult.success) {
            s3DeleteResults.success = false;
            s3DeleteResults.errors.push(...(batchResult.errors || [batchResult.error]));
          }
        } catch (error) {
          console.error(`S3 batch deletion error for batch ${i / batchSize + 1}:`, error);
          s3DeleteResults.success = false;
          s3DeleteResults.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
        }
      }
    }

    // Delete all files from database
    const fileDeleteResult = await File.deleteMany({
      userId,
      folderId: { $in: allFolderIds }
    });

    console.log('Deleted files from database:', fileDeleteResult.deletedCount);

    // Delete all folders from database (including nested ones)
    const folderDeleteResult = await Folder.deleteMany({
      userId,
      _id: { $in: allFolderIds }
    });

    console.log('Deleted folders from database:', folderDeleteResult.deletedCount);

    // Clear cached encryption keys for all deleted files
    filesToDelete.forEach(file => {
      try {
        clearPasswordFromMemory(file._id.toString());
      } catch (error) {
        // Ignore errors - keys might not be cached
      }
    });

    res.json({
      success: true,
      message: 'Folder and all contents permanently deleted successfully',
      data: {
        deletionSummary,
        results: {
          filesDeleted: fileDeleteResult.deletedCount,
          foldersDeleted: folderDeleteResult.deletedCount,
          s3DeleteSuccess: s3DeleteResults.success,
          s3Errors: s3DeleteResults.errors.length > 0 ? s3DeleteResults.errors : null
        },
        deletionTimestamp: new Date()
      }
    });

  } catch (error) {
    console.error('Secure folder deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during secure folder deletion: ' + error.message
    });
  }
};

/**
 * Get folder contents for deletion preview
 */
const getFolderDeletionPreview = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;

    // Validate input
    if (!folderId || !mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder ID provided'
      });
    }

    // Find folder and verify ownership
    const folder = await Folder.findOne({ 
      _id: folderId, 
      userId, 
      isDeleted: false 
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found or you do not have permission to access it'
      });
    }

    // Get all nested folders recursively
    const nestedFolders = await getAllNestedFolders(folderId, userId);
    const allFolderIds = [folderId, ...nestedFolders.map(f => f._id)];

    // Get all files in this folder and nested folders
    const allFiles = await File.find({
      userId,
      folderId: { $in: allFolderIds },
      isDeleted: false
    });

    // Calculate total size
    const totalSize = allFiles.reduce((sum, file) => sum + (file.fileSize || 0), 0);

    res.json({
      success: true,
      data: {
        folder: {
          id: folder._id,
          name: folder.folderName,
          path: folder.path
        },
        preview: {
          totalFolders: allFolderIds.length,
          totalFiles: allFiles.length,
          totalSize: formatFileSize(totalSize),
          totalSizeBytes: totalSize,
          nestedFolders: nestedFolders.length,
          directFiles: allFiles.filter(f => f.folderId?.toString() === folderId).length,
          sampleFiles: allFiles.slice(0, 5).map(f => ({
            id: f._id,
            name: f.fileName,
            size: formatFileSize(f.fileSize || 0)
          }))
        }
      }
    });

  } catch (error) {
    console.error('Folder deletion preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting folder deletion preview: ' + error.message
    });
  }
};

/**
 * Helper function to get all nested folders recursively
 */
const getAllNestedFolders = async (parentFolderId, userId) => {
  const nestedFolders = [];
  
  const getChildren = async (folderId) => {
    const children = await Folder.find({
      userId,
      parentFolderId: folderId,
      isDeleted: false
    });
    
    for (const child of children) {
      nestedFolders.push(child);
      await getChildren(child._id); // Recursive call for nested folders
    }
  };
  
  await getChildren(parentFolderId);
  return nestedFolders;
};

/**
 * Helper function to format file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  deleteFileSecure,
  deleteFolderSecure,
  getFolderDeletionPreview
};