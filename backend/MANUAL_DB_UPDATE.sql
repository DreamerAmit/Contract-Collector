-- Add processed column to vault_searches
ALTER TABLE vault_searches ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false NOT NULL;

-- Add results column to vault_searches
ALTER TABLE vault_searches ADD COLUMN IF NOT EXISTS results TEXT; 