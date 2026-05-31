const mongoose = require('mongoose');
const crypto = require('crypto');

const sharedFileSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  ownerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  shareToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => crypto.randomBytes(32).toString('hex')
  },
  hashedSharePassword: {
    type: String,
    required: true // Always hash the share password
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
  },
  maxDownloads: {
    type: Number,
    default: null // null means unlimited
  },
  currentDownloads: {
    type: Number,
    default: 0
  },
  allowPreview: {
    type: Boolean,
    default: true
  },
  allowDownload: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  accessLog: [
    {
      timestamp: {
        type: Date,
        default: Date.now
      },
      ipAddress: String,
      action: {
        type: String,
        enum: ['password_attempt', 'preview', 'download', 'failed_attempt'],
        default: 'password_attempt'
      },
      success: Boolean
    }
  ],
  failedAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  fileEncryptionPassword: {
    type: String,
    default: null,
    select: false // Don't select by default for security
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for finding active shares
sharedFileSchema.index({ shareToken: 1, isActive: 1 });
sharedFileSchema.index({ ownerUserId: 1, createdAt: -1 });

// Static method to check if share is expired
sharedFileSchema.statics.isShareExpired = function(share) {
  if (!share.expiresAt) return false;
  return new Date() > share.expiresAt;
};

// Static method to check if share has exceeded download limit
sharedFileSchema.statics.hasExceededDownloadLimit = function(share) {
  if (!share.maxDownloads) return false;
  return share.currentDownloads >= share.maxDownloads;
};

// Static method to check if share is locked due to failed attempts
sharedFileSchema.statics.isShareLocked = function(share) {
  if (!share.lockedUntil) return false;
  return new Date() < share.lockedUntil;
};

// Instance method to log access
sharedFileSchema.methods.logAccess = function(ipAddress, action, success) {
  this.accessLog.push({
    timestamp: new Date(),
    ipAddress,
    action,
    success
  });
  
  // Keep only last 100 access logs
  if (this.accessLog.length > 100) {
    this.accessLog = this.accessLog.slice(-100);
  }
};

// Instance method to increment failed attempts
sharedFileSchema.methods.incrementFailedAttempts = function() {
  this.failedAttempts += 1;
  
  // Lock after 5 failed attempts for 15 minutes
  if (this.failedAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
};

// Instance method to reset failed attempts
sharedFileSchema.methods.resetFailedAttempts = function() {
  this.failedAttempts = 0;
  this.lockedUntil = null;
};

// Instance method to increment download count
sharedFileSchema.methods.incrementDownloadCount = function() {
  this.currentDownloads += 1;
};

// Getter for isExpired
sharedFileSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

// Getter for downloadLimitReached
sharedFileSchema.virtual('downloadLimitReached').get(function() {
  if (!this.maxDownloads) return false;
  return this.currentDownloads >= this.maxDownloads;
});

// Instance method to check if locked due to failed attempts
sharedFileSchema.methods.isLockedDueToFailedAttempts = function() {
  if (!this.lockedUntil) return false;
  return new Date() < this.lockedUntil;
};

// Instance method to record failed attempt
sharedFileSchema.methods.recordFailedAttempt = async function() {
  this.failedAttempts += 1;
  
  // Lock after 5 failed attempts for 15 minutes
  if (this.failedAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  await this.save();
};

// Instance method to reset failed attempts
sharedFileSchema.methods.resetFailedAttempts = async function() {
  this.failedAttempts = 0;
  this.lockedUntil = null;
  await this.save();
};

// Instance method to record access
sharedFileSchema.methods.recordAccess = async function(ipAddress, userAgent, action) {
  this.accessLog.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    action,
    success: true
  });
  
  // Keep only last 100 access logs
  if (this.accessLog.length > 100) {
    this.accessLog = this.accessLog.slice(-100);
  }
  
  this.lastAccessedAt = new Date();
  await this.save();
};

// Instance method to deactivate share
sharedFileSchema.methods.deactivate = async function() {
  this.isActive = false;
  await this.save();
};

// Add lastAccessedAt field if not present
if (!sharedFileSchema.paths.lastAccessedAt) {
  sharedFileSchema.add({
    lastAccessedAt: {
      type: Date,
      default: null
    }
  });
}

// Add failedPasswordAttempts virtual for compatibility
sharedFileSchema.virtual('failedPasswordAttempts').get(function() {
  return this.failedAttempts;
});

module.exports = mongoose.model('SharedFile', sharedFileSchema);
