const mongoose = require('mongoose');

const userCloudConfigSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    bucketName: {
      type: String,
      required: true,
      trim: true
    },
    region: {
      type: String,
      required: true,
      default: 'us-east-1'
    },
    // Encrypted AWS credentials - NEVER store plaintext
    encryptedCredentials: {
      type: String,
      required: true
    },
    // Encryption metadata for decryption
    encryptionIV: {
      type: String,
      required: true
    },
    encryptionAuthTag: {
      type: String,
      required: true
    },
    // Connection status
    isConnected: {
      type: Boolean,
      default: false,
      index: true
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'validating'],
      default: 'disconnected'
    },
    lastValidated: {
      type: Date,
      default: null
    },
    validationError: {
      type: String,
      default: null
    },
    // Permissions verified
    permissionsVerified: {
      type: Boolean,
      default: false
    },
    verifiedPermissions: {
      type: [String],
      default: []
    },
    // Metadata
    connectedAt: {
      type: Date,
      default: null
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for quick lookups
userCloudConfigSchema.index({ userId: 1, isConnected: 1 });

module.exports = mongoose.model('UserCloudConfig', userCloudConfigSchema);
