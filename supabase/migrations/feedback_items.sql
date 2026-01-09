-- Feedback/Bug Reporting System
-- Allows users to submit bugs, feature requests, and improvements from any page

-- Create enum for feedback categories
DO $$ BEGIN
    CREATE TYPE feedback_category AS ENUM ('bug', 'feature', 'improvement');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for feedback status
DO $$ BEGIN
    CREATE TYPE feedback_status AS ENUM ('open', 'in_progress', 'done');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for priority
DO $$ BEGIN
    CREATE TYPE feedback_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the feedback_items table
CREATE TABLE IF NOT EXISTS feedback_items (
    id SERIAL PRIMARY KEY,
    
    -- Content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    category feedback_category NOT NULL DEFAULT 'bug',
    status feedback_status NOT NULL DEFAULT 'open',
    priority feedback_priority NOT NULL DEFAULT 'medium',
    
    -- Page context (normalized page name, not full URL)
    page_name VARCHAR(100) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- User tracking
    submitted_by TEXT DEFAULT 'Anon',
    user_email TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_items_status ON feedback_items(status);
CREATE INDEX IF NOT EXISTS idx_feedback_items_page ON feedback_items(page_name);
CREATE INDEX IF NOT EXISTS idx_feedback_items_category ON feedback_items(category);
CREATE INDEX IF NOT EXISTS idx_feedback_items_priority ON feedback_items(priority);
