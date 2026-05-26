const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE,
      issuer: 'secure-cloud-drive',
      audience: 'secure-cloud-drive-users'
    }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'secure-cloud-drive',
      audience: 'secure-cloud-drive-users'
    });
  } catch (error) {
    throw new Error('Invalid token');
  }
};

// Generate refresh token (longer expiry)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d',
      issuer: 'secure-cloud-drive',
      audience: 'secure-cloud-drive-users'
    }
  );
};

module.exports = {
  generateToken,
  verifyToken,
  generateRefreshToken
};