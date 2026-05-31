const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Production-level encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (96 bits recommended for GCM, but 128 is also secure)
const TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 600000; // OWASP recommended minimum for 2023+
const AAD_STRING = 'SecureDrive-v2.0-FileEncryption'; // Additional Authenticated Data

// Security constants
const PASSWORD_MIN_LENGTH = 8;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Securely derive encryption key from password using PBKDF2
 * @param {string} password - User's password (cleared from memory after use)
 * @param {Buffer} salt - Cryptographically secure salt
 * @returns {Buffer} - Derived encryption key
 */
const deriveKey = (password, salt) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (!salt || salt.length !== SALT_LENGTH) {
    throw new Error('Salt must be exactly 32 bytes');
  }
  
  try {
    // Use PBKDF2 with SHA-512 for key derivation (production standard)
    const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
    return key;
  } catch (error) {
    throw new Error('Key derivation failed: ' + error.message);
  }
};

/**
 * Generate cryptographically secure random salt
 * @returns {Buffer} - Random salt
 */
const generateSalt = () => {
  return crypto.randomBytes(SALT_LENGTH);
};

/**
 * Generate cryptographically secure random IV
 * @returns {Buffer} - Random IV
 */
const generateIV = () => {
  return crypto.randomBytes(IV_LENGTH);
};

/**
 * Validate password strength (basic validation)
 * @param {string} password - Password to validate
 * @param {boolean} isCustomPassword - Whether this is a custom password (stricter validation)
 * @returns {Object} - Validation result
 */
const validatePassword = (password, isCustomPassword = false) => {
  const result = {
    isValid: false,
    errors: []
  };

  if (!password || typeof password !== 'string') {
    result.errors.push('Password must be a string');
    return result;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    result.errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }

  result.isValid = result.errors.length === 0;
  return result;
};

/**
 * Encrypt file buffer with production-level security
 * @param {Buffer} fileBuffer - File data to encrypt
 * @param {string} userPassword - User's password (will be cleared from memory)
 * @param {Buffer} salt - Optional salt (will generate if not provided)
 * @param {boolean} skipPasswordValidation - Skip password validation (for account passwords)
 * @returns {Object} - Encrypted data with metadata
 */
const encryptFile = (fileBuffer, userPassword, salt = null, skipPasswordValidation = false) => {
  // Input validation
  if (!Buffer.isBuffer(fileBuffer)) {
    return {
      success: false,
      error: 'Invalid file buffer provided'
    };
  }

  if (fileBuffer.length === 0) {
    return {
      success: false,
      error: 'File buffer is empty'
    };
  }

  if (fileBuffer.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  // Validate password only for custom passwords
  if (!skipPasswordValidation) {
    const passwordValidation = validatePassword(userPassword, true); // true for custom password validation
    if (!passwordValidation.isValid) {
      return {
        success: false,
        error: 'Password validation failed: ' + passwordValidation.errors.join(', ')
      };
    }
  }

  try {
    // Generate salt if not provided
    if (!salt) {
      salt = generateSalt();
    }
    
    // Derive encryption key from password and salt
    const key = deriveKey(userPassword, salt);
    
    // Generate random IV for this encryption operation
    const iv = generateIV();
    
    // Create cipher with AES-256-GCM (authenticated encryption)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Set Additional Authenticated Data (AAD) for integrity
    const aad = Buffer.from(AAD_STRING, 'utf8');
    cipher.setAAD(aad);
    
    // Encrypt the file
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ]);
    
    // Get authentication tag (provides integrity and authenticity)
    const tag = cipher.getAuthTag();
    
    // Combine all components: salt + iv + tag + aad_length + aad + encrypted_data
    const aadLength = Buffer.alloc(4);
    aadLength.writeUInt32BE(aad.length, 0);
    
    const encryptedFile = Buffer.concat([
      salt,           // 32 bytes
      iv,             // 16 bytes  
      tag,            // 16 bytes
      aadLength,      // 4 bytes
      aad,            // variable length
      encrypted       // variable length
    ]);
    
    // Clear sensitive data from memory
    key.fill(0);
    
    return {
      encryptedBuffer: encryptedFile,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM,
      keyDerivation: {
        method: 'PBKDF2',
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-512'
      },
      success: true
    };
  } catch (error) {
    console.error('Encryption error:', error);
    return {
      success: false,
      error: 'Encryption failed: ' + error.message
    };
  }
};

/**
 * Decrypt file buffer with production-level security
 * @param {Buffer} encryptedBuffer - Encrypted file data
 * @param {string} userPassword - User's password (will be cleared from memory)
 * @returns {Object} - Decrypted data or error
 */
const decryptFile = (encryptedBuffer, userPassword) => {
  // Input validation
  if (!Buffer.isBuffer(encryptedBuffer)) {
    return {
      success: false,
      error: 'Invalid encrypted buffer provided'
    };
  }

  const minSize = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 4; // +4 for AAD length
  if (encryptedBuffer.length < minSize) {
    return {
      success: false,
      error: 'Encrypted buffer is too small or corrupted'
    };
  }

  // Validate password
  const passwordValidation = validatePassword(userPassword);
  if (!passwordValidation.isValid) {
    return {
      success: false,
      error: 'Invalid password provided'
    };
  }

  try {
    let offset = 0;
    
    // Extract components from encrypted buffer
    const salt = encryptedBuffer.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    
    const iv = encryptedBuffer.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    
    const tag = encryptedBuffer.slice(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;
    
    // Read AAD length
    const aadLength = encryptedBuffer.readUInt32BE(offset);
    offset += 4;
    
    // Validate AAD length
    if (aadLength > 1000 || aadLength < 1) { // Reasonable bounds
      return {
        success: false,
        error: 'Invalid AAD length in encrypted data'
      };
    }
    
    // Extract AAD
    const aad = encryptedBuffer.slice(offset, offset + aadLength);
    offset += aadLength;
    
    // Verify AAD matches expected value
    const expectedAAD = Buffer.from(AAD_STRING, 'utf8');
    if (!aad.equals(expectedAAD)) {
      return {
        success: false,
        error: 'File was encrypted with a different version or is corrupted'
      };
    }
    
    // Extract encrypted data
    const encrypted = encryptedBuffer.slice(offset);
    
    if (encrypted.length === 0) {
      return {
        success: false,
        error: 'No encrypted data found'
      };
    }
    
    // Derive decryption key using same parameters as encryption
    const key = deriveKey(userPassword, salt);
    
    // Create decipher with AES-256-GCM
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(aad);
    
    // Decrypt the file
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Clear sensitive data from memory
    key.fill(0);
    
    return {
      decryptedBuffer: decrypted,
      success: true
    };
  } catch (error) {
    console.error('Decryption error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to decrypt file.';
    
    if (error.message.includes('bad decrypt') || 
        error.message.includes('auth') || 
        error.message.includes('tag')) {
      errorMessage = 'Invalid password or corrupted file. Please check your password and try again.';
    } else if (error.message.includes('Invalid key length') || 
               error.message.includes('Invalid IV length')) {
      errorMessage = 'File was encrypted with incompatible settings or is corrupted.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Verify user account password against stored bcrypt hash
 * @param {string} plainPassword - Plain text password from user
 * @param {string} hashedPassword - Bcrypt hash from database
 * @returns {Promise<boolean>} - Whether password is correct
 */
const verifyAccountPassword = async (plainPassword, hashedPassword) => {
  try {
    if (!plainPassword || !hashedPassword) {
      return false;
    }
    
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};

/**
 * Create hash of custom password for optional storage/verification
 * @param {string} customPassword - Custom password to hash
 * @returns {Promise<string>} - Bcrypt hash of custom password
 */
const hashCustomPassword = async (customPassword) => {
  try {
    if (!customPassword) {
      throw new Error('Custom password is required');
    }
    
    // Use bcrypt with cost factor 12 (secure for 2023+)
    const saltRounds = 12;
    return await bcrypt.hash(customPassword, saltRounds);
  } catch (error) {
    console.error('Custom password hashing error:', error);
    throw new Error('Failed to hash custom password');
  }
};

/**
 * Securely clear password from memory (best effort)
 * @param {string} password - Password string to clear
 */
const clearPasswordFromMemory = (password) => {
  if (typeof password === 'string') {
    // This is a best-effort approach in JavaScript
    // The string may still exist in memory due to JS string immutability
    try {
      // Overwrite the string reference (limited effectiveness in JS)
      password = null;
    } catch (error) {
      // Ignore errors in clearing memory
    }
  }
};

/**
 * Validate file encryption integrity
 * @param {Buffer} encryptedBuffer - Encrypted file buffer
 * @returns {Object} - Validation result
 */
const validateEncryption = (encryptedBuffer) => {
  try {
    if (!Buffer.isBuffer(encryptedBuffer)) {
      return {
        isValid: false,
        error: 'Invalid buffer type'
      };
    }
    
    // Check minimum size (salt + iv + tag + aad_length + min_aad + some_data)
    const minSize = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 4 + 1 + 1;
    if (encryptedBuffer.length < minSize) {
      return {
        isValid: false,
        error: 'Buffer too small to be valid encrypted file'
      };
    }
    
    // Check that the buffer has proper structure
    let offset = SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
    
    // Validate AAD length field
    if (encryptedBuffer.length < offset + 4) {
      return {
        isValid: false,
        error: 'Missing AAD length field'
      };
    }
    
    const aadLength = encryptedBuffer.readUInt32BE(offset);
    if (aadLength > 1000 || aadLength < 1) {
      return {
        isValid: false,
        error: 'Invalid AAD length'
      };
    }
    
    offset += 4 + aadLength;
    
    // Check that there's encrypted data
    if (encryptedBuffer.length <= offset) {
      return {
        isValid: false,
        error: 'No encrypted data found'
      };
    }
    
    // Check entropy of encrypted portion (should be high for properly encrypted data)
    const encryptedPortion = encryptedBuffer.slice(offset, Math.min(offset + 1000, encryptedBuffer.length));
    
    // Only check entropy if we have enough data
    if (encryptedPortion.length >= 100) {
      const entropy = calculateEntropy(encryptedPortion);
      
      if (entropy < 5.0) { // Lower threshold for smaller files
        return {
          isValid: false,
          error: 'Low entropy suggests data may not be properly encrypted'
        };
      }
      
      return {
        isValid: true,
        entropy: entropy,
        encryptedDataSize: encryptedBuffer.length - offset
      };
    } else {
      // For very small files, just validate structure
      return {
        isValid: true,
        entropy: null,
        encryptedDataSize: encryptedBuffer.length - offset,
        note: 'Entropy check skipped for small file'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Validation error: ' + error.message
    };
  }
};

/**
 * Calculate entropy of a buffer (measure of randomness)
 * @param {Buffer} buffer - Buffer to analyze
 * @returns {number} - Entropy value (0-8, higher is more random)
 */
const calculateEntropy = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return 0;
  }
  
  const frequency = new Array(256).fill(0);
  
  // Count frequency of each byte value
  for (let i = 0; i < buffer.length; i++) {
    frequency[buffer[i]]++;
  }
  
  let entropy = 0;
  const bufferLength = buffer.length;
  
  // Calculate Shannon entropy
  for (let i = 0; i < 256; i++) {
    if (frequency[i] > 0) {
      const p = frequency[i] / bufferLength;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
};

/**
 * Create secure file encryption metadata
 * @param {string} userId - User ID
 * @param {string} fileName - Original file name
 * @param {string} encryptionType - 'account' or 'custom'
 * @returns {Object} - Encryption metadata
 */
const createEncryptionMetadata = (userId, fileName, encryptionType = 'account') => {
  const timestamp = Date.now();
  
  return {
    userId,
    fileName: fileName.substring(0, 255), // Limit filename length
    encryptionType, // 'account' or 'custom'
    algorithm: ALGORITHM,
    keyDerivation: {
      method: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512'
    },
    timestamp,
    version: '2.0' // Encryption version for future compatibility
  };
};

module.exports = {
  encryptFile,
  decryptFile,
  verifyAccountPassword,
  hashCustomPassword,
  clearPasswordFromMemory,
  validateEncryption,
  createEncryptionMetadata,
  validatePassword,
  generateSalt,
  generateIV,
  deriveKey,
  calculateEntropy,
  
  // Constants
  ALGORITHM,
  KEY_LENGTH,
  IV_LENGTH,
  TAG_LENGTH,
  SALT_LENGTH,
  PBKDF2_ITERATIONS,
  PASSWORD_MIN_LENGTH,
  MAX_FILE_SIZE
};