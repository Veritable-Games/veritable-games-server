-- Migration: Remove UNIQUE constraint for journals namespace
-- Date: 2025-11-12
-- Reason: Journals use timestamp + random suffix (journal-{timestamp}-{random})
--         Collision probability is astronomically low, constraint is redundant

-- Step 1: Drop the existing namespace-scoped constraint
ALTER TABLE wiki.wiki_pages
DROP CONSTRAINT IF EXISTS wiki_pages_slug_namespace_unique;

-- Step 2: Create partial UNIQUE index - enforce uniqueness for non-journal pages only
-- This keeps wiki pages safe while allowing journals to be constraint-free
CREATE UNIQUE INDEX IF NOT EXISTS wiki_pages_slug_non_journal_unique
ON wiki.wiki_pages(slug)
WHERE namespace != 'journals';

-- Explanation:
-- - Wiki pages, library pages, etc. still have UNIQUE slugs (good for SEO, URLs)
-- - Journals are exempt from constraint (they use randomized slugs)
-- - Best of both worlds: safety for wiki, freedom for journals

-- Step 3: Verify the index exists
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'wiki'
  AND tablename = 'wiki_pages'
  AND indexname = 'wiki_pages_slug_non_journal_unique';

-- Expected output:
-- wiki | wiki_pages | wiki_pages_slug_non_journal_unique | CREATE UNIQUE INDEX ... WHERE namespace <> 'journals'
