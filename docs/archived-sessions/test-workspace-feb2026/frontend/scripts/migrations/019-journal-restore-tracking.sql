-- Migration 019: Add journal restore tracking columns
-- Date: 2026-02-13
-- Description: Add restored_by and restored_at columns to wiki_pages for journal restoration tracking
-- Related: Archive/Delete system redesign - fix JSON.parse error when restoring journals
--
-- These columns are referenced in /api/journals/recover/route.ts (lines 84-85) but don't exist,
-- causing silent failures and JSON.parse errors. This migration adds the missing columns.

-- Add restore tracking columns to wiki_pages
ALTER TABLE wiki.wiki_pages
ADD COLUMN IF NOT EXISTS restored_by INTEGER REFERENCES users.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS restored_at TIMESTAMP;

-- Create index for restore queries (improve performance for filtered queries)
CREATE INDEX IF NOT EXISTS idx_wiki_pages_restored_at
ON wiki.wiki_pages(restored_at)
WHERE restored_at IS NOT NULL AND namespace = 'journals';

-- Verify migration
DO $$
BEGIN
    -- Check restored_by column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'wiki'
        AND table_name = 'wiki_pages'
        AND column_name = 'restored_by'
    ) THEN
        RAISE EXCEPTION 'Migration 019 failed: restored_by column not created';
    END IF;

    -- Check restored_at column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'wiki'
        AND table_name = 'wiki_pages'
        AND column_name = 'restored_at'
    ) THEN
        RAISE EXCEPTION 'Migration 019 failed: restored_at column not created';
    END IF;

    RAISE NOTICE 'Migration 019 completed successfully: restored_by and restored_at columns added';
END $$;
