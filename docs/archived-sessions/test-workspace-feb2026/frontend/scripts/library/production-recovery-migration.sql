-- Production Database Recovery Migration
-- For databases where new columns exist but old columns were already dropped
-- This migration handles the partial migration state on production

BEGIN;

-- Step 0: Verify current state
-- Should show notes and file_path columns exist, old columns dropped

-- Step 1: Ensure all required columns exist
ALTER TABLE library.library_documents
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE library.library_documents
  ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 2: Make content column nullable if it isn't already
-- (Some documents may have content, new ones will use file_path)
ALTER TABLE library.library_documents
  ALTER COLUMN content DROP NOT NULL;

-- Step 3: Verify view exists and is correct
-- Drop if it exists with wrong definition
DROP VIEW IF EXISTS library.all_documents;

-- Step 4: Recreate the all_documents view with proper column mapping
-- Maps new schema columns to expected names for backward compatibility
CREATE VIEW library.all_documents AS
SELECT
  id,
  slug,
  title,
  author,
  publication_date,
  document_type,
  notes AS description,
  COALESCE(file_path, '') AS file_path_info,
  language,
  created_by,
  created_at,
  updated_at,
  view_count,
  translation_group_id,
  linked_document_group_id,
  is_public,
  content,
  notes
FROM library.library_documents;

-- Step 5: Create/update indexes for performance
CREATE INDEX IF NOT EXISTS idx_library_documents_file_path
  ON library.library_documents(file_path);

CREATE INDEX IF NOT EXISTS idx_library_documents_notes
  ON library.library_documents(notes);

CREATE INDEX IF NOT EXISTS idx_library_documents_slug
  ON library.library_documents(slug);

CREATE INDEX IF NOT EXISTS idx_library_documents_created_at
  ON library.library_documents(created_at DESC);

-- Step 6: Verify schema integrity
-- All required columns for document creation should exist
ALTER TABLE library.library_documents
  ADD CONSTRAINT check_document_has_content CHECK (
    content IS NOT NULL OR file_path IS NOT NULL
  );

COMMIT;
