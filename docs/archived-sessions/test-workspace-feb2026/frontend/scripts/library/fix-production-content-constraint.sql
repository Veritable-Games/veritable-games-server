-- Fix Production: Drop NOT NULL constraint on content column and recreate view

BEGIN;

-- Step 1: Drop NOT NULL constraint on content column
-- This allows new documents to be created with file_path only
ALTER TABLE library.library_documents
  ALTER COLUMN content DROP NOT NULL;

-- Step 2: Recreate the all_documents view
-- This view is needed for backward compatibility and queries
DROP VIEW IF EXISTS library.all_documents;

CREATE VIEW library.all_documents AS
SELECT
  id,
  slug,
  title,
  author,
  publication_date,
  document_type,
  COALESCE(notes, '') AS description,
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

COMMIT;
