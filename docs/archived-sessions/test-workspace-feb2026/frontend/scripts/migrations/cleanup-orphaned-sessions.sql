-- Migration: Clean Up Orphaned and Expired Sessions
-- Date: 2025-11-10
-- Issue: 21 sessions exist for user_id=1 with NULL last_login_at
--
-- Problem: Sessions accumulate but user never successfully completes login flow.
-- This suggests either:
-- 1. Sessions created before password verification (should be after)
-- 2. Multiple failed login attempts creating sessions incorrectly
-- 3. Session cleanup not working properly
--
-- Solution: Remove all expired sessions and optionally clear all sessions
-- to force fresh login after authentication fixes are applied.

BEGIN;

-- Show session statistics before cleanup
SELECT
  'BEFORE CLEANUP' as stage,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions
FROM auth.sessions;

-- Show sessions by user
SELECT
  'SESSIONS BY USER' as info,
  user_id,
  COUNT(*) as session_count,
  MIN(created_at) as oldest_session,
  MAX(created_at) as newest_session,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired
FROM auth.sessions
GROUP BY user_id;

-- Remove expired sessions
DELETE FROM auth.sessions
WHERE expires_at <= NOW();

-- OPTIONAL: Uncomment to remove ALL sessions (forces re-login for all users)
-- This is recommended after fixing authentication code to ensure clean slate
-- DELETE FROM auth.sessions;

-- Show session statistics after cleanup
SELECT
  'AFTER CLEANUP' as stage,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_sessions
FROM auth.sessions;

COMMIT;

-- Note: After applying authentication code fixes, run this again with
-- DELETE FROM auth.sessions uncommented to clear all sessions and
-- force users to log in fresh with the corrected authentication flow.
