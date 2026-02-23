-- Add UUID column to users table for permanent user identification
-- Purpose: Immutable identifier for moderation/support (username/display_name can change)
-- Created: 2026-02-15

-- Add uuid column with automatic generation for new users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'users'
    AND table_name = 'users'
    AND column_name = 'uuid'
  ) THEN
    ALTER TABLE users.users
    ADD COLUMN uuid UUID DEFAULT gen_random_uuid() NOT NULL;
  END IF;
END $$;

-- Backfill UUIDs for existing users
UPDATE users.users
SET uuid = gen_random_uuid()
WHERE uuid IS NULL;

-- Create unique index for fast lookups (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users.users(uuid);

-- Add comment for documentation
COMMENT ON COLUMN users.users.uuid IS 'Immutable unique identifier for moderation and support. Used to track users even if they change username/display_name.';
