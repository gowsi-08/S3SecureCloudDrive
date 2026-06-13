const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// Import security middleware
const { generalLimiter, authLimiter } = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const folderRoutes = require('./routes/folders');
const secureFileRoutes = require('./routes/secureFiles');
const secureDeleteRoutes = require('./routes/secureDelete');
const cloudConfigRoutes = require('./routes/cloudConfig');
const sharedFilesRoutes = require('./routes/sharedFiles');

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  'https://secureclouddrive.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Apply rate limiting
app.use(generalLimiter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Secure Cloud Drive API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    corsEnabled: true
  });
});

// Detailed health check for debugging
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/secure-files', secureFileRoutes);
app.use('/api/secure-delete', secureDeleteRoutes);
app.use('/api/cloud-config', cloudConfigRoutes);
app.use('/api/shared-files', sharedFilesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URL, {
   
  })
  .then(async () => {
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📊 Database: ${mongoose.connection.name}`);
    
    // Run index migration for folders (drops old index, cleans duplicates, creates new index with bucketId)
    try {
      const Folder = require('./models/Folder');
      const migrationResult = await Folder.migrateIndexes();
      if (migrationResult.success) {
        console.log('✅ Folder indexes migrated successfully');
      } else {
        console.log('⚠️ Folder index migration failed:', migrationResult.error);
      }
    } catch (error) {
      console.error('❌ Error running index migration:', error.message);
      // Don't exit - let server continue, user can manually fix
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(() => {
    console.log('📊 MongoDB connection closed.');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}`);
});