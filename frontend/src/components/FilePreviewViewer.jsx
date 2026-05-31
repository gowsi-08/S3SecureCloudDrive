import React, { useState, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FilePreviewViewer = ({ isOpen, onClose, fileData, fileName, fileType }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  if (!isOpen || !fileData) return null;

  const renderPreview = () => {
    // Image files
    if (fileType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
          <img 
            src={fileData} 
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain"
            onError={(e) => {
              console.error('Image load error:', e);
              e.target.src = '';
            }}
          />
        </div>
      );
    }

    // PDF files - using iframe with blob URL
    if (fileType === 'application/pdf') {
      return (
        <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
          <iframe
            src={fileData}
            type="application/pdf"
            width="100%"
            height="600px"
            className="rounded-lg"
            title="PDF Preview"
          />
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white">Page {currentPage}</span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      );
    }

    // Text files
    if (fileType.startsWith('text/') || fileType === 'text/plain') {
      return (
        <div className="bg-gray-900 rounded-lg p-6 overflow-auto max-h-[70vh]">
          <pre className="text-gray-100 font-mono text-sm whitespace-pre-wrap break-words">
            {typeof fileData === 'string' ? fileData : 'Unable to display text content'}
          </pre>
        </div>
      );
    }

    // Video files
    if (fileType.startsWith('video/')) {
      return (
        <div className="flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
          <video
            controls
            width="100%"
            height="600"
            className="max-w-full max-h-[70vh]"
          >
            <source src={fileData} type={fileType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    // Audio files
    if (fileType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center bg-gray-900 rounded-lg p-8">
          <div className="w-full max-w-md">
            <audio
              controls
              className="w-full"
            >
              <source src={fileData} type={fileType} />
              Your browser does not support the audio tag.
            </audio>
          </div>
          <p className="text-gray-300 mt-4">{fileName}</p>
        </div>
      );
    }

    // Default - show file info
    return (
      <div className="flex items-center justify-center bg-gray-900 rounded-lg p-8 min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-300 text-lg mb-4">Preview not available for this file type</p>
          <p className="text-gray-500">{fileType}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white truncate">{fileName}</h2>
            <p className="text-blue-100 text-sm">{fileType}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Preview Content */}
        <div className="p-6">
          {renderPreview()}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-2xl flex items-center justify-between">
          <p className="text-sm text-gray-600">Preview Mode</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default FilePreviewViewer;
