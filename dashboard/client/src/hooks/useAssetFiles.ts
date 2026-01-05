import useSWR, { mutate } from 'swr'

const API_BASE = import.meta.env.VITE_API_URL || 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api'

interface AssetFile {
  file_id: number
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  description: string
  created_at: string
}

interface FilesResponse {
  asset_id: number
  files: AssetFile[]
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useAssetFiles(assetId: number | null) {
  const { data, error, isLoading } = useSWR<FilesResponse>(
    assetId ? `${API_BASE}/dashboard/files/${assetId}` : null,
    fetcher
  )

  const uploadFile = async (file: File, description?: string) => {
    if (!assetId) return null
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('asset_id', assetId.toString())
    if (description) {
      formData.append('description', description)
    }
    
    const response = await fetch(`${API_BASE}/dashboard/files`, {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload file')
    }
    
    const newFile = await response.json()
    
    // Revalidate the files list
    mutate(`${API_BASE}/dashboard/files/${assetId}`)
    
    return newFile
  }

  const deleteFile = async (fileId: number) => {
    const response = await fetch(`${API_BASE}/dashboard/files/${fileId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete file')
    }
    
    // Revalidate the files list
    if (assetId) {
      mutate(`${API_BASE}/dashboard/files/${assetId}`)
    }
    
    return true
  }

  return {
    files: data?.files || [],
    isLoading,
    error,
    uploadFile,
    deleteFile
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️'
  if (fileType === 'application/pdf') return '📄'
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return '📊'
  if (fileType.includes('document') || fileType.includes('word')) return '📝'
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📽️'
  if (fileType.startsWith('video/')) return '🎬'
  if (fileType.startsWith('audio/')) return '🎵'
  if (fileType.includes('zip') || fileType.includes('archive')) return '📦'
  return '📎'
}
