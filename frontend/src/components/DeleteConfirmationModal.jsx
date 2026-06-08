import React, { useState } from 'react';
import { AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  item,
  loading = false 
}) => {
  const [confirmationName, setConfirmationName] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!confirmationName.trim()) {
      setError('Please enter the name to confirm deletion');
      return;
    }

    if (confirmationName.trim() !== item?.name) {
      setError(`Name doesn't match. Please type "${item?.name}" exactly`);
      return;
    }

    onConfirm();
    setConfirmationName('');
    setError('');
  };

  const handleClose = () => {
    setConfirmationName('');
    setError('');
    onClose();
  };

  if (!isOpen || !item) return null;

  const isFile = item.type === 'file';
  const itemType = isFile ? 'File' : 'Folder';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Delete {itemType}?
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This action cannot be undone
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

          {/* Item Details */}
          {showDetails && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 text-sm">Item Details</h4>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Hide
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium text-gray-900 break-all">{item.name}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">{itemType}</span>
                </div>

                {isFile && item.fileSize && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Size:</span>
                    <span className="font-medium text-gray-900">{item.fileSize}</span>
                  </div>
                )}

                {isFile && item.fileType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-medium text-gray-900">{item.fileType}</span>
                  </div>
                )}

                {item.uploadedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium text-gray-900">
                      {new Date(item.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!showDetails && (
            <button
              onClick={() => setShowDetails(true)}
              className="mb-6 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              Show Details
            </button>
          )}

          {/* Warning Message */}
          <div className="mb-6 space-y-3">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>⚠️ Warning:</strong> Deleting this {itemType.toLowerCase()} will permanently remove it from your storage. This action cannot be reversed.
              </p>
            </div>

            {/* Share Link Warning for Files */}
            {isFile && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  🔗 Share Links Will Be Revoked
                </p>
                <p className="text-sm text-orange-700">
                  If you've shared this file with others, all active share links will be permanently deactivated and removed. Shared users will no longer be able to access this file.
                </p>
              </div>
            )}

            {/* Share Link Warning for Folders */}
            {!isFile && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  🔗 Share Links Will Be Revoked
                </p>
                <p className="text-sm text-orange-700">
                  All files in this folder and any shared links associated with them will be permanently deactivated. Shared users will no longer be able to access any files from this folder.
                </p>
              </div>
            )}
          </div>

          {/* Confirmation Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Type the {itemType.toLowerCase()} name to confirm deletion:
            </label>
            <div className="relative">
              <input
                type="text"
                value={confirmationName}
                onChange={(e) => {
                  setConfirmationName(e.target.value);
                  if (error) setError('');
                }}
                placeholder={`Type: ${item.name}`}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm text-gray-900 placeholder-gray-400 ${
                  error ? 'border-red-500 bg-white' : 'border-gray-300 bg-white'
                }`}
                disabled={loading}
                autoFocus
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              This is case-sensitive. You must type the exact name.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !confirmationName.trim()}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Delete {itemType}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
