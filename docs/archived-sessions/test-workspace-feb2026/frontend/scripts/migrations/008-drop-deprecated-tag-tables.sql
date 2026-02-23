-- Migration: Drop Deprecated Tag Tables
-- Date: After 2025-12-16
--
-- Description:
-- Removes deprecated tag tables that were replaced by the unified shared.tags system.
-- All tag data has been migrated to shared.tags (Nov 2025 migration).
--
-- Prerequisites:
-- 1. Verify all code using library_tags/library_tag_categories has been migrated
-- 2. Verify shared.tags contains all necessary tags
-- 3. Run in a maintenance window
--
-- Rollback: This migration is not reversible. Backup tables before running.

-- Step 1: Verify migration is complete by checking no orphaned references exist
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Check for any document-tag relationships pointing to old library_tags
  SELECT COUNT(*) INTO orphan_count
  FROM library.library_document_tags ldt
  WHERE NOT EXISTS (
    SELECT 1 FROM shared.tags t WHERE t.id = ldt.tag_id
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned document-tag relationships. Migration incomplete.', orphan_count;
  END IF;

  RAISE NOTICE 'Pre-check passed: No orphaned references found';
END $$;

-- Step 2: Drop deprecated library tag tables
-- These were replaced by shared.tags in Nov 2025

-- Drop library_tag_categories if it exists
DROP TABLE IF EXISTS library.library_tag_categories CASCADE;

-- Drop library_tags if it exists
DROP TABLE IF EXISTS library.library_tags CASCADE;

-- Step 3: Drop deprecated anarchist tag tables (if they exist)
-- These were also consolidated into shared.tags
DROP TABLE IF EXISTS anarchist.tags CASCADE;
DROP TABLE IF EXISTS anarchist.tag_categories CASCADE;

-- Step 4: Log completion
DO $$
BEGIN
  RAISE NOTICE 'Deprecated tag tables dropped successfully';
  RAISE NOTICE 'Tags are now managed exclusively via shared.tags';
END $$;

-- Verification query (run manually after migration):
-- SELECT COUNT(*) FROM shared.tags;
-- SELECT source, COUNT(*) FROM shared.tags GROUP BY source;
