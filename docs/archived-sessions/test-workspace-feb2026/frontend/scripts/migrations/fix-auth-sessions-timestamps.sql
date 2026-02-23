-- Migration: Fix auth.sessions timestamp columns
-- Issue: expires_at, created_at, last_accessed are BIGINT but should be TIMESTAMP
-- Root Cause: SQLite used INTEGER for timestamps, PostgreSQL needs proper TIMESTAMP type
-- Created: November 7, 2025

-- Step 1: Backup existing table
DROP TABLE IF EXISTS auth.sessions_backup;
CREATE TABLE auth.sessions_backup AS SELECT * FROM auth.sessions;

-- Step 2: Add new timestamp columns
ALTER TABLE auth.sessions
  ADD COLUMN expires_at_ts TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN created_at_ts TIMESTAMP WITHOUT TIME ZONE,
  ADD COLUMN last_accessed_ts TIMESTAMP WITHOUT TIME ZONE;

-- Step 3: Convert BIGINT milliseconds to TIMESTAMP
-- Note: BIGINT values are Unix timestamps in milliseconds (e.g., 1730946421034)
UPDATE auth.sessions SET
  expires_at_ts = TO_TIMESTAMP(expires_at / 1000.0),
  created_at_ts = TO_TIMESTAMP(created_at / 1000.0),
  last_accessed_ts = CASE
    WHEN last_accessed IS NOT NULL AND last_accessed > 0
    THEN TO_TIMESTAMP(last_accessed / 1000.0)
    ELSE NULL
  END;

-- Step 4: Drop old columns
ALTER TABLE auth.sessions
  DROP COLUMN expires_at,
  DROP COLUMN created_at,
  DROP COLUMN last_accessed;

-- Step 5: Rename new columns to original names
ALTER TABLE auth.sessions
  RENAME COLUMN expires_at_ts TO expires_at;
ALTER TABLE auth.sessions
  RENAME COLUMN created_at_ts TO created_at;
ALTER TABLE auth.sessions
  RENAME COLUMN last_accessed_ts TO last_accessed;

-- Step 6: Add constraints
ALTER TABLE auth.sessions
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Step 7: Recreate indexes for performance
DROP INDEX IF EXISTS auth.idx_sessions_expires;
CREATE INDEX idx_sessions_expires ON auth.sessions(expires_at);

DROP INDEX IF EXISTS auth.idx_sessions_user_id;
CREATE INDEX idx_sessions_user_id ON auth.sessions(user_id);

-- Verification query
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'sessions'
  AND column_name IN ('expires_at', 'created_at', 'last_accessed')
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Backup table: auth.sessions_backup';
  RAISE NOTICE 'New column types: TIMESTAMP WITHOUT TIME ZONE';
END $$;
