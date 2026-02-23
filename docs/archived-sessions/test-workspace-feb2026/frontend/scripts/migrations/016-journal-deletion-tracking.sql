-- Migration 016: Journal Deletion Tracking
-- Date: 2026-02-12
-- Description: Add soft deletion tracking columns to wiki_pages for journals
-- Related: Journals refactor with inline deleted state display
-- Incident: docs/incidents/2026-02-12-journals-missing-columns.md

-- Add deletion tracking columns to wiki_pages
ALTER TABLE wiki.wiki_pages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_by INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for querying deleted journals
CREATE INDEX IF NOT EXISTS idx_wiki_pages_is_deleted
ON wiki.wiki_pages(is_deleted)
WHERE namespace = 'journals';

-- Create index for deleted_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_wiki_pages_deleted_at
ON wiki.wiki_pages(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Verify migration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'wiki'
        AND table_name = 'wiki_pages'
        AND column_name = 'is_deleted'
    ) THEN
        RAISE EXCEPTION 'Migration 016 failed: is_deleted column not created';
    END IF;

    RAISE NOTICE 'Migration 016 completed successfully';
END $$;
