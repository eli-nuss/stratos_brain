-- Create chat_sources table for NotebookLM-style source management
CREATE TABLE IF NOT EXISTS chat_sources (
  source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES company_chats(chat_id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('file', 'url', 'text', 'company_doc')),
  name TEXT NOT NULL,
  description TEXT,
  -- File-specific fields
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  -- URL-specific fields
  source_url TEXT,
  -- Content fields
  raw_content TEXT,
  extracted_text TEXT,
  word_count INTEGER,
  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sources_chat_id ON chat_sources(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_sources_user_id ON chat_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sources_status ON chat_sources(status);
CREATE INDEX IF NOT EXISTS idx_chat_sources_enabled ON chat_sources(chat_id, is_enabled) WHERE is_enabled = true;

-- Enable Row Level Security
ALTER TABLE chat_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own sources
CREATE POLICY "Users can view their own sources" ON chat_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sources" ON chat_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sources" ON chat_sources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sources" ON chat_sources
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_sources_updated_at
  BEFORE UPDATE ON chat_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_sources_updated_at();

-- Create storage bucket for source files (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-sources', 'chat-sources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-sources bucket
CREATE POLICY "Users can upload source files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-sources' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their source files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-sources' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their source files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-sources' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
