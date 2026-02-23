-- Migration: Remove Document Category and Tag Category Systems
-- Date: November 24, 2025
-- Purpose: Simplify library architecture by removing unused document categories
--          and low-utility tag categories, replacing with flat tag list
-- Affected tables:
--   - library.library_document_categories (0 associations)
--   - library.library_categories (16 unused categories)
--   - library.library_tag_categories (16 tag categories)
--   - library.library_tags.category_id column

-- IMPORTANT: Run database backup before executing:
-- docker exec veritable-games-postgres pg_dump -U postgres veritable_games > backup-pre-category-removal.sql

BEGIN;

-- Step 1: Drop document category junction table (0 rows)
DROP TABLE IF EXISTS library.library_document_categories CASCADE;

-- Step 2: Drop document categories table (16 unused categories)
DROP TABLE IF EXISTS library.library_categories CASCADE;

-- Step 3: Drop category_id column from tags (references tag categories)
ALTER TABLE library.library_tags DROP COLUMN IF EXISTS category_id CASCADE;

-- Step 4: Drop tag categories table (16 tag categories)
DROP TABLE IF EXISTS library.library_tag_categories CASCADE;

-- Verification queries (uncomment to verify after migration):
-- SELECT COUNT(*) FROM library.library_tags; -- Should show all tags without category_id
-- \d library.library_tags; -- Should not show category_id column

COMMIT;

-- Rollback script (if needed):
-- This migration is destructive. Restore from backup if rollback needed:
-- docker exec -i veritable-games-postgres psql -U postgres veritable_games < backup-pre-category-removal.sql
