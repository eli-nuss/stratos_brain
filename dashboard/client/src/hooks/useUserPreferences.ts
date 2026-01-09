import { useCallback } from 'react';
import useSWR from 'swr';
import { supabase, UserPreference } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Fetcher for SWR
const fetchPreferences = async (userId: string): Promise<UserPreference[]> => {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching preferences:', error);
    return [];
  }
  return data || [];
};

export function useUserPreferences() {
  const { user } = useAuth();

  const { data: preferences, mutate } = useSWR(
    user ? `user-preferences-${user.id}` : null,
    () => user ? fetchPreferences(user.id) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  // Get a specific preference by key
  const getPreference = useCallback(
    <T = any>(key: string, defaultValue: T): T => {
      if (!preferences) return defaultValue;
      const pref = preferences.find((p) => p.preference_key === key);
      return pref ? (pref.preference_value as T) : defaultValue;
    },
    [preferences]
  );

  // Set a preference (upsert)
  const setPreference = useCallback(
    async <T = any>(key: string, value: T): Promise<boolean> => {
      if (!user) {
        console.warn('Cannot save preference: user not logged in');
        return false;
      }

      try {
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            {
              user_id: user.id,
              preference_key: key,
              preference_value: value,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,preference_key',
            }
          );

        if (error) {
          console.error('Error saving preference:', error);
          return false;
        }

        // Revalidate the cache
        mutate();
        return true;
      } catch (err) {
        console.error('Error saving preference:', err);
        return false;
      }
    },
    [user, mutate]
  );

  // Delete a preference
  const deletePreference = useCallback(
    async (key: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from('user_preferences')
          .delete()
          .eq('user_id', user.id)
          .eq('preference_key', key);

        if (error) {
          console.error('Error deleting preference:', error);
          return false;
        }

        mutate();
        return true;
      } catch (err) {
        console.error('Error deleting preference:', err);
        return false;
      }
    },
    [user, mutate]
  );

  return {
    preferences: preferences || [],
    getPreference,
    setPreference,
    deletePreference,
    isLoggedIn: !!user,
  };
}

// Specific preference keys used in the app
export const PREFERENCE_KEYS = {
  COLUMN_LAYOUT_WATCHLIST: 'column_layout_watchlist',
  COLUMN_LAYOUT_MODEL_PORTFOLIO: 'column_layout_model_portfolio',
  COLUMN_LAYOUT_CORE_PORTFOLIO: 'column_layout_core_portfolio',
  COLUMN_LAYOUT_EQUITIES: 'column_layout_equities',
  COLUMN_LAYOUT_CRYPTO: 'column_layout_crypto',
  COLUMN_LAYOUT_STOCK_LIST: (listId: number) => `column_layout_stock_list_${listId}`,
  HIDDEN_COLUMNS: (viewId: string) => `hidden_columns_${viewId}`,
  COLUMN_ORDER: (viewId: string) => `column_order_${viewId}`,
  COLUMN_WIDTHS: (viewId: string) => `column_widths_${viewId}`,
} as const;
