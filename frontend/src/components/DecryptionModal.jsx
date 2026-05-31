import React, { useState, useEffect } from 'react';
import { X, Lock, Shield, Eye, EyeOff, Download, FileText, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const DecryptionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  file = null, 
  loading = false,
  action = 'download' // 'download' or 'preview'
}) => {
  const [step, setStep] = useState('choice'); // 'choice', 'account-password', 'custom-password'
  const [accountPassword, setAccountPassword] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setAccountPassword('');
      setCustomPassword('');
      setErrors({});
    }
  }, [isOpen]);

  // Clear sensitive data when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Clear sensitive data from memory
      setAccountPassword('');
      setCustomPassword('');
    };
  }, []);

  // Validate passwords
  const validatePasswords = () => {
    const newErrors = {};

    if (step === 'account-password') {
      if (!accountPassword.trim()) {
        newErrors.accountPassword = 'Account password is required';
      }
    } else if (step === 'custom-password') {
      if (!customPassword.trim()) {
        newErrors.customPassword = 'Custom password is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validatePasswords()) {
      return;
    }

    try {
      if (step === 'account-password') {
        // Use account password for decryption
        await onConfirm({
          type: 'account',
          password: accountPassword,
          file,
          action
        });
      } else if (step === 'custom-password') {
        // Use custom password for decryption
        await onConfirm({
          type: 'custom',
          password: customPassword,
          file,
          action
        });
      }

      // Clear sensitive data after successful submission
      setAccountPassword('');
      setCustomPassword('');
      
    } catch (error) {
      console.error('Decryption error:', error);
      
      // Show error on the same page instead of throwing
      if (step === 'account-password') {
        setErrors({
          accountPassword: error.message || 'Wrong password. Please check your password and try again.'
        });
      } else if (step === 'custom-password') {
        setErrors({
          customPassword: error.message || 'Wrong password. Please check your password and try again.'
        });
      }
      
      // Don't close the modal, let user fix the error
      toast.error(error.message || 'Decryption failed. Please check your password.');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (step === 'account-password' || step === 'custom-password') {
      setStep('choice');
      setAccountPassword('');
      setCustomPassword('');
      setErrors({});
    }
  };

  // Handle modal close
  const handleClose = () => {
    // Clear sensitive data before closing
    setAccountPassword('');
    setCustomPassword('');
    setErrors({});
    onClose();
  };

  if (!isOpen || !file) return null;

  const actionIcon = action === 'preview' ? FileText : Download;
  const actionText = action === 'preview' ? 'Preview' : 'Download';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full">
                <Lock className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {step === 'choice' && `${actionText} Encrypted File`}
                  {step === 'account-password' && 'Enter Account Password'}
                  {step === 'custom-password' && 'Enter Custom Password'}
                </h3>
                <p className="text-sm text-gray-500 truncate max-w-xs">
                  {file.fileName || file.name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File Info */}
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">File:</span>
              <span className="font-medium text-gray-900 truncate ml-2 max-w-xs">
                {file.originalName || file.fileName || file.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Size:</span>
              <span className="text-gray-900">{file.fileSize}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Type:</span>
              <span className="text-gray-900 capitalize">{file.category}</span>
            </div>
          </div>

          {/* Choice Step */}
          {step === 'choice' && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <actionIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-900">
                      Choose decryption method
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Enter the password used to encrypt this file to {action} it.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setStep('account-password')}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full group-hover:bg-blue-200">
                      <Shield className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-900">Account Password</p>
                      <p className="text-sm text-gray-500">
                        File was encrypted with your login password
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setStep('custom-password')}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 group"
                >
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full group-hover:bg-purple-200">
                      <Lock className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-900">Custom Password</p>
                      <p className="text-sm text-gray-500">
                        File was encrypted with a custom password
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="ml-2 text-sm text-yellow-800">
                    <strong>Note:</strong> Use the same password that was used to encrypt this file.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Password Step */}
          {step === 'account-password' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-900">
                      Account Password Required
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Enter your account password to decrypt and {action} this file.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Password
                </label>
                <div className="relative">
                  <input
                    type={showAccountPassword ? 'password' : 'text'}
                    value={accountPassword}
                    onChange={(e) => {
                      setAccountPassword(e.target.value);
                      if (errors.accountPassword) {
                        setErrors(prev => ({ ...prev, accountPassword: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 font-medium ${
                      errors.accountPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your account password"
                    disabled={loading}
                    autoComplete="current-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPassword(!showAccountPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-700 transition"
                    disabled={loading}
                  >
                    {showAccountPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
                {errors.accountPassword && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{errors.accountPassword}</p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !accountPassword.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Decrypting...' : actionText}
                </button>
              </div>
            </form>
          )}

          {/* Custom Password Step */}
          {step === 'custom-password' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start">
                  <Lock className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-purple-900">
                      Custom Password Required
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      Enter the custom password used to encrypt this file.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Password
                </label>
                <div className="relative">
                  <input
                    type={showCustomPassword ? 'password' : 'text'}
                    value={customPassword}
                    onChange={(e) => {
                      setCustomPassword(e.target.value);
                      if (errors.customPassword) {
                        setErrors(prev => ({ ...prev, customPassword: '' }));
                      }
                    }}
                    className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900 placeholder-gray-500 font-medium ${
                      errors.customPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter the custom password"
                    disabled={loading}
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassword(!showCustomPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-700 transition"
                    disabled={loading}
                  >
                    {showCustomPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
                {errors.customPassword && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{errors.customPassword}</p>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !customPassword.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Decrypting...' : actionText}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecryptionModal;