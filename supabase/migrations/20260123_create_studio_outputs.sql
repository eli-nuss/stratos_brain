-- Create studio_outputs table for persisting generated content
CREATE TABLE IF NOT EXISTS public.studio_outputs (
    output_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES public.company_chats(chat_id) ON DELETE CASCADE,
    user_id UUID,
    output_type TEXT NOT NULL CHECK (output_type IN ('report', 'slides', 'diagram', 'table')),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('generating', 'ready', 'error')),
    content TEXT,
    diagram_data JSONB,
    error_message TEXT,
    prompt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups by chat_id
CREATE INDEX IF NOT EXISTS idx_studio_outputs_chat_id ON public.studio_outputs(chat_id);

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_studio_outputs_user_id ON public.studio_outputs(user_id);

-- Add comment
COMMENT ON TABLE public.studio_outputs IS 'Stores generated studio outputs (reports, diagrams, slides, tables) for chat sessions';

-- Enable RLS
ALTER TABLE public.studio_outputs ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Allow users to view their own outputs
CREATE POLICY "Users can view their own outputs" ON public.studio_outputs
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own outputs
CREATE POLICY "Users can insert their own outputs" ON public.studio_outputs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own outputs
CREATE POLICY "Users can update their own outputs" ON public.studio_outputs
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own outputs
CREATE POLICY "Users can delete their own outputs" ON public.studio_outputs
    FOR DELETE USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role has full access" ON public.studio_outputs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
