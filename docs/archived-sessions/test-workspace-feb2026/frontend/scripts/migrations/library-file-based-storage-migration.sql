-- Library File-Based Storage Schema Migration
-- Aligns database schema with code refactor (Nov 2025)
-- Migrates from content column to file-based storage

BEGIN;

-- Step 0: Drop dependent views (will be recreated after schema changes)
DROP VIEW IF EXISTS library.all_documents;

-- Step 1: Add new columns for file-based storage
ALTER TABLE library.library_documents
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE library.library_documents
  ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Step 2: Migrate existing data
-- Copy description → notes for all documents that don't have notes yet
UPDATE library.library_documents
SET notes = description
WHERE notes IS NULL AND description IS NOT NULL;

-- Step 3: Drop old/obsolete columns
-- These columns are no longer used by the application
ALTER TABLE library.library_documents
  DROP COLUMN IF EXISTS status;

ALTER TABLE library.library_documents
  DROP COLUMN IF EXISTS description;

ALTER TABLE library.library_documents
  DROP COLUMN IF EXISTS abstract;

-- Note: We keep the 'content' column for now as a fallback
-- The application uses dual-read logic: file_path first, then content
-- Make it nullable since new documents will use file_path instead
ALTER TABLE library.library_documents
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE library.library_documents
  DROP COLUMN IF EXISTS search_text;

-- Step 4: Drop old indexes that reference removed columns
DROP INDEX IF EXISTS library.idx_library_documents_search_text;
DROP INDEX IF EXISTS library.idx_library_documents_status_type_created;

-- Step 5: Create new indexes for file-based queries
CREATE INDEX IF NOT EXISTS idx_library_documents_file_path
  ON library.library_documents(file_path);

-- Step 6: Create index for notes column (searchable descriptions)
CREATE INDEX IF NOT EXISTS idx_library_documents_notes
  ON library.library_documents(notes);

-- Step 7: Recreate the all_documents view with updated column names
-- This view unifies library and anarchist documents for unified search
CREATE OR REPLACE VIEW library.all_documents AS
SELECT
  (library_documents.id)::text AS id,
  'library'::text AS source,
  library_documents.slug,
  library_documents.title,
  NULL::text AS title_english,
  library_documents.author,
  library_documents.language,
  library_documents.publication_date,
  library_documents.document_type,
  library_documents.notes AS description,  -- Map notes to description for compatibility
  library_documents.view_count,
  library_documents.linked_document_group_id,
  library_documents.created_at,
  library_documents.updated_at
FROM library.library_documents

UNION ALL

SELECT
  (documents.id)::text AS id,
  'anarchist'::text AS source,
  documents.slug,
  documents.title,
  NULL::text AS title_english,
  documents.author,
  documents.language,
  documents.publication_date,
  documents.document_type,
  documents.notes AS description,
  documents.view_count,
  documents.linked_document_group_id,
  documents.created_at,
  documents.updated_at
FROM anarchist.documents;

COMMIT;
