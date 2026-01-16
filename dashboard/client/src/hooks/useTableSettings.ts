import useSWR, { mutate as globalMutate } from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetcher, defaultSwrConfig, getJsonApiHeaders, API_BASE } from "../lib/api-config";

export interface TableSettings {
  id: number;
  user_id: string;
  table_key: string;
  visible_columns: string[];
  column_order: string[];
  column_widths: Record<string, number>;
  sort_by: string | null;
  sort_order: 'asc' | 'desc';
  secondary_sort_by: string | null;
  secondary_sort_order: 'asc' | 'desc';
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TableSettingsUpdate {
  visible_columns?: string[];
  column_order?: string[];
  column_widths?: Record<string, number>;
  sort_by?: string | null;
  sort_order?: 'asc' | 'desc';
  secondary_sort_by?: string | null;
  secondary_sort_order?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

/**
 * Hook to get and manage user-specific table settings
 * @param tableKey - Unique identifier for the table (e.g., 'watchlist', 'equities', 'crypto')
 */
export function useTableSettings(tableKey: string) {
  const { user } = useAuth();
  
  // Only fetch if user is authenticated
  const url = user?.id ? `${API_BASE}/dashboard/table-settings/${tableKey}` : null;
  
  const { data, error, isLoading, mutate } = useSWR<TableSettings | null>(
    url,
    apiFetcher,
    {
      ...defaultSwrConfig,
      revalidateOnFocus: false,
      // Return null for 404 (no settings saved yet)
      onError: (err) => {
        console.log(`[TableSettings] No saved settings for ${tableKey}:`, err);
      }
    }
  );

  return {
    settings: data || null,
    isLoading,
    error,
    mutate,
    isAuthenticated: !!user?.id,
  };
}

/**
 * Save table settings for the current user
 */
export async function saveTableSettings(
  tableKey: string,
  settings: TableSettingsUpdate
): Promise<TableSettings> {
  const response = await fetch(`${API_BASE}/dashboard/table-settings/${tableKey}`, {
    method: 'PUT',
    headers: getJsonApiHeaders(),
    body: JSON.stringify(settings),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save table settings');
  }
  
  const savedSettings = await response.json();
  
  // Revalidate the settings
  globalMutate(`${API_BASE}/dashboard/table-settings/${tableKey}`);
  
  return savedSettings;
}

/**
 * Reset table settings to defaults (delete saved settings)
 */
export async function resetTableSettings(tableKey: string): Promise<void> {
  const response = await fetch(`${API_BASE}/dashboard/table-settings/${tableKey}`, {
    method: 'DELETE',
    headers: getJsonApiHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reset table settings');
  }
  
  // Revalidate the settings
  globalMutate(`${API_BASE}/dashboard/table-settings/${tableKey}`);
}

/**
 * Get default table settings for a specific table
 */
export function getDefaultTableSettings(tableKey: string): TableSettingsUpdate {
  // Default settings can be customized per table
  const defaults: Record<string, TableSettingsUpdate> = {
    watchlist: {
      sort_by: 'ai_setup_quality_score',
      sort_order: 'desc',
      visible_columns: ['symbol', 'name', 'price', 'change_pct', 'ai_setup_quality_score', 'signal_label'],
    },
    equities: {
      sort_by: 'dollar_volume',
      sort_order: 'desc',
      visible_columns: ['symbol', 'name', 'price', 'change_pct', 'dollar_volume', 'ai_setup_quality_score'],
    },
    crypto: {
      sort_by: 'dollar_volume',
      sort_order: 'desc',
      visible_columns: ['symbol', 'name', 'price', 'change_pct', 'dollar_volume', 'ai_setup_quality_score'],
    },
  };
  
  return defaults[tableKey] || {
    sort_by: null,
    sort_order: 'desc',
    visible_columns: [],
  };
}
