/**
 * Shared file utility functions
 * Consolidates file formatting, validation, and sanitization logic
 */

const path = require('path');
const crypto = require('crypto');

// Get file category based on mimetype
const getFileCategory = (mimetype) => {
  if (mimetype.includes('image')) return 'image';
  if (mimetype.includes('video')) return 'video';
  if (mimetype.includes('audio')) return 'audio';
  if (mimetype.includes('pdf')) return 'pdf';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'document';
  if (mimetype.includes('excel') || mimetype.includes('sheet')) return 'spreadsheet';
  return 'other';
};

// Format file size for display
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Sanitize filename to prevent path traversal and invalid characters
const sanitizeFilename = (filename) => {
  // Remove path traversal attempts
  let sanitized = path.basename(filename);

  // Replace invalid characters
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

  // Remove leading dots and spaces
  sanitized = sanitized.replace(/^[.\s]+/, '');

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }

  // Ensure filename is not empty
  if (!sanitized || sanitized === '') {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
};

// Validate file content against malicious patterns
const validateFileContent = (fileBuffer, fileString, filename, mimetype) => {
  try {
    // Check for suspicious executable patterns
    const suspiciousPatterns = [
      /MZ\x90\x00/g, // PE executable
      /\x7fELF/g, // ELF executable
      /^#!\/bin\//g, // Shell script
      /<%\s*@\s*Page/gi, // ASP
      /<%\s*Response\s*\.Write/gi, // ASP response
      /On\s+Error\s+Resume/gi, // VBScript
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fileString)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('File content validation error:', error);
    return false;
  }
};

// Extract token from Authorization header
const extractTokenFromHeaders = (authHeader) => {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

module.exports = {
  getFileCategory,
  formatFileSize,
  sanitizeFilename,
  validateFileContent,
  extractTokenFromHeaders
};
