-- Part 4: Make signal outputs config-aware
-- Adds config_id to signal tables so different configs don't overwrite each other

-- Add config_id to daily_signal_facts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'daily_signal_facts' AND column_name = 'config_id'
  ) THEN
    ALTER TABLE public.daily_signal_facts 
    ADD COLUMN config_id UUID REFERENCES public.engine_configs(config_id);
  END IF;
END $$;

-- Add config_id to signal_instances if not exists  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'signal_instances' AND column_name = 'config_id'
  ) THEN
    ALTER TABLE public.signal_instances 
    ADD COLUMN config_id UUID REFERENCES public.engine_configs(config_id);
  END IF;
END $$;

-- Add config_id to signal_ai_annotations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'signal_ai_annotations' AND column_name = 'config_id'
  ) THEN
    ALTER TABLE public.signal_ai_annotations 
    ADD COLUMN config_id UUID REFERENCES public.engine_configs(config_id);
  END IF;
END $$;

-- Set default config_id for existing rows (use the default active config)
UPDATE public.daily_signal_facts 
SET config_id = (SELECT config_id FROM public.engine_configs WHERE is_active = true LIMIT 1)
WHERE config_id IS NULL;

UPDATE public.signal_instances 
SET config_id = (SELECT config_id FROM public.engine_configs WHERE is_active = true LIMIT 1)
WHERE config_id IS NULL;

UPDATE public.signal_ai_annotations 
SET config_id = (SELECT config_id FROM public.engine_configs WHERE is_active = true LIMIT 1)
WHERE config_id IS NULL;

-- Drop old unique constraints if they exist
ALTER TABLE public.daily_signal_facts 
DROP CONSTRAINT IF EXISTS daily_signal_facts_pkey;

ALTER TABLE public.signal_instances 
DROP CONSTRAINT IF EXISTS signal_instances_asset_id_signal_type_key;

-- Create new unique constraints that include config_id
-- daily_signal_facts: unique by (date, asset, config, signal_type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_signal_facts_config_pkey'
  ) THEN
    ALTER TABLE public.daily_signal_facts 
    ADD CONSTRAINT daily_signal_facts_config_pkey 
    PRIMARY KEY (date, asset_id, config_id, template_name);
  END IF;
EXCEPTION WHEN others THEN
  -- If primary key already exists or columns don't match, create unique index instead
  CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_signal_facts_config 
  ON public.daily_signal_facts(date, asset_id, config_id, template_name);
END $$;

-- signal_instances: unique by (asset, config, signal_type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_instances_config 
ON public.signal_instances(asset_id, config_id, template_name)
WHERE state NOT IN ('ENDED', 'COOLDOWN');

-- signal_ai_annotations: unique by (instance, date, config, prompt_version)
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_ai_annotations_config 
ON public.signal_ai_annotations(instance_id, as_of_date, config_id, prompt_version);

-- Create indexes for efficient config-based queries
CREATE INDEX IF NOT EXISTS idx_daily_signal_facts_config 
ON public.daily_signal_facts(config_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_signal_instances_config 
ON public.signal_instances(config_id, state);

CREATE INDEX IF NOT EXISTS idx_signal_ai_annotations_config 
ON public.signal_ai_annotations(config_id, as_of_date DESC);
