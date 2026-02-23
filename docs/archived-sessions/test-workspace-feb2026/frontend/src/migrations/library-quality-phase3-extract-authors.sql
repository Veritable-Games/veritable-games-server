-- Library Quality Fix Phase 3: Extract Authors from Content
-- Date: November 24, 2025
-- Purpose: Attempt to extract author names from document content for 1,867 documents with missing authors

BEGIN;

-- Create function to extract author from content
CREATE OR REPLACE FUNCTION extract_author_from_content(p_content TEXT)
RETURNS TEXT AS $$
DECLARE
  v_author TEXT;
  v_first_lines TEXT;
BEGIN
  -- Get first 500 characters
  v_first_lines := LEFT(p_content, 500);

  -- Pattern 1: "By Author Name" at start of line
  v_author := (
    SELECT substring(v_first_lines FROM '(?:^|\n)By\s+([^\n]{3,80})')
  );
  IF v_author IS NOT NULL THEN
    RETURN TRIM(v_author);
  END IF;

  -- Pattern 2: "Author: Name"
  v_author := (
    SELECT substring(v_first_lines FROM 'Author:\s*([^\n]{3,80})')
  );
  IF v_author IS NOT NULL THEN
    RETURN TRIM(v_author);
  END IF;

  -- Pattern 3: "Written by Name"
  v_author := (
    SELECT substring(v_first_lines FROM 'Written by\s+([^\n]{3,80})')
  );
  IF v_author IS NOT NULL THEN
    RETURN TRIM(v_author);
  END IF;

  -- Pattern 4: "Author - Name" or "Author – Name"
  v_author := (
    SELECT substring(v_first_lines FROM 'Author[\s\-–]+([^\n]{3,80})')
  );
  IF v_author IS NOT NULL THEN
    RETURN TRIM(v_author);
  END IF;

  -- No author found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create temp table to track changes
CREATE TEMP TABLE IF NOT EXISTS author_extraction_log (
  id BIGINT,
  old_author TEXT,
  new_author TEXT,
  extraction_method TEXT
);

-- Extract authors from content
INSERT INTO author_extraction_log (id, old_author, new_author, extraction_method)
SELECT
  id,
  author as old_author,
  extract_author_from_content(content) as new_author,
  'content_extraction' as extraction_method
FROM library.library_documents
WHERE (author IS NULL OR author = '')
  AND LENGTH(content) > 0;

-- Show preview of extractions
SELECT
  COUNT(*) as total_missing_authors,
  COUNT(*) FILTER (WHERE new_author IS NOT NULL) as authors_found,
  COUNT(*) FILTER (WHERE new_author IS NULL) as authors_not_found
FROM author_extraction_log;

-- Sample of found authors
SELECT id, new_author
FROM author_extraction_log
WHERE new_author IS NOT NULL
LIMIT 10;

-- Update documents with extracted authors
UPDATE library.library_documents d
SET author = l.new_author
FROM author_extraction_log l
WHERE d.id = l.id
  AND l.new_author IS NOT NULL
  AND LENGTH(l.new_author) >= 3
  AND LENGTH(l.new_author) <= 100;

-- Show results
SELECT
  'Updated' as status,
  COUNT(*) as count
FROM author_extraction_log
WHERE new_author IS NOT NULL
  AND LENGTH(new_author) >= 3
  AND LENGTH(new_author) <= 100;

-- Verify remaining missing authors
SELECT
  COUNT(*) as still_missing_authors
FROM library.library_documents
WHERE (author IS NULL OR author = '')
  AND LENGTH(content) > 0;

COMMIT;

-- Cleanup function (optional)
-- DROP FUNCTION IF EXISTS extract_author_from_content(TEXT);
