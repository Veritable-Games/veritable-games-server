-- Password Reset Columns Migration
-- Adds password_reset_token and password_reset_expires_at to users table
-- Pattern matches email_verification_* columns

-- PostgreSQL version
ALTER TABLE users.users
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

-- Create index for fast token lookups (sparse index)
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
ON users.users(password_reset_token)
WHERE password_reset_token IS NOT NULL;

-- SQLite version (for development)
-- Note: SQLite doesn't support IF NOT EXISTS for columns
-- Run only if column doesn't exist:
-- ALTER TABLE users ADD COLUMN password_reset_token TEXT;
-- ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP;
