import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { folderAPI, fileAPI, cloudConfigAPI } from '../services/api';
import { 
  LogOut, 
  User, 
  Shield, 
  Cloud, 
  Upload, 
  Folder,
  File,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  FolderPlus,
  UploadCloud,
  Eye,
  Download,
  Trash2,
  Settings,
  HardDrive,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';
import EncryptionModal from './EncryptionModal';
import DecryptionModal from './DecryptionModal';
import CreateFolderModal from './CreateFolderModal';
import FilePreviewModal from './FilePreviewModal';
import BucketConnectionModal from './BucketConnectionModal';
import CreateBucketModal from './CreateBucketModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ShareFileModal from './ShareFileModal';
import ShareManagementPage from './ShareManagementPage';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: '0 MB'
  });

  // Bucket connection states
  const [bucketConnectionModalOpen, setBucketConnectionModalOpen] = useState(false);
  const [createBucketModalOpen, setCreateBucketModalOpen] = useState(false);
  const [bucketConnected, setBucketConnected] = useState(false);
  const [checkingBucket, setCheckingBucket] = useState(true);

  // Modal states
  const [encryptionModalOpen, setEncryptionModalOpen] = useState(false);
  const [decryptionModalOpen, setDecryptionModalOpen] = useState(false);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [shareFileModalOpen, setShareFileModalOpen] = useState(false);
  const [shareManagementOpen, setShareManagementOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFileForDecryption, setSelectedFileForDecryption] = useState(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [decryptionAction, setDecryptionAction] = useState('download');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  // Check if bucket is connected
  const checkBucketConnection = async () => {
    try {
      setCheckingBucket(true);
      const response = await cloudConfigAPI.getConnectionStatus();
      if (response.data.success) {
        const isConnected = response.data.data.isConnected;
        setBucketConnected(isConnected);
        if (!isConnected) {
          setBucketConnectionModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Check bucket connection error:', error);
      // If error, show modal to connect
      setBucketConnectionModalOpen(true);
    } finally {
      setCheckingBucket(false);
    }
  };

  const handleBucketConnectionSuccess = () => {
    setBucketConnected(true);
    setBucketConnectionModalOpen(false);
    toast.success('Bucket connected successfully!');
    loadFolderContents();
    loadStats();
  };

  // Load folder contents
  const loadFolderContents = async (folderId = 'root') => {
    try {
      setLoading(true);
      const response = await folderAPI.getFolderContents(folderId);
      if (response.data.success) {
        setCurrentFolder(response.data.data.currentFolder);
        setFolders(response.data.data.folders);
        setFiles(response.data.data.files);
      }
    } catch (error) {
      toast.error('Failed to load folder contents');
      console.error('Load folder error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load storage stats
  const loadStats = async () => {
    try {
      const response = await folderAPI.getStorageStats();
      if (response.data.success) {
        const data = response.data.data.storage;
        setStats({
          totalFiles: data.totalFiles,
          totalFolders: data.totalFolders,
          totalSize: data.formattedTotalSize
        });
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  // Create new folder
  const handleCreateFolder = () => {
    setCreateFolderModalOpen(true);
  };

  // Handle folder creation confirmation
  const handleCreateFolderConfirm = async (folderName, parentFolderId) => {
    try {
      setCreateFolderLoading(true);
      
      const response = await folderAPI.createFolder(folderName, parentFolderId);
      
      if (response.data.success) {
        toast.success('Folder created successfully');
        await loadFolderContents(currentFolder?.id || 'root');
        await loadStats();
      }
    } catch (error) {
      console.error('Create folder error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create folder';
      toast.error(errorMessage);
    } finally {
      setCreateFolderLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,video/*,audio/*';
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const fileArray = files.map(file => ({
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: file.type
      }));

      setSelectedFiles(fileArray);
      setEncryptionModalOpen(true);
    };
    
    input.click();
  };

  // Handle encryption confirmation from modal
  const handleEncryptionConfirm = async ({ password, files, isCustomPassword }) => {
    try {
      setUploadLoading(true);

      // Prepare form data
      const formData = new FormData();
      files.forEach(fileObj => formData.append('files', fileObj.file));
      formData.append('folderId', currentFolder?.id || '');
      formData.append('password', password);
      formData.append('isCustomPassword', isCustomPassword ? 'true' : 'false');

      toast.loading('Encrypting and uploading files...', { id: 'upload' });

      // Upload files with encryption
      const response = await fileAPI.uploadFiles(formData);
      
      if (response.data.success) {
        const uploadedFiles = response.data.data.uploadedFiles || [];
        const errors = response.data.data.errors || [];
        
        const uploadedCount = uploadedFiles.length;
        const errorCount = errors.length;
        
        if (errorCount === 0 && uploadedCount > 0) {
          toast.success(`Successfully uploaded ${uploadedCount} file(s)!`, { id: 'upload' });
        } else if (uploadedCount > 0 && errorCount > 0) {
          toast.success(`Uploaded ${uploadedCount} file(s), ${errorCount} failed`, { id: 'upload' });
        } else {
          toast.error(`All ${files.length} file(s) failed to upload`, { id: 'upload' });
        }
        
        if (uploadedCount > 0) {
          await loadFolderContents(currentFolder?.id || 'root');
          await loadStats();
        }
      }

      setEncryptionModalOpen(false);
      setSelectedFiles([]);

    } catch (error) {
      console.error('Upload error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed';
      console.log('❌ UPLOAD ERROR:', errorMessage);
      toast.error(errorMessage, { id: 'upload' });
    } finally {
      setUploadLoading(false);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folder) => {
    loadFolderContents(folder.id);
  };

  // Handle file download/preview
  const handleFileAction = (file, action = 'download') => {
    if (action === 'preview') {
      setSelectedFileForPreview(file);
      setPreviewModalOpen(true);
    } else {
      setSelectedFileForDecryption(file);
      setDecryptionAction(action);
      setDecryptionModalOpen(true);
    }
  };

  // Handle file preview
  const handleFilePreview = async (file, password) => {
    try {
      setPreviewLoading(true);

      const response = await fileAPI.downloadFile(file.id, {
        password,
        preview: true
      });
      
      // Create blob from response
      const blob = new Blob([response.data], { type: file.fileType });
      const url = window.URL.createObjectURL(blob);

      // Handle different file types
      if (file.category === 'image') {
        const newWindow = window.open();
        newWindow.document.write(`
          <html>
            <head><title>${file.fileName}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; background:#f3f4f6;">
              <img src="${url}" style="max-width:100%; max-height:100vh; object-fit:contain;" alt="${file.fileName}">
            </body>
          </html>
        `);
      } else if (file.category === 'pdf') {
        window.open(url, '_blank');
      } else {
        // For other files, download them
        const link = document.createElement('a');
        link.href = url;
        link.download = file.originalName || file.fileName;
        link.click();
      }
      
      toast.success('File decrypted and previewed successfully');
      
      // Clean up
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

    } catch (error) {
      console.error('Preview error:', error);
      throw error; // Re-throw to be handled by the modal
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle decryption confirmation from modal
  const handleDecryptionConfirm = async ({ password, file, action }) => {
    try {
      toast.loading(`Decrypting ${file.fileName}...`, { id: 'decrypt' });

      const response = await fileAPI.downloadFile(file.id, {
        password,
        preview: action === 'preview'
      });
      
      // Handle arraybuffer response
      const arrayBuffer = response.data;
      const blob = new Blob([arrayBuffer]);
      const url = window.URL.createObjectURL(blob);

      // Get filename from response headers or use file name
      const contentDisposition = response.headers['content-disposition'];
      let filename = file.originalName || file.fileName;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download file
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('File decrypted and downloaded successfully', { id: 'decrypt' });

      // Clean up
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setDecryptionModalOpen(false);
      setSelectedFileForDecryption(null);

    } catch (error) {
      console.error('File action error:', error);
      if (error.response?.status === 401) {
        toast.error('Wrong password! Please check your password and try again.', { id: 'decrypt' });
      } else if (error.response?.status === 404) {
        toast.error('File not found.', { id: 'decrypt' });
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Download timeout. Please try again.', { id: 'decrypt' });
      } else {
        toast.error('Failed to access file. Please try again.', { id: 'decrypt' });
      }
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (file) => {
    setItemToDelete({
      type: 'file',
      name: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
      id: file.id
    });
    setDeleteConfirmationOpen(true);
  };

  // Handle file share
  const handleShareFile = (file) => {
    setSelectedFileForShare(file);
    setShareFileModalOpen(true);
  };

  // Handle folder deletion
  const handleDeleteFolder = async (folder) => {
    setItemToDelete({
      type: 'folder',
      name: folder.name,
      id: folder.id
    });
    setDeleteConfirmationOpen(true);
  };

  // Confirm deletion
  const handleConfirmDelete = async () => {
    try {
      setDeleteLoading(true);
      
      if (itemToDelete.type === 'file') {
        await fileAPI.deleteFile(itemToDelete.id);
        toast.success('File deleted successfully');
      } else {
        await folderAPI.deleteFolder(itemToDelete.id);
        toast.success('Folder deleted successfully');
      }
      
      setDeleteConfirmationOpen(false);
      setItemToDelete(null);
      await loadFolderContents(currentFolder?.id || 'root');
      await loadStats();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete item');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Navigate back
  const navigateBack = () => {
    if (currentFolder?.parentFolderId) {
      loadFolderContents(currentFolder.parentFolderId);
    } else {
      loadFolderContents('root');
    }
  };

  // Load initial data
  useEffect(() => {
    checkBucketConnection();
    loadFolderContents();
    loadStats();
  }, []);

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
  const mainMargin = sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 ${sidebarWidth} bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out lg:translate-x-0`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center">
              <Shield className="w-6 h-6 text-blue-600" />
              <span className="ml-2 text-lg font-bold text-gray-900">SecureDrive</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="flex justify-center w-full">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
          )}
          
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4 px-2">
          <div className="space-y-1">
            <button 
              onClick={() => loadFolderContents('root')}
              className="bg-blue-50 text-blue-700 group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md hover:bg-blue-100 transition-colors"
            >
              <Cloud className="text-blue-500 h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="ml-3">My Files</span>}
            </button>
            
            {/* Divider */}
            <div className="my-2 border-t border-gray-200" />
            
            <button 
              onClick={() => setCreateBucketModalOpen(true)}
              className="text-gray-700 hover:bg-purple-50 hover:text-purple-900 group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors"
            >
              <HardDrive className="text-gray-400 group-hover:text-purple-500 h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="ml-3">Connect Bucket</span>}
            </button>
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="absolute bottom-0 w-full p-3 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={mainMargin}>
        {/* Top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6">
            <div className="flex justify-between h-14">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="ml-2 lg:ml-0 flex items-center">
                  {currentFolder && (
                    <button
                      onClick={navigateBack}
                      className="mr-2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h1 className="text-xl font-semibold text-gray-900">
                    {currentFolder ? currentFolder.name : 'My Files'}
                  </h1>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleFileUpload}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm leading-4 font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Upload
                </button>
                <button
                  onClick={handleCreateFolder}
                  className="inline-flex items-center px-4 py-2.5 border-2 border-gray-300 text-sm leading-4 font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Folder
                </button>
                <button
                  onClick={() => setShareManagementOpen(true)}
                  className="inline-flex items-center px-4 py-2.5 border-2 border-purple-300 text-sm leading-4 font-semibold rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  My Shares
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Stats Cards */}
        <div className="px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600">
                      <File className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-600">Total Files</dt>
                      <dd className="text-2xl font-bold text-gray-900">{stats.totalFiles}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-600">
                      <Folder className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-600">Total Folders</dt>
                      <dd className="text-2xl font-bold text-gray-900">{stats.totalFolders}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-600">
                      <HardDrive className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-600">Storage Used</dt>
                      <dd className="text-2xl font-bold text-gray-900">{stats.totalSize}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Upload/Create Area */}
        {(folders.length === 0 && files.length === 0) && (
          <div className="px-4 sm:px-6 py-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-blue-100 rounded-full">
                    <Cloud className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Get Started</h3>
                <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">Your storage is empty. Use the buttons above to upload files or create folders.</p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Files and Folders */}
        <div className="px-4 sm:px-6 pb-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {(folders.length > 0 || files.length > 0) && (
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Folders */}
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="group relative bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-400 transition-all duration-200 cursor-pointer"
                        onClick={() => navigateToFolder(folder)}
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="p-2 bg-blue-500 rounded-lg">
                            <Folder className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{folder.name}</p>
                            <p className="text-xs text-gray-600">Folder</p>
                          </div>
                        </div>
                        
                        {/* Folder actions */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folder);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete folder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Files */}
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="group relative bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-gray-400 transition-all duration-200"
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="p-2 bg-gray-400 rounded-lg">
                            <File className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{file.fileName}</p>
                            <p className="text-xs text-gray-600">{file.fileSize}</p>
                          </div>
                        </div>
                        
                        {/* File actions */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex space-x-1 bg-white rounded-lg shadow-md p-1">
                            <button
                              onClick={() => handleFileAction(file, 'preview')}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFileAction(file, 'download')}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleShareFile(file)}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Share"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <BucketConnectionModal
        isOpen={bucketConnectionModalOpen}
        onClose={() => setBucketConnectionModalOpen(false)}
        onSuccess={handleBucketConnectionSuccess}
      />

      <CreateBucketModal
        isOpen={createBucketModalOpen}
        onClose={() => setCreateBucketModalOpen(false)}
        onSuccess={handleBucketConnectionSuccess}
      />

      <EncryptionModal
        isOpen={encryptionModalOpen}
        onClose={() => {
          setEncryptionModalOpen(false);
          setSelectedFiles([]);
        }}
        onConfirm={handleEncryptionConfirm}
        files={selectedFiles}
        loading={uploadLoading}
      />

      <DecryptionModal
        isOpen={decryptionModalOpen}
        onClose={() => {
          setDecryptionModalOpen(false);
          setSelectedFileForDecryption(null);
        }}
        onConfirm={handleDecryptionConfirm}
        file={selectedFileForDecryption}
        action={decryptionAction}
        loading={false}
      />

      <CreateFolderModal
        isOpen={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        onConfirm={handleCreateFolderConfirm}
        currentFolder={currentFolder}
        loading={createFolderLoading}
      />

      <FilePreviewModal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          setSelectedFileForPreview(null);
        }}
        onPreview={handleFilePreview}
        file={selectedFileForPreview}
        loading={previewLoading}
      />

      <DeleteConfirmationModal
        isOpen={deleteConfirmationOpen}
        onClose={() => {
          setDeleteConfirmationOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        item={itemToDelete}
        loading={deleteLoading}
      />

      <ShareFileModal
        isOpen={shareFileModalOpen}
        onClose={() => {
          setShareFileModalOpen(false);
          setSelectedFileForShare(null);
        }}
        file={selectedFileForShare}
        onSuccess={() => {
          setShareFileModalOpen(false);
          setSelectedFileForShare(null);
        }}
      />

      <ShareManagementPage
        isOpen={shareManagementOpen}
        onClose={() => setShareManagementOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
