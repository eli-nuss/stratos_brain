import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Activity types
export type ActivityType = 
  | 'tag_added'
  | 'tag_removed'
  | 'asset_reviewed'
  | 'memo_generated'
  | 'added_to_watchlist'
  | 'removed_from_watchlist'
  | 'added_to_model_portfolio'
  | 'removed_from_model_portfolio'
  | 'added_to_core_portfolio'
  | 'removed_from_core_portfolio'
  | 'added_to_stock_list'
  | 'removed_from_stock_list'
  | 'chat_started'
  | 'column_layout_changed';

// Entity types
export type EntityType = 
  | 'asset'
  | 'stock_list'
  | 'watchlist'
  | 'model_portfolio'
  | 'core_portfolio'
  | 'memo'
  | 'chat';

export function useUserActivity() {
  const { user, profile } = useAuth();

  // Log an activity
  const logActivity = useCallback(
    async (
      actionType: ActivityType,
      entityType: EntityType,
      entityId: number,
      metadata?: Record<string, any>
    ): Promise<boolean> => {
      // Still log even if user is not logged in (user_id will be null)
      try {
        const { error } = await supabase.from('user_activity').insert({
          user_id: user?.id || null,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          metadata: {
            ...metadata,
            user_email: profile?.email || 'anonymous',
            user_display_name: profile?.display_name || 'Anonymous',
          },
        });

        if (error) {
          console.error('Error logging activity:', error);
          return false;
        }
        return true;
      } catch (err) {
        console.error('Error logging activity:', err);
        return false;
      }
    },
    [user, profile]
  );

  // Get activity for a specific entity
  const getEntityActivity = useCallback(
    async (entityType: EntityType, entityId: number, limit = 50) => {
      try {
        const { data, error } = await supabase
          .from('user_activity')
          .select(`
            *,
            user_profiles:user_id (
              email,
              display_name
            )
          `)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching activity:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error('Error fetching activity:', err);
        return [];
      }
    },
    []
  );

  // Get recent activity for the current user
  const getMyActivity = useCallback(
    async (limit = 50) => {
      if (!user) return [];

      try {
        const { data, error } = await supabase
          .from('user_activity')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching user activity:', error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error('Error fetching user activity:', err);
        return [];
      }
    },
    [user]
  );

  return {
    logActivity,
    getEntityActivity,
    getMyActivity,
    currentUser: profile,
  };
}
