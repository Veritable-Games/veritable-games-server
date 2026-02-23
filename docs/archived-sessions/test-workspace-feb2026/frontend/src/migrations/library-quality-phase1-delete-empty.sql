-- Library Quality Fix Phase 1: Delete Empty Content Documents
-- Date: November 24, 2025
-- Purpose: Remove 99 documents with 0-byte content

BEGIN;

-- Create audit log table for deleted documents
CREATE TEMP TABLE IF NOT EXISTS deleted_empty_docs (
  id BIGINT,
  slug TEXT,
  title TEXT,
  author TEXT,
  file_path TEXT,
  source_url TEXT,
  created_at TIMESTAMP,
  deletion_reason TEXT
);

-- Log documents being deleted
INSERT INTO deleted_empty_docs (id, slug, title, author, file_path, source_url, created_at, deletion_reason)
SELECT
  id,
  slug,
  title,
  author,
  file_path,
  source_url,
  created_at,
  'Empty content (0 bytes)'
FROM library.library_documents
WHERE content IS NULL OR content = '' OR LENGTH(content) = 0;

-- Show what will be deleted
SELECT
  COUNT(*) as docs_to_delete,
  COUNT(*) FILTER (WHERE file_path IS NOT NULL) as has_file_path,
  COUNT(*) FILTER (WHERE source_url IS NOT NULL) as has_source_url
FROM deleted_empty_docs;

-- Delete the documents
-- This will CASCADE to library.library_document_tags automatically
DELETE FROM library.library_documents
WHERE content IS NULL OR content = '' OR LENGTH(content) = 0;

-- Show results
SELECT
  'Deleted' as status,
  COUNT(*) as count
FROM deleted_empty_docs;

-- Verify no empty docs remain
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN 'SUCCESS: No empty documents remain'
    ELSE 'WARNING: ' || COUNT(*) || ' empty documents still exist'
  END as verification
FROM library.library_documents
WHERE content IS NULL OR content = '' OR LENGTH(content) = 0;

COMMIT;

-- Export audit log (PostgreSQL only)
-- COPY deleted_empty_docs TO '/tmp/deleted_empty_docs_2025-11-24.csv' WITH CSV HEADER;
