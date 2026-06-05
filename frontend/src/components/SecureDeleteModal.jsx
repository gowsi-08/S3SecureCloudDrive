import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2, Shield, Lock, FileText, Folder, HardDrive, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const SecureDeleteModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  item = null, 
  type = 'file', // 'file' or 'folder'
  loading = false,
  folderPreview = null // For folder deletion preview
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [step, setStep] = useState(1); // 1: Warning, 2: Confirmation

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmationText('');
      setIsVerified(false);
      setShowWarning(false);
      setStep(1);
    }
  }, [isOpen]);

  // Verify confirmation text
  useEffect(() => {
    if (item) {
      const targetName = type === 'file' ? item.fileName || item.name : item.folderName || item.name;
      const isMatch = confirmationText.trim() === targetName;
      setIsVerified(isMatch);
      
      // Show warning if user typed something but it doesn't match
      if (confirmationText.length > 0 && !isMatch) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }
  }, [confirmationText, item, type]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isVerified) {
      toast.error(`Please enter the exact ${type} name to confirm deletion`);
      return;
    }

    try {
      await onConfirm(item, confirmationText.trim());
      onClose();
      setStep(1);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Handle next step
  const handleNext = () => {
    setStep(2);
  };

  // Handle back
  const handleBack = () => {
    setStep(1);
  };

  if (!isOpen || !item) return null;

  const targetName = type === 'file' ? item.fileName || item.name : item.folderName || item.name;
  const ItemIcon = type === 'file' ? FileText : Folder;

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 overflow-y-auto" 
          style={{ zIndex: 9999 }}
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75 backdrop-blur-sm"
              onClick={onClose}
              style={{ zIndex: 9998 }}
            />

          {/* Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl sm:max-w-lg relative"
            style={{ zIndex: 10000 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Permanent Delete {type === 'file' ? 'File' : 'Folder'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    This action cannot be undone
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

            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {/* Warning Step */}
                <div className="mb-6">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                    <div className="flex items-start space-x-3">
                      <Shield className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-red-800 mb-1">
                          Security Warning
                        </h4>
                        <p className="text-sm text-red-700">
                          You are about to permanently delete this {type}. This action will:
                        </p>
                        <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                          <li>Remove all data permanently from our servers</li>
                          <li>Delete encrypted files from secure storage</li>
                          {type === 'folder' && (
                            <>
                              <li>Delete all files and subfolders recursively</li>
                              <li>Remove all nested content permanently</li>
                            </>
                          )}
                          <li>Cannot be recovered or restored</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-start space-x-3">
                      <ItemIcon className="w-8 h-8 text-gray-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {targetName}
                        </h4>
                        <div className="mt-2 space-y-1">
                          {type === 'file' ? (
                            <>
                              <div className="flex items-center text-sm text-gray-600">
                                <FileText className="w-4 h-4 mr-2" />
                                Type: {item.fileType || 'Unknown'}
                              </div>
                              <div className="flex items-center text-sm text-gray-600">
                                <HardDrive className="w-4 h-4 mr-2" />
                                Size: {formatFileSize(item.fileSizeBytes || item.fileSize)}
                              </div>
                              {item.uploadedAt && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Clock className="w-4 h-4 mr-2" />
                                  Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {folderPreview && (
                                <>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <FileText className="w-4 h-4 mr-2" />
                                    Files: {folderPreview.totalFiles}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Folder className="w-4 h-4 mr-2" />
                                    Subfolders: {folderPreview.nestedFolders}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <HardDrive className="w-4 h-4 mr-2" />
                                    Total Size: {folderPreview.totalSize}
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Folder Preview Details */}
                  {type === 'folder' && folderPreview && folderPreview.totalFiles > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-yellow-800 mb-2">
                            This will delete {folderPreview.totalFiles} file(s) and {folderPreview.nestedFolders} subfolder(s)
                          </h4>
                          {folderPreview.sampleFiles && folderPreview.sampleFiles.length > 0 && (
                            <div>
                              <p className="text-sm text-yellow-700 mb-2">Sample files to be deleted:</p>
                              <ul className="text-sm text-yellow-700 space-y-1">
                                {folderPreview.sampleFiles.map((file, index) => (
                                  <li key={index} className="flex items-center space-x-2">
                                    <FileText className="w-3 h-3" />
                                    <span className="truncate">{file.name}</span>
                                    <span className="text-xs">({file.size})</span>
                                  </li>
                                ))}
                                {folderPreview.totalFiles > folderPreview.sampleFiles.length && (
                                  <li className="text-xs italic">
                                    ... and {folderPreview.totalFiles - folderPreview.sampleFiles.length} more files
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    disabled={loading}
                  >
                    Continue to Confirmation
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Confirmation Step */}
                <form onSubmit={handleSubmit}>
                  <div className="mb-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-medium text-red-800 mb-2">
                            Are you sure you want to permanently delete {type === 'file' ? 'file' : 'folder'} '{targetName}'?
                          </h4>
                          <p className="text-sm text-red-700 mb-3">
                            {type === 'folder' && folderPreview && (
                              <>This will delete {folderPreview.totalFiles} file(s) and {folderPreview.nestedFolders} subfolder(s). </>
                            )}
                            This action cannot be undone.
                          </p>
                          <p className="text-sm font-medium text-red-800">
                            To confirm deletion, type the full {type} name below:
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Target Name Display */}
                    <div className="bg-gray-100 rounded-lg p-3 mb-4">
                      <div className="flex items-center space-x-2">
                        <ItemIcon className="w-5 h-5 text-gray-600" />
                        <span className="font-mono text-sm font-medium text-gray-900 break-all">
                          {targetName}
                        </span>
                      </div>
                    </div>

                    {/* Input Field */}
                    <div>
                      <label htmlFor="confirmationText" className="block text-sm font-medium text-gray-700 mb-2">
                        Enter the exact {type} name:
                      </label>
                      <input
                        type="text"
                        id="confirmationText"
                        value={confirmationText}
                        onChange={(e) => setConfirmationText(e.target.value)}
                        placeholder={`Type: ${targetName}`}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                          showWarning 
                            ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                            : isVerified 
                              ? 'border-green-300 focus:ring-green-500 bg-green-50'
                              : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        disabled={loading}
                        autoComplete="off"
                        spellCheck="false"
                      />
                      
                      {/* Validation Messages */}
                      {showWarning && (
                        <motion.p 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-red-600 flex items-center space-x-1"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Name does not match exactly. Please check spelling and case.</span>
                        </motion.p>
                      )}
                      
                      {isVerified && (
                        <motion.p 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 text-sm text-green-600 flex items-center space-x-1"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Name verified. You can now proceed with deletion.</span>
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      disabled={loading}
                    >
                      Back
                    </button>
                    
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!isVerified || loading}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                          isVerified && !loading
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Deleting...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Trash2 className="w-4 h-4" />
                            <span>Permanently Delete</span>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
      )}
    </AnimatePresence>
  );
};

export default SecureDeleteModal;