const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const allowedOrigins = [
  'https://secureclouddrive.netlify.app',
  'https://s3-drive-project.netlify.app',
  'https://s3secureclouddrive.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Secure Cloud Drive API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Test route working!"
  });
});

// Try to load and mount routes
const loadRoute = (path, mountPath) => {
  try {
    const route = require(path);
    app.use(mountPath, route);
    console.log(`✅ Mounted: ${mountPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to load ${mountPath}:`, error.message);
    return false;
  }
};

// Load security middleware
try {
  const { generalLimiter, authLimiter } = require('./middleware/security');
  app.use(generalLimiter);
  
  loadRoute('./routes/auth', '/api/auth');
  loadRoute('./routes/files', '/api/files');
  loadRoute('./routes/folders', '/api/folders');
  loadRoute('./routes/secureFiles', '/api/secure-files');
  loadRoute('./routes/secureDelete', '/api/secure-delete');
  loadRoute('./routes/cloudConfig', '/api/cloud-config');
  loadRoute('./routes/sharedFiles', '/api/shared-files');
} catch (error) {
  console.error('❌ Failed to load middleware or routes:', error.message);
}

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error.message);
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}`);
});
