const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

// Indexes
folderSchema.index({ userId: 1, parentFolderId: 1 });
folderSchema.index({ userId: 1, folderName: 1, parentFolderId: 1 }, { unique: true });

// Static method to get folder contents
folderSchema.statics.getFolderContents = async function(userId, folderId = null) {
  const File = mongoose.model('File');
  
  const [folders, files] = await Promise.all([
    this.find({
      userId,
      parentFolderId: folderId,
      isDeleted: false
    }).sort({ folderName: 1 }),
    
    File.find({
      userId,
      folderId: folderId,
      isDeleted: false
    }).sort({ fileName: 1 })
  ]);
  
  return { folders, files };
};

module.exports = mongoose.model('Folder', folderSchema);