import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Lock, Clock, Download, Eye, AlertCircle, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { fileAPI } from '../services/api';

const ShareFileModal = ({ isOpen, onClose, file, onShareSuccess }) => {
  const [step, setStep] = useState(1);
  const [sharePassword, setSharePassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expirationOption, setExpirationOption] = useState('never');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [allowPreview, setAllowPreview] = useState(true);
  const [allowDownload, setAllowDownload] = useState(true);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Guard against null file
  if (!isOpen || !file) {
    return null;
  }

  const resetForm = () => {
    setStep(1);
    setSharePassword('');
    setConfirmPassword('');
    setExpirationOption('never');
    setMaxDownloads('');
    setAllowPreview(true);
    setAllowDownload(true);
    setShareUrl('');
    setCopied(false);
    setPasswordError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validatePasswords = () => {
    setPasswordError('');
    
    if (!sharePassword || !confirmPassword) {
      setPasswordError('Both password fields are required');
      return false;
    }
    
    if (sharePassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return false;
    }
    
    if (sharePassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleCreateShare = async () => {
    if (!validatePasswords()) return;

    setLoading(true);
    try {
      // Ensure we have the correct file ID
      const fileId = file._id || file.id;
      
      if (!fileId) {
        toast.error('File ID is missing');
        setLoading(false);
        return;
      }

      const response = await fileAPI.createShareLink({
        fileId: fileId,
        sharePassword,
        expirationOption: expirationOption === 'never' ? null : expirationOption,
        maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
        allowPreview,
        allowDownload
      });

      if (response.data.success) {
        setShareUrl(response.data.data.shareUrl);
        setStep(5);
        toast.success('Share link created successfully!');
        if (onShareSuccess) {
          onShareSuccess(response.data.data);
        }
      }
    } catch (error) {
      console.error('Create share error:', error);
      console.error('File object:', file);
      toast.error(error.response?.data?.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  };

  const contentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white">Secure Share File</h2>
              <button
                onClick={handleClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* Step 1: File Details */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">File Details</h3>
                      
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-600">File Name</label>
                          <p className="text-gray-900 font-semibold mt-1">{file?.fileName || file?.name || 'Unknown'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600">File Size</label>
                            <p className="text-gray-900 font-semibold mt-1">
                              {file?.fileSize ? (file.fileSize / (1024 * 1024)).toFixed(2) : '0'} MB
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">File Type</label>
                            <p className="text-gray-900 font-semibold mt-1">{file?.fileType || 'Unknown'}</p>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-600">Upload Date</label>
                          <p className="text-gray-900 font-semibold mt-1">
                            {file?.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setStep(2)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition mt-6"
                      >
                        Continue to Password Setup
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Password Setup */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Create Share Password</h3>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                        <p className="text-sm text-blue-800">
                          This password is separate from your account password. Recipients will need this to access the file.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Lock size={16} className="inline mr-2" />
                          Share Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={sharePassword}
                            onChange={(e) => {
                              setSharePassword(e.target.value);
                              setPasswordError('');
                            }}
                            placeholder="Enter a strong password (min 8 characters)"
                            className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2 font-semibold">
                          {sharePassword.length}/8 characters minimum
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Lock size={16} className="inline mr-2" />
                          Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => {
                              setConfirmPassword(e.target.value);
                              setPasswordError('');
                            }}
                            placeholder="Re-enter your password"
                            className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
                          >
                            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                      </div>

                      {passwordError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                          {passwordError}
                        </div>
                      )}

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setStep(1)}
                          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => setStep(3)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition"
                        >
                          Next: Settings
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Optional Settings */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Optional Settings</h3>

                      {/* Expiration */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock size={16} className="inline mr-2" />
                          Link Expiration
                        </label>
                        <select
                          value={expirationOption}
                          onChange={(e) => setExpirationOption(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-medium"
                        >
                          <option value="never">Never expires</option>
                          <option value="1hour">Expires in 1 hour</option>
                          <option value="24hours">Expires in 24 hours</option>
                          <option value="7days">Expires in 7 days</option>
                        </select>
                      </div>

                      {/* Max Downloads */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Download size={16} className="inline mr-2" />
                          Maximum Downloads (Optional)
                        </label>
                        <input
                          type="number"
                          value={maxDownloads}
                          onChange={(e) => setMaxDownloads(e.target.value)}
                          placeholder="Leave empty for unlimited"
                          min="1"
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 font-medium"
                        />
                      </div>

                      {/* Permissions */}
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowPreview}
                            onChange={(e) => setAllowPreview(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            <Eye size={16} className="inline mr-2" />
                            Allow Preview
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowDownload}
                            onChange={(e) => setAllowDownload(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            <Download size={16} className="inline mr-2" />
                            Allow Download
                          </span>
                        </label>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setStep(2)}
                          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
                        >
                          Back
                        </button>
                        <button
                          onClick={() => setStep(4)}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition"
                        >
                          Review & Create
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {step === 4 && (
                  <motion.div
                    key="step4"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Review Share Settings</h3>

                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">File:</span>
                          <span className="font-semibold text-gray-900">{file?.fileName || file?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expiration:</span>
                          <span className="font-semibold text-gray-900">
                            {expirationOption === 'never' ? 'Never' : expirationOption}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max Downloads:</span>
                          <span className="font-semibold text-gray-900">
                            {maxDownloads || 'Unlimited'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Preview:</span>
                          <span className="font-semibold text-gray-900">
                            {allowPreview ? '✓ Allowed' : '✗ Disabled'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Download:</span>
                          <span className="font-semibold text-gray-900">
                            {allowDownload ? '✓ Allowed' : '✗ Disabled'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setStep(3)}
                          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleCreateShare}
                          disabled={loading}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                        >
                          {loading ? 'Creating...' : 'Create Share Link'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Success */}
                {step === 5 && (
                  <motion.div
                    key="step5"
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="space-y-4 text-center">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.6 }}
                        className="inline-block"
                      >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                          <Check size={32} className="text-green-600" />
                        </div>
                      </motion.div>

                      <h3 className="text-2xl font-bold text-gray-800">Share Link Created!</h3>
                      <p className="text-gray-600">Your secure share link is ready to share</p>

                      <div className="bg-gray-50 rounded-lg p-4 mt-4">
                        <p className="text-xs text-gray-600 mb-2">Share Link:</p>
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-3">
                          <input
                            type="text"
                            value={shareUrl}
                            readOnly
                            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
                          />
                          <button
                            onClick={handleCopyLink}
                            className="text-blue-600 hover:text-blue-700 transition"
                          >
                            {copied ? <Check size={20} /> : <Copy size={20} />}
                          </button>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                        <p className="text-sm text-blue-800">
                          <strong>Share Password:</strong> Recipients will need the password you created to access this file.
                        </p>
                      </div>

                      <button
                        onClick={handleClose}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition mt-6"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareFileModal;
