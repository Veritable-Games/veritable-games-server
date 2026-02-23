-- Migration 020: Add Full-Text Search to Journals
-- Date: February 16, 2026
-- Purpose: Replace slow LIKE queries with PostgreSQL full-text search
--
-- Performance Impact:
-- - Current: LIKE '%query%' = full table scan (300-500ms for multi-word searches)
-- - After: FTS with GIN index (50-80% faster, <100ms typical)
--
-- ============================================================
-- PHASE 1: Add tsvector column for search
-- ============================================================

-- Add search_vector column to store pre-computed search data
ALTER TABLE wiki.journals
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================================
-- PHASE 2: Create GIN index for fast full-text search
-- ============================================================

-- GIN (Generalized Inverted Index) is optimized for tsvector
-- Provides O(log n) lookups vs O(n) for LIKE queries
CREATE INDEX IF NOT EXISTS idx_journals_fts
  ON wiki.journals
  USING GIN(search_vector);

-- ============================================================
-- PHASE 3: Create trigger function to maintain search_vector
-- ============================================================

-- Function to update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION wiki.journals_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Combine title (weight A = highest) and content (weight B = high)
  -- This gives title matches higher relevance in search results
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- PHASE 4: Create trigger on journals table
-- ============================================================

-- Trigger fires BEFORE INSERT OR UPDATE to populate search_vector
DROP TRIGGER IF EXISTS journals_search_vector_trigger ON wiki.journals;
CREATE TRIGGER journals_search_vector_trigger
  BEFORE INSERT OR UPDATE ON wiki.journals
  FOR EACH ROW
  EXECUTE FUNCTION wiki.journals_search_vector_update();

-- ============================================================
-- PHASE 5: Populate search_vector for existing journals
-- ============================================================

-- Update all existing journals to populate search_vector
-- This may take a few seconds for large datasets
UPDATE wiki.journals
SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'B')
WHERE search_vector IS NULL;

-- ============================================================
-- PHASE 6: Add updated_at index (if not exists)
-- ============================================================

-- Improves ORDER BY updated_at DESC performance
-- (May already exist from migration 018)
CREATE INDEX IF NOT EXISTS idx_journals_updated_at
  ON wiki.journals(updated_at DESC);

-- ============================================================
-- VERIFICATION QUERIES (for manual verification)
-- ============================================================

-- Uncomment to verify search_vector column exists:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'wiki' AND table_name = 'journals' AND column_name = 'search_vector';

-- Uncomment to verify GIN index exists:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'journals' AND indexname = 'idx_journals_fts';

-- Uncomment to test FTS query performance:
-- EXPLAIN ANALYZE
-- SELECT id, title, ts_rank(search_vector, plainto_tsquery('english', 'test query')) as rank
-- FROM wiki.journals
-- WHERE search_vector @@ plainto_tsquery('english', 'test query')
-- ORDER BY rank DESC;

-- Uncomment to compare with LIKE query performance:
-- EXPLAIN ANALYZE
-- SELECT id, title FROM wiki.journals WHERE title LIKE '%test%' OR content LIKE '%test%';
