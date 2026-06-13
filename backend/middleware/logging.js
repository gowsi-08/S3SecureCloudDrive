const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get current date for log file naming
const getLogFileName = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.log`;
};

// Get current timestamp
const getTimestamp = () => {
  return new Date().toISOString();
};

// Get client IP
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         'UNKNOWN';
};

// Write log to file
const writeLog = (logEntry) => {
  const logFile = path.join(logsDir, getLogFileName());
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
};

// Sanitize sensitive data from body and headers
const sanitizeData = (data) => {
  if (!data) return data;
  
  const sensitiveFields = ['password', 'token', 'Authorization', 'authorization', 'accessKeyId', 'secretAccessKey', 'sessionToken'];
  const sanitized = JSON.parse(JSON.stringify(data));
  
  if (typeof sanitized === 'object') {
    sensitiveFields.forEach(field => {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '***REDACTED***';
      }
    });
  }
  
  return sanitized;
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const requestStartTime = Date.now();
  
  // Store original response.json
  const originalJson = res.json;
  
  // Capture response
  res.json = function(data) {
    const responseTime = Date.now() - requestStartTime;
    
    // Create log entry
    const logEntry = {
      timestamp: getTimestamp(),
      type: 'HTTP',
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      query: req.query,
      clientIP: getClientIP(req),
      userAgent: req.get('user-agent'),
      requestHeaders: sanitizeData({
        'content-type': req.get('content-type'),
        'authorization': req.get('authorization'),
      }),
      requestBody: sanitizeData(req.body),
      responseStatus: res.statusCode,
      responseHeaders: {
        'content-type': res.get('content-type'),
      },
      responseBody: sanitizeData(data),
      responseTimeMs: responseTime,
      userId: req.user?.id || req.userId || null,
      email: req.user?.email || null,
    };
    
    // Write to log file
    writeLog(logEntry);
    
    // Log to console in a formatted way
    const statusColor = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅';
    console.log(
      `${statusColor} [${getTimestamp()}] ${req.method} ${req.path} - ${res.statusCode} (${responseTime}ms)`
    );
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const logEntry = {
    timestamp: getTimestamp(),
    type: 'ERROR',
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    clientIP: getClientIP(req),
    userAgent: req.get('user-agent'),
    requestBody: sanitizeData(req.body),
    errorName: err.name,
    errorMessage: err.message,
    errorCode: err.code,
    errorStatus: err.statusCode || 500,
    errorStack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId: req.user?.id || req.userId || null,
    email: req.user?.email || null,
  };
  
  // Write to log file
  writeLog(logEntry);
  
  // Log to console
  console.error(
    `❌ ERROR [${getTimestamp()}] ${req.method} ${req.path} - ${err.message}`
  );
  
  next(err);
};

// Uncaught exception logger
const setupUncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    const logEntry = {
      timestamp: getTimestamp(),
      type: 'UNCAUGHT_EXCEPTION',
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      pid: process.pid,
      memory: process.memoryUsage(),
    };
    
    writeLog(logEntry);
    console.error('❌ UNCAUGHT EXCEPTION:', error);
    process.exit(1);
  });
};

// Unhandled promise rejection logger
const setupUnhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    const logEntry = {
      timestamp: getTimestamp(),
      type: 'UNHANDLED_REJECTION',
      reason: reason instanceof Error ? {
        name: reason.name,
        message: reason.message,
        stack: reason.stack,
      } : reason,
      promise: String(promise),
      pid: process.pid,
    };
    
    writeLog(logEntry);
    console.error('❌ UNHANDLED REJECTION:', reason);
  });
};

// Get recent logs
const getRecentLogs = (lines = 100) => {
  try {
    const logFile = path.join(logsDir, getLogFileName());
    if (!fs.existsSync(logFile)) {
      return [];
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());
    return allLines.slice(-lines).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    return [];
  }
};

// Clear old logs (older than 7 days)
const cleanupOldLogs = () => {
  try {
    const files = fs.readdirSync(logsDir);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Deleted old log file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
  }
};

module.exports = {
  requestLogger,
  errorLogger,
  setupUncaughtExceptionHandler,
  setupUnhandledRejectionHandler,
  getRecentLogs,
  cleanupOldLogs,
  getLogsDir: () => logsDir,
};
