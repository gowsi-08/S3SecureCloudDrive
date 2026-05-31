import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, 
  Trash2, 
  Copy, 
  Check, 
  Clock, 
  Download, 
  Eye, 
  Lock,
  AlertCircle,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { sharedFilesAPI } from '../services/api';

const ShareManagementPage = ({ isOpen, onClose }) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copied, setCopied] = useState(null);
  const [expandedShare, setExpandedShare] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [deletingId, setDeleteId] = useState(null);

  // Fetch user's shares
  const fetchShares = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await sharedFilesAPI.getMyShares(pageNum, 10);
      
      if (response.data.success) {
        setShares(response.data.data);
        setPage(response.data.pagination.page);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Fetch shares error:', error);
      toast.error('Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchShares();
    }
  }, [isOpen]);

  const handleCopyLink = (shareToken) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(shareToken);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeactivateShare = async (shareId) => {
    if (!window.confirm('Are you sure you want to deactivate this share?')) return;

    try {
      setDeactivatingId(shareId);
      const response = await sharedFilesAPI.deactivateShare(shareId);
      
      if (response.data.success) {
        toast.success('Share deactivated successfully');
        fetchShares(page);
      }
    } catch (error) {
      console.error('Deactivate share error:', error);
      toast.error('Failed to deactivate share');
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleDeleteShare = async (shareId) => {
    if (!window.confirm('Are you sure you want to permanently delete this share?')) return;

    try {
      setDeleteId(shareId);
      const response = await sharedFilesAPI.deleteShare(shareId);
      
      if (response.data.success) {
        toast.success('Share deleted successfully');
        fetchShares(page);
      }
    } catch (error) {
      console.error('Delete share error:', error);
      toast.error('Failed to delete share');
    } finally {
      setDeleteId(null);
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

  const getExpirationStatus = (expiresAt) => {
    if (!expiresAt) return { text: 'Never', color: 'text-gray-600' };
    
    const now = new Date();
    const expDate = new Date(expiresAt);
    const diffMs = expDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffMs < 0) return { text: 'Expired', color: 'text-red-600' };
    if (diffHours < 1) return { text: 'Expires soon', color: 'text-orange-600' };
    if (diffHours < 24) return { text: `${Math.floor(diffHours)}h left`, color: 'text-orange-600' };
    
    const diffDays = Math.floor(diffHours / 24);
    return { text: `${diffDays}d left`, color: 'text-green-600' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Share2 size={28} className="text-white" />
            <h2 className="text-2xl font-bold text-white">My Shares</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && shares.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"
              />
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-12">
              <Share2 size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Shares Yet</h3>
              <p className="text-gray-500">You haven't created any file shares yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shares.map((share) => {
                const expirationStatus = getExpirationStatus(share.expiresAt);
                const isExpired = share.isExpired;
                
                return (
                  <motion.div
                    key={share.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`border rounded-lg p-4 transition ${
                      isExpired 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {/* Share Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800">{share.fileName}</h3>
                          {isExpired && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                              Expired
                            </span>
                          )}
                          {!share.isActive && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatFileSize(share.fileSize)} • {share.fileType}
                        </p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyLink(share.shareToken)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Copy link"
                        >
                          {copied === share.shareToken ? (
                            <Check size={18} className="text-green-600" />
                          ) : (
                            <Copy size={18} />
                          )}
                        </button>

                        <button
                          onClick={() => setExpandedShare(expandedShare === share.id ? null : share.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition"
                        >
                          <ChevronDown 
                            size={18} 
                            className={`transition-transform ${expandedShare === share.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Share Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-medium text-gray-800">{formatDate(share.createdAt)}</p>
                      </div>

                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <Clock size={14} />
                          Expiration
                        </p>
                        <p className={`font-medium ${expirationStatus.color}`}>
                          {expirationStatus.text}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-600 flex items-center gap-1">
                          <Download size={14} />
                          Downloads
                        </p>
                        <p className="font-medium text-gray-800">
                          {share.maxDownloads 
                            ? `${share.currentDownloads}/${share.maxDownloads}` 
                            : `${share.currentDownloads}/∞`
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-600">Permissions</p>
                        <div className="flex gap-1 mt-1">
                          {share.allowPreview && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1">
                              <Eye size={12} /> Preview
                            </span>
                          )}
                          {share.allowDownload && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded flex items-center gap-1">
                              <Download size={12} /> Download
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedShare === share.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-gray-200 pt-3 mt-3"
                      >
                        <div className="bg-white rounded p-3 mb-3">
                          <p className="text-xs text-gray-600 mb-2">Share Link:</p>
                          <div className="flex items-center gap-2 bg-gray-100 rounded p-2">
                            <input
                              type="text"
                              value={`${window.location.origin}/share/${share.shareToken}`}
                              readOnly
                              className="flex-1 bg-transparent outline-none text-xs text-gray-700 font-mono"
                            />
                            <button
                              onClick={() => handleCopyLink(share.shareToken)}
                              className="text-blue-600 hover:text-blue-700 transition"
                            >
                              {copied === share.shareToken ? (
                                <Check size={16} />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          </div>
                        </div>

                        {share.lastAccessedAt && (
                          <p className="text-xs text-gray-600 mb-3">
                            Last accessed: {formatDate(share.lastAccessedAt)}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          {share.isActive && !isExpired && (
                            <button
                              onClick={() => handleDeactivateShare(share.id)}
                              disabled={deactivatingId === share.id}
                              className="flex-1 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded text-sm font-medium transition disabled:opacity-50"
                            >
                              {deactivatingId === share.id ? 'Deactivating...' : 'Deactivate'}
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteShare(share.id)}
                            disabled={deletingId === share.id}
                            className="flex-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <Trash2 size={14} />
                            {deletingId === share.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => fetchShares(page - 1)}
                disabled={page === 1 || loading}
                className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => fetchShares(page + 1)}
                disabled={page === totalPages || loading}
                className="px-3 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Next
              </button>

              <button
                onClick={() => fetchShares(page)}
                disabled={loading}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition"
                title="Refresh"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ShareManagementPage;
