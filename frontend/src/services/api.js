import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Don't set Content-Type for FormData - let the browser handle it
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout on actual token expiration/invalid token errors
    // Don't logout on password validation errors (401 from file operations)
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.message || '';
      const endpoint = error.config?.url || '';
      
      // Check if this is a token/auth error vs password validation error
      const isAuthError = 
        errorMessage.includes('token') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('not authenticated') ||
        endpoint.includes('/auth/');
      
      // Only logout if it's an actual auth/token error
      if (isAuthError) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
  logout: () => api.post('/auth/logout'),
  verifyToken: () => api.get('/auth/verify-token'),
};

// File API functions
export const fileAPI = {
  uploadFiles: (formData) => api.post('/files/upload', formData),
  getFiles: (folderId = null) => api.get('/files', { params: { folderId } }),
  downloadFile: (fileId, data) => 
    api.post(`/files/${fileId}/download`, data, {
      responseType: 'blob',
      timeout: 300000 // 5 minute timeout for large files
    }),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  renameFile: (fileId, newName) => api.put(`/files/${fileId}/rename`, { newName }),
  getFileDetails: (fileId) => api.get(`/files/${fileId}`),
  searchFiles: (query, fileType = null, folderId = null) => 
    api.get('/files/search', { params: { query, fileType, folderId } }),
  
  // Share file functions
  createShareLink: (shareData) =>
    api.post('/shared-files/create', shareData),
  
  getShareDetails: (shareToken) =>
    api.get(`/shared-files/${shareToken}/details`),
  
  verifySharePassword: (shareToken, data) =>
    api.post(`/shared-files/${shareToken}/verify-password`, data),
  
  downloadSharedFile: (shareToken, data) =>
    api.post(`/shared-files/${shareToken}/download`, data, {
      responseType: 'blob',
      timeout: 300000 // 5 minute timeout for large files
    }),
  
  previewSharedFile: (shareToken, data) =>
    api.post(`/shared-files/${shareToken}/preview`, data, {
      responseType: 'arraybuffer',
      timeout: 300000 // 5 minute timeout for large files
    }),
  
  getMyShares: () =>
    api.get('/shared-files/my-shares'),
  
  deactivateShare: (shareId) =>
    api.delete(`/shared-files/${shareId}`)
};

// Secure File API functions (new secure encryption system)
export const secureFileAPI = {
  verifyAccountPassword: (password) => 
    api.post('/secure-files/verify-password', { password }),
  
  uploadFilesSecure: (formData) => 
    api.post('/secure-files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  downloadFileSecure: (fileId, encryptionType, password, preview = false) => 
    api.post(`/secure-files/download/${fileId}`, { 
      encryptionType, 
      password, 
      preview 
    }, {
      responseType: 'blob'
    })
};

// Secure Delete API functions (new secure deletion system)
export const secureDeleteAPI = {
  deleteFileSecure: (fileId, confirmationName) =>
    api.delete(`/secure-delete/files/${fileId}`, {
      data: { confirmationName }
    }),
  
  deleteFolderSecure: (folderId, confirmationName) =>
    api.delete(`/secure-delete/folders/${folderId}`, {
      data: { confirmationName }
    }),

  getFolderDeletePreview: (folderId) =>
    api.get(`/secure-delete/folders/${folderId}/preview`)
};

// Folder API functions
export const folderAPI = {
  createFolder: (folderName, parentFolderId = null) => 
    api.post('/folders', { folderName, parentFolderId }),
  getFolderContents: (folderId = 'root') => api.get(`/folders/${folderId}/contents`),
  getFolderHierarchy: (folderId) => api.get(`/folders/${folderId}/hierarchy`),
  renameFolder: (folderId, newName) => api.put(`/folders/${folderId}/rename`, { newName }),
  deleteFolder: (folderId) => api.delete(`/folders/${folderId}`),
  getStorageStats: () => api.get('/folders/stats')
};

// Cloud Configuration API functions (BYOS - Bring Your Own Storage)
export const cloudConfigAPI = {
  // Connect AWS S3 bucket
  connectBucket: (bucketData) => 
    api.post('/cloud-config/connect', bucketData),

  // Get connection status
  getConnectionStatus: () => 
    api.get('/cloud-config/status'),

  // Disconnect bucket
  disconnectBucket: () => 
    api.post('/cloud-config/disconnect'),

  // Test connection
  testConnection: () => 
    api.post('/cloud-config/test'),

  // Get IAM policy template
  getIAMPolicy: (bucketName) => 
    api.get(`/cloud-config/iam-policy?bucketName=${bucketName}`),

  // Get bucket statistics
  getBucketStats: () => 
    api.get('/cloud-config/stats'),

  // Update bucket configuration
  updateBucketConfig: (updateData) => 
    api.put('/cloud-config/update', updateData)
};

// Shared Files API functions (Secure file sharing system)
export const sharedFilesAPI = {
  // Generate share link
  generateShareLink: (shareData) =>
    api.post('/shared-files/generate', shareData),

  // Get share details (public - no auth required)
  getShareDetails: (shareToken) =>
    api.get(`/shared-files/${shareToken}/details`),

  // Verify share password (public - no auth required)
  verifySharePassword: (shareToken, password) =>
    api.post(`/shared-files/${shareToken}/verify-password`, { password }),

  // Download shared file (public - no auth required)
  downloadSharedFile: (shareToken, password, preview = false) =>
    api.post(`/shared-files/${shareToken}/download`, { password, preview }, {
      responseType: 'blob'
    }),

  // Get user's shares (protected)
  getMyShares: (page = 1, limit = 10) =>
    api.get('/shared-files/my-shares', { params: { page, limit } }),

  // Deactivate share (protected)
  deactivateShare: (shareId) =>
    api.put(`/shared-files/${shareId}/deactivate`),

  // Delete share (protected)
  deleteShare: (shareId) =>
    api.delete(`/shared-files/${shareId}`)
};

export default api;