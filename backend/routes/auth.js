const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout,
  verifyToken
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validatePasswordChange
} = require('../middleware/validation');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/login', validateLogin, login);

// Protected routes (require authentication)
router.use(protect); // All routes below this middleware require authentication

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', validatePasswordChange, changePassword);
router.post('/logout', logout);
router.get('/verify-token', verifyToken);

module.exports = router;