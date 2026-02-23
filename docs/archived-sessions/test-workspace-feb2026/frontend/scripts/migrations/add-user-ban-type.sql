-- Migration: Add ban_type column to users table
-- Purpose: Distinguish between soft bans (reversible) and hard bans (permanent deletion)
-- Created: 2025-11-29

-- Add ban_type column: NULL = not banned, 'soft' = soft ban, 'hard' = hard ban (permanent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_type TEXT DEFAULT NULL;

-- Add ban_reason column to store the reason for the ban
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;

-- Add banned_at timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP DEFAULT NULL;

-- Add banned_by to track who performed the ban
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by INTEGER DEFAULT NULL;

-- Create index for quick lookup of banned users
CREATE INDEX IF NOT EXISTS idx_users_ban_type ON users(ban_type);

-- Add constraint to ensure ban_type is valid
-- Note: PostgreSQL specific - CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_ban_type;
ALTER TABLE users ADD CONSTRAINT chk_ban_type CHECK (ban_type IS NULL OR ban_type IN ('soft', 'hard'));
