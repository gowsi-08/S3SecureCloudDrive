const multer = require('multer');
const mime = require('mime-types');
const path = require('path');

// File type validation - COMPREHENSIVE whitelist
const allowedMimeTypes = [
  // Images
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
  // Documents
  'application/pdf',
  'text/plain', 'text/csv', 'text/html', 'text/xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // .pptx
  'application/rtf',
  'application/vnd.oasis.opendocument.text',  // .odt
  'application/vnd.oasis.opendocument.spreadsheet',  // .ods
  'application/vnd.oasis.opendocument.presentation',  // .odp
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-bzip2',
  // Media - Video
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',  // .avi
  'video/x-matroska',  // .mkv
  'video/webm',
  'video/x-flv',
  'video/3gpp',
  'video/3gpp2',
  // Media - Audio
  'audio/mpeg',  // .mp3
  'audio/mp4',  // .m4a
  'audio/wav', 'audio/x-wav',
  'audio/ogg',
  'audio/x-flac',  // .flac
  'audio/aac',  // .aac
  'audio/flac',
  // Code/Config files
  'text/javascript',
  'application/json',
  'application/xml',
  'text/yaml',
  'text/x-python',
  'text/x-java-source',
  'text/x-c++src',
  'text/x-csrc',
  'text/x-php',
  'text/css',
  'text/x-shellscript',
  // Additional safe types
  'application/octet-stream'  // Generic binary fallback
];

// File size limits (in bytes)
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES_PER_UPLOAD = 10;

// File filter function
const fileFilter = (req, file, cb) => {
  try {
    console.log(`📄 File filter: ${file.originalname}, MIME: ${file.mimetype}`);
    
    // Check MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      console.log(`❌ MIME type not allowed: ${file.mimetype}`);
      return cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }

    // Additional validation based on file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const expectedMimeType = mime.lookup(ext);
    
    console.log(`📝 Extension: ${ext}, Expected MIME: ${expectedMimeType}`);
    
    if (expectedMimeType && expectedMimeType !== file.mimetype) {
      console.log(`❌ MIME mismatch: expected ${expectedMimeType}, got ${file.mimetype}`);
      return cb(new Error('File extension does not match MIME type'), false);
    }

    // Check for potentially dangerous files
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.jar', '.vbs'];
    if (dangerousExtensions.includes(ext)) {
      console.log(`❌ Dangerous extension: ${ext}`);
      return cb(new Error('File type is not allowed for security reasons'), false);
    }

    console.log(`✅ File filter passed`);
    cb(null, true);
  } catch (error) {
    console.log(`❌ File filter error: ${error.message}`);
    cb(error, false);
  }
};

// Multer configuration for memory storage (we'll handle S3 upload manually)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_UPLOAD,
    fieldSize: 1024 * 1024, // 1MB for form fields
  },
  fileFilter: fileFilter
});

// Middleware to handle upload errors
const handleUploadError = (error, req, res, next) => {
  console.log('🔍 handleUploadError called');
  console.log('Error object:', error);
  console.log('Error message:', error?.message);
  console.log('Error code:', error?.code);
  
  if (error instanceof multer.MulterError) {
    console.log('❌ Multer error:', error.code, error.message);
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        console.log('📤 Returning file size error');
        return res.status(400).json({
          success: false,
          message: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        });
      case 'LIMIT_FILE_COUNT':
        console.log('📤 Returning file count error');
        return res.status(400).json({
          success: false,
          message: `Too many files. Maximum is ${MAX_FILES_PER_UPLOAD} files per upload`
        });
      case 'LIMIT_UNEXPECTED_FILE':
        console.log('📤 Returning unexpected file error');
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field'
        });
      default:
        console.log('📤 Returning generic multer error:', error.message);
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`
        });
    }
  }

  if (error && error.message && (error.message.includes('File type') || error.message.includes('not allowed'))) {
    console.log('❌ File type error:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  if (error) {
    console.log('❌ Unknown error in handleUploadError:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || 'Upload processing error'
    });
  }

  console.log('➡️ No error, passing to next middleware');
  next();
};

// Validate file content (basic security check)
const validateFileContent = (fileBuffer, mimetype) => {
  try {
    // Check for common file signatures
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
      'application/zip': [0x50, 0x4B, 0x03, 0x04],
      'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70] // ftyp box
    };

    // Check if file starts with expected signature
    if (signatures[mimetype]) {
      const signature = signatures[mimetype];
      for (let i = 0; i < signature.length; i++) {
        if (fileBuffer[i] !== signature[i]) {
          return false;
        }
      }
    }

    // Check for embedded scripts or malicious content
    const fileString = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    for (const pattern of maliciousPatterns) {
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

// Sanitize filename
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

// Get file category based on MIME type
const getFileCategory = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('text/')) return 'text';
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

module.exports = {
  upload,
  handleUploadError,
  validateFileContent,
  sanitizeFilename,
  getFileCategory,
  formatFileSize,
  allowedMimeTypes,
  MAX_FILE_SIZE,
  MAX_FILES_PER_UPLOAD
};