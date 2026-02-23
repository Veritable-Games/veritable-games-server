-- Add is_public field to anarchist library documents
-- Migration: 006
-- Created: 2025-11-26
-- Purpose: Enable visibility toggle for anarchist documents (admin-only vs public)

BEGIN;

-- Add column with default true (all existing documents remain public)
ALTER TABLE anarchist.documents
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Create index for filtering queries
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_is_public
  ON anarchist.documents(is_public);

-- Verify column was added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'anarchist'
      AND table_name = 'documents'
      AND column_name = 'is_public'
  ) THEN
    RAISE EXCEPTION 'Failed to add is_public column';
  END IF;
  RAISE NOTICE '✓ Added is_public column to anarchist.documents';
END $$;

COMMIT;
