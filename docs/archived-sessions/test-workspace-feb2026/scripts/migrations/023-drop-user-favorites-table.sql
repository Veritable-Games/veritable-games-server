-- Migration: Drop user_favorites table
-- Date: 2026-02-15
-- Reason: Favorites system has been removed from codebase
-- See: docs/features/profiles/research/FAVORITES_REBUILD_PLAN.md for future rebuild plan
--
-- CRITICAL: This migration MUST be applied to production BEFORE deploying code changes
-- that remove favorites infrastructure (Phase 1: Immediate Cleanup)

-- Drop the user_favorites table and all related indexes
DROP TABLE IF EXISTS user_favorites CASCADE;

-- Migration complete
-- Expected state after migration:
-- - user_favorites table no longer exists
-- - All foreign key constraints on user_favorites removed
-- - All indexes on user_favorites removed
