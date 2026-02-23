-- Migration: Real Session Management & Login History
-- Created: November 30, 2025
-- Purpose: Add device tracking to sessions and create login history table

-- =============================================================================
-- Part 1: Extend auth.sessions table with device/location columns
-- =============================================================================

ALTER TABLE auth.sessions
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS device VARCHAR(50),
ADD COLUMN IF NOT EXISTS os VARCHAR(100),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS region VARCHAR(100),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();

-- Add index for active sessions lookup
CREATE INDEX IF NOT EXISTS idx_sessions_user_active
ON auth.sessions(user_id, is_active)
WHERE is_active = true;

-- Add index for last activity (for cleanup of stale sessions)
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity
ON auth.sessions(last_activity);

-- =============================================================================
-- Part 2: Create auth.login_history table
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth.login_history (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
  session_id BIGINT,  -- NULL if login failed, references auth.sessions(id)

  -- Request metadata
  ip_address INET,
  user_agent TEXT,

  -- Parsed device info
  browser VARCHAR(100),
  device VARCHAR(50),      -- 'Desktop', 'Mobile', 'Tablet', 'Unknown'
  os VARCHAR(100),

  -- Geolocation (from ip-api.com)
  city VARCHAR(100),
  region VARCHAR(100),
  country VARCHAR(100),
  country_code VARCHAR(10),

  -- Login result
  login_successful BOOLEAN NOT NULL,
  failure_reason VARCHAR(50),  -- 'invalid_password', 'user_not_found', '2fa_failed', '2fa_required', 'account_locked', 'account_banned'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for user's login history (most common query)
CREATE INDEX IF NOT EXISTS idx_login_history_user
ON auth.login_history(user_id, created_at DESC);

-- Index for recent activity across all users (admin monitoring)
CREATE INDEX IF NOT EXISTS idx_login_history_recent
ON auth.login_history(created_at DESC);

-- Index for failed login monitoring (security)
CREATE INDEX IF NOT EXISTS idx_login_history_failed
ON auth.login_history(user_id, login_successful, created_at DESC)
WHERE login_successful = false;

-- =============================================================================
-- Part 3: Add foreign key constraint for session_id (optional, after table exists)
-- =============================================================================

-- Note: We don't add a FK constraint because:
-- 1. Failed logins don't have sessions
-- 2. Sessions can be deleted while history should remain
-- The session_id is kept for reference only

-- =============================================================================
-- Verification query (run after migration)
-- =============================================================================

-- SELECT
--   'auth.sessions columns' as check_type,
--   COUNT(*) as column_count
-- FROM information_schema.columns
-- WHERE table_schema = 'auth' AND table_name = 'sessions';

-- SELECT
--   'auth.login_history exists' as check_type,
--   EXISTS(
--     SELECT 1 FROM information_schema.tables
--     WHERE table_schema = 'auth' AND table_name = 'login_history'
--   ) as exists;
