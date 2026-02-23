-- Library Quality Fix Phase 4: Flag Documents Without Tags
-- Date: November 24, 2025
-- Purpose: Mark 215 documents without tags for manual review

BEGIN;

-- Create temp table to track untagged documents
CREATE TEMP TABLE IF NOT EXISTS untagged_docs (
  id BIGINT,
  title TEXT,
  author TEXT,
  content_preview TEXT
);

-- Find documents without tags
INSERT INTO untagged_docs (id, title, author, content_preview)
SELECT
  d.id,
  d.title,
  d.author,
  LEFT(d.content, 200) as content_preview
FROM library.library_documents d
WHERE NOT EXISTS (
  SELECT 1 FROM library.library_document_tags dt
  WHERE dt.document_id = d.id
)
AND LENGTH(d.content) > 0;

-- Show count
SELECT COUNT(*) as documents_without_tags
FROM untagged_docs;

-- Sample of untagged documents
SELECT id, title, author
FROM untagged_docs
LIMIT 10;

-- Add flag to notes field for manual review
UPDATE library.library_documents d
SET notes = CASE
  WHEN notes IS NULL OR notes = '' THEN '[NEEDS TAGS]'
  WHEN notes NOT LIKE '%[NEEDS TAGS]%' THEN notes || ' [NEEDS TAGS]'
  ELSE notes
END
FROM untagged_docs u
WHERE d.id = u.id;

-- Show results
SELECT
  COUNT(*) as flagged_for_tagging
FROM library.library_documents
WHERE notes LIKE '%[NEEDS TAGS]%';

COMMIT;
