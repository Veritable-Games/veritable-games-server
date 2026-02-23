# Forums Database Quick Reference

**Last Updated:** 2025-10-09
**Database:** `/frontend/data/forums.db`
**Full Analysis:** See `FORUMS_DATABASE_SCHEMA_ANALYSIS.md`

---

## Tables Overview

| Table | Rows | Purpose | Key Features |
|-------|------|---------|-------------|
| `forum_categories` | 6 | Topic organization | Unique slugs, color-coded, materialized counts |
| `forum_topics` | 1 | Discussion threads | Soft delete, cached user data, status tracking |
| `forum_replies` | 0 | Nested replies (max depth: 5) | Materialized paths, solution marking, vote scoring |
| `forum_tags` | 0 | Topic tagging | Usage count tracking, color customization |
| `forum_topic_tags` | 0 | Junction table | Many-to-many topics↔tags |
| `forum_search_fts` | 3 | FTS5 search index | Porter stemming, unicode61, auto-sync via triggers |

---

## Critical Schema Features

### ✅ Excellent Design Choices

1. **FTS5 Full-Text Search:**
   - Tokenizer: `porter unicode61 remove_diacritics 2`
   - Searchable: title, content, username, category_name, tag_names
   - Auto-synced via 7 triggers (insert/update/delete for topics + replies)
   - Contentless mode for space efficiency

2. **Materialized Denormalization:**
   - Cached user data (username, display_name) in topics/replies
   - Cached counts (topic_count, reply_count, usage_count)
   - Avoids expensive JOINs and COUNT(*) queries
   - Trade-off: Must sync when source data changes

3. **Nested Reply Threading:**
   - Materialized path (e.g., `1.5.12`) for tree traversal
   - Auto-calculated depth, path, thread_root_id via triggers
   - Max depth: 5 (enforced via trigger + CHECK constraint)
   - Enables `ORDER BY path` for flat tree display

4. **Soft Deletes:**
   - `deleted_at` and `deleted_by` columns
   - Indexes on `deleted_at` for filtering
   - Preserves data for audit trail
   - FTS5 trigger removes from search index

5. **Data Validation:**
   - CHECK constraints on title (3-200 chars), content (10+ chars)
   - Status enum ('open', 'closed', 'solved')
   - Color hex validation
   - Non-negative counts
   - Unique slugs and names

### ⚠️ Critical Issues

1. **Foreign Keys DISABLED:**
   ```sql
   PRAGMA foreign_keys; -- Returns 0
   ```
   **FIX:** Add to `/lib/database/pool.ts`:
   ```typescript
   db.pragma('foreign_keys = ON');
   ```

2. **No Foreign Keys to users.db:**
   - SQLite doesn't support cross-database FKs
   - Must validate user_id at application level
   - Risk: Orphaned records if user deleted

3. **Username Sync:**
   - Cached `username`/`user_display_name` in topics/replies
   - No automatic sync when users change username
   - **Solution:** Create background job or user update webhook

---

## Indexing Strategy

**Total Indexes:** 19 (well-covered)

### Primary Use Cases Covered

✅ Category browsing by section + sort order
✅ Topic lists by category (with pinned first)
✅ Topic filtering by status
✅ Reply threading (parent → children)
✅ Materialized path traversal
✅ Solution lookup (is_solution + vote_score)
✅ User history (topics + replies by user)
✅ Tag queries (by slug, by usage count)
✅ Soft delete filtering (deleted_at IS NULL)

### Missing Indexes (Recommended)

```sql
-- Hot topics
CREATE INDEX idx_topics_view_count ON forum_topics(view_count DESC);

-- Popular topics
CREATE INDEX idx_topics_vote_score ON forum_topics(vote_score DESC);

-- Moderation audit
CREATE INDEX idx_topics_moderated ON forum_topics(moderated_at DESC)
  WHERE moderated_at IS NOT NULL;
```

---

## Trigger System (19 Triggers)

### Auto-Update (2)
- `forum_topics_auto_update` - Refresh `updated_at` on changes
- `forum_replies_auto_update` - Refresh `updated_at` on changes

### Materialized Counts (4)
- `forum_topics_insert_count` - Increment category topic_count
- `forum_topics_delete_count` - Decrement category topic_count
- `topic_tags_insert_count` - Increment tag usage_count
- `topic_tags_delete_count` - Decrement tag usage_count

### Reply Management (5)
- `forum_replies_calculate_nesting` - Auto-calculate depth/path/thread_root_id
- `forum_replies_enforce_max_depth` - Prevent depth > 5
- `forum_replies_insert_update_topic` - Increment topic reply_count
- `forum_replies_delete_update_topic` - Decrement topic reply_count
- `forum_replies_mark_solution` - Unmark other solutions (only 1 per topic)

### FTS5 Sync (7)
- `forum_fts_topic_insert`, `forum_fts_topic_update`, `forum_fts_topic_delete`
- `forum_fts_reply_insert`, `forum_fts_reply_update`, `forum_fts_reply_delete`
- `forum_fts_reply_soft_delete` - Remove when `is_deleted = 1`

### Category Stats (1)
- `forum_topics_update_reply_count` - Update category reply_count

---

## Common Queries

### Search Topics/Replies
```sql
SELECT
  content_type,
  content_id,
  title,
  snippet(forum_search_fts, 1, '<mark>', '</mark>', '...', 30) as excerpt,
  rank
FROM forum_search_fts
WHERE forum_search_fts MATCH 'search query'
  AND category_name = 'Category Name'
ORDER BY rank
LIMIT 20;
```

### Get Category with Topics
```sql
-- Category
SELECT * FROM forum_categories WHERE slug = 'general-discussion';

-- Topics in category (with pagination)
SELECT * FROM forum_topics
WHERE category_id = ? AND deleted_at IS NULL
ORDER BY is_pinned DESC, last_activity_at DESC
LIMIT 20 OFFSET 0;
```

### Get Topic with Nested Replies
```sql
-- Topic
SELECT * FROM forum_topics WHERE id = ?;

-- All replies (flat, ordered by path for tree display)
SELECT * FROM forum_replies
WHERE topic_id = ? AND deleted_at IS NULL
ORDER BY path ASC;
```

### Find Solution for Topic
```sql
SELECT * FROM forum_replies
WHERE topic_id = ? AND is_solution = 1
LIMIT 1;
```

### Get User's Topics
```sql
SELECT * FROM forum_topics
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;
```

### Get Popular Tags
```sql
SELECT * FROM forum_tags
ORDER BY usage_count DESC
LIMIT 20;
```

---

## Missing Features (vs. Production Forums)

### Critical (Must-Have)
- ❌ User permissions (view/post per category)
- ❌ Read tracking (unread topics indicator)
- ❌ User notifications (mentions, replies)
- ❌ Moderation queue (user reports)

### Important (Should-Have)
- ❌ Revision history (full edit diffs)
- ❌ Bookmarks/favorites
- ❌ Reaction system (beyond vote_score)
- ❌ Draft auto-save

### Nice-to-Have
- ❌ Poll system
- ❌ Badge/achievement system
- ❌ User groups (bulk permissions)
- ❌ Email digests
- ❌ Topic timers (auto-close)

---

## Performance Tips

### ✅ Optimized Patterns

1. **Use Views for Active Content:**
   ```sql
   CREATE VIEW active_topics AS
     SELECT * FROM forum_topics WHERE deleted_at IS NULL;

   CREATE VIEW active_replies AS
     SELECT * FROM forum_replies WHERE deleted_at IS NULL;
   ```

2. **Batch FTS5 Updates:**
   ```sql
   -- For bulk inserts, disable triggers then rebuild:
   PRAGMA triggers = OFF;
   -- Bulk insert topics
   INSERT INTO forum_search_fts(forum_search_fts) VALUES('rebuild');
   PRAGMA triggers = ON;
   ```

3. **Leverage Materialized Counts:**
   ```sql
   -- ✅ FAST (uses materialized count)
   SELECT topic_count FROM forum_categories WHERE id = ?;

   -- ❌ SLOW (counts every row)
   SELECT COUNT(*) FROM forum_topics WHERE category_id = ?;
   ```

4. **Use Indexes for Sorting:**
   ```sql
   -- ✅ Uses idx_topics_category index
   SELECT * FROM forum_topics
   WHERE category_id = ?
   ORDER BY is_pinned DESC, updated_at DESC;
   ```

### ⚠️ Potential Bottlenecks

1. **FTS5 Trigger Subqueries:**
   - Topic insert triggers fetch category name + tags via JOIN
   - Slow with 50+ tags per topic
   - **Solution:** Limit tags per topic (max 10)

2. **Trigger Overhead on Bulk Inserts:**
   - Every insert fires 3-4 triggers
   - Slow for 100+ topics at once
   - **Solution:** Disable triggers for bulk, rebuild FTS5 after

3. **Soft Delete Filtering:**
   - Every query needs `WHERE deleted_at IS NULL`
   - Use views (active_topics) to encapsulate

---

## TypeScript Integration

The schema **perfectly aligns** with `/lib/forums/types.ts`:

| TypeScript Type | Database Table | Status |
|----------------|----------------|--------|
| `ForumCategory` | `forum_categories` | ✅ 100% match |
| `ForumTopic` | `forum_topics` | ✅ Maps user_id → author_id |
| `ForumReply` | `forum_replies` | ✅ Maps depth field |
| `ForumTag` | `forum_tags` | ✅ 100% match |

**Repository Pattern:**
- `/lib/forums/repositories/topic-repository.ts` - CRUD for topics
- `/lib/forums/repositories/reply-repository.ts` - CRUD for replies
- `/lib/forums/repositories/category-repository.ts` - CRUD for categories
- `/lib/forums/repositories/search-repository.ts` - FTS5 queries

All repositories:
- ✅ Use Result pattern (Ok/Err) for error handling
- ✅ Transform DB rows → TypeScript types
- ✅ Handle pagination
- ✅ Fetch cross-DB user data separately

---

## Schema Changelog

**Current Version:** 1.0 (October 2025)

**Added:**
- Initial schema with 6 core tables
- FTS5 full-text search
- 19 triggers for integrity
- 19 indexes for performance
- Soft delete support
- Nested reply threading

**Known Issues:**
- Foreign keys disabled by default (must enable in pool)
- No username sync mechanism

**Planned:**
- Read tracking table
- Notification system
- Moderation queue
- Revision history

---

## Quick Checklist for New Features

Before modifying the schema:

1. ✅ Check if foreign keys are enabled (`PRAGMA foreign_keys`)
2. ✅ Consider materialized vs. computed data (denormalize for performance)
3. ✅ Add indexes for new query patterns
4. ✅ Update FTS5 triggers if adding searchable fields
5. ✅ Add CHECK constraints for validation
6. ✅ Use soft deletes (deleted_at) instead of hard deletes
7. ✅ Update TypeScript types in `/lib/forums/types.ts`
8. ✅ Update repositories for new fields
9. ✅ Test cascade deletes with foreign keys enabled
10. ✅ Document schema changes in CLAUDE.md

---

**For Full Analysis:** See `FORUMS_DATABASE_SCHEMA_ANALYSIS.md` (23 pages, comprehensive review)
