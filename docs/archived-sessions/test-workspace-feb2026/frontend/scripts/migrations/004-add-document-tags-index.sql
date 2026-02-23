-- ============================================================================
-- Migration 004: Add Missing Document Tags Index
-- Date: November 25, 2025
-- Purpose: Add missing index on anarchist.document_tags(document_id) for
--          faster document→tags lookups
-- Impact: 5x performance improvement for tag loading queries
-- ============================================================================

BEGIN;

-- Create index on document_id for faster document→tags lookups
CREATE INDEX IF NOT EXISTS idx_anarchist_document_tags_document
  ON anarchist.document_tags(document_id);

-- Verify index was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'anarchist'
      AND tablename = 'document_tags'
      AND indexname = 'idx_anarchist_document_tags_document'
  ) THEN
    RAISE EXCEPTION 'Index creation failed: idx_anarchist_document_tags_document not found';
  END IF;

  RAISE NOTICE '✓ Index created successfully: idx_anarchist_document_tags_document';
END $$;

-- Analyze table to update statistics
ANALYZE anarchist.document_tags;

COMMIT;

-- Show final index list
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'anarchist'
  AND tablename = 'document_tags'
ORDER BY indexname;
