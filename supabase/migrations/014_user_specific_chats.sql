-- Migration: 014_user_specific_chats.sql
-- Description: Add user_id to company_chats for user-specific chat isolation
-- Each user will have their own separate chat history per company

-- Step 1: Add user_id column (nullable initially for existing data)
ALTER TABLE public.company_chats 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Step 2: Create index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_company_chats_user_id 
ON public.company_chats (user_id);

-- Step 3: Create composite index for user + asset lookups
CREATE INDEX IF NOT EXISTS idx_company_chats_user_asset 
ON public.company_chats (user_id, asset_id);

-- Step 4: Drop the old unique constraint on asset_id alone
ALTER TABLE public.company_chats 
DROP CONSTRAINT IF EXISTS company_chats_asset_id_key;

-- Step 5: Add new unique constraint for user_id + asset_id combination
-- This allows each user to have their own chat per asset
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_chats_user_asset_unique 
ON public.company_chats (user_id, asset_id) 
WHERE user_id IS NOT NULL;

-- Step 6: Add comment explaining the change
COMMENT ON COLUMN public.company_chats.user_id IS 'User who owns this chat session. NULL for legacy shared chats.';
