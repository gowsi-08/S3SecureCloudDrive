const rateLimit = require('express-rate-limit');

// Helper function to get client IP from proxy headers
const getClientIP = (req) => {
  return req.ip || req.connection.remoteAddress;
};

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  skip: (req) => process.env.NODE_ENV !== 'production' // Disable rate limiting in development
});

// Strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: getClientIP,
  skip: (req) => process.env.NODE_ENV !== 'production' // Disable rate limiting in development
});

// Password change rate limiting
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password change attempts per hour
  message: {
    success: false,
    message: 'Too many password change attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIP,
  skip: (req) => process.env.NODE_ENV !== 'production' // Disable rate limiting in development
});

module.exports = {
  generalLimiter,
  authLimiter,
  passwordLimiter
};