const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bucketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserCloudConfig',
    default: null,
    required: false
  },
  folderName: {
    type: String,
    required: true,
    trim: true
  },
  parentFolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  path: {
    type: String,
    required: true,
    default: ''
  },
  level: {
    type: Number,
    default: 0
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes - UPDATED to include bucketId for isolation
folderSchema.index({ userId: 1, bucketId: 1, parentFolderId: 1 });
folderSchema.index({ userId: 1, bucketId: 1, folderName: 1, parentFolderId: 1 }, { unique: true });

// Index migration hook - Runs once after model creation
folderSchema.post('init', async function() {
  // This runs when model is first loaded - we'll handle migration in server.js instead
});

// Helper static method for index migration
folderSchema.statics.migrateIndexes = async function() {
  console.log('\n🔧 ===== FOLDER INDEX MIGRATION START =====');
  try {
    const collection = this.collection;
    
    // Get existing indexes
    const existingIndexes = await collection.getIndexes();
    console.log('📋 Existing indexes:', Object.keys(existingIndexes));
    
    // Drop old index without bucketId (userId_1_folderName_1_parentFolderId_1)
    if (existingIndexes['userId_1_folderName_1_parentFolderId_1']) {
      console.log('🗑️ Dropping old index: userId_1_folderName_1_parentFolderId_1');
      await collection.dropIndex('userId_1_folderName_1_parentFolderId_1');
      console.log('✅ Old index dropped');
    }
    
    // Delete duplicate records (keep one, remove duplicates)
    console.log('🧹 Cleaning up duplicate folder records...');
    
    // Find all folders with duplicates (same userId, folderName, parentFolderId, but different bucketIds or first one)
    const duplicates = await this.aggregate([
      {
        $group: {
          _id: {
            userId: '$userId',
            folderName: '$folderName',
            parentFolderId: '$parentFolderId',
            isDeleted: '$isDeleted'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`📊 Found ${duplicates.length} groups of duplicate folders`);
    
    let deletedCount = 0;
    for (const dup of duplicates) {
      console.log(`   📁 Folder: ${dup._id.folderName}, duplicates: ${dup.count}`);
      // Keep first ID, delete others
      const idsToDelete = dup.ids.slice(1);
      const result = await this.deleteMany({ _id: { $in: idsToDelete } });
      deletedCount += result.deletedCount;
      console.log(`   ✅ Deleted ${result.deletedCount} duplicate records`);
    }
    
    console.log(`✅ Cleaned up ${deletedCount} duplicate records`);
    
    // Recreate indexes
    console.log('🔄 Recreating indexes...');
    await collection.dropIndex('userId_1_bucketId_1_parentFolderId_1').catch(() => {});
    await collection.dropIndex('userId_1_bucketId_1_folderName_1_parentFolderId_1').catch(() => {});
    
    // Create new indexes with bucketId
    await collection.createIndex({ userId: 1, bucketId: 1, parentFolderId: 1 });
    console.log('✅ Index created: userId_1_bucketId_1_parentFolderId_1');
    
    await collection.createIndex(
      { userId: 1, bucketId: 1, folderName: 1, parentFolderId: 1 },
      { unique: true }
    );
    console.log('✅ Index created: userId_1_bucketId_1_folderName_1_parentFolderId_1 (UNIQUE)');
    
    console.log('✅ ===== FOLDER INDEX MIGRATION COMPLETE =====\n');
    return { success: true, duplicatesRemoved: deletedCount };
    
  } catch (error) {
    console.error('❌ Index migration error:', error);
    console.log('⚠️ Manual fix required - see instructions below');
    return { success: false, error: error.message };
  }
};

// Static method to get folder contents
folderSchema.statics.getFolderContents = async function(userId, folderId = null, bucketId = null) {
  const File = mongoose.model('File');
  
  console.log(`\n🔍 Folder.getFolderContents called:`);
  console.log(`   userId: ${userId}`);
  console.log(`   folderId: ${folderId}`);
  console.log(`   bucketId: ${bucketId}`);
  
  // Build file query - ALWAYS include bucketId for isolation
  const fileQuery = {
    userId,
    folderId: folderId,
    isDeleted: false
  };
  
  // Build folder query - ALWAYS include bucketId for isolation
  const folderQuery = {
    userId,
    parentFolderId: folderId,
    isDeleted: false
  };
  
  // bucketId is mandatory when provided by middleware
  if (bucketId) {
    fileQuery.bucketId = bucketId;
    folderQuery.bucketId = bucketId;
    console.log(`✅ Adding bucket filter to both: bucketId=${bucketId}`);
  } else {
    console.log(`⚠️  WARNING: No bucketId provided! This will return items from ALL buckets!`);
  }
  
  // Get folders - FILTERED by bucketId for isolation
  console.log(`🔍 Folder query: ${JSON.stringify(folderQuery)}`);
  const folders = await this.find(folderQuery).sort({ folderName: 1 });
  
  // Get files - FILTERED by bucketId for isolation
  console.log(`🔍 File query: ${JSON.stringify(fileQuery)}`);
  const files = await File.find(fileQuery).sort({ fileName: 1 });
  
  console.log(`✅ Found ${folders.length} folders, ${files.length} files\n`);
  return { folders, files };
};

module.exports = mongoose.model('Folder', folderSchema);