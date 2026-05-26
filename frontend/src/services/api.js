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
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
      responseType: 'blob'
    }),
  deleteFile: (fileId) => api.delete(`/files/${fileId}`),
  renameFile: (fileId, newName) => api.put(`/files/${fileId}/rename`, { newName }),
  getFileDetails: (fileId) => api.get(`/files/${fileId}`),
  searchFiles: (query, fileType = null, folderId = null) => 
    api.get('/files/search', { params: { query, fileType, folderId } })
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

export default api;