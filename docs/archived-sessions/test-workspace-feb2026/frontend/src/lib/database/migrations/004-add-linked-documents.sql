-- Migration: Add Linked Documents Support
-- Purpose: Replace translation_group_id with linked_document_group_id for manual document grouping
-- Supports translations, duplicates, and different editions
-- Date: November 8, 2025

-- ============================================================================
-- DROP OLD TRANSLATION_GROUP_ID (if it exists from migration 003)
-- ============================================================================

ALTER TABLE library.library_documents DROP COLUMN IF EXISTS translation_group_id;
ALTER TABLE anarchist.documents DROP COLUMN IF EXISTS translation_group_id;

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_library_documents_translation_group_id;
DROP INDEX IF EXISTS idx_library_documents_translation_lookup;
DROP INDEX IF EXISTS idx_anarchist_documents_translation_group_id;
DROP INDEX IF EXISTS idx_anarchist_documents_translation_lookup;

-- Drop old views if they exist
DROP VIEW IF EXISTS documents.translation_groups;
DROP VIEW IF EXISTS documents.all_documents;
DROP FUNCTION IF EXISTS documents.get_translations(TEXT);

-- ============================================================================
-- CREATE LINKED DOCUMENTS METADATA TABLE (in library schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS library.linked_document_groups (
  id TEXT PRIMARY KEY,                    -- Format: ldg_${timestamp}_${random}
  created_by INTEGER NOT NULL,            -- Admin user ID who created the link
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  -- NOTE: No direct foreign key to users table because users table is in different schema
  -- Validation of created_by happens in application layer
);

-- Index for finding groups by creator
CREATE INDEX IF NOT EXISTS idx_linked_groups_created_by
  ON library.linked_document_groups(created_by);

-- Index for timestamp-based queries (newest groups first)
CREATE INDEX IF NOT EXISTS idx_linked_groups_created_at
  ON library.linked_document_groups(created_at DESC);

-- ============================================================================
-- LIBRARY DOCUMENTS: Add linked documents field
-- ============================================================================

ALTER TABLE library.library_documents
  ADD COLUMN linked_document_group_id TEXT DEFAULT NULL;

-- Foreign key reference to linked document groups
ALTER TABLE library.library_documents
  ADD CONSTRAINT fk_library_documents_linked_group
  FOREIGN KEY (linked_document_group_id)
  REFERENCES library.linked_document_groups(id)
  ON DELETE SET NULL;

-- Index for fast linked documents lookup
CREATE INDEX IF NOT EXISTS idx_library_documents_linked_group_id
  ON library.library_documents(linked_document_group_id);

-- Composite index for finding documents in a group by language
CREATE INDEX IF NOT EXISTS idx_library_documents_linked_lookup
  ON library.library_documents(linked_document_group_id, language);

-- ============================================================================
-- ANARCHIST DOCUMENTS: Add linked documents field
-- ============================================================================

ALTER TABLE anarchist.documents
  ADD COLUMN linked_document_group_id TEXT DEFAULT NULL;

-- Foreign key reference to linked document groups
ALTER TABLE anarchist.documents
  ADD CONSTRAINT fk_anarchist_documents_linked_group
  FOREIGN KEY (linked_document_group_id)
  REFERENCES library.linked_document_groups(id)
  ON DELETE SET NULL;

-- Index for fast linked documents lookup
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_linked_group_id
  ON anarchist.documents(linked_document_group_id);

-- Composite index for finding documents in a group by language
CREATE INDEX IF NOT EXISTS idx_anarchist_documents_linked_lookup
  ON anarchist.documents(linked_document_group_id, language);

-- ============================================================================
-- UNIFIED VIEW FOR LINKED DOCUMENTS
-- ============================================================================

-- View showing all documents with linked group info
CREATE OR REPLACE VIEW library.all_documents AS
SELECT
  id::text,
  'library' as source,
  slug,
  title,
  NULL::text as title_english,
  author,
  language,
  publication_date,
  document_type,
  description,
  view_count,
  linked_document_group_id,
  created_at,
  updated_at
FROM library.library_documents

UNION ALL

SELECT
  id::text,
  'anarchist' as source,
  slug,
  title,
  NULL::text as title_english,
  author,
  language,
  publication_date,
  document_type,
  notes as description,
  view_count,
  linked_document_group_id,
  created_at,
  updated_at
FROM anarchist.documents;

-- ============================================================================
-- HELPER FUNCTION: Get all documents in a linked group
-- ============================================================================

CREATE OR REPLACE FUNCTION library.get_linked_documents(
  p_group_id TEXT
) RETURNS TABLE (
  id TEXT,
  source TEXT,
  slug TEXT,
  title TEXT,
  language TEXT,
  author TEXT,
  publication_date TEXT,
  view_count INTEGER
) AS $$
SELECT
  l.id::text,
  'library',
  l.slug,
  l.title,
  l.language,
  l.author,
  l.publication_date,
  l.view_count
FROM library.library_documents l
WHERE l.linked_document_group_id = p_group_id

UNION ALL

SELECT
  a.id::text,
  'anarchist',
  a.slug,
  a.title,
  a.language,
  a.author,
  a.publication_date,
  a.view_count
FROM anarchist.documents a
WHERE a.linked_document_group_id = p_group_id

ORDER BY language, publication_date DESC NULLS LAST;
$$ LANGUAGE SQL;

-- ============================================================================
-- HELPER FUNCTION: Get language codes for a linked group (for badge display)
-- ============================================================================

CREATE OR REPLACE FUNCTION library.get_group_languages(
  p_group_id TEXT
) RETURNS TEXT[] AS $$
SELECT ARRAY_AGG(DISTINCT language ORDER BY language)
FROM (
  SELECT language FROM library.library_documents WHERE linked_document_group_id = p_group_id
  UNION ALL
  SELECT language FROM anarchist.documents WHERE linked_document_group_id = p_group_id
) languages
WHERE language IS NOT NULL;
$$ LANGUAGE SQL;

-- ============================================================================
-- TRIGGER: Update updated_at timestamp on linked group changes
-- ============================================================================

CREATE OR REPLACE FUNCTION library.update_linked_group_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE library.linked_document_groups
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.linked_document_group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for library documents
CREATE TRIGGER update_linked_group_timestamp_library
AFTER INSERT OR UPDATE ON library.library_documents
FOR EACH ROW
WHEN (NEW.linked_document_group_id IS NOT NULL)
EXECUTE FUNCTION library.update_linked_group_timestamp();

-- Trigger for anarchist documents
CREATE TRIGGER update_linked_group_timestamp_anarchist
AFTER INSERT OR UPDATE ON anarchist.documents
FOR EACH ROW
WHEN (NEW.linked_document_group_id IS NOT NULL)
EXECUTE FUNCTION library.update_linked_group_timestamp();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Replaced translation_group_id with linked_document_group_id for manual grouping
-- Created linked_document_groups table for group metadata (creator, timestamps)
-- Added indexes for efficient querying of grouped documents
-- Created views and functions for unified cross-collection queries
-- Linked documents support translations, duplicates, and different editions
-- Exclusive membership: each document can only be in one group at a time
--
-- Usage:
-- 1. Admin creates linked group: INSERT INTO documents.linked_document_groups (id, created_by) VALUES ('ldg_...', user_id)
-- 2. Add documents to group: UPDATE library_documents SET linked_document_group_id = 'ldg_...' WHERE id IN (...)
-- 3. Unlink documents: UPDATE library_documents SET linked_document_group_id = NULL WHERE linked_document_group_id = 'ldg_...'
-- 4. Get group documents: SELECT * FROM documents.get_linked_documents('ldg_...')
-- 5. Get group languages: SELECT documents.get_group_languages('ldg_...')

COMMIT;
