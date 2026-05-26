import React, { useState, useEffect } from 'react';
import { X, Lock, Shield, Eye, EyeOff, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const EncryptionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  files = [], 
  loading = false 
}) => {
  const [step, setStep] = useState('choice'); // 'choice', 'account-password', 'custom-password'
  const [accountPassword, setAccountPassword] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [confirmCustomPassword, setConfirmCustomPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errors, setErrors] = useState({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('choice');
      setAccountPassword('');
      setCustomPassword('');
      setConfirmCustomPassword('');
      setErrors({});
      setPasswordStrength(0);
    }
  }, [isOpen]);

  // Clear sensitive data when component unmounts or modal closes
  useEffect(() => {
    return () => {
      // Clear sensitive data from memory
      setAccountPassword('');
      setCustomPassword('');
      setConfirmCustomPassword('');
    };
  }, []);

  // Password strength calculation
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  // Handle custom password change
  const handleCustomPasswordChange = (value) => {
    setCustomPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
    
    // Clear errors when user starts typing
    if (errors.customPassword) {
      setErrors(prev => ({ ...prev, customPassword: '' }));
    }
  };

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
      } else if (customPassword.length < 8) {
        newErrors.customPassword = 'Password must be at least 8 characters long';
      } else if (passwordStrength < 3) {
        newErrors.customPassword = 'Password is too weak. Use a mix of letters, numbers, and symbols';
      }

      if (!confirmCustomPassword.trim()) {
        newErrors.confirmCustomPassword = 'Please confirm your password';
      } else if (customPassword !== confirmCustomPassword) {
        newErrors.confirmCustomPassword = 'Passwords do not match';
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
        // Verify account password and proceed with encryption
        await onConfirm({
          type: 'account',
          password: accountPassword,
          files,
          isCustomPassword: false
        });
      } else if (step === 'custom-password') {
        // Use custom password for encryption
        await onConfirm({
          type: 'custom',
          password: customPassword,
          files,
          isCustomPassword: true
        });
      }

      // Clear sensitive data after successful submission
      setAccountPassword('');
      setCustomPassword('');
      setConfirmCustomPassword('');
      
    } catch (error) {
      console.error('Encryption error:', error);
      toast.error(error.message || 'Encryption failed. Please try again.');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (step === 'account-password' || step === 'custom-password') {
      setStep('choice');
      setAccountPassword('');
      setCustomPassword('');
      setConfirmCustomPassword('');
      setErrors({});
    }
  };

  // Handle modal close
  const handleClose = () => {
    // Clear sensitive data before closing
    setAccountPassword('');
    setCustomPassword('');
    setConfirmCustomPassword('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 4) return 'Medium';
    return 'Strong';
  };

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
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {step === 'choice' && 'File Encryption'}
                  {step === 'account-password' && 'Verify Account Password'}
                  {step === 'custom-password' && 'Create Custom Password'}
                </h3>
                <p className="text-sm text-gray-500">
                  {files.length} file(s) selected for upload
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

          {/* Choice Step */}
          {step === 'choice' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <Lock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-900">
                      Choose your encryption method
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Your files will be encrypted before upload for maximum security.
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
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full group-hover:bg-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-900">Use Account Password</p>
                      <p className="text-sm text-gray-500">
                        Encrypt with your login password (recommended)
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
                      <p className="font-medium text-gray-900">Use Custom Password</p>
                      <p className="text-sm text-gray-500">
                        Create a unique password for these files
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="ml-2 text-sm text-yellow-800">
                    <strong>Important:</strong> Remember your chosen password. You'll need it to decrypt and access your files later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Password Step */}
          {step === 'account-password' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-900">
                      Account Password Verification
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Enter your account password to encrypt the files. This ensures only you can decrypt them.
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
                    type={showAccountPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(e) => {
                      setAccountPassword(e.target.value);
                      if (errors.accountPassword) {
                        setErrors(prev => ({ ...prev, accountPassword: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.accountPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your account password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPassword(!showAccountPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.accountPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.accountPassword}</p>
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
                  {loading ? 'Encrypting...' : 'Encrypt & Upload'}
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
                      Custom Encryption Password
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      Create a strong, unique password for these files. Make sure to remember it!
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
                    type={showCustomPassword ? 'text' : 'password'}
                    value={customPassword}
                    onChange={(e) => handleCustomPasswordChange(e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.customPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter a strong password"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassword(!showCustomPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showCustomPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {customPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Password Strength</span>
                      <span className={`font-medium ${
                        passwordStrength <= 2 ? 'text-red-600' : 
                        passwordStrength <= 4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {getPasswordStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                        style={{ width: `${(passwordStrength / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {errors.customPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.customPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmCustomPassword}
                    onChange={(e) => {
                      setConfirmCustomPassword(e.target.value);
                      if (errors.confirmCustomPassword) {
                        setErrors(prev => ({ ...prev, confirmCustomPassword: '' }));
                      }
                    }}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.confirmCustomPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your password"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmCustomPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmCustomPassword}</p>
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
                  disabled={loading || !customPassword.trim() || !confirmCustomPassword.trim()}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Encrypting...' : 'Encrypt & Upload'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EncryptionModal;