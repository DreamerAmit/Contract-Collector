# Database Migration Instructions

This document provides instructions for updating the database schema to support the removal of Google Vault holds and implementation of direct exports.

## Schema Changes

The migration in `src/migrations/update-vault-search-remove-holds.js` will make the following changes to the `vault_searches` table:

1. Remove hold-related columns:
   - `gmail_hold_id`
   - `drive_hold_id`
   - `export_id`

2. Add export-related columns:
   - `gmail_export_id`
   - `drive_export_id`

3. Rename `keywords` column to `search_terms` (if it exists)

## Running the Migration

To apply these changes to your database, run the following commands:

```bash
# Navigate to the backend directory
cd backend

# Install required dependencies if not already installed
npm install sequelize-cli pg pg-hstore

# Run the migration
npx sequelize-cli db:migrate --migrations-path=./src/migrations
```

## Manual Schema Update (if needed)

If you prefer to manually update the schema or if the migration fails, run the following SQL statements on your PostgreSQL database:

```sql
-- Remove hold-related columns
ALTER TABLE vault_searches DROP COLUMN IF EXISTS gmail_hold_id;
ALTER TABLE vault_searches DROP COLUMN IF EXISTS drive_hold_id;
ALTER TABLE vault_searches DROP COLUMN IF EXISTS export_id;

-- Add export-related columns
ALTER TABLE vault_searches ADD COLUMN gmail_export_id VARCHAR(255);
ALTER TABLE vault_searches ADD COLUMN drive_export_id VARCHAR(255);

-- Rename keywords column to search_terms if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vault_searches' AND column_name = 'keywords') THEN
        ALTER TABLE vault_searches RENAME COLUMN keywords TO search_terms;
    END IF;
END
$$;
```

## Verifying the Migration

To verify the migration was successful, check that:

1. The `vault_searches` table no longer has `gmail_hold_id`, `drive_hold_id`, or `export_id` columns
2. The `vault_searches` table has new `gmail_export_id` and `drive_export_id` columns
3. The table has a `search_terms` column (not `keywords`)

## Rollback (if needed)

If you need to revert these changes, run:

```bash
npx sequelize-cli db:migrate:undo --migrations-path=./src/migrations
```

Or manually with SQL:

```sql
-- Add back hold-related columns
ALTER TABLE vault_searches ADD COLUMN gmail_hold_id VARCHAR(255);
ALTER TABLE vault_searches ADD COLUMN drive_hold_id VARCHAR(255);
ALTER TABLE vault_searches ADD COLUMN export_id VARCHAR(255);

-- Remove export-related columns
ALTER TABLE vault_searches DROP COLUMN IF EXISTS gmail_export_id;
ALTER TABLE vault_searches DROP COLUMN IF EXISTS drive_export_id;

-- Rename search_terms back to keywords
ALTER TABLE vault_searches RENAME COLUMN search_terms TO keywords;
``` 