-- Wiki Production Database Diagnostic Queries
-- Run on production PostgreSQL (192.168.1.15) to diagnose wiki category issues
-- Date: November 14, 2025

-- ============================================================================
-- SECTION 1: SCHEMA VERIFICATION
-- ============================================================================

-- 1.1: Check if wiki schema exists
SELECT
  schema_name,
  CASE
    WHEN schema_name = 'wiki' THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END as status
FROM information_schema.schemata
WHERE schema_name = 'wiki';

-- Expected: 1 row with "EXISTS ✓"
-- If no rows: Schema not created at all


-- 1.2: List all wiki tables
SELECT
  table_name,
  table_type,
  pg_size_pretty(pg_total_relation_size(table_schema||'.'||table_name)) as size
FROM information_schema.tables
WHERE table_schema = 'wiki'
ORDER BY table_name;

-- Expected: 25 tables including:
--   - wiki_categories
--   - wiki_pages
--   - wiki_revisions
--   - wiki_page_categories
--   - etc.


-- 1.3: Verify critical tables exist
SELECT
  'wiki_categories' as table_name,
  EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'wiki' AND table_name = 'wiki_categories') as exists
UNION ALL
SELECT 'wiki_pages', EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'wiki' AND table_name = 'wiki_pages')
UNION ALL
SELECT 'wiki_revisions', EXISTS(SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'wiki' AND table_name = 'wiki_revisions');

-- Expected: All true


-- ============================================================================
-- SECTION 2: WIKI CATEGORIES DATA
-- ============================================================================

-- 2.1: Count total categories
SELECT
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE is_public = true OR is_public IS NULL) as public_categories,
  COUNT(*) FILTER (WHERE is_public = false) as private_categories
FROM wiki.wiki_categories;

-- Expected: Should have 8-12 categories (uncategorized, archive, autumn, etc.)
-- If 0: Categories table exists but is empty - THIS IS THE PROBLEM


-- 2.2: List all categories with details
SELECT
  id,
  name,
  parent_id,
  COALESCE(is_public, true) as is_public,
  sort_order,
  color,
  icon,
  created_at
FROM wiki.wiki_categories
ORDER BY sort_order, name;

-- Expected: Multiple rows with category data
-- If empty: Categories not seeded


-- 2.3: Check for category hierarchy
SELECT
  c.id,
  c.name,
  c.parent_id,
  p.name as parent_name,
  COUNT(DISTINCT wp.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_categories p ON c.parent_id = p.id
LEFT JOIN wiki.wiki_pages wp ON c.id = wp.category_id AND wp.status = 'published'
GROUP BY c.id, c.name, c.parent_id, p.name
ORDER BY c.sort_order, c.name;

-- Expected: Shows parent-child relationships if any exist


-- ============================================================================
-- SECTION 3: WIKI PAGES DATA
-- ============================================================================

-- 3.1: Count total pages
SELECT
  COUNT(*) as total_pages,
  COUNT(*) FILTER (WHERE status = 'published') as published_pages,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_pages,
  COUNT(*) FILTER (WHERE status = 'archived') as archived_pages,
  COUNT(*) FILTER (WHERE is_deleted = true) as deleted_pages
FROM wiki.wiki_pages;

-- Expected: 174 total, most published
-- If 0: Pages not migrated


-- 3.2: Pages by category
SELECT
  COALESCE(wp.category_id, 'NULL') as category_id,
  COUNT(*) as page_count,
  COUNT(*) FILTER (WHERE wp.status = 'published') as published_count,
  STRING_AGG(DISTINCT wp.title, ', ' ORDER BY wp.title) FILTER (WHERE wp.status = 'published' LIMIT 5) as sample_pages
FROM wiki.wiki_pages wp
GROUP BY wp.category_id
ORDER BY page_count DESC;

-- Expected: Shows page distribution across categories
-- If many pages in 'NULL' or 'uncategorized': Pages exist but categories don't


-- 3.3: Check for orphaned pages (category doesn't exist)
SELECT
  COUNT(*) as orphaned_page_count,
  STRING_AGG(DISTINCT wp.category_id, ', ') as orphaned_categories
FROM wiki.wiki_pages wp
WHERE status = 'published'
  AND (wp.category_id IS NULL OR
       wp.category_id NOT IN (SELECT id FROM wiki.wiki_categories));

-- Expected: 0 orphaned pages
-- If > 0: Pages reference non-existent categories


-- 3.4: Sample pages by namespace
SELECT
  namespace,
  COUNT(*) as count,
  STRING_AGG(DISTINCT slug, ', ' ORDER BY slug LIMIT 3) as sample_slugs
FROM wiki.wiki_pages
WHERE status = 'published'
GROUP BY namespace
ORDER BY count DESC;

-- Expected: Shows pages in different namespaces (main, journal, project, etc.)


-- ============================================================================
-- SECTION 4: PAGE-CATEGORY RELATIONSHIPS
-- ============================================================================

-- 4.1: Check wiki_page_categories junction table
SELECT
  COUNT(*) as total_relationships,
  COUNT(DISTINCT page_id) as pages_with_categories,
  COUNT(DISTINCT category_id) as categories_with_pages
FROM wiki.wiki_page_categories;

-- Expected: Should have entries linking pages to categories
-- If 0: Junction table exists but has no data


-- 4.2: Verify referential integrity
SELECT
  COUNT(*) as missing_category_references,
  STRING_AGG(DISTINCT wpc.category_id, ', ') as missing_categories
FROM wiki.wiki_page_categories wpc
WHERE wpc.category_id NOT IN (SELECT id FROM wiki.wiki_categories);

-- Expected: 0 rows (perfect referential integrity)
-- If > 0: Broken foreign key references


-- ============================================================================
-- SECTION 5: WIKI REVISIONS DATA
-- ============================================================================

-- 5.1: Check revision data completeness
SELECT
  COUNT(*) as total_revisions,
  COUNT(DISTINCT page_id) as pages_with_revisions,
  MIN(revision_timestamp) as oldest_revision,
  MAX(revision_timestamp) as latest_revision
FROM wiki.wiki_revisions;

-- Expected: Many revisions (174+ for 174 pages)
-- If 0: Revisions not migrated


-- 5.2: Pages without revisions
SELECT
  COUNT(*) as pages_without_revisions,
  COUNT(*) FILTER (WHERE status = 'published') as published_without_revisions
FROM wiki.wiki_pages wp
WHERE NOT EXISTS (
  SELECT 1 FROM wiki.wiki_revisions wr WHERE wr.page_id = wp.id
);

-- Expected: 0 (all pages should have revisions)
-- If > 0: Pages exist but content missing


-- ============================================================================
-- SECTION 6: WIKI SEARCH & INDEXING
-- ============================================================================

-- 6.1: Check full-text search index
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'wiki' AND indexname LIKE '%search%'
ORDER BY indexname;

-- Expected: FTS indexes for wiki_search


-- 6.2: Check other critical indexes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
WHERE schemaname = 'wiki'
ORDER BY tablename, indexname;

-- Expected: Many indexes for optimal query performance


-- ============================================================================
-- SECTION 7: DATABASE CONSTRAINTS
-- ============================================================================

-- 7.1: Check foreign keys for wiki_page_categories
SELECT
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.table_constraints
NATURAL JOIN information_schema.key_column_usage
WHERE table_schema = 'wiki' AND table_name = 'wiki_page_categories'
ORDER BY constraint_name;

-- Expected: Foreign keys to wiki_pages and wiki_categories


-- 7.2: List all constraints in wiki schema
SELECT
  constraint_type,
  COUNT(*) as count
FROM information_schema.table_constraints
WHERE table_schema = 'wiki'
GROUP BY constraint_type
ORDER BY constraint_type;

-- Expected: PRIMARY KEY, UNIQUE, FOREIGN KEY constraints


-- ============================================================================
-- SECTION 8: PERFORMANCE DIAGNOSTICS
-- ============================================================================

-- 8.1: Table sizes and row counts
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  (SELECT count(*) FROM pg_class
   WHERE oid = schemaname||'.'||tablename::regclass AND relkind='i') as index_count
FROM pg_tables
WHERE schemaname = 'wiki'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Expected: Shows table sizes and index counts


-- 8.2: Index usage statistics (if available)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'wiki'
ORDER BY idx_scan DESC NULLS LAST;

-- Expected: Shows which indexes are being used


-- ============================================================================
-- SECTION 9: QUERY SIMULATION (Testing Actual Queries)
-- ============================================================================

-- 9.1: Simulate WikiCategoryService.getAllCategories()
SELECT
  c.*,
  COUNT(DISTINCT p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id AND p.status = 'published'
GROUP BY c.id
ORDER BY c.sort_order, c.name;

-- Expected: Lists all categories with page counts
-- If empty: This is why category pages show 404


-- 9.2: Simulate WikiCategoryService.getRootCategories()
SELECT
  c.*,
  COUNT(DISTINCT p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id AND p.status = 'published'
WHERE c.parent_id IS NULL
GROUP BY c.id
ORDER BY c.sort_order, c.name;

-- Expected: Root categories only
-- If empty: Category navigation broken


-- 9.3: Simulate category page fetch
SELECT
  c.id,
  c.name,
  c.description,
  c.color,
  c.icon,
  COUNT(DISTINCT p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id AND p.status = 'published'
WHERE c.id = 'archive'  -- Replace 'archive' with any category ID
GROUP BY c.id, c.name, c.description, c.color, c.icon;

-- Expected: Single category with page count
-- If empty: Specific category pages will show 404


-- ============================================================================
-- SECTION 10: SCHEMA COLUMN VERIFICATION
-- ============================================================================

-- 10.1: Check wiki_categories columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'wiki' AND table_name = 'wiki_categories'
ORDER BY ordinal_position;

-- Expected columns:
--   id (text/varchar, NOT NULL)
--   parent_id (text/varchar, nullable)
--   name (text/varchar, NOT NULL)
--   description (text, nullable)
--   color (text/varchar)
--   icon (text/varchar)
--   sort_order (integer)
--   created_at (timestamp)
--   is_public (integer/boolean)


-- 10.2: Check wiki_pages columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'wiki' AND table_name = 'wiki_pages'
ORDER BY ordinal_position;

-- Expected: category_id column should exist


-- ============================================================================
-- SUMMARY DIAGNOSTIC
-- ============================================================================

-- Run this final query to get a quick overview
WITH category_check AS (
  SELECT
    COUNT(*) as category_count,
    CASE WHEN COUNT(*) > 0 THEN 'EXIST' ELSE 'MISSING' END as status
  FROM wiki.wiki_categories
),
page_check AS (
  SELECT
    COUNT(*) as page_count,
    COUNT(DISTINCT category_id) as categories_used
  FROM wiki.wiki_pages
  WHERE status = 'published'
),
junction_check AS (
  SELECT
    COUNT(*) as junction_count
  FROM wiki.wiki_page_categories
)
SELECT
  cc.category_count,
  cc.status as category_status,
  pc.page_count,
  pc.categories_used,
  jc.junction_count,
  CASE
    WHEN cc.category_count = 0 THEN '❌ CRITICAL: Categories table is empty'
    WHEN pc.page_count = 0 THEN '❌ CRITICAL: Pages table is empty'
    WHEN cc.category_count > 0 AND pc.page_count > 0 THEN '✓ Data looks healthy'
    ELSE '⚠️  Partial data issue'
  END as overall_status
FROM category_check cc, page_check pc, junction_check jc;

-- ============================================================================
-- END OF DIAGNOSTIC QUERIES
-- ============================================================================

-- Usage:
-- 1. Copy these queries into a PostgreSQL client connected to production
-- 2. Run SECTION 1 first to verify schema exists
-- 3. Run SECTION 2 to check category data (most likely to find the issue)
-- 4. Run other sections for detailed diagnostics
-- 5. Run SUMMARY DIAGNOSTIC at the end for quick overview

-- Expected findings:
-- - wiki schema EXISTS
-- - 25 tables present
-- - 8-12 categories in wiki_categories table
-- - 174 pages in wiki_pages table
-- - Pages linked to categories via category_id column
-- - Multiple revisions for pages
-- - Full-text search indexes active

-- Most likely finding (November 14, 2025):
-- - wiki schema: EXISTS
-- - wiki_categories table: EMPTY (0 rows)
-- - wiki_pages table: 174 rows (✓ pages exist)
-- - This explains why category pages show "doesn't exist"
