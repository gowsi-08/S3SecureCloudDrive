import React, { useState, useEffect } from 'react';
import { cloudConfigAPI } from '../services/api';
import toast from 'react-hot-toast';
import { ChevronDown, Plus, Trash2, AlertCircle, Loader } from 'lucide-react';

const BucketSelector = ({ selectedBucketId, onBucketChange, onNeedRefresh }) => {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);

  useEffect(() => {
    loadBuckets();
  }, []);

  const loadBuckets = async () => {
    try {
      setLoading(true);
      const response = await cloudConfigAPI.getConnectionStatus();
      
      if (response.data.success) {
        const bucketList = response.data.data.buckets || [];
        setBuckets(bucketList);
        
        if (bucketList.length > 0 && !selectedBucketId) {
          // Select first bucket by default
          onBucketChange(bucketList[0].id);
        }
      }
    } catch (error) {
      console.error('Load buckets error:', error);
      toast.error('Failed to load buckets');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectBucket = async (bucketId, bucketName) => {
    if (!window.confirm(`Are you sure you want to disconnect "${bucketName}"?`)) {
      return;
    }

    try {
      setDisconnecting(bucketId);
      const response = await cloudConfigAPI.disconnectBucket(bucketId);
      
      if (response.data.success) {
        toast.success(`Bucket "${bucketName}" disconnected`);
        
        // Remove from list
        const updatedBuckets = buckets.filter(b => b.id !== bucketId);
        setBuckets(updatedBuckets);
        
        // If selected bucket was disconnected, select another
        if (selectedBucketId === bucketId && updatedBuckets.length > 0) {
          onBucketChange(updatedBuckets[0].id);
        } else if (updatedBuckets.length === 0) {
          onBucketChange(null);
          onNeedRefresh?.();
        }
      }
    } catch (error) {
      console.error('Disconnect bucket error:', error);
      toast.error('Failed to disconnect bucket');
    } finally {
      setDisconnecting(null);
    }
  };

  const selectedBucket = buckets.find(b => b.id === selectedBucketId);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Bucket Selector Dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors"
            disabled={loading || buckets.length === 0}
          >
            <span className="flex items-center gap-2">
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium">
                    {selectedBucket?.bucketName || 'No Bucket Selected'}
                  </span>
                </>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && buckets.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
              <div className="max-h-64 overflow-y-auto">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.id}
                    className={`flex items-center justify-between px-4 py-2 hover:bg-gray-100 ${
                      selectedBucketId === bucket.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        onBucketChange(bucket.id);
                        setShowDropdown(false);
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium">{bucket.bucketName}</div>
                      <div className="text-xs text-gray-500">{bucket.region}</div>
                    </button>
                    <button
                      onClick={() => handleDisconnectBucket(bucket.id, bucket.bucketName)}
                      disabled={disconnecting === bucket.id}
                      className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Disconnect bucket"
                    >
                      {disconnecting === bucket.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Connect New Bucket Button */}
        <button
          onClick={() => {
            setShowDropdown(false);
            onNeedRefresh?.('connect');
          }}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
          title="Connect another bucket"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Bucket</span>
        </button>
      </div>

      {/* No Buckets Warning */}
      {!loading && buckets.length === 0 && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">No buckets connected</p>
            <p className="text-xs text-yellow-700">Connect an AWS S3 bucket to get started</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BucketSelector;
