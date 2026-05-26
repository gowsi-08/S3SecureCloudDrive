import React, { useState, useEffect } from 'react';
import { X, Folder, AlertCircle, Check, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const CreateFolderModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  parentFolder = null,
  loading = false 
}) => {
  const [folderName, setFolderName] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setIsValid(false);
      setValidationError('');
      setShowValidation(false);
    }
  }, [isOpen]);

  // Validate folder name in real-time
  useEffect(() => {
    if (folderName.length === 0) {
      setIsValid(false);
      setValidationError('');
      setShowValidation(false);
      return;
    }

    setShowValidation(true);
    
    // Validate folder name
    const trimmedName = folderName.trim();
    
    if (trimmedName.length === 0) {
      setIsValid(false);
      setValidationError('Folder name cannot be empty or only spaces');
      return;
    }

    if (trimmedName.length > 255) {
      setIsValid(false);
      setValidationError('Folder name cannot exceed 255 characters');
      return;
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmedName)) {
      setIsValid(false);
      setValidationError('Folder name contains invalid characters: < > : " / \\ | ? *');
      return;
    }

    // Check for reserved names
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(trimmedName.toUpperCase())) {
      setIsValid(false);
      setValidationError('This folder name is reserved and cannot be used');
      return;
    }

    // Check for leading/trailing spaces or dots
    if (trimmedName.startsWith(' ') || trimmedName.endsWith(' ')) {
      setIsValid(false);
      setValidationError('Folder name cannot start or end with spaces');
      return;
    }

    if (trimmedName.startsWith('.') || trimmedName.endsWith('.')) {
      setIsValid(false);
      setValidationError('Folder name cannot start or end with dots');
      return;
    }

    // All validations passed
    setIsValid(true);
    setValidationError('');
  }, [folderName]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isValid || loading) {
      return;
    }

    try {
      await onConfirm(folderName.trim(), parentFolder?.id || null);
      onClose();
    } catch (error) {
      console.error('Create folder error:', error);
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setFolderName(e.target.value);
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && isValid && !loading) {
      handleSubmit(e);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 9999 }}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-50 backdrop-blur-sm"
              onClick={onClose}
              style={{ zIndex: 9998 }}
            />

            {/* Modal */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl sm:max-w-lg relative"
              style={{ zIndex: 10000 }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Folder className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Create New Folder
                  </h3>
                  <p className="text-sm text-gray-500">
                    {parentFolder ? `Inside "${parentFolder.name}"` : 'In root directory'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-2">
                  Folder Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="folderName"
                    value={folderName}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter folder name..."
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors text-gray-900 placeholder-gray-400 ${
                      showValidation
                        ? isValid
                          ? 'border-green-500 focus:ring-green-500 bg-white'
                          : 'border-red-500 focus:ring-red-500 bg-white'
                        : 'border-gray-300 focus:ring-blue-500 bg-white'
                    }`}
                    disabled={loading}
                    autoComplete="off"
                    autoFocus
                    maxLength={255}
                  />
                  
                  {/* Validation Icon */}
                  {showValidation && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      {isValid ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                        >
                          <Check className="w-3 h-3 text-white" />
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <AlertCircle className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Character Count */}
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {/* Validation Message */}
                    {showValidation && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-sm ${
                          isValid ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isValid ? '✓ Valid folder name' : validationError}
                      </motion.p>
                    )}
                  </div>
                  <span className={`text-xs ${
                    folderName.length > 240 ? 'text-red-500' : 'text-gray-500'
                  }`}>
                    {folderName.length}/255
                  </span>
                </div>
              </div>

              {/* Guidelines */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Folder Name Guidelines:</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>• Cannot contain: &lt; &gt; : " / \ | ? *</li>
                  <li>• Cannot be empty or only spaces</li>
                  <li>• Cannot start or end with dots or spaces</li>
                  <li>• Maximum 255 characters</li>
                  <li>• Cannot use reserved names (CON, PRN, AUX, etc.)</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                    isValid && !loading
                      ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 transform hover:scale-[1.02]'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Folder className="w-4 h-4" />
                      <span>Create Folder</span>
                    </div>
                  )}
                </button>
              </div>
            </form>

            {/* Security Notice */}
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-2 h-2 text-white" />
                </div>
                <p className="text-xs text-gray-600">
                  Folders are created securely with proper access controls and encryption.
                </p>
              </div>
            </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default CreateFolderModal;