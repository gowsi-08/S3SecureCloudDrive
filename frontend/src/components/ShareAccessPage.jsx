import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Download, Eye, AlertCircle, CheckCircle, Clock, FileText, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { fileAPI } from '../services/api';
import FilePreviewViewer from './FilePreviewViewer';

const ShareAccessPage = () => {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  
  const [step, setStep] = useState('details'); // details, password, preview
  const [loading, setLoading] = useState(true);
  const [shareDetails, setShareDetails] = useState(null);
  const [password, setPassword] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [verifying, setVerifying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPreviewViewer, setShowPreviewViewer] = useState(false);

  // Fetch share details
  useEffect(() => {
    const fetchShareDetails = async () => {
      try {
        setLoading(true);
        const response = await fileAPI.getShareDetails(shareToken);
        
        if (response.data.success) {
          setShareDetails(response.data.data);
          setStep('details');
        }
      } catch (error) {
        console.error('Fetch share details error:', error);
        
        if (error.response?.status === 410) {
          toast.error('This share link has expired');
        } else if (error.response?.status === 404) {
          toast.error('Share link not found');
        } else {
          toast.error('Failed to load share details');
        }
        
        setTimeout(() => navigate('/'), 3000);
      } finally {
        setLoading(false);
      }
    };

    if (shareToken) {
      fetchShareDetails();
    }
  }, [shareToken, navigate]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    
    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    setVerifying(true);
    setPasswordError('');

    try {
      const response = await fileAPI.verifySharePassword(shareToken, { password });
      
      if (response.data.success) {
        setAccessToken(response.data.data.accessToken);
        setStep('preview');
        toast.success('Password verified!');
      }
    } catch (error) {
      console.error('Verify password error:', error);
      
      if (error.response?.status === 401) {
        setPasswordError('Invalid password');
        setAttemptsRemaining(error.response.data.attemptsRemaining || 0);
        
        if (error.response.data.attemptsRemaining === 0) {
          toast.error('Too many failed attempts. Please try again later.');
          setTimeout(() => navigate('/'), 3000);
        }
      } else if (error.response?.status === 429) {
        setPasswordError('Too many failed attempts. Please try again later.');
        setTimeout(() => navigate('/'), 3000);
      } else if (error.response?.status === 410) {
        toast.error('This share link has expired');
        setTimeout(() => navigate('/'), 3000);
      } else {
        setPasswordError('Failed to verify password');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handlePreview = async () => {
    if (!shareDetails?.settings.allowPreview) {
      toast.error('Preview is not allowed for this share');
      return;
    }

    setPreviewing(true);

    try {
      const response = await fileAPI.downloadSharedFile(shareToken, {
        password,
        preview: true
      });

      if (response.data) {
        // response.data is already a blob
        const blob = response.data;
        
        // For text files, read the blob as text
        if (shareDetails.file.type.startsWith('text/')) {
          const text = await blob.text();
          setPreviewData(text);
        } else {
          // For other file types, create a blob URL
          const url = URL.createObjectURL(blob);
          setPreviewData(url);
        }
        
        setPreviewType(shareDetails.file.type);
        setShowPreviewViewer(true);
        toast.success('File preview loaded successfully');
      }
    } catch (error) {
      console.error('Preview error:', error);
      console.error('Error response:', error.response?.data);
      
      // Extract error details for better messaging
      const errorData = error.response?.data;
      const errorCode = errorData?.code || 'UNKNOWN';
      const errorMessage = errorData?.message || 'Unable to preview file';
      const errorDetails = errorData?.details;
      
      // Provide specific error messages based on error code
      let userMessage = '❌ ' + errorMessage;
      
      if (error.response?.status === 401) {
        userMessage = '❌ Invalid password. Please verify and try again.';
      } else if (error.response?.status === 403) {
        userMessage = '❌ ' + errorMessage;
      } else if (error.response?.status === 410) {
        userMessage = '❌ This share link has expired or the file has been deleted by the owner.';
        setTimeout(() => navigate('/'), 3000);
      } else if (error.response?.status === 429) {
        userMessage = '❌ Too many failed attempts. Please try again later.';
        setTimeout(() => navigate('/'), 3000);
      } else if (error.code === 'ECONNABORTED') {
        userMessage = '❌ Preview timeout. The file is taking too long to load. Please try again.';
      } else if (error.response?.status >= 500) {
        // Use specific error codes for server errors
        if (errorCode === 'S3_FILE_NOT_FOUND') {
          userMessage = '❌ File not found in storage. It may have been deleted.';
        } else if (errorCode === 'S3_ACCESS_DENIED') {
          userMessage = '❌ Access denied to file storage. Please contact the file owner.';
        } else if (errorCode === 'S3_TIMEOUT') {
          userMessage = '❌ Storage service timeout. Please try again later.';
        } else if (errorCode === 'DECRYPTION_FAILED') {
          userMessage = '❌ Failed to decrypt file. It may be corrupted or the encryption key is incorrect.';
        } else if (errorCode === 'ENCRYPTION_PASSWORD_MISSING') {
          userMessage = '❌ File encryption key is not available. Please contact the file owner.';
        } else if (errorCode === 'FILE_DELETED') {
          userMessage = '❌ ' + errorMessage;
        } else {
          userMessage = '❌ Server error: Unable to process preview request. Please try again later.';
        }
      }
      
      toast.error(userMessage);
    } finally {
      setPreviewing(false);
    }
  };

  const handleDownload = async () => {
    if (!shareDetails?.settings.allowDownload) {
      toast.error('❌ Download is not allowed for this share');
      return;
    }

    setDownloading(true);

    try {
      toast.loading('⏳ Decrypting and downloading file...', { id: 'download' });
      
      const response = await fileAPI.downloadSharedFile(shareToken, {
        password,
        preview: false
      });

      if (response.data) {
        // response.data is already a blob
        const blob = response.data;
        const url = window.URL.createObjectURL(blob);

        // Get filename from response headers or use file name
        const contentDisposition = response.headers['content-disposition'];
        let filename = shareDetails.file.originalName || shareDetails.file.name;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('✅ File downloaded successfully', { id: 'download' });

        // Clean up
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      console.error('Download error:', error);
      console.error('Error response:', error.response?.data);
      
      // Extract error details for better messaging
      const errorData = error.response?.data;
      const errorCode = errorData?.code || 'UNKNOWN';
      const errorMessage = errorData?.message || 'Unable to download file';
      
      // Provide specific error messages based on error code
      let userMessage = '❌ ' + errorMessage;
      
      if (error.response?.status === 401) {
        userMessage = '❌ Invalid password. Please verify and try again.';
      } else if (error.response?.status === 403) {
        userMessage = '❌ ' + errorMessage;
      } else if (error.response?.status === 410) {
        userMessage = '❌ Share link has expired or download limit reached. File is no longer available.';
      } else if (error.response?.status === 429) {
        userMessage = '❌ Too many failed attempts. Please try again later.';
      } else if (error.code === 'ECONNABORTED') {
        userMessage = '❌ Download timeout. The file is taking too long to download. Please try again.';
      } else if (error.response?.status >= 500) {
        // Use specific error codes for server errors
        if (errorCode === 'S3_FILE_NOT_FOUND') {
          userMessage = '❌ File not found in storage. It may have been deleted.';
        } else if (errorCode === 'S3_ACCESS_DENIED') {
          userMessage = '❌ Access denied to file storage. Please contact the file owner.';
        } else if (errorCode === 'S3_TIMEOUT') {
          userMessage = '❌ Storage service timeout. Please try again later.';
        } else if (errorCode === 'DECRYPTION_FAILED') {
          userMessage = '❌ Failed to decrypt file. It may be corrupted or the encryption key is incorrect.';
        } else if (errorCode === 'ENCRYPTION_PASSWORD_MISSING') {
          userMessage = '❌ File encryption key is not available. Please contact the file owner.';
        } else if (errorCode === 'FILE_DELETED') {
          userMessage = '❌ ' + errorMessage;
        } else {
          userMessage = '❌ Server error: Unable to process download request. Please try again later.';
        }
      }
      
      toast.error(userMessage, { id: 'download' });
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"
        />
      </div>
    );
  }

  if (!shareDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Share Not Found</h2>
          <p className="text-gray-600 mb-6">This share link is invalid or has expired.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Secure File Share
          </h1>
          <p className="text-gray-600">Access shared file securely</p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          {/* File Details Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-white">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <FileText size={32} />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{shareDetails.file.name}</h2>
                <p className="text-blue-100 mb-3">Shared by {shareDetails.owner.name}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-100">File Size</p>
                    <p className="font-semibold">{formatFileSize(shareDetails.file.size)}</p>
                  </div>
                  <div>
                    <p className="text-blue-100">File Type</p>
                    <p className="font-semibold">{shareDetails.file.type}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Share Settings Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              {shareDetails.settings.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock size={16} className="text-orange-500" />
                  <span>Expires: {formatDate(shareDetails.settings.expiresAt)}</span>
                </div>
              )}
              
              {shareDetails.settings.maxDownloads && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Download size={16} className="text-blue-500" />
                  <span>
                    Downloads: {shareDetails.settings.currentDownloads} / {shareDetails.settings.maxDownloads}
                  </span>
                </div>
              )}

              {!shareDetails.settings.allowPreview && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Eye size={16} className="text-gray-400" />
                  <span>Preview disabled</span>
                </div>
              )}

              {!shareDetails.settings.allowDownload && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Download size={16} className="text-gray-400" />
                  <span>Download disabled</span>
                </div>
              )}
            </div>

            {/* Password Entry */}
            {step === 'details' && (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleVerifyPassword}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Lock size={16} className="inline mr-2" />
                    Enter Share Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'password' : 'text'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Enter the password provided by the file owner"
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 font-medium"
                      disabled={verifying}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3 text-gray-500 hover:text-gray-700 transition"
                    >
                      {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>

                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    {passwordError}
                    {attemptsRemaining > 0 && (
                      <p className="text-xs mt-1">
                        Attempts remaining: {attemptsRemaining}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifying}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify Password'}
                </button>
              </motion.form>
            )}

            {/* Preview/Download Options */}
            {step === 'preview' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <span className="text-sm text-green-800">Password verified successfully</span>
                </div>

                {shareDetails?.settings.allowPreview && (
                  <button
                    onClick={handlePreview}
                    disabled={previewing}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    <Eye size={20} />
                    {previewing ? 'Loading Preview...' : 'Preview File'}
                  </button>
                )}

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 text-green-600 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  <Download size={20} />
                  {downloading ? 'Downloading...' : 'Download File'}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8 text-gray-600 text-sm"
        >
          <p>🔒 Your file is encrypted and secure</p>
        </motion.div>
      </div>

      {/* File Preview Viewer */}
      <FilePreviewViewer
        isOpen={showPreviewViewer}
        onClose={() => setShowPreviewViewer(false)}
        fileData={previewData}
        fileName={shareDetails?.file?.name}
        fileType={previewType}
      />
    </div>
  );
};

export default ShareAccessPage;
