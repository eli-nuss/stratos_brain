-- Migration: User-Specific Data
-- ==============================
-- This migration adds user_id columns to tables that should be user-specific:
-- - asset_notes (per-asset notes in the table)
-- - research_notes (already has user_id, just need to enforce it)
-- - company_chats (already has user_id, just need to enforce it)
-- - brain_chats (already has user_id, just need to enforce it)
-- - user_table_settings (new table for column/filter/sort preferences)
--
-- Shared tables (no changes needed):
-- - watchlist
-- - stock_lists, stock_list_items
-- - model_portfolio_holdings
-- - core_portfolio_holdings
-- - asset_tags

-- ============================================
-- 1. Add user_id to asset_notes table
-- ============================================

-- Add user_id column to asset_notes (nullable initially for migration)
ALTER TABLE asset_notes 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_asset_notes_user_id ON asset_notes(user_id);

-- Create composite index for user + asset lookups
CREATE INDEX IF NOT EXISTS idx_asset_notes_user_asset ON asset_notes(user_id, asset_id);

-- ============================================
-- 2. Create user_table_settings table
-- ============================================
-- Stores per-user, per-table settings for columns, sorting, filtering

CREATE TABLE IF NOT EXISTS user_table_settings (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    table_key VARCHAR(100) NOT NULL, -- e.g., 'watchlist', 'equity', 'crypto', 'stock_list_123'
    
    -- Column configuration
    visible_columns JSONB DEFAULT '[]'::jsonb, -- Array of column IDs
    column_order JSONB DEFAULT '[]'::jsonb, -- Array of column IDs in display order
    column_widths JSONB DEFAULT '{}'::jsonb, -- Map of column ID to width
    
    -- Sort configuration
    sort_by VARCHAR(100), -- Primary sort column
    sort_order VARCHAR(10) DEFAULT 'desc', -- 'asc' or 'desc'
    secondary_sort_by VARCHAR(100), -- Secondary sort column
    secondary_sort_order VARCHAR(10) DEFAULT 'desc',
    
    -- Filter configuration
    filters JSONB DEFAULT '{}'::jsonb, -- Map of filter key to filter value
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one settings record per user per table
    CONSTRAINT user_table_settings_unique UNIQUE (user_id, table_key)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_table_settings_user ON user_table_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_table_settings_user_table ON user_table_settings(user_id, table_key);

-- ============================================
-- 3. Ensure research_notes has proper user_id handling
-- ============================================
-- research_notes already has user_id column, just ensure index exists

CREATE INDEX IF NOT EXISTS idx_research_notes_user_id ON research_notes(user_id);

-- ============================================
-- 4. Ensure company_chats has proper user_id handling
-- ============================================
-- company_chats already has user_id column, just ensure index exists

CREATE INDEX IF NOT EXISTS idx_company_chats_user_id ON company_chats(user_id);

-- ============================================
-- 5. Ensure brain_chats has proper user_id handling
-- ============================================
-- brain_chats already has user_id column, just ensure index exists

CREATE INDEX IF NOT EXISTS idx_brain_chats_user_id ON brain_chats(user_id);

-- ============================================
-- 6. Add comment documentation
-- ============================================

COMMENT ON TABLE user_table_settings IS 'Stores per-user table display settings including column visibility, order, widths, and sort/filter preferences';
COMMENT ON COLUMN user_table_settings.table_key IS 'Identifier for the table view, e.g., watchlist, equity, crypto, stock_list_123';
COMMENT ON COLUMN user_table_settings.visible_columns IS 'JSON array of column IDs that are visible';
COMMENT ON COLUMN user_table_settings.column_order IS 'JSON array of column IDs in display order';
COMMENT ON COLUMN user_table_settings.filters IS 'JSON object mapping filter keys to filter values';

COMMENT ON COLUMN asset_notes.user_id IS 'User who owns this note. NULL for legacy shared notes.';
