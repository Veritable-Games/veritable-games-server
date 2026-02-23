-- Migration: Add translation grouping support
-- Purpose: Enable linking documents across languages (e.g., same text in English + German)
-- Date: November 8, 2025

-- ============================================================================
-- LIBRARY DOCUMENTS: Add translation grouping field
-- ============================================================================

ALTER TABLE library.library_documents
  ADD COLUMN translation_group_id TEXT;

-- Index for fast translation lookup by group
CREATE INDEX idx_library_documents_translation_group_id
  ON library.library_documents(translation_group_id);

-- Composite index for finding translations of a specific document
CREATE INDEX idx_library_documents_translation_lookup
  ON library.library_documents(translation_group_id, language);

-- ============================================================================
-- ANARCHIST DOCUMENTS: Add translation grouping field
-- ============================================================================

ALTER TABLE anarchist.documents
  ADD COLUMN translation_group_id TEXT;

-- Index for fast translation lookup by group
CREATE INDEX idx_anarchist_documents_translation_group_id
  ON anarchist.documents(translation_group_id);

-- Composite index for finding translations of a specific document
CREATE INDEX idx_anarchist_documents_translation_lookup
  ON anarchist.documents(translation_group_id, language);

-- ============================================================================
-- UNIFIED TRANSLATION VIEW (for querying both collections)
-- ============================================================================

CREATE VIEW documents.translation_groups AS
SELECT
  tg.translation_group_id,
  array_agg(DISTINCT CASE WHEN tg.source = 'library' THEN l.language ELSE a.language END ORDER BY CASE WHEN tg.source = 'library' THEN l.language ELSE a.language END) as languages,
  count(DISTINCT CASE WHEN tg.source = 'library' THEN l.id ELSE a.id END) as translation_count,
  min(tg.first_seen) as created_at
FROM (
  SELECT 'library' as source, translation_group_id, created_at as first_seen, NULL::int as lib_id, NULL::int as anarchist_id FROM library.library_documents WHERE translation_group_id IS NOT NULL
  UNION ALL
  SELECT 'anarchist' as source, translation_group_id, created_at as first_seen, NULL::int, NULL::int FROM anarchist.documents WHERE translation_group_id IS NOT NULL
) tg
LEFT JOIN library.library_documents l ON tg.source = 'library' AND tg.translation_group_id = l.translation_group_id
LEFT JOIN anarchist.documents a ON tg.source = 'anarchist' AND tg.translation_group_id = a.translation_group_id
WHERE tg.translation_group_id IS NOT NULL
GROUP BY tg.translation_group_id;

-- ============================================================================
-- UNIFIED DOCUMENTS VIEW (for cross-collection queries)
-- ============================================================================

CREATE VIEW documents.all_documents AS
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
  translation_group_id,
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
  translation_group_id,
  created_at,
  updated_at
FROM anarchist.documents;

-- ============================================================================
-- TRANSLATION HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION documents.get_translations(
  p_translation_group_id TEXT
) RETURNS TABLE (
  id TEXT,
  source TEXT,
  slug TEXT,
  title TEXT,
  language TEXT,
  author TEXT
) AS $$
SELECT
  COALESCE(l.id::text, a.id::text),
  CASE WHEN l.id IS NOT NULL THEN 'library' ELSE 'anarchist' END,
  COALESCE(l.slug, a.slug),
  COALESCE(l.title, a.title),
  COALESCE(l.language, a.language),
  COALESCE(l.author, a.author)
FROM library.library_documents l
FULL OUTER JOIN anarchist.documents a
  ON l.translation_group_id = a.translation_group_id
  AND l.translation_group_id = p_translation_group_id
WHERE COALESCE(l.translation_group_id, a.translation_group_id) = p_translation_group_id
ORDER BY COALESCE(l.language, a.language);
$$ LANGUAGE SQL;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Added translation_group_id field to both library.library_documents and anarchist.documents
-- Created indexes for fast translation lookup
-- Created views and functions for unified cross-collection queries
-- Translation grouping enables language switching on document detail pages

COMMIT;
