import React, { useState, useEffect } from 'react';
import { authAPI, folderAPI } from '../services/api';

const DiagnosticPage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const testResults = [];

    // Test 1: Backend Connection
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-token');
      testResults.push({
        name: 'Backend Connection',
        status: response.ok ? 'PASS' : 'FAIL',
        details: `Status: ${response.status}`,
        error: null
      });
    } catch (error) {
      testResults.push({
        name: 'Backend Connection',
        status: 'FAIL',
        details: 'Cannot connect to backend server',
        error: error.message
      });
    }

    // Test 2: Auth API
    try {
      await authAPI.verifyToken();
      testResults.push({
        name: 'Auth API',
        status: 'PASS',
        details: 'Auth API accessible',
        error: null
      });
    } catch (error) {
      testResults.push({
        name: 'Auth API',
        status: error.response?.status === 401 ? 'PASS' : 'FAIL',
        details: error.response?.status === 401 ? 'Auth API working (no token)' : 'Auth API error',
        error: error.message
      });
    }

    // Test 3: Folder API
    try {
      await folderAPI.getFolderContents('root');
      testResults.push({
        name: 'Folder API',
        status: 'PASS',
        details: 'Folder API accessible',
        error: null
      });
    } catch (error) {
      testResults.push({
        name: 'Folder API',
        status: error.response?.status === 401 ? 'PASS' : 'FAIL',
        details: error.response?.status === 401 ? 'Folder API working (no auth)' : 'Folder API error',
        error: error.message
      });
    }

    // Test 4: Local Storage
    try {
      localStorage.setItem('test', 'value');
      const value = localStorage.getItem('test');
      localStorage.removeItem('test');
      testResults.push({
        name: 'Local Storage',
        status: value === 'value' ? 'PASS' : 'FAIL',
        details: 'Local storage working',
        error: null
      });
    } catch (error) {
      testResults.push({
        name: 'Local Storage',
        status: 'FAIL',
        details: 'Local storage not accessible',
        error: error.message
      });
    }

    // Test 5: Environment Check
    testResults.push({
      name: 'Environment',
      status: 'INFO',
      details: `Frontend: http://127.0.0.1:3000, Backend: http://localhost:5000`,
      error: null
    });

    setTests(testResults);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Running diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">System Diagnostics</h1>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Test Results</h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {tests.map((test, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      test.status === 'PASS' ? 'bg-green-500' :
                      test.status === 'FAIL' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}></div>
                    <h3 className="font-medium text-gray-900">{test.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    test.status === 'PASS' ? 'bg-green-100 text-green-800' :
                    test.status === 'FAIL' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {test.status}
                  </span>
                </div>
                
                <p className="mt-2 text-sm text-gray-600">{test.details}</p>
                
                {test.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-700 font-mono">{test.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={runDiagnostics}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Re-run Diagnostics
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go to Login
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;