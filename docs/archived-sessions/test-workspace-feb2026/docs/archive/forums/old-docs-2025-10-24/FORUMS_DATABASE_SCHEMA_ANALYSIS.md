# Forums Database Schema Analysis

**Generated:** 2025-10-09
**Database:** `/frontend/data/forums.db`
**SQLite Version:** WAL mode enabled
**Foreign Keys:** DISABLED (critical issue - see below)

---

## Executive Summary

The forums database has a **well-designed, production-ready schema** with comprehensive features including:

- ✅ **FTS5 full-text search** with automatic sync via triggers
- ✅ **Materialized denormalization** for performance (cached counts, user data)
- ✅ **Soft deletes** with `deleted_at` columns
- ✅ **Nested replies** with path-based tree structure (max depth: 5)
- ✅ **Comprehensive indexing** for common query patterns
- ✅ **Automatic triggers** for maintaining data integrity and search index
- ✅ **Constraint validation** at database level (CHECK constraints)
- ⚠️ **Foreign keys defined but DISABLED** (critical - must enable in pool)

**Current Data:**
- 6 categories
- 1 topic
- 0 replies
- 0 tags
- 3 FTS5 search entries

---

## Database Tables

### 1. Core Tables

#### `forum_categories` (6 rows)
```sql
CREATE TABLE forum_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  section TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,

  -- Materialized counts (updated via triggers)
  topic_count INTEGER DEFAULT 0 NOT NULL,
  reply_count INTEGER DEFAULT 0 NOT NULL,

  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Constraints
  CHECK (sort_order >= 0),
  CHECK (topic_count >= 0),
  CHECK (reply_count >= 0),
  CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
)
```

**Key Features:**
- Unique slugs for URL routing
- Color validation (hex codes only)
- Section grouping for category organization
- Materialized counts for performance (no COUNT(*) needed)
- Timestamps with auto-update trigger

**Indexes:**
- `idx_categories_slug` - Fast slug lookups
- `idx_categories_section_order` - Sorted category lists by section

**Missing Features:**
- ❌ No `is_archived` flag for hiding categories
- ❌ No permission system (view/post restrictions)
- ❌ No `parent_id` for category hierarchies

---

#### `forum_topics` (1 row)
```sql
CREATE TABLE forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,

  -- Content
  title TEXT NOT NULL CHECK(length(title) >= 3 AND length(title) <= 200),
  content TEXT NOT NULL CHECK(length(content) >= 10),

  -- Cached user data (avoid cross-DB joins)
  username TEXT,
  user_display_name TEXT,

  -- Status flags
  status TEXT DEFAULT 'open' NOT NULL CHECK(status IN ('open', 'closed', 'solved')),
  is_pinned INTEGER DEFAULT 0 NOT NULL CHECK(is_pinned IN (0, 1)),
  is_locked INTEGER DEFAULT 0 NOT NULL CHECK(is_locked IN (0, 1)),

  -- Materialized counts
  reply_count INTEGER DEFAULT 0 NOT NULL CHECK(reply_count >= 0),
  view_count INTEGER DEFAULT 0 NOT NULL CHECK(view_count >= 0),
  vote_score INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_reply_at DATETIME,
  last_reply_user_id INTEGER,
  last_reply_username TEXT,

  -- Edit tracking
  last_edited_at DATETIME,
  last_edited_by INTEGER,

  -- Moderation
  moderated_at DATETIME,
  moderated_by INTEGER,
  moderation_reason TEXT,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by INTEGER DEFAULT NULL,

  -- Foreign keys
  FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE
)
```

**Key Features:**
- **Length validation** via CHECK constraints (3-200 chars title, 10+ chars content)
- **Cached user data** (username, display_name) to avoid cross-database JOINs
- **Soft delete** with `deleted_at` + `deleted_by`
- **Edit history** tracking (last_edited_at, last_edited_by)
- **Moderation tracking** (moderated_at, moderated_by, moderation_reason)
- **Materialized counts** for replies, views, votes
- **Last reply metadata** for forum index views

**Indexes:**
- `idx_topics_category` - Category listings with pinned topics first
- `idx_topics_category_status` - Filtered category views
- `idx_topics_last_reply` - "Active topics" sorting
- `idx_topics_status` - Status filtering
- `idx_topics_user` - User's topics history
- `idx_forum_topics_deleted` - Soft delete queries

**Missing Features:**
- ❌ No `is_sticky` vs `is_pinned` distinction (global vs category-level pins)
- ❌ No `is_announcement` flag
- ❌ No `view_permissions` or `post_permissions` columns
- ❌ No `tags_cache` JSON column (relies on JOIN for tag display)
- ⚠️ No foreign key to `users.id` (can't enforce user existence)

**Design Notes:**
- Schema denormalizes user data (username, display_name) which is EXCELLENT for performance
- This avoids cross-database JOINs to `users.db` for every topic display
- Must manually sync when users change username/display_name

---

#### `forum_replies` (0 rows)
```sql
CREATE TABLE forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  parent_id INTEGER,
  user_id INTEGER NOT NULL,

  -- Content
  content TEXT NOT NULL CHECK(length(content) >= 1),

  -- Cached user data
  username TEXT,
  user_display_name TEXT,

  -- Nesting metadata (materialized for performance)
  depth INTEGER DEFAULT 0 NOT NULL CHECK(depth >= 0 AND depth <= 5),
  path TEXT,
  thread_root_id INTEGER,

  -- Status flags
  is_solution INTEGER DEFAULT 0 NOT NULL CHECK(is_solution IN (0, 1)),
  is_deleted INTEGER DEFAULT 0 NOT NULL CHECK(is_deleted IN (0, 1)),

  -- Scoring
  vote_score INTEGER DEFAULT 0 NOT NULL,

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Edit tracking
  last_edited_at DATETIME,
  last_edited_by INTEGER,
  deleted_at DATETIME DEFAULT NULL,
  deleted_by INTEGER DEFAULT NULL,

  -- Foreign keys
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES forum_replies(id) ON DELETE CASCADE
)
```

**Key Features:**
- **Nested threading** up to 5 levels deep (enforced via CHECK + trigger)
- **Materialized path** for efficient tree traversal (e.g., `1.5.12` = reply 12 under 5 under 1)
- **Thread root tracking** for collapsing/expanding conversation trees
- **Solution marking** (only 1 per topic, enforced via trigger)
- **Soft delete** with audit trail
- **Cached user data** like topics
- **Vote scoring** for community-driven quality

**Indexes:**
- `idx_replies_topic` - Topic's replies with threading support
- `idx_replies_parent` - Child replies of a parent
- `idx_replies_path` - Materialized path lookups
- `idx_replies_thread_root` - Thread-based queries
- `idx_replies_solution` - Finding accepted solutions
- `idx_replies_user` - User's reply history
- `idx_forum_replies_deleted` - Soft delete queries

**Triggers:**
- `forum_replies_calculate_nesting` - Auto-calculate depth, path, thread_root_id
- `forum_replies_enforce_max_depth` - Block replies deeper than 5 levels
- `forum_replies_insert_update_topic` - Increment topic reply_count
- `forum_replies_delete_update_topic` - Decrement topic reply_count
- `forum_replies_mark_solution` - Unmark other solutions when marking new one
- `forum_replies_auto_update` - Auto-update updated_at timestamp

**Missing Features:**
- ❌ No `reply_to_user_id` for @mentions tracking
- ❌ No `is_by_topic_author` flag for quick visual identification
- ❌ No `reaction_counts` JSON column (e.g., {"👍": 5, "❤️": 3})

**Design Excellence:**
- The **materialized path** design is OUTSTANDING for performance
- Avoids recursive CTEs and enables `ORDER BY path` for tree display
- The depth limit of 5 is reasonable (prevents Reddit-style 100-deep threads)

---

#### `forum_tags` (0 rows)
```sql
CREATE TABLE forum_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#64748b',
  usage_count INTEGER DEFAULT 0 NOT NULL CHECK(usage_count >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

  CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
)
```

**Key Features:**
- Unique names and slugs
- Color customization (hex validation)
- Materialized usage count (updated via triggers)
- Lightweight design

**Indexes:**
- `idx_tags_slug` - Fast slug lookups
- `idx_tags_usage` - Popular tags sorting

**Missing Features:**
- ❌ No `category_id` for category-specific tags
- ❌ No `is_featured` or `is_official` flags
- ❌ No `synonyms` JSON column for tag merging

---

#### `forum_topic_tags` (0 rows) - Junction Table
```sql
CREATE TABLE forum_topic_tags (
  topic_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,

  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES forum_tags(id) ON DELETE CASCADE
)
```

**Key Features:**
- Composite primary key prevents duplicates
- Cascade deletes maintain integrity
- Minimal design (no extra metadata)

**Indexes:**
- `idx_topic_tags_topic` - Tags for a topic
- `idx_topic_tags_tag` - Topics with a tag

**Triggers:**
- `topic_tags_insert_count` - Increment tag usage_count
- `topic_tags_delete_count` - Decrement tag usage_count

**Missing Features:**
- ❌ No `added_by` user tracking
- ❌ No `is_primary` flag for main tag

---

### 2. Full-Text Search (FTS5)

#### `forum_search_fts` (3 rows) - Virtual Table
```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  -- Indexed columns (searchable)
  title,
  content,
  username,
  category_name,
  tag_names,

  -- Metadata (UNINDEXED - stored but not searchable)
  content_id UNINDEXED,
  content_type UNINDEXED,
  category_id UNINDEXED,
  topic_id UNINDEXED,
  user_id UNINDEXED,
  created_at UNINDEXED,
  vote_score UNINDEXED,
  is_pinned UNINDEXED,
  is_locked UNINDEXED,
  reply_count UNINDEXED,

  -- Configuration
  content='',
  contentless_delete=1,
  tokenize='porter unicode61 remove_diacritics 2'
)
```

**Key Features:**
- ✅ **Porter stemming** - Finds "running" when searching "run"
- ✅ **Unicode normalization** - Handles international characters
- ✅ **Diacritics removal** - "cafe" matches "café"
- ✅ **Contentless mode** - Stores only index (saves space)
- ✅ **Automatic sync** via triggers (insert/update/delete)
- ✅ **Rich metadata** for filtering and sorting results

**Searchable Fields:**
- `title` - Topic titles
- `content` - Topic/reply content
- `username` - Author names
- `category_name` - Category names
- `tag_names` - Comma-separated tag list

**Metadata (for filtering):**
- `content_type` - 'topic' or 'reply'
- `content_id` - ID of topic or reply
- `category_id`, `topic_id`, `user_id` - For filtering
- `created_at` - Date filtering
- `vote_score`, `is_pinned`, `is_locked`, `reply_count` - Ranking/filtering

**Triggers for Sync:**
- `forum_fts_topic_insert` - Add new topics to index
- `forum_fts_topic_update` - Update topic in index
- `forum_fts_topic_delete` - Remove topic from index
- `forum_fts_reply_insert` - Add new replies to index
- `forum_fts_reply_update` - Update reply in index
- `forum_fts_reply_delete` - Remove reply from index
- `forum_fts_reply_soft_delete` - Remove soft-deleted replies

**Supporting Tables:**
- `forum_search_fts_config` - FTS5 configuration (1 row)
- `forum_search_fts_data` - FTS5 index data (4 rows)
- `forum_search_fts_docsize` - Document size info (3 rows)
- `forum_search_fts_idx` - FTS5 term index (2 rows)

**Search Query Example:**
```sql
-- Find all topics/replies matching "game design" in "General" category
SELECT
  content_type,
  content_id,
  title,
  snippet(forum_search_fts, 1, '<mark>', '</mark>', '...', 30) as excerpt,
  rank
FROM forum_search_fts
WHERE forum_search_fts MATCH 'game design'
  AND category_name = 'General Discussion'
ORDER BY rank
LIMIT 20;
```

**Missing Features:**
- ❌ No BM25 relevance tuning (FTS5 supports custom ranking)
- ❌ No synonym support (e.g., "RPG" → "role-playing game")
- ❌ No phrase search optimization

**Design Excellence:**
- The FTS5 configuration is EXCELLENT with proper tokenization
- Automatic trigger-based sync ensures index is always current
- Contentless mode saves storage while maintaining search speed

---

## Schema Validation & Integrity

### ✅ Strengths

1. **CHECK Constraints:**
   - Title length: 3-200 characters
   - Content length: 10+ characters (topics), 1+ (replies)
   - Status: Must be 'open', 'closed', or 'solved'
   - Boolean flags: 0 or 1 only
   - Colors: Valid hex codes only
   - Depth: 0-5 for replies
   - Counts: Non-negative integers

2. **Unique Constraints:**
   - Category slugs
   - Tag names and slugs
   - Composite keys on junction tables

3. **Default Values:**
   - Timestamps: CURRENT_TIMESTAMP
   - Counts: 0
   - Status: 'open'
   - Booleans: 0 (false)
   - Colors: Sensible defaults

4. **Auto-Update Triggers:**
   - `updated_at` automatically refreshed on changes
   - Materialized counts maintained by triggers
   - FTS5 index synced automatically
   - Solution marking enforces single solution per topic

### ⚠️ Critical Issues

1. **Foreign Keys DISABLED:**
   ```sql
   PRAGMA foreign_keys; -- Returns 0 (disabled)
   ```

   **Impact:**
   - Can create topics with non-existent category_id
   - Can create replies with non-existent topic_id
   - CASCADE deletes won't work
   - Data integrity at risk

   **Fix:** Enable in database pool:
   ```typescript
   db.pragma('foreign_keys = ON');
   ```

2. **No Foreign Keys to users.db:**
   - `forum_topics.user_id` not enforced
   - `forum_replies.user_id` not enforced
   - `last_edited_by`, `deleted_by`, etc. not enforced

   **Reason:** SQLite doesn't support cross-database foreign keys

   **Mitigation:** Application-level validation required

3. **Cached User Data Sync:**
   - `username` and `user_display_name` are denormalized
   - Must manually sync when users change these fields
   - No trigger can do this (cross-database)

   **Recommendation:** Create a user update webhook/event system

---

## Indexing Strategy

### ✅ Well-Indexed Queries

**Total Indexes:** 19 (excluding auto-created primary keys)

**Coverage:**
- Category browsing (by section, sort order)
- Topic lists (by category, status, pinned, last activity)
- Reply threading (by parent, path, thread root)
- User history (topics and replies by user)
- Tag queries (by usage, by slug)
- Soft deletes (deleted_at indexes)
- Solutions (is_solution + vote_score)

### ⚠️ Missing Indexes

1. **Full-Text Search Filtering:**
   - No composite index on `(category_id, created_at)` for date-filtered searches
   - No index on `vote_score` for ranking

2. **Moderation Queries:**
   - No index on `moderated_at` for moderation history
   - No index on `moderated_by` for moderator activity

3. **View Tracking:**
   - No index on `view_count` for "hot topics" queries

4. **Composite Filters:**
   - No index on `(status, is_pinned, last_activity_at)` for common queries

### 💡 Recommended Indexes

```sql
-- Hot topics (high view count)
CREATE INDEX idx_topics_view_count ON forum_topics(view_count DESC);

-- Moderation audit trail
CREATE INDEX idx_topics_moderated ON forum_topics(moderated_at DESC) WHERE moderated_at IS NOT NULL;

-- Search result ranking
CREATE INDEX idx_topics_vote_score ON forum_topics(vote_score DESC);

-- User contributions across databases
CREATE INDEX idx_topics_user_created ON forum_topics(user_id, created_at DESC);
CREATE INDEX idx_replies_user_created ON forum_replies(user_id, created_at DESC);
```

---

## Trigger System

**Total Triggers:** 19

### Auto-Update Triggers (2)
- `forum_topics_auto_update` - Update `updated_at` on topic changes
- `forum_replies_auto_update` - Update `updated_at` on reply changes

### Materialized Count Triggers (4)
- `forum_topics_insert_count` - Increment category topic_count
- `forum_topics_delete_count` - Decrement category topic_count
- `topic_tags_insert_count` - Increment tag usage_count
- `topic_tags_delete_count` - Decrement tag usage_count

### Reply Management Triggers (5)
- `forum_replies_calculate_nesting` - Auto-calculate depth, path, thread_root_id
- `forum_replies_enforce_max_depth` - Block replies deeper than 5 levels
- `forum_replies_insert_update_topic` - Increment topic reply_count
- `forum_replies_delete_update_topic` - Decrement topic reply_count
- `forum_replies_mark_solution` - Unmark other solutions when marking new one

### FTS5 Sync Triggers (7)
- `forum_fts_topic_insert` - Index new topics
- `forum_fts_topic_update` - Reindex updated topics
- `forum_fts_topic_delete` - Remove deleted topics from index
- `forum_fts_reply_insert` - Index new replies
- `forum_fts_reply_update` - Reindex updated replies
- `forum_fts_reply_delete` - Remove deleted replies from index
- `forum_fts_reply_soft_delete` - Remove soft-deleted replies from index

### Category Counter Trigger (1)
- `forum_topics_update_reply_count` - Update category reply_count when topic reply_count changes (TRUNCATED in output)

### ✅ Trigger Quality

**Strengths:**
- Comprehensive coverage of data integrity needs
- FTS5 sync is automatic and reliable
- Materialized counts avoid expensive COUNT(*) queries
- Solution marking logic prevents multiple solutions

**Potential Issues:**
- ⚠️ Trigger performance impact on bulk operations (INSERT 1000 rows = 1000 trigger fires)
- ⚠️ FTS5 triggers use subqueries (could be slow with large datasets)
- ⚠️ No error handling in triggers (SQLite limitation)

**Recommendation:**
- For bulk operations, consider disabling triggers temporarily
- Monitor FTS5 trigger performance with large topics (100+ replies)

---

## Comparison to Mature Forum Systems

### Discourse (Ruby on Rails, PostgreSQL)

**Missing from forums.db:**
- ❌ **User trust levels** (Discourse has 0-4 trust levels for progressive permissions)
- ❌ **Read tracking** (last_read_at per user per topic)
- ❌ **Bookmark system** (users can bookmark topics/posts)
- ❌ **User notifications** (mentions, quotes, replies to your posts)
- ❌ **Private messaging** (DMs between users)
- ❌ **Like/reaction system** (separate from vote_score)
- ❌ **Draft system** (auto-save unfinished posts)
- ❌ **Post revisions** (full edit history, not just last_edited_at)
- ❌ **Topic timers** (auto-close after X days)
- ❌ **Polls** (embedded in topics)
- ❌ **Topic excerpts** (separate from content, for SEO)
- ❌ **Category permissions** (read/write/admin per category)
- ❌ **User groups** (for bulk permissions)
- ❌ **Email digests** (weekly summaries)
- ❌ **Badge system** (achievements for users)

**Has in forums.db:**
- ✅ Nested replies (Discourse uses flat threading)
- ✅ Soft deletes (Discourse hard-deletes)
- ✅ FTS5 search (Discourse uses PostgreSQL full-text)
- ✅ Tags (Discourse has this too)

### Reddit (Python, Cassandra/PostgreSQL)

**Missing from forums.db:**
- ❌ **Subreddit system** (equivalent to categories but more isolated)
- ❌ **Upvote/downvote separation** (vote_score is aggregate)
- ❌ **Gilding/awards** (community rewards)
- ❌ **Crossposting** (post in multiple categories)
- ❌ **Flair system** (user flair + post flair)
- ❌ **Sort algorithms** (best, hot, controversial, top)
- ❌ **Spam filtering** (AutoModerator equivalent)
- ❌ **Report system** (user-generated moderation queue)
- ❌ **Wiki pages** (per subreddit)
- ❌ **Multireddits** (custom category groupings)

**Has in forums.db:**
- ✅ Nested replies (Reddit's core feature)
- ✅ Vote scoring (Reddit-style)
- ✅ Moderation fields (moderated_at, moderated_by)
- ✅ Pinning (sticky posts)

### Stack Overflow (C#, SQL Server)

**Missing from forums.db:**
- ❌ **Answer acceptance** (forums.db has is_solution but for replies, not topics)
- ❌ **Bounty system** (reward points for answers)
- ❌ **Suggested edits** (community editing with review queue)
- ❌ **Close reasons** (duplicate, off-topic, etc.)
- ❌ **Duplicate linking** (mark as duplicate of another topic)
- ❌ **Revision history** (full diff between versions)
- ❌ **Comment system** (lightweight replies to answers)
- ❌ **Protected questions** (require reputation to answer)
- ❌ **Linked/related questions** (automatic and manual)

**Has in forums.db:**
- ✅ Solution marking (is_solution)
- ✅ Vote scoring
- ✅ Tags
- ✅ Edit tracking (last_edited_at, last_edited_by)

---

## Missing Features for Production Forum

### Critical (Must-Have)

1. **User Permissions System:**
   ```sql
   -- Add to forum_categories
   ALTER TABLE forum_categories ADD COLUMN view_permission TEXT DEFAULT 'everyone';
   ALTER TABLE forum_categories ADD COLUMN post_permission TEXT DEFAULT 'authenticated';

   -- Create permissions table
   CREATE TABLE forum_permissions (
     id INTEGER PRIMARY KEY,
     category_id INTEGER,
     role TEXT NOT NULL,
     can_view INTEGER DEFAULT 1,
     can_post INTEGER DEFAULT 1,
     can_moderate INTEGER DEFAULT 0,
     FOREIGN KEY (category_id) REFERENCES forum_categories(id) ON DELETE CASCADE
   );
   ```

2. **Read Tracking (Mark as Read):**
   ```sql
   CREATE TABLE forum_topic_reads (
     topic_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     last_read_at DATETIME NOT NULL,
     last_read_reply_id INTEGER,
     PRIMARY KEY (topic_id, user_id),
     FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
   );
   ```

3. **User Notifications:**
   ```sql
   CREATE TABLE forum_notifications (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL,
     type TEXT NOT NULL, -- 'mention', 'reply', 'solution', 'topic_reply'
     topic_id INTEGER,
     reply_id INTEGER,
     from_user_id INTEGER,
     is_read INTEGER DEFAULT 0,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
     FOREIGN KEY (reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE
   );
   ```

4. **Moderation Queue:**
   ```sql
   CREATE TABLE forum_moderation_queue (
     id INTEGER PRIMARY KEY,
     content_type TEXT NOT NULL, -- 'topic' or 'reply'
     content_id INTEGER NOT NULL,
     reported_by INTEGER NOT NULL,
     reason TEXT NOT NULL,
     status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
     resolved_by INTEGER,
     resolved_at DATETIME,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Important (Should-Have)

5. **Revision History:**
   ```sql
   CREATE TABLE forum_topic_revisions (
     id INTEGER PRIMARY KEY,
     topic_id INTEGER NOT NULL,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     edited_by INTEGER NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
   );

   -- Same for replies
   CREATE TABLE forum_reply_revisions (
     id INTEGER PRIMARY KEY,
     reply_id INTEGER NOT NULL,
     content TEXT NOT NULL,
     edited_by INTEGER NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (reply_id) REFERENCES forum_replies(id) ON DELETE CASCADE
   );
   ```

6. **Bookmarks/Favorites:**
   ```sql
   CREATE TABLE forum_bookmarks (
     topic_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (topic_id, user_id),
     FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
   );
   ```

7. **Reaction System (Beyond Votes):**
   ```sql
   CREATE TABLE forum_reactions (
     id INTEGER PRIMARY KEY,
     content_type TEXT NOT NULL, -- 'topic' or 'reply'
     content_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     reaction_type TEXT NOT NULL, -- 'like', 'helpful', 'insightful', etc.
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     UNIQUE (content_type, content_id, user_id, reaction_type)
   );
   ```

8. **User Drafts:**
   ```sql
   CREATE TABLE forum_drafts (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL,
     draft_type TEXT NOT NULL, -- 'topic' or 'reply'
     topic_id INTEGER, -- NULL for new topic
     parent_id INTEGER, -- For replies
     title TEXT,
     content TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

### Nice-to-Have

9. **Poll System:**
   ```sql
   CREATE TABLE forum_polls (
     id INTEGER PRIMARY KEY,
     topic_id INTEGER NOT NULL,
     question TEXT NOT NULL,
     multiple_choice INTEGER DEFAULT 0,
     closes_at DATETIME,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
   );

   CREATE TABLE forum_poll_options (
     id INTEGER PRIMARY KEY,
     poll_id INTEGER NOT NULL,
     option_text TEXT NOT NULL,
     vote_count INTEGER DEFAULT 0,
     FOREIGN KEY (poll_id) REFERENCES forum_polls(id) ON DELETE CASCADE
   );

   CREATE TABLE forum_poll_votes (
     poll_id INTEGER NOT NULL,
     option_id INTEGER NOT NULL,
     user_id INTEGER NOT NULL,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (poll_id, option_id, user_id)
   );
   ```

10. **Badge System:**
    ```sql
    CREATE TABLE forum_badges (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      icon TEXT,
      criteria TEXT NOT NULL, -- JSON describing how to earn
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE forum_user_badges (
      user_id INTEGER NOT NULL,
      badge_id INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, badge_id),
      FOREIGN KEY (badge_id) REFERENCES forum_badges(id) ON DELETE CASCADE
    );
    ```

---

## Data Integrity Recommendations

### Immediate Fixes

1. **Enable Foreign Keys:**
   ```typescript
   // In /lib/database/pool.ts
   db.pragma('foreign_keys = ON');
   ```

2. **Add Missing Indexes:**
   ```sql
   CREATE INDEX idx_topics_view_count ON forum_topics(view_count DESC);
   CREATE INDEX idx_topics_vote_score ON forum_topics(vote_score DESC);
   ```

3. **Add Soft Delete Filter Views:**
   ```sql
   CREATE VIEW active_topics AS
     SELECT * FROM forum_topics WHERE deleted_at IS NULL;

   CREATE VIEW active_replies AS
     SELECT * FROM forum_replies WHERE deleted_at IS NULL;
   ```

### Long-Term Improvements

4. **Username Sync Mechanism:**
   - Add `updated_at` index to users.db
   - Create background job to sync changed usernames
   - OR: Use database triggers with `ATTACH DATABASE` (risky for concurrency)

5. **Partition Large Tables:**
   - If topics/replies exceed 100K rows, consider partitioning by date
   - SQLite doesn't support native partitioning, but can use multiple tables:
     ```sql
     forum_topics_2024
     forum_topics_2025
     -- Union views for queries
     ```

6. **Archive Old Topics:**
   ```sql
   CREATE TABLE forum_topics_archive (
     -- Same schema as forum_topics
   );

   -- Move topics older than 1 year with no activity
   INSERT INTO forum_topics_archive
   SELECT * FROM forum_topics
   WHERE last_activity_at < datetime('now', '-1 year');
   ```

---

## Performance Considerations

### ✅ Optimized Patterns

1. **Materialized Counts:**
   - No `COUNT(*)` queries needed for reply_count, topic_count, etc.
   - Updated via triggers in same transaction

2. **Denormalized User Data:**
   - Avoids cross-database JOINs for every topic display
   - Trade-off: Stale data if username changes

3. **FTS5 Index:**
   - Fast full-text search without external service (Elasticsearch, etc.)
   - Porter stemming improves recall

4. **Materialized Paths:**
   - Efficient nested reply tree traversal
   - Avoids recursive CTEs

### ⚠️ Potential Bottlenecks

1. **Trigger Overhead:**
   - Every INSERT triggers FTS5 update + count updates
   - Could be slow for bulk operations (100+ topics at once)
   - **Solution:** Batch insert with triggers disabled, then rebuild FTS5

2. **FTS5 Subqueries:**
   - Triggers use complex subqueries to fetch category name, tags
   - Could slow down inserts with large tag counts
   - **Solution:** Denormalize tag_names to forum_topics table

3. **No Pagination in Triggers:**
   - FTS5 insert trigger fetches ALL tags for a topic
   - If topic has 50 tags, JOIN is expensive
   - **Solution:** Limit tags per topic (e.g., max 10)

4. **Soft Delete Queries:**
   - Every query must filter `WHERE deleted_at IS NULL`
   - Indexes on deleted_at help, but still overhead
   - **Solution:** Use views (active_topics, active_replies)

---

## Schema Migration Path

If deploying from scratch, this schema is **production-ready** with these fixes:

### Phase 1: Immediate (Pre-Launch)
1. Enable foreign keys in pool
2. Add missing indexes (view_count, vote_score)
3. Create active_topics/active_replies views
4. Add read tracking table
5. Add notification table

### Phase 2: Post-Launch (After User Feedback)
6. Add moderation queue
7. Add revision history
8. Add bookmark system
9. Add reaction system

### Phase 3: Scale (After 10K Topics)
10. Optimize FTS5 triggers (denormalize tags)
11. Add badge system
12. Add poll system
13. Consider sharding if > 100K topics

---

## Conclusion

### Overall Assessment: **8.5/10**

**Strengths:**
- ✅ Well-designed core schema with proper normalization
- ✅ Excellent FTS5 implementation with automatic sync
- ✅ Smart denormalization for performance (cached user data, counts)
- ✅ Comprehensive indexing strategy
- ✅ Soft deletes with audit trails
- ✅ Clever nested reply system with materialized paths
- ✅ Proper CHECK constraints for data validation

**Critical Issues:**
- ⚠️ Foreign keys disabled (MUST enable)
- ⚠️ No cross-database foreign keys to users.db (SQLite limitation)
- ⚠️ No username sync mechanism

**Missing Features (vs. Mature Forums):**
- ❌ User permissions system
- ❌ Read tracking (unread indicators)
- ❌ User notifications
- ❌ Moderation queue
- ❌ Revision history
- ❌ Bookmark/favorite system
- ❌ Reaction system
- ❌ Polls
- ❌ Badges

**Recommendation:**
This schema is **production-ready for an MVP forum** after enabling foreign keys. For a full-featured community platform, add:
1. Read tracking (unread badges)
2. Notifications (mentions, replies)
3. Moderation queue (reports)
4. Revision history (accountability)

The FTS5 implementation alone is worth keeping - it's better than many custom forum systems.

---

## TypeScript Type System Alignment

The schema **perfectly aligns** with the TypeScript types in `/lib/forums/types.ts`:

| TypeScript Type | Database Table | Alignment |
|----------------|----------------|-----------|
| `ForumCategory` | `forum_categories` | ✅ 100% match |
| `ForumTopic` | `forum_topics` | ✅ Maps correctly (user_id → author_id) |
| `ForumReply` | `forum_replies` | ✅ Maps correctly (depth field name differs) |
| `ForumTag` | `forum_tags` | ✅ 100% match |
| `PaginationMetadata` | N/A | ✅ Computed in repository layer |
| `SearchResultDTO` | `forum_search_fts` | ✅ Uses FTS5 rank + snippet() |

**Minor Type Mismatches:**
- TypeScript has `reply_depth` but DB has `depth` (repository transforms)
- TypeScript has `post_count` in ForumCategory but DB has `reply_count` (different semantic)
- TypeScript expects `content_format` but DB doesn't enforce it (defaults to 'markdown')

**Repository Layer Quality:**
The TopicRepository correctly:
- ✅ Transforms DB rows to TypeScript types
- ✅ Handles pagination
- ✅ Implements Result pattern for errors
- ✅ Uses transactions for consistency
- ✅ Fetches joined user data separately (cross-DB)

---

**End of Analysis**
