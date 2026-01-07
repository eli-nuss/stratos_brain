import { useState, useRef, useEffect } from 'react'
import { useAssetFiles, formatFileSize, getFileIcon } from '../hooks/useAssetFiles'

interface FilesSectionProps {
  assetId: number
}

export function FilesSection({ assetId }: FilesSectionProps) {
  const { files, isLoading, uploadFile, deleteFile, refreshFiles } = useAssetFiles(assetId)

  // Listen for memo completion events to refresh files
  useEffect(() => {
    const handleMemoCompleted = () => {
      refreshFiles();
    };
    
    window.addEventListener('memo-completed', handleMemoCompleted);
    return () => window.removeEventListener('memo-completed', handleMemoCompleted);
  }, [refreshFiles]);
  const [isUploading, setIsUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return
    
    setIsUploading(true)
    setError(null)
    
    try {
      for (const file of Array.from(selectedFiles)) {
        await uploadFile(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDelete = async (fileId: number, fileName: string) => {
    if (!confirm(`Delete "${fileName}"?`)) return
    
    try {
      await deleteFile(fileId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          📁 Files
          <span className="text-xs text-gray-500">({files.length})</span>
        </h4>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-white transition-colors"
        >
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-4 mb-3 text-center transition-colors
          ${dragOver 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-gray-700 hover:border-gray-600'
          }
        `}
      >
        <p className="text-xs text-gray-500">
          {dragOver ? 'Drop files here' : 'Drag & drop files here'}
        </p>
      </div>

      {/* Files list */}
      {isLoading ? (
        <div className="text-xs text-gray-500">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-2">No files attached</div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.file_id}
              className="flex items-center gap-2 p-2 bg-gray-800/50 rounded hover:bg-gray-800 group"
            >
              <span className="text-lg">{getFileIcon(file.file_type)}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={file.file_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 truncate block"
                  title={file.file_name}
                >
                  {file.file_name}
                </a>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleDelete(file.file_id, file.file_name)}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1 transition-opacity"
                title="Delete file"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
