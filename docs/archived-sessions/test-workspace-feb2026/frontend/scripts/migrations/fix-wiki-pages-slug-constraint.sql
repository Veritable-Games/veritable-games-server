-- Migration: Fix wiki_pages slug constraint to be namespace-scoped
-- Date: 2025-11-08
-- Issue: UNIQUE constraint on slug is global, should be per-namespace
--
-- Background: Journals are private notes (not searchable, not indexed like wiki)
-- and should have independent slug space from main wiki pages.
-- Random timestamp slugs like 'journal-1762591254745' are acceptable.

-- Step 1: Check for any existing conflicts (should be none)
-- This query finds slugs that appear in multiple namespaces
SELECT slug, COUNT(DISTINCT namespace) as namespace_count,
       array_agg(DISTINCT namespace) as namespaces
FROM wiki.wiki_pages
GROUP BY slug
HAVING COUNT(DISTINCT namespace) > 1;

-- If the above returns rows, there are conflicts to resolve manually
-- Expected: 0 rows (no conflicts)

-- Step 2: Drop the old global UNIQUE constraint
ALTER TABLE wiki.wiki_pages
DROP CONSTRAINT IF EXISTS wiki_pages_slug_key;

-- Step 3: Add namespace-scoped UNIQUE constraint
-- This allows duplicate slugs across different namespaces
-- but maintains uniqueness within each namespace
ALTER TABLE wiki.wiki_pages
ADD CONSTRAINT wiki_pages_slug_namespace_unique
UNIQUE (slug, namespace);

-- Step 4: Verify the new constraint exists
SELECT conname, contype,
       pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'wiki.wiki_pages'::regclass
  AND conname = 'wiki_pages_slug_namespace_unique';

-- Expected output:
-- wiki_pages_slug_namespace_unique | u | UNIQUE (slug, namespace)

-- Note: The existing index idx_wiki_pages_slug_namespace will support this constraint
