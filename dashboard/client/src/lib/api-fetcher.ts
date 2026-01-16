/**
 * Shared API fetcher with robust error handling
 * 
 * Features:
 * - Handles auth errors gracefully (returns empty data instead of breaking UI)
 * - Logs errors for debugging
 * - Handles JSON error responses
 * - Type-safe response handling
 */

export interface ApiError {
  code: number;
  message: string;
}

export function isApiError(data: unknown): data is ApiError {
  return (
    data !== null &&
    typeof data === 'object' &&
    'code' in data &&
    'message' in data
  );
}

/**
 * Enhanced fetcher for SWR hooks
 * Returns empty array on auth errors to prevent UI breakage
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url);
  
  // Check if response is ok
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] Error [${response.status}] on ${url}: ${errorText}`);
    
    // Return empty array for auth errors to prevent UI breakage
    if (response.status === 401 || response.status === 403) {
      console.warn('[API] Auth error, returning empty data');
      return [] as unknown as T;
    }
    
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle error responses that return as JSON
  if (isApiError(data)) {
    console.error(`[API] Error response: ${data.message}`);
    // Return empty array for error responses to prevent UI breakage
    return [] as unknown as T;
  }
  
  return data as T;
}

/**
 * Default SWR configuration for API hooks
 */
export const defaultSwrConfig = {
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  onError: (err: Error, key: string) => {
    console.error(`[SWR] Error fetching ${key}:`, err);
  }
};

/**
 * Make a POST request with JSON body
 */
export async function apiPost<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] POST Error [${response.status}] on ${url}: ${errorText}`);
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Make a PUT request with JSON body
 */
export async function apiPut<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] PUT Error [${response.status}] on ${url}: ${errorText}`);
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Make a DELETE request
 */
export async function apiDelete<T = unknown>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] DELETE Error [${response.status}] on ${url}: ${errorText}`);
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}
