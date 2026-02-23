-- Migration 002: Add missing document_id index
-- Created: November 17, 2025
-- Purpose: Improve document→tags query performance
-- Bug #3: Missing Database Index (P0 Critical Fix)

BEGIN;

-- Add index for document_id lookups
-- This index is needed for efficient queries like:
--   SELECT tags FROM document_tags WHERE document_id = ?
-- Currently only tag_id is indexed, causing sequential scans for document→tags queries
CREATE INDEX IF NOT EXISTS idx_anarchist_document_tags_document
    ON anarchist.document_tags(document_id);

-- Verify index created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'anarchist'
        AND tablename = 'document_tags'
        AND indexname = 'idx_anarchist_document_tags_document'
    ) THEN
        RAISE NOTICE 'Index idx_anarchist_document_tags_document created successfully';
    ELSE
        RAISE EXCEPTION 'Index creation failed';
    END IF;
END $$;

COMMIT;
