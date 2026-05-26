const crypto = require('crypto');

// Master encryption key - should be in environment variable
const MASTER_KEY = process.env.CREDENTIAL_MASTER_KEY || 'your-super-secret-master-key-change-in-production';

// Ensure master key is 32 bytes for AES-256
const getMasterKey = () => {
  const key = crypto.createHash('sha256').update(MASTER_KEY).digest();
  return key;
};

/**
 * Encrypt AWS credentials using AES-256-GCM
 * @param {string} accessKeyId - AWS Access Key ID
 * @param {string} secretAccessKey - AWS Secret Access Key
 * @returns {object} Encrypted credentials with IV and auth tag
 */
const encryptCredentials = (accessKeyId, secretAccessKey) => {
  try {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Access Key ID and Secret Access Key are required');
    }

    // Generate random IV (16 bytes for AES)
    const iv = crypto.randomBytes(16);
    
    // Get master key
    const masterKey = getMasterKey();

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);

    // Combine credentials for encryption
    const credentialsString = JSON.stringify({
      accessKeyId,
      secretAccessKey
    });

    // Encrypt
    let encrypted = cipher.update(credentialsString, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      success: true,
      encryptedCredentials: encrypted,
      encryptionIV: iv.toString('hex'),
      encryptionAuthTag: authTag.toString('hex'),
      error: null
    };
  } catch (error) {
    console.error('Credential encryption error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Decrypt AWS credentials using AES-256-GCM
 * @param {string} encryptedCredentials - Encrypted credentials JSON
 * @param {string} iv - Initialization vector (hex)
 * @param {string} authTag - Authentication tag (hex)
 * @returns {object} Decrypted credentials
 */
const decryptCredentials = (encryptedCredentials, iv, authTag) => {
  try {
    if (!encryptedCredentials || !iv || !authTag) {
      throw new Error('All encryption parameters are required');
    }

    // Convert IV and auth tag from hex
    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    // Get master key
    const masterKey = getMasterKey();

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    // Decrypt
    let decrypted = decipher.update(encryptedCredentials, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse credentials
    const credentials = JSON.parse(decrypted);

    return {
      success: true,
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      error: null
    };
  } catch (error) {
    console.error('Credential decryption error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Encrypt single credential value
 * @param {string} value - Value to encrypt
 * @returns {object} Encrypted value with IV and auth tag
 */
const encryptValue = (value) => {
  try {
    if (!value) {
      throw new Error('Value is required');
    }

    const iv = crypto.randomBytes(16);
    const masterKey = getMasterKey();

    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      success: true,
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      error: null
    };
  } catch (error) {
    console.error('Value encryption error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Decrypt single credential value
 * @param {string} encrypted - Encrypted value
 * @param {string} iv - Initialization vector (hex)
 * @param {string} authTag - Authentication tag (hex)
 * @returns {object} Decrypted value
 */
const decryptValue = (encrypted, iv, authTag) => {
  try {
    if (!encrypted || !iv || !authTag) {
      throw new Error('All decryption parameters are required');
    }

    const ivBuffer = Buffer.from(iv, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');
    const masterKey = getMasterKey();

    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      success: true,
      value: decrypted,
      error: null
    };
  } catch (error) {
    console.error('Value decryption error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  encryptCredentials,
  decryptCredentials,
  encryptValue,
  decryptValue,
  getMasterKey
};
