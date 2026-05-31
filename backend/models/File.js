const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  fileType: {
    type: String,
    required: true,
    enum: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'
    ]
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  s3Key: {
    type: String,
    required: true,
    unique: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null,
    index: true
  },
  isEncrypted: {
    type: Boolean,
    default: true
  },
  encryptionType: {
    type: String,
    enum: ['account', 'custom'],
    default: 'account'
  },
  encryptionVersion: {
    type: String,
    default: '2.0'
  },
  encryptionAlgorithm: {
    type: String,
    default: 'aes-256-gcm'
  },
  encryptionPassword: {
    type: String,
    default: null,
    select: false // Don't select by default for security
  },
  customPasswordHash: {
    type: String,
    default: null // Only set if custom password is used and user opts to store hash
  },
  encryptionIV: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  downloadCount: {
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

// Indexes for better query performance
fileSchema.index({ userId: 1, folderId: 1 });
fileSchema.index({ userId: 1, fileName: 1 });
fileSchema.index({ userId: 1, fileType: 1 });
fileSchema.index({ userId: 1, uploadedAt: -1 });

// Virtual for file category
fileSchema.virtual('category').get(function() {
  if (this.fileType.startsWith('image/')) return 'image';
  if (this.fileType.startsWith('video/')) return 'video';
  if (this.fileType.startsWith('audio/')) return 'audio';
  if (this.fileType === 'application/pdf') return 'pdf';
  if (this.fileType.startsWith('text/')) return 'text';
  if (this.fileType.includes('word') || this.fileType.includes('document')) return 'document';
  if (this.fileType.includes('excel') || this.fileType.includes('sheet')) return 'spreadsheet';
  return 'other';
});

// Method to get file path in S3
fileSchema.methods.getS3Path = function() {
  return `${this.userId}/${this.folderId || 'root'}/${this.fileName}`;
};

// Method to update last accessed
fileSchema.methods.updateLastAccessed = function() {
  this.lastAccessed = new Date();
  this.downloadCount += 1;
  return this.save();
};

// Static method to get user's storage usage
fileSchema.statics.getUserStorageUsage = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' }, fileCount: { $sum: 1 } } }
  ]);
  return result[0] || { totalSize: 0, fileCount: 0 };
};

// Pre-save middleware to generate S3 key
fileSchema.pre('save', function() {
  if (this.isNew && !this.s3Key) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    this.s3Key = `${this.userId}/${this.folderId || 'root'}/${timestamp}-${random}-${this.fileName}`;
  }
  
});

module.exports = mongoose.model('File', fileSchema);