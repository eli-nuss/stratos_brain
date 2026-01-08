// Global document polling service that persists across component unmounts
// This ensures documents are saved even when user switches tabs/assets

const API_BASE = 'https://wfogbaipiqootjrsprde.supabase.co/functions/v1/control-api';

interface PendingDocument {
  taskId: string;
  assetId: number;
  documentType: 'one_pager' | 'memo';
  symbol: string;
  startedAt: number;
}

// Store pending documents in memory (persists across component re-renders)
const pendingDocuments: Map<string, PendingDocument> = new Map();

// Store active polling intervals
const pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

// Event listeners for document completion
type DocumentCompletedCallback = (taskId: string, assetId: number, documentType: string) => void;
const completionListeners: Set<DocumentCompletedCallback> = new Set();

export function addCompletionListener(callback: DocumentCompletedCallback) {
  completionListeners.add(callback);
  return () => completionListeners.delete(callback);
}

function notifyCompletion(taskId: string, assetId: number, documentType: string) {
  completionListeners.forEach(callback => callback(taskId, assetId, documentType));
  // Also dispatch a custom event for components that prefer event-based updates
  window.dispatchEvent(new CustomEvent('document-completed', { 
    detail: { taskId, assetId, documentType } 
  }));
}

async function checkAndSaveDocument(pending: PendingDocument): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/dashboard/memo-status/${pending.taskId}`);
    if (!response.ok) return false;
    
    const data = await response.json();
    console.log(`[DocumentPolling] Task ${pending.taskId} status: ${data.status}`);
    
    if (data.status === 'completed' && data.output_file) {
      // Use the output_file from the API response
      const fileUrl = data.output_file.fileUrl;
      const fileName = data.output_file.fileName;
      
      console.log(`[DocumentPolling] Task completed with file: ${fileName}`);
      
      // Save the file to storage
      const saveResponse = await fetch(`${API_BASE}/dashboard/memo-status/${pending.taskId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: pending.assetId,
          file_url: fileUrl,
          file_name: fileName,
          document_type: pending.documentType
        })
      });
      
      if (saveResponse.ok) {
        console.log(`[DocumentPolling] Saved ${pending.documentType} for ${pending.symbol} (task: ${pending.taskId})`);
        notifyCompletion(pending.taskId, pending.assetId, pending.documentType);
        return true; // Document saved successfully
      } else {
        const errorText = await saveResponse.text();
        console.error(`[DocumentPolling] Save failed: ${errorText}`);
      }
      return true; // Completed, stop polling even if save failed
    } else if (data.status === 'failed' || data.status === 'cancelled') {
      console.log(`[DocumentPolling] Task ${pending.taskId} ${data.status}`);
      return true; // Stop polling
    }
    
    return false; // Still running, continue polling
  } catch (error) {
    console.error(`[DocumentPolling] Error checking task ${pending.taskId}:`, error);
    return false; // Continue polling on error
  }
}

function startPolling(taskId: string) {
  // Don't start if already polling
  if (pollingIntervals.has(taskId)) return;
  
  const pending = pendingDocuments.get(taskId);
  if (!pending) return;
  
  console.log(`[DocumentPolling] Starting polling for ${pending.symbol} ${pending.documentType} (task: ${taskId})`);
  
  // Do an immediate check
  checkAndSaveDocument(pending).then(done => {
    if (done) {
      stopPolling(taskId);
      pendingDocuments.delete(taskId);
    }
  });
  
  // Set up interval polling every 10 seconds
  const interval = setInterval(async () => {
    const currentPending = pendingDocuments.get(taskId);
    if (!currentPending) {
      stopPolling(taskId);
      return;
    }
    
    const done = await checkAndSaveDocument(currentPending);
    if (done) {
      stopPolling(taskId);
      pendingDocuments.delete(taskId);
    }
  }, 10000); // Poll every 10 seconds
  
  pollingIntervals.set(taskId, interval);
}

function stopPolling(taskId: string) {
  const interval = pollingIntervals.get(taskId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(taskId);
    console.log(`[DocumentPolling] Stopped polling for task: ${taskId}`);
  }
}

// Public API

export function registerPendingDocument(
  taskId: string,
  assetId: number,
  documentType: 'one_pager' | 'memo',
  symbol: string
) {
  const pending: PendingDocument = {
    taskId,
    assetId,
    documentType,
    symbol,
    startedAt: Date.now()
  };
  
  pendingDocuments.set(taskId, pending);
  startPolling(taskId);
  
  console.log(`[DocumentPolling] Registered ${documentType} for ${symbol} (task: ${taskId})`);
}

export function isPendingForAsset(assetId: number, documentType: 'one_pager' | 'memo'): boolean {
  for (const pending of pendingDocuments.values()) {
    if (pending.assetId === assetId && pending.documentType === documentType) {
      return true;
    }
  }
  return false;
}

export function getPendingTaskId(assetId: number, documentType: 'one_pager' | 'memo'): string | null {
  for (const [taskId, pending] of pendingDocuments.entries()) {
    if (pending.assetId === assetId && pending.documentType === documentType) {
      return taskId;
    }
  }
  return null;
}

export function getAllPendingDocuments(): PendingDocument[] {
  return Array.from(pendingDocuments.values());
}

// Restore polling on page load (if there are any pending documents in localStorage)
export function initializeFromStorage() {
  try {
    const stored = localStorage.getItem('pendingDocuments');
    if (stored) {
      const docs = JSON.parse(stored) as PendingDocument[];
      docs.forEach(doc => {
        // Only restore if less than 30 minutes old
        if (Date.now() - doc.startedAt < 30 * 60 * 1000) {
          pendingDocuments.set(doc.taskId, doc);
          startPolling(doc.taskId);
        }
      });
      console.log(`[DocumentPolling] Restored ${pendingDocuments.size} pending documents from storage`);
    }
  } catch (error) {
    console.error('[DocumentPolling] Error restoring from storage:', error);
  }
}

// Save to localStorage periodically
function saveToStorage() {
  try {
    const docs = Array.from(pendingDocuments.values());
    localStorage.setItem('pendingDocuments', JSON.stringify(docs));
  } catch (error) {
    console.error('[DocumentPolling] Error saving to storage:', error);
  }
}

// Save to storage whenever a document is registered
const originalRegister = registerPendingDocument;
export { originalRegister };

// Override to also save to storage
(function() {
  const _register = registerPendingDocument;
  (window as any).__documentPollingRegister = (
    taskId: string,
    assetId: number,
    documentType: 'one_pager' | 'memo',
    symbol: string
  ) => {
    _register(taskId, assetId, documentType, symbol);
    saveToStorage();
  };
})();

// Initialize on module load
if (typeof window !== 'undefined') {
  initializeFromStorage();
  
  // Save to storage every 30 seconds
  setInterval(saveToStorage, 30000);
  
  // Save before page unload
  window.addEventListener('beforeunload', saveToStorage);
}
