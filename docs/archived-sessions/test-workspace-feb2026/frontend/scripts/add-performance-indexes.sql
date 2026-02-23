-- Performance Optimization Indexes for forums.db
-- Created: 2025-10-08
-- Expected impact: 5-10x query speedup for 50-67% write overhead
--
-- Usage:
--   sqlite3 data/forums.db < scripts/add-performance-indexes.sql
--
-- Or use the SQL maintenance script (recommended):
--   npm run db:migrate -- --db=forums --file=scripts/add-performance-indexes.sql

-- =============================================================================
-- CRITICAL INDEXES (Must Implement - 8 indexes)
-- =============================================================================

-- 1. Composite index for topic listing (HIGHEST IMPACT)
--    Covers: WHERE category_id = ? ORDER BY is_pinned DESC, updated_at DESC
--    Used by: GET /api/forums/[category]/topics (60% of traffic)
--    Expected speedup: 15-25ms → <5ms (at 1000 topics)
CREATE INDEX IF NOT EXISTS idx_topics_category_pinned_updated
  ON forum_topics(category_id, is_pinned DESC, updated_at DESC);

-- 2. Foreign key index: category_id
--    Prevents full table scans when filtering by category
CREATE INDEX IF NOT EXISTS idx_topics_category
  ON forum_topics(category_id);

-- 3. Foreign key index: author_id
--    Used for user activity queries, moderation lookups
CREATE INDEX IF NOT EXISTS idx_topics_author
  ON forum_topics(author_id);

-- 4. Reply index: topic_id (base case for recursive CTE)
--    Partial index: only top-level replies (parent_id IS NULL)
--    Expected speedup: 80-120ms → 30-45ms (500 replies with both reply indexes)
CREATE INDEX IF NOT EXISTS idx_replies_topic
  ON forum_replies(topic_id)
  WHERE parent_id IS NULL;

-- 5. Reply index: parent_id (recursive case for CTE)
--    Partial index: only nested replies (parent_id IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_replies_parent
  ON forum_replies(parent_id)
  WHERE parent_id IS NOT NULL;

-- 6. Category hierarchy index
--    Used for subcategory navigation
CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON forum_categories(parent_id)
  WHERE parent_id IS NOT NULL;

-- 7. Topic-tags lookup
--    Used for tag filtering, tag clouds
CREATE INDEX IF NOT EXISTS idx_topic_tags_topic
  ON topic_tags(topic_id);

-- 8. Status filtering (partial index)
--    Only indexes non-active topics (5% of data)
--    Used for moderation queries (hidden/deleted/flagged topics)
CREATE INDEX IF NOT EXISTS idx_topics_status
  ON forum_topics(status)
  WHERE status != 'active';

-- =============================================================================
-- OPTIONAL INDEXES (Implement After Monitoring - 3 indexes)
-- =============================================================================
-- Only add these if monitoring shows they're needed

-- 9. Recently active topics (if "recently active" sorting is common)
-- CREATE INDEX IF NOT EXISTS idx_topics_category_updated
--   ON forum_topics(category_id, updated_at DESC);

-- 10. Paginated reply loading (if loading replies in chunks)
-- CREATE INDEX IF NOT EXISTS idx_replies_topic_created
--   ON forum_replies(topic_id, created_at ASC);

-- 11. Hot topics feature (if view count sorting is used)
-- CREATE INDEX IF NOT EXISTS idx_topics_view_count
--   ON forum_topics(view_count DESC)
--   WHERE view_count > 100;

-- =============================================================================
-- UPDATE QUERY PLANNER STATISTICS
-- =============================================================================
-- This tells SQLite about data distribution and helps optimize query plans

ANALYZE forum_topics;
ANALYZE forum_replies;
ANALYZE forum_categories;
ANALYZE topic_tags;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these to verify indexes were created and are being used

-- List all indexes
-- SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY tbl_name, name;

-- Check index usage for topic listing query
-- EXPLAIN QUERY PLAN SELECT * FROM forum_topics WHERE category_id = 1 ORDER BY is_pinned DESC, updated_at DESC LIMIT 20;
-- Expected: "SEARCH TABLE forum_topics USING INDEX idx_topics_category_pinned_updated"

-- Check index usage for reply loading query
-- EXPLAIN QUERY PLAN SELECT * FROM forum_replies WHERE topic_id = 1 AND parent_id IS NULL;
-- Expected: "SEARCH TABLE forum_replies USING INDEX idx_replies_topic"

-- =============================================================================
-- PERFORMANCE IMPACT ESTIMATES
-- =============================================================================
--
-- Write Performance Impact:
-- - INSERT topic: 0.5ms → 0.8ms (+60%)
-- - INSERT reply: 0.3ms → 0.5ms (+67%)
-- - UPDATE topic: 0.4ms → 0.6ms (+50%)
--
-- Read Performance Improvement:
-- - List topics (1000 topics): 15-25ms → <5ms (5-10x faster)
-- - Get replies (500 replies): 80-120ms → 30-45ms (3-4x faster)
-- - Category navigation: 10-15ms → 2-3ms (5x faster)
--
-- Disk Space Usage:
-- - Index overhead: ~50-100 KB (for 1000 topics + 10K replies)
-- - Total database size: 888 KB → ~950 KB (+7%)
--
-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- If indexes cause issues, drop them with:
--
-- DROP INDEX IF EXISTS idx_topics_category_pinned_updated;
-- DROP INDEX IF EXISTS idx_topics_category;
-- DROP INDEX IF EXISTS idx_topics_author;
-- DROP INDEX IF EXISTS idx_replies_topic;
-- DROP INDEX IF EXISTS idx_replies_parent;
-- DROP INDEX IF EXISTS idx_categories_parent;
-- DROP INDEX IF EXISTS idx_topic_tags_topic;
-- DROP INDEX IF EXISTS idx_topics_status;
--
-- Then run: ANALYZE;
-- =============================================================================
