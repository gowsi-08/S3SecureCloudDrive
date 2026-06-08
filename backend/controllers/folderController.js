const Folder = require('../models/Folder');
const File = require('../models/File');

// Create new folder
const createFolder = async (req, res) => {
  try {
    const { folderName, parentFolderId } = req.body;
    const userId = req.user._id;
    const bucketId = req.bucketId;  // Get bucketId from middleware (required for bucket isolation)

    console.log('📁 Create folder request:', { folderName, parentFolderId, userId, bucketId });

    // CRITICAL: Ensure bucketId is present
    if (!bucketId) {
      console.log('🔴 CRITICAL ERROR: bucketId is missing!');
      return res.status(400).json({
        success: false,
        message: 'Bucket ID is required - middleware failed to set bucketId'
      });
    }

    if (!folderName || !folderName.trim()) {
      console.log('❌ Folder name is required');
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }

    // Validate parent folder if provided
    let parentFolder = null;
    if (parentFolderId) {
      console.log('🔍 Validating parent folder:', parentFolderId);
      parentFolder = await Folder.findOne({
        _id: parentFolderId,
        userId,
        bucketId,  // Validate it's in the same bucket
        isDeleted: false
      });

      if (!parentFolder) {
        console.log('❌ Parent folder not found or in different bucket');
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
      console.log('✅ Parent folder found:', parentFolder.folderName);
    }

    // Check for duplicate folder name
    console.log('🔍 Checking for duplicate folder name in this bucket');
    const existingFolder = await Folder.findOne({
      userId,
      bucketId,  // Check only in this bucket
      folderName: folderName.trim(),
      parentFolderId: parentFolderId || null,
      isDeleted: false
    });

    if (existingFolder) {
      console.log('❌ Folder with this name already exists in this bucket');
      return res.status(409).json({
        success: false,
        message: 'Folder with this name already exists'
      });
    }

    // Calculate path and level BEFORE creating the document
    console.log('📝 Calculating path and level...');
    let path, level;
    
    if (parentFolder) {
      path = `${parentFolder.path}/${folderName.trim()}`;
      level = parentFolder.level + 1;
      console.log('📍 Path (with parent):', path, 'Level:', level);
    } else {
      path = folderName.trim();
      level = 0;
      console.log('📍 Path (root):', path, 'Level:', level);
    }

    // Create folder with path, level, and bucketId
    console.log('📝 Creating new folder document');
    const folder = new Folder({
      userId,
      bucketId,  // Store bucketId for isolation
      folderName: folderName.trim(),
      parentFolderId: parentFolderId || null,
      path: path,
      level: level
    });

    console.log('💾 Saving folder to database');
    await folder.save();

    console.log('✅ Folder created successfully:', {
      id: folder._id,
      name: folder.folderName,
      path: folder.path,
      level: folder.level,
      bucketId: folder.bucketId
    });

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      data: {
        id: folder._id,
        name: folder.folderName,
        parentFolderId: folder.parentFolderId,
        path: folder.path,
        level: folder.level,
        bucketId: folder.bucketId,
        createdAt: folder.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Create folder error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating folder'
    });
  }
};

// Get folders and files in a directory
const getFolderContents = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;
    const bucketId = req.bucketId;  // Use bucketId from middleware (REQUIRED)

    console.log(`\n📂 getFolderContents controller called:`);
    console.log(`   folderId: ${folderId}`);
    console.log(`   userId: ${userId}`);
    console.log(`   req.bucketId from middleware: ${req.bucketId}`);
    console.log(`   req.query.bucketId: ${req.query.bucketId}`);
    console.log(`   bucketId type: ${typeof bucketId}`);
    console.log(`   Full query: ${JSON.stringify(req.query)}`);

    // Validate folder if provided
    if (folderId && folderId !== 'root') {
      const folder = await Folder.findOne({
        _id: folderId,
        userId,
        isDeleted: false
      });

      if (!folder) {
        return res.status(404).json({
          success: false,
          message: 'Folder not found'
        });
      }
    }

    // Get folder contents with bucket isolation
    const targetFolderId = (folderId === 'root') ? null : folderId;
    const { folders, files } = await Folder.getFolderContents(userId, targetFolderId, bucketId);

    // Format folders
    const formattedFolders = folders.map(folder => ({
      id: folder._id,
      name: folder.folderName,
      path: folder.path,
      level: folder.level,
      parentFolderId: folder.parentFolderId,
      createdAt: folder.createdAt,
      type: 'folder'
    }));

    // Format files
    const formattedFiles = files.map(file => ({
      id: file._id,
      name: file.fileName,
      fileName: file.fileName,
      originalName: file.originalName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      fileSizeBytes: file.fileSize,
      uploadedAt: file.uploadedAt,
      type: 'file'
    }));

    // Get current folder info if not root
    let currentFolder = null;
    if (folderId && folderId !== 'root') {
      const folder = await Folder.findById(folderId);
      if (folder) {
        currentFolder = {
          id: folder._id,
          name: folder.folderName,
          path: folder.path,
          level: folder.level,
          parentFolderId: folder.parentFolderId
        };
      }
    }

    res.json({
      success: true,
      data: {
        currentFolder,
        folders: formattedFolders,
        files: formattedFiles,
        totalFolders: formattedFolders.length,
        totalFiles: formattedFiles.length
      }
    });

  } catch (error) {
    console.error('Get folder contents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching folder contents'
    });
  }
};

// Delete folder
const deleteFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user._id;
    const bucketId = req.bucketId;  // Get bucketId from middleware

    console.log('🗑️ Delete folder request:', { folderId, userId, bucketId });

    // CRITICAL: Ensure bucketId is present
    if (!bucketId) {
      console.log('🔴 CRITICAL ERROR: bucketId is missing!');
      return res.status(400).json({
        success: false,
        message: 'Bucket ID is required - middleware failed to set bucketId'
      });
    }

    // Find folder - MUST verify it's in the same bucket
    const folder = await Folder.findOne({
      _id: folderId,
      userId,
      bucketId,  // Verify it's in this bucket
      isDeleted: false
    });

    if (!folder) {
      console.log('❌ Folder not found or in different bucket');
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    console.log('📁 Found folder:', folder.folderName);

    // Find all files in this folder and subfolders
    console.log('🔍 Finding all files in folder and subfolders...');
    const { deleteFromUserS3 } = require('../services/dynamicS3Client');
    const shareCleanupService = require('../services/shareCleanupService');
    
    // Get all files in this folder (recursively)
    const getAllFilesInFolder = async (parentFolderId) => {
      const files = await File.find({
        userId,
        bucketId,  // Only files in this bucket
        folderId: parentFolderId,
        isDeleted: false
      });
      
      const subfolders = await Folder.find({
        userId,
        bucketId,  // Only subfolders in this bucket
        parentFolderId: parentFolderId,
        isDeleted: false
      });
      
      let allFiles = [...files];
      for (const subfolder of subfolders) {
        const subFiles = await getAllFilesInFolder(subfolder._id);
        allFiles = [...allFiles, ...subFiles];
      }
      
      return allFiles;
    };

    const filesToDelete = await getAllFilesInFolder(folderId);
    console.log(`📄 Found ${filesToDelete.length} files to delete`);

    // STEP 1-7: Use share cleanup service to HARD DELETE all share links for files in this folder
    const fileIdsToDelete = filesToDelete.map(f => f._id);
    const cleanupResult = await shareCleanupService.cleanupShareLinksForFiles(fileIdsToDelete, 'original_folder_deleted');
    console.log(`📊 Share cleanup result - Hard deleted: ${cleanupResult.deletedCount} share link(s)`);

    // STEP 8: Delete files from S3
    for (const file of filesToDelete) {
      try {
        console.log(`🗑️ Deleting from S3: ${file.s3Key}`);
        const deleteResult = await deleteFromUserS3(userId, file.s3Key, bucketId);
        if (deleteResult.success) {
          console.log(`✅ Deleted from S3: ${file.s3Key}`);
        } else {
          console.log(`⚠️ Failed to delete from S3: ${file.s3Key}`);
        }
      } catch (error) {
        console.error(`❌ Error deleting from S3: ${file.s3Key}`, error);
      }
    }

    // STEP 9: Mark all files as deleted in database
    console.log('💾 Marking files as deleted...');
    await File.updateMany(
      { _id: { $in: filesToDelete.map(f => f._id) } },
      { isDeleted: true, deletedAt: new Date() }
    );

    // Mark all subfolders as deleted
    console.log('💾 Marking subfolders as deleted...');
    const markSubfoldersDeleted = async (parentFolderId) => {
      const subfolders = await Folder.find({
        userId,
        bucketId,
        parentFolderId: parentFolderId,
        isDeleted: false
      });
      
      for (const subfolder of subfolders) {
        await markSubfoldersDeleted(subfolder._id);
      }
      
      await Folder.updateMany(
        { parentFolderId: parentFolderId, userId, bucketId, isDeleted: false },
        { isDeleted: true, deletedAt: new Date() }
      );
    };

    await markSubfoldersDeleted(folderId);

    // Mark folder as deleted
    folder.isDeleted = true;
    folder.deletedAt = new Date();
    await folder.save();

    console.log('✅ Folder deleted successfully');

    res.json({
      success: true,
      message: `Folder deleted successfully. ${cleanupResult.deletedCount} share link(s) have been permanently removed.`,
      filesDeleted: filesToDelete.length,
      shareLinksRemoved: cleanupResult.deletedCount
    });

  } catch (error) {
    console.error('❌ Delete folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting folder'
    });
  }
};

// Get user's storage statistics
const getStorageStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const bucketId = req.bucketId;  // Use bucketId from middleware (REQUIRED)

    console.log(`📊 Storage stats: userId=${userId}, bucketId=${bucketId}`);
    
    // CRITICAL: Ensure bucketId is present
    if (!bucketId) {
      console.log(`   🔴 CRITICAL ERROR: bucketId is missing in getStorageStats!`);
      return res.status(400).json({
        success: false,
        message: 'Bucket ID is required for storage statistics'
      });
    }

    // Get file statistics - FILTERED by bucket
    const fileQuery = {
      userId,
      bucketId,  // Mandatory bucket filtering
      isDeleted: false
    };
    
    const fileStats = await File.aggregate([
      {
        $match: fileQuery
      },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$fileSize' }
        }
      }
    ]);

    // Get folder count (not filtered by bucket - user-level)
    const folderCount = await Folder.countDocuments({
      userId,
      isDeleted: false
    });

    const stats = fileStats[0] || { totalFiles: 0, totalSize: 0 };

    res.json({
      success: true,
      data: {
        storage: {
          totalFiles: stats.totalFiles,
          totalFolders: folderCount,
          totalSize: stats.totalSize,
          formattedTotalSize: formatFileSize(stats.totalSize),
          bucketId: bucketId
        }
      }
    });

  } catch (error) {
    console.error('Get storage stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching storage statistics'
    });
  }
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  createFolder,
  getFolderContents,
  deleteFolder,
  getStorageStats
};