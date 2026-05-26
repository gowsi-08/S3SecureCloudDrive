import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle, Copy, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { cloudConfigAPI } from '../services/api';

const BucketConnectionModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    bucketName: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: ''
  });
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedPolicy, setCopiedPolicy] = useState(false);

  const iamPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: ['s3:ListBucket', 's3:GetBucketLocation'],
        Resource: `arn:aws:s3:::${formData.bucketName || 'YOUR-BUCKET-NAME'}`
      },
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
        Resource: `arn:aws:s3:::${formData.bucketName || 'YOUR-BUCKET-NAME'}/*`
      }
    ]
  };

  const policyJson = JSON.stringify(iamPolicy, null, 2);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(policyJson);
    setCopiedPolicy(true);
    toast.success('Policy copied to clipboard!');
    setTimeout(() => setCopiedPolicy(false), 2000);
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError('');

      // Validate inputs
      const trimmedBucketName = formData.bucketName.trim();
      const trimmedAccessKeyId = formData.accessKeyId.trim();
      const trimmedSecretAccessKey = formData.secretAccessKey.trim();

      if (!trimmedBucketName) {
        setError('❌ Bucket name is required');
        setLoading(false);
        return;
      }
      if (trimmedBucketName.length < 3 || trimmedBucketName.length > 63) {
        setError('❌ Bucket name must be 3-63 characters');
        setLoading(false);
        return;
      }
      if (!trimmedAccessKeyId) {
        setError('❌ Access Key ID is required');
        setLoading(false);
        return;
      }
      if (!trimmedSecretAccessKey) {
        setError('❌ Secret Access Key is required');
        setLoading(false);
        return;
      }

      toast.loading('🔄 Validating bucket connection...', { id: 'connect' });

      // Connect bucket with trimmed values
      const response = await cloudConfigAPI.connectBucket({
        bucketName: trimmedBucketName,
        region: formData.region,
        accessKeyId: trimmedAccessKeyId,
        secretAccessKey: trimmedSecretAccessKey
      });

      if (response.data.success) {
        toast.success('✅ Bucket connected successfully!', { id: 'connect' });
        setFormData({
          bucketName: '',
          region: 'us-east-1',
          accessKeyId: '',
          secretAccessKey: ''
        });
        setStep(1);
        onSuccess();
        onClose();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to connect bucket';
      setError(`❌ ${errorMessage}`);
      toast.error(errorMessage, { id: 'connect' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">{step}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Connect Your AWS S3 Bucket</h2>
              <p className="text-blue-100 text-sm mt-1">
                {step === 1 ? 'Step 1: Setup Instructions' : 'Step 2: Enter Your Credentials'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {step === 1 ? (
            // Step 1: Instructions
            <div className="space-y-6">
              {/* Info Box */}
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                <p className="text-blue-900 font-semibold">💡 What is BYOS?</p>
                <p className="text-blue-800 text-sm mt-2">
                  Your files will be stored in YOUR OWN AWS S3 bucket. You control the storage, you own the data, and you pay only for what you use.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900 text-lg">Follow these steps:</h3>
                
                <div className="space-y-3">
                  {[
                    { num: 1, title: 'Create S3 Bucket', desc: 'Go to AWS Console → S3 → Create bucket' },
                    { num: 2, title: 'Create IAM User', desc: 'Go to IAM → Users → Create user (NOT root account)' },
                    { num: 3, title: 'Attach Policy', desc: 'Copy the policy below and attach it to your IAM user' },
                    { num: 4, title: 'Generate Keys', desc: 'Create access keys for the IAM user' },
                    { num: 5, title: 'Enter Details', desc: 'Fill in your bucket name, region, and access keys' }
                  ].map((step) => (
                    <div key={step.num} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                          {step.num}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{step.title}</p>
                        <p className="text-gray-600 text-sm">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IAM Policy */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 text-lg">📋 IAM Policy (Copy & Paste)</h3>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copiedPolicy ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-white border border-gray-300 rounded p-4 text-sm font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  <pre className="text-gray-800 whitespace-pre-wrap break-words">{policyJson}</pre>
                </div>
                <p className="text-gray-600 text-xs mt-3">
                  ⚠️ Replace <span className="bg-yellow-100 px-1 font-mono">YOUR-BUCKET-NAME</span> with your actual bucket name if it's different
                </p>
              </div>

              {/* Security Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">⚠️ Security Important:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                    <li>NEVER use AWS root account credentials</li>
                    <li>Always create a LIMITED IAM user</li>
                    <li>Only grant the 4 permissions shown above</li>
                    <li>Limit access to your specific bucket only</li>
                    <li>Your credentials will be encrypted with AES-256-GCM</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            // Step 2: Form
            <div className="space-y-5">
              {/* Bucket Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  S3 Bucket Name *
                </label>
                <input
                  type="text"
                  name="bucketName"
                  value={formData.bucketName}
                  onChange={handleChange}
                  placeholder="my-secure-storage"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  📝 Exact name of your S3 bucket (3-63 characters, lowercase)
                </p>
              </div>

              {/* Region */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  AWS Region *
                </label>
                <select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="us-east-1">US East (N. Virginia) - us-east-1</option>
                  <option value="us-west-1">US West (N. California) - us-west-1</option>
                  <option value="us-west-2">US West (Oregon) - us-west-2</option>
                  <option value="eu-west-1">EU (Ireland) - eu-west-1</option>
                  <option value="eu-central-1">EU (Frankfurt) - eu-central-1</option>
                  <option value="ap-south-1">Asia Pacific (Mumbai) - ap-south-1</option>
                  <option value="ap-southeast-1">Asia Pacific (Singapore) - ap-southeast-1</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo) - ap-northeast-1</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  🌍 Select the AWS region where your bucket is located
                </p>
              </div>

              {/* Access Key ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  IAM Access Key ID *
                </label>
                <input
                  type="text"
                  name="accessKeyId"
                  value={formData.accessKeyId}
                  onChange={handleChange}
                  placeholder="AKIA..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-gray-900 placeholder-gray-400 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  🔑 From IAM user → Security credentials → Access keys
                </p>
              </div>

              {/* Secret Access Key */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  IAM Secret Access Key *
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    name="secretAccessKey"
                    value={formData.secretAccessKey}
                    onChange={handleChange}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-gray-900 placeholder-gray-400 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  🔐 Keep this secret! It will be encrypted and stored securely
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {/* Security Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold">✓ Your credentials are safe</p>
                    <p className="mt-1">
                      Your AWS credentials will be encrypted with AES-256-GCM before storage. They will never be exposed, logged, or sent to the frontend.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 flex gap-3 border-t border-gray-200 sticky bottom-0">
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 font-semibold transition-colors"
            >
              ← Back
            </button>
          )}
          {step === 1 && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-semibold transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => step === 1 ? setStep(2) : handleConnect()}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {step === 1 ? 'Loading...' : 'Connecting...'}
              </>
            ) : (
              <>
                {step === 1 ? 'Continue' : 'Connect Bucket'}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BucketConnectionModal;
