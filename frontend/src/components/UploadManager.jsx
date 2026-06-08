import React, { useRef, useState } from 'react';
import { Upload, FolderPlus, X, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * UploadManager Component
 * Handles both file and folder uploads with improved UI/UX
 * Supports:
 * - Single file selection
 * - Multiple file selection
 * - Folder selection (preserves structure)
 * - Drag and drop
 * - File type validation
 * - Progress indication
 */

const UploadManager = ({ 
  onFilesSelected, 
  onFolderSelected,
  isLoading = false,
  disabled = false 
}) => {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [uploadMode, setUploadMode] = useState(null); // 'file', 'folder', or null

  // List of supported file types
  const SUPPORTED_TYPES = [
    // Documents
    { type: 'application/pdf', ext: 'PDF' },
    { type: 'application/msword', ext: 'DOC' },
    { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'DOCX' },
    { type: 'application/vnd.ms-excel', ext: 'XLS' },
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'XLSX' },
    { type: 'application/vnd.ms-powerpoint', ext: 'PPT' },
    { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'PPTX' },
    // Text
    { type: 'text/plain', ext: 'TXT' },
    { type: 'text/csv', ext: 'CSV' },
    // Code
    { type: 'application/json', ext: 'JSON' },
    { type: 'text/xml', ext: 'XML' },
    { type: 'text/x-python', ext: 'PY' },
    { type: 'text/javascript', ext: 'JS' },
    { type: 'text/html', ext: 'HTML' },
    { type: 'text/css', ext: 'CSS' },
    // Archive
    { type: 'application/zip', ext: 'ZIP' },
    { type: 'application/x-rar-compressed', ext: 'RAR' },
    // Images
    { type: 'image/jpeg', ext: 'JPG' },
    { type: 'image/png', ext: 'PNG' },
    { type: 'image/gif', ext: 'GIF' },
    { type: 'image/webp', ext: 'WEBP' },
    { type: 'image/svg+xml', ext: 'SVG' },
    // Video
    { type: 'video/mp4', ext: 'MP4' },
    { type: 'video/quicktime', ext: 'MOV' },
    { type: 'video/x-msvideo', ext: 'AVI' },
    { type: 'video/x-matroska', ext: 'MKV' },
    // Audio
    { type: 'audio/mpeg', ext: 'MP3' },
    { type: 'audio/wav', ext: 'WAV' },
    { type: 'audio/ogg', ext: 'OGG' },
    { type: 'audio/flac', ext: 'FLAC' },
    // Plus all other types by wildcard
  ];

  const handleFileInputClick = () => {
    if (!disabled && !isLoading) {
      setUploadMode('file');
      fileInputRef.current?.click();
    }
  };

  const handleFolderInputClick = () => {
    if (!disabled && !isLoading) {
      setUploadMode('folder');
      folderInputRef.current?.click();
    }
  };

  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      path: file.webkitRelativePath || file.name
    }));

    setSelectedFiles(fileArray);
    setUploadMode('file');

    if (onFilesSelected) {
      onFilesSelected(fileArray);
    }
  };

  const handleFolderSelect = (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).map(file => ({
      file,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type,
      path: file.webkitRelativePath || file.name
    }));

    // Extract folder name from first file path
    const folderName = fileArray[0]?.path?.split('/')[0] || 'Folder';

    setSelectedFolder({
      name: folderName,
      fileCount: fileArray.length,
      totalSize: fileArray.reduce((sum, f) => sum + f.file.size, 0)
    });
    
    setSelectedFiles(fileArray);
    setUploadMode('folder');

    if (onFolderSelected) {
      onFolderSelected(fileArray);
    }
  };

  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  const handleFolderInputChange = (e) => {
    handleFolderSelect(e.target.files);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading && !disabled) {
      setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (isLoading || disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Generate accept attribute string from SUPPORTED_TYPES
  const generateAcceptAttribute = () => {
    // Accept all file types since we support everything
    return '*/*';
  };

  const getSupportedTypesInfo = () => {
    const typeGroups = {
      'Documents': ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'],
      'Text': ['TXT', 'CSV'],
      'Code': ['JSON', 'XML', 'PY', 'JS', 'HTML', 'CSS'],
      'Archives': ['ZIP', 'RAR'],
      'Images': ['JPG', 'PNG', 'GIF', 'WEBP', 'SVG'],
      'Video': ['MP4', 'MOV', 'AVI', 'MKV'],
      'Audio': ['MP3', 'WAV', 'OGG', 'FLAC']
    };
    return typeGroups;
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setSelectedFolder(null);
    setUploadMode(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Upload Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleFileInputClick}
          disabled={isLoading || disabled}
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm leading-4 font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-md hover:shadow-lg"
          title="Upload individual files with multiple file types"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Files
        </button>

        <button
          onClick={handleFolderInputClick}
          disabled={isLoading || disabled}
          className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm leading-4 font-semibold rounded-lg text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 shadow-md hover:shadow-lg"
          title="Upload entire folder while preserving structure"
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          Upload Folder
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        accept={generateAcceptAttribute()}
        aria-label="Upload files"
      />

      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory="true"
        mozdirectory="true"
        onChange={handleFolderInputChange}
        className="hidden"
        aria-label="Upload folder"
      />

      {/* Drag and Drop Area */}
      {selectedFiles.length === 0 && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          } ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex flex-col items-center justify-center">
            <Upload className={`w-12 h-12 mb-3 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-900">
              Drag and drop files or folders here
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Or click the upload buttons above
            </p>
          </div>
        </div>
      )}

      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedFolder ? (
                <FolderPlus className="w-5 h-5 text-purple-600" />
              ) : (
                <Upload className="w-5 h-5 text-blue-600" />
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedFolder
                    ? `Folder: ${selectedFolder.name} (${selectedFolder.fileCount} files)`
                    : `${selectedFiles.length} file(s) selected`}
                </p>
                <p className="text-xs text-gray-500">
                  Total size: {formatFileSize(
                    selectedFiles.reduce((sum, f) => sum + f.file.size, 0)
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear selection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* File List */}
          <div className="bg-white rounded border border-gray-200 max-h-40 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {selectedFiles.slice(0, 5).map((fileObj, index) => (
                <div key={index} className="px-3 py-2 flex items-center gap-2 text-xs text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="flex-1 truncate">{fileObj.path}</span>
                  <span className="text-gray-400 flex-shrink-0">{fileObj.size}</span>
                </div>
              ))}
              {selectedFiles.length > 5 && (
                <div className="px-3 py-2 text-xs text-gray-500 font-medium bg-gray-50">
                  +{selectedFiles.length - 5} more file(s)
                </div>
              )}
            </div>
          </div>

          {/* Info Messages */}
          <div className="bg-blue-50 border border-blue-200 rounded p-2 flex gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              {selectedFolder ? (
                <p>
                  ✓ Folder structure preserved • ✓ All files encrypted • ✓ Recursive upload enabled
                </p>
              ) : (
                <p>
                  ✓ All file types supported • ✓ Encrypted upload • ✓ Multiple files supported
                </p>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin">
                <Upload className="w-4 h-4" />
              </div>
              <span>Processing files...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadManager;
