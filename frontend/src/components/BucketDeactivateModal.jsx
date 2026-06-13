import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const BucketDeactivateModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  bucketName,
  loading = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-black bg-opacity-50"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Deactivate Bucket?
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will disconnect the bucket
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Bucket Details */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 text-sm mb-3">Bucket Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bucket Name:</span>
                <span className="font-medium text-gray-900 break-all">{bucketName}</span>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="mb-6 space-y-3">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Warning:</strong> Deactivating this bucket will disconnect it from your account. You can reconnect it later with the same credentials.
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-2">
                ℹ️ Your files remain safe
              </p>
              <p className="text-sm text-blue-700">
                Your files stored in this S3 bucket will not be deleted. You can reconnect the bucket anytime to access them again.
              </p>
            </div>
          </div>

          {/* Confirmation Text */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Bucket Name:</strong> <span className="font-mono text-amber-600">{bucketName}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-amber-600 border border-transparent rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deactivating...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Deactivate Bucket
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BucketDeactivateModal;
