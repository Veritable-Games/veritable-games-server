# Forums Database Architecture - Complete Analysis

**Project**: Veritable Games  
**Database**: forums.db (SQLite)  
**Last Updated**: October 24, 2025  
**Status**: Fully Functional

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema](#database-schema)
   - [Category Visibility System](#category-visibility-system)
3. [Bitflags Status System](#bitflags-status-system)
4. [Indexes & Performance](#indexes--performance)
5. [FTS5 Full-Text Search](#fts5-full-text-search)
6. [Table Relationships](#table-relationships)
7. [Triggers & Automation](#triggers--automation)
8. [Service Layer Architecture](#service-layer-architecture)
9. [API Routes](#api-routes)
10. [Data Flow Examples](#data-flow-examples)

---

## Executive Summary

The forums database implements a **modern, efficient forum system** with the following highlights:

- **3 main tables** (categories, topics, replies) + **1 virtual FTS5 table** for search
- **Bitflags status system** - Single INTEGER column replaces 6 boolean columns
- **Category visibility control** - Admin-only categories with 404-based security
- **FTS5 full-text search** - Automatic indexing via triggers, supports stemming & diacritics
- **Materialized path** for reply nesting (up to 5 levels deep)
- **4 specialized services**: Forum, Search, Moderation, Stats
- **6 repositories**: Topic, Reply, Category, Base, Search, Stats
- **17 API routes** covering all CRUD + moderation operations
- **Real-time events** via Server-Sent Events (SSE)

---

## Database Schema

### 1. Forum Categories Table

```sql
CREATE TABLE IF NOT EXISTS forum_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  section TEXT DEFAULT 'general',
  sort_order INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  topic_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  last_post_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Columns**:
| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `id` | INTEGER PRIMARY KEY | Unique category identifier | Auto-increment |
| `slug` | TEXT UNIQUE | URL-friendly category identifier | e.g., "forum-rules", "noxii-general" |
| `name` | TEXT | Display name | e.g., "Forum Rules" |
| `description` | TEXT | Category description | Optional |
| `color` | TEXT | Tailwind/Hex color for UI | Default: '#3B82F6' (blue) |
| `icon` | TEXT | Emoji or icon | e.g., '📋', '🎮', '🔧' |
| `section` | TEXT | Section grouping | "Social Contract", "Noxii Game", "Autumn Project", "Miscellaneous" |
| `sort_order` | INTEGER | Display order within section | Lower = higher priority |
| `is_public` | INTEGER | Visibility control | 1 = public (visible to all), 0 = admin-only (hidden) |
| `topic_count` | INTEGER | Denormalized topic count | Updated by triggers |
| `reply_count` | INTEGER | Denormalized reply count | Updated by triggers |
| `last_post_at` | DATETIME | Last activity timestamp | Updated by triggers |
| `created_at` | DATETIME | Creation timestamp | System managed |
| `updated_at` | DATETIME | Last update timestamp | System managed |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE on `slug`

**Default Categories** (auto-inserted on first run):
1. Forum Rules (Social Contract)
2. Noxii General Discussion (Noxii Game)
3. Noxii Modding (Noxii Game)
4. Maps & Mods (Noxii Game)
5. Autumn Development (Autumn Project)
6. Off-Topic (Miscellaneous)

---

### Category Visibility System

The forums implement a **visibility control system** allowing admins to hide categories from non-admin users. This is useful for:
- Work-in-progress categories
- Internal discussion areas
- Seasonal/temporary categories
- Admin-only announcement sections

#### How It Works

**Database Level**:
- `is_public` column: `1` = visible to all, `0` = admin-only
- Default: All categories start as public (`is_public = 1`)
- Only admins can toggle visibility (Ctrl+Click + Tab keyboard shortcut)

**Access Control**:
- **Admins** (`role = 'admin'`): See ALL categories regardless of `is_public` value
- **Non-Admins** (users, moderators, anonymous): Only see categories where `is_public = 1`
- **Direct Access**: Attempting to access a hidden category returns **404 Not Found** (not 403 Forbidden)
- **Search**: Topics and replies from hidden categories are excluded from search results for non-admins

**Frontend Behavior**:
- Hidden categories are filtered out before rendering (see `ForumCategoryList.tsx:800-820`)
- Sections auto-hide when ALL their categories are hidden
- No visual indication that a category exists if hidden (prevents information leakage)

#### Implementation Details

**Service Layer** (`ForumCategoryService.ts:50-54`):
```typescript
// Only admins see all categories
if (userRole !== 'admin') {
  query += ` WHERE is_public = 1`;
}
```

**API Routes**:

1. **GET `/api/forums/categories/[slug]`** (`categories/[slug]/route.ts:46-55`):
   - Checks category visibility before returning
   - Returns 404 for hidden categories accessed by non-admins
   - Prevents exposing hidden category existence

2. **GET `/api/forums/topics`** (`topics/route.ts:46-59`):
   - Validates category visibility when filtering by category
   - Returns 404 if category is hidden and user is not admin
   - Prevents accessing topics from hidden categories

3. **GET `/api/forums/search`** (`search-repository.ts:91-103, 189-201, 286-297`):
   - Joins with `forum_categories` table to check `is_public`
   - Filters results: `WHERE c.is_public = 1` for non-admins
   - Applies to topic search, reply search, and combined search
   - Example query pattern:
   ```sql
   SELECT ...
   FROM forum_search_fts fts
   INNER JOIN forum_categories c ON fts.category_id = c.id
   WHERE fts MATCH ?
     AND c.is_public = 1  -- Added for non-admins
   ORDER BY rank ASC
   ```

**Security Patterns**:
- **Return 404, not 403**: Prevents exposing that a hidden category exists
- **Server-Side Filtering**: Never trust client to filter categories
- **Consistent Checks**: Visibility verified at service, API, and search layers
- **No Client-Side Hints**: Hidden categories never sent to non-admin clients

#### UI Controls (Admin Only)

**Keyboard Shortcut** (`ForumCategoryList.tsx`):
1. **Ctrl+Click**: Select one or more categories
2. **Tab Key**: Toggle visibility for selected categories
3. **Visual Feedback**: Selected categories show checkmark, hidden categories show eye-slash icon

**Batch Operations**:
- Multiple categories can be toggled simultaneously
- Changes apply immediately via optimistic updates
- Server validates admin role before applying changes

#### Example Use Cases

1. **WIP Category**: Hide "Noxii Beta Testing" until feature is ready
2. **Seasonal Category**: Hide "Halloween Events" during off-season
3. **Admin Discussion**: Hide "Staff Lounge" from public view
4. **Deprecation**: Hide old categories before archiving/deletion

#### Migration Notes

- Pre-existing categories default to `is_public = 1` (public)
- No data migration needed - column has DEFAULT constraint
- Backward compatible: NULL treated as 1 (public)

---

### 2. Forum Topics Table

```sql
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  user_id INTEGER,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  is_locked INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_solved INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  vote_score INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  last_edited_at DATETIME,
  last_edited_by INTEGER
);
```

**Columns**:
| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `id` | INTEGER PRIMARY KEY | Topic identifier | Auto-increment |
| `category_id` | INTEGER | Parent category | Foreign key reference |
| `user_id` | INTEGER | Topic author | User ID from users.db |
| `title` | TEXT | Topic title | Required, visible in listings |
| `content` | TEXT | Topic body | Markdown content |
| `content_format` | TEXT | Content type | Default: 'markdown' |
| `is_locked` | INTEGER | Lock status (DEPRECATED) | See: Status Bitflags |
| `is_pinned` | INTEGER | Pin status (DEPRECATED) | See: Status Bitflags |
| `is_solved` | INTEGER | Solved status (DEPRECATED) | See: Status Bitflags |
| `status` | TEXT | Text status (LEGACY) | Kept for compatibility |
| `vote_score` | INTEGER | Net upvotes - downvotes | Used for sorting |
| `reply_count` | INTEGER | Denormalized reply count | Updated when replies added/deleted |
| `view_count` | INTEGER | Total views | Incremented on topic access |
| `created_at` | DATETIME | Creation timestamp | Set once, never changes |
| `updated_at` | DATETIME | Last update | Updated on content edits |
| `last_activity_at` | DATETIME | Last reply/edit time | Updated on any change |
| `deleted_at` | DATETIME | Soft delete marker | NULL = active, timestamp = deleted |
| `deleted_by` | INTEGER | User who deleted | User ID from users.db |
| `last_edited_at` | DATETIME | Last edit timestamp | NULL if never edited |
| `last_edited_by` | INTEGER | User who last edited | User ID from users.db |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `category_id` - Fast category filtering
- INDEX on `user_id` - Fast user activity lookup
- INDEX on `deleted_at` - Soft delete queries
- INDEX on `last_activity_at` - Recent activity queries

**Status Architecture** (CRITICAL):
- **OLD WAY** (DEPRECATED): Boolean columns `is_locked`, `is_pinned`, `is_solved`
- **NEW WAY** (ACTIVE): Single `status` INTEGER column using **bitflags**
- All three boolean columns still exist for backward compatibility
- Application ONLY uses bitflags, boolean columns are ignored
- See [Bitflags Status System](#bitflags-status-system) section for details

---

### 3. Forum Replies Table

```sql
CREATE TABLE IF NOT EXISTS forum_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  parent_id INTEGER,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'markdown',
  reply_depth INTEGER DEFAULT 0,
  path TEXT DEFAULT '',
  is_solution INTEGER DEFAULT 0,
  vote_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  deleted_by INTEGER,
  last_edited_at DATETIME,
  last_edited_by INTEGER
);
```

**Columns**:
| Column | Type | Purpose | Notes |
|--------|------|---------|-------|
| `id` | INTEGER PRIMARY KEY | Reply identifier | Auto-increment |
| `topic_id` | INTEGER NOT NULL | Parent topic | Foreign key reference |
| `parent_id` | INTEGER | Parent reply (for nesting) | NULL = root reply (direct to topic) |
| `user_id` | INTEGER NOT NULL | Reply author | User ID from users.db |
| `content` | TEXT NOT NULL | Reply body | Markdown content, required |
| `content_format` | TEXT | Content type | Default: 'markdown' |
| `reply_depth` | INTEGER | Nesting level | 0 = root, 1-5 = nested |
| `path` | TEXT | Materialized path | "1/2/5" = IDs in nesting chain |
| `is_solution` | INTEGER | Marked as solution | Boolean: 1 = yes, 0 = no |
| `vote_score` | INTEGER | Net votes | Used for sorting |
| `created_at` | DATETIME | Creation timestamp | Set once, never changes |
| `updated_at` | DATETIME | Last update | Updated on edits |
| `deleted_at` | DATETIME | Soft delete marker | NULL = active |
| `deleted_by` | INTEGER | Who deleted this | User ID from users.db |
| `last_edited_at` | DATETIME | Last edit time | NULL if never edited |
| `last_edited_by` | INTEGER | Who last edited | User ID from users.db |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `topic_id` - Fast reply lookup per topic
- INDEX on `parent_id` - Fast nested reply lookup
- INDEX on `user_id` - Fast user activity lookup
- INDEX on `deleted_at` - Soft delete queries

**Reply Nesting**:
- Maximum depth: **5 levels**
- Enforced at creation time in `ReplyRepository.create()`
- Materialized path stored in `path` column for efficient tree traversal
- Example path: "42/157/203" means: Reply 42 → Reply 157 → Reply 203 (your reply)

---

### 4. Forum Search FTS5 Virtual Table

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS forum_search_fts USING fts5(
  content_id UNINDEXED,
  content_type UNINDEXED,
  title,
  content,
  author_username,
  category_name,
  category_id UNINDEXED,
  created_at UNINDEXED,
  vote_score UNINDEXED,
  topic_id UNINDEXED,
  is_locked UNINDEXED,
  is_pinned UNINDEXED,
  tokenize='porter unicode61 remove_diacritics 2'
);
```

**Virtual Table Design** (FTS5):
- **Not a real table** - Automatically maintained by triggers
- **Tokenizer**: `porter unicode61 remove_diacritics 2`
  - `porter` - Porter stemming (running → run, tries → tri)
  - `unicode61` - Unicode support
  - `remove_diacritics 2` - Strip accents (café → cafe)
  - `2` - Diacritic class (Latin characters)

**Indexed Columns** (searchable):
- `title` - Topic titles (high relevance)
- `content` - Topic/reply body (main searchable content)
- `author_username` - Author name
- `category_name` - Category name

**Unindexed Columns** (metadata only):
- `content_id` - Reference to topic/reply ID
- `content_type` - 'topic' or 'reply'
- `category_id` - For filtering
- `created_at` - For date sorting
- `vote_score` - For popularity sorting
- `topic_id` - To find which topic reply belongs to
- `is_locked`, `is_pinned` - Status filtering

**Search Features**:
- Full-text search with relevance ranking (BM25)
- Phrase queries: `"exact match"`
- Boolean operators: `term AND other`, `term OR other`, `term NOT other`
- Prefix search: `prog*` matches programming, program, progress
- Stemming: "running" finds "run"
- Diacritic removal: "café" finds "cafe"

---

## Bitflags Status System

### Overview

Instead of storing 6 boolean columns (`is_locked`, `is_pinned`, `is_solved`, `is_archived`, `is_deleted`, `is_featured`), the system uses a **single INTEGER column** where each bit represents a flag.

This is memory-efficient, faster to query, and enables combinations (topic can be both pinned AND solved).

### Flag Definitions

```typescript
export const TopicStatusFlags = {
  LOCKED:   1 << 0, // Binary: 0000001 = 1   (locked topic)
  PINNED:   1 << 1, // Binary: 0000010 = 2   (pinned to top)
  SOLVED:   1 << 2, // Binary: 0000100 = 4   (has solution)
  ARCHIVED: 1 << 3, // Binary: 0001000 = 8   (read-only)
  DELETED:  1 << 4, // Binary: 0010000 = 16  (soft delete)
  FEATURED: 1 << 5, // Binary: 0100000 = 32  (highlighted)
} as const;
```

### Examples

| Status Value | Binary | Meaning | Example |
|-------------|--------|---------|---------|
| 0 | 000000 | Open (no flags) | Normal topic |
| 1 | 000001 | Locked | Topic is closed to new replies |
| 2 | 000010 | Pinned | Topic floats to top of category |
| 3 | 000011 | Locked + Pinned | "Important announcement" - read-only |
| 4 | 000100 | Solved | Question answered |
| 5 | 000101 | Locked + Solved | Answered question, closed |
| 6 | 000110 | Pinned + Solved | Answered, highlighted |
| 7 | 000111 | Locked + Pinned + Solved | Important, answered, closed |

### Helper Functions

All operations use bitwise helpers from `src/lib/forums/status-flags.ts`:

```typescript
// Check if flag is set
hasFlag(status, TopicStatusFlags.PINNED) // true/false

// Add a flag
newStatus = addFlag(status, TopicStatusFlags.SOLVED)

// Remove a flag
newStatus = removeFlag(status, TopicStatusFlags.LOCKED)

// Toggle a flag
newStatus = toggleFlag(status, TopicStatusFlags.PINNED)

// Check multiple flags
hasAnyFlag(status, [LOCKED, SOLVED])  // true if ANY set
hasAllFlags(status, [PINNED, SOLVED]) // true if ALL set

// Get all active flags
getActiveFlags(6) // ['PINNED', 'SOLVED']

// Convert to boolean object (UI compatibility)
toBooleans(6) // { is_pinned: true, is_solved: true, ... }

// Convert from booleans (migration)
fromBooleans(true, false, true) // 5
```

### SQL Query Helpers

```typescript
// Check if pinned
StatusQueryHelpers.hasFlag(TopicStatusFlags.PINNED)
// Generates: (status & 2) > 0

// Check if NOT locked
StatusQueryHelpers.notHasFlag(TopicStatusFlags.LOCKED)
// Generates: (status & 1) = 0

// Check if BOTH pinned and solved
StatusQueryHelpers.hasAllFlags([PINNED, SOLVED])
// Generates: (status & 6) = 6

// Check if EITHER pinned or solved
StatusQueryHelpers.hasAnyFlag([PINNED, SOLVED])
// Generates: (status & 6) > 0
```

### In-Database Storage

The `forum_topics` table stores status as:
```sql
status INTEGER DEFAULT 0  -- Bitfield: 6 flags max
```

**Backward Compatibility Note**:
- Old boolean columns (`is_locked`, `is_pinned`, `is_solved`) still exist but are **IGNORED**
- Application never reads/writes these columns
- Single `status` column is the source of truth
- Triggers auto-populate FTS5 using bitflags

---

## Indexes & Performance

### Topic Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_topics_category ON forum_topics(category_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON forum_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_deleted ON forum_topics(deleted_at);
```

**Performance Impact**:
- `idx_topics_category`: Browse topics per category (PRIMARY access pattern)
- `idx_topics_user`: Find all topics by user (Profile page)
- `idx_topics_deleted`: Filter out soft-deleted topics efficiently

### Reply Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_replies_topic ON forum_replies(topic_id);
CREATE INDEX IF NOT EXISTS idx_replies_parent ON forum_replies(parent_id);
CREATE INDEX IF NOT EXISTS idx_replies_user ON forum_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_deleted ON forum_replies(deleted_at);
```

**Performance Impact**:
- `idx_replies_topic`: Fetch all replies for a topic (Most common query)
- `idx_replies_parent`: Build reply tree (Nesting)
- `idx_replies_user`: User activity tracking
- `idx_replies_deleted`: Soft delete filtering

### FTS5 Indexes

```sql
-- Virtual table has its own internal indexes
-- UNINDEXED columns are not indexed by FTS5 (smaller index, faster inserts)
-- Indexed columns: title, content, author_username, category_name
```

---

## FTS5 Full-Text Search

### Automatic Synchronization

Triggers keep FTS5 in sync with base tables:

#### Topic Insert Trigger
```sql
CREATE TRIGGER IF NOT EXISTS forum_fts_topic_insert
AFTER INSERT ON forum_topics
BEGIN
  INSERT INTO forum_search_fts (
    content_id, content_type, title, content, author_username,
    category_name, category_id, created_at, vote_score,
    topic_id, is_locked, is_pinned
  )
  SELECT
    new.id, 'topic', new.title, new.content,
    'unknown',
    c.name, new.category_id, new.created_at, new.vote_score,
    new.id, new.is_locked, new.is_pinned
  FROM forum_categories c
  WHERE c.id = new.category_id;
END;
```

#### Topic Update Trigger
```sql
CREATE TRIGGER IF NOT EXISTS forum_fts_topic_update
AFTER UPDATE ON forum_topics
BEGIN
  DELETE FROM forum_search_fts 
  WHERE content_id = old.id AND content_type = 'topic';
  
  INSERT INTO forum_search_fts (...)
  -- Same as insert trigger
END;
```

#### Topic Delete Trigger
```sql
CREATE TRIGGER IF NOT EXISTS forum_fts_topic_delete
AFTER DELETE ON forum_topics
BEGIN
  DELETE FROM forum_search_fts 
  WHERE content_id = old.id AND content_type = 'topic';
END;
```

#### Reply Triggers (Similar pattern for replies)
- `forum_fts_reply_insert`
- `forum_fts_reply_update`
- `forum_fts_reply_delete`

### Search Query Examples

```typescript
// Simple search
"rust programming"
// Finds topics with EITHER "rust" OR "programming" (or stemmed variants)

// Phrase search (exact match)
'"pattern matching"'
// Only matches exact phrase

// Boolean operators
"rust AND programming"  // Both terms required
"rust OR golang"        // Either term
"rust NOT javascript"   // Rust but not JavaScript

// Prefix search
"prog*"  // Matches: program, programming, progress, programmer

// Combined
"rust AND (embedded OR systems)"
// Rust AND (either embedded OR systems)
```

### BM25 Relevance Ranking

FTS5 uses BM25 algorithm for relevance scoring:
- Documents with search terms in title rank higher
- More occurrences = higher relevance
- Document length doesn't distort scoring
- Automatically calculated

Queries return results ordered by `rank ASC` (lower rank = better match).

---

## Table Relationships

### Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ users.db (Separate Database)                                 │
├──────────────────────────────────────────────────────────────┤
│ users                                                         │
│  id (PK)                                                     │
│  username                                                     │
│  display_name                                                │
│  avatar_url                                                   │
│  role                                                         │
└────────────┬─────────────────────────────────────────────────┘
             │
             │ (no FK - cross-database references)
             │
┌────────────▼─────────────────────────────────────────────────┐
│ forums.db                                                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─ forum_categories (1)                                      │
│ │  id (PK) ◄─────────┐                                       │
│ │  slug              │                                       │
│ │  name              │                                       │
│ │  description       │                                       │
│ │  color             │                                       │
│ │  icon              │                                       │
│ │  section           │                                       │
│ │  sort_order        │                                       │
│ └─────────────────────┤─────────────────────────┐            │
│                       │                         │            │
│                       │ (N)                     │            │
│                 ┌─────┴──────────────────┐     │            │
│                 │                        │     │            │
│                 ▼ category_id (FK)       │     │            │
│ ┌─ forum_topics (N)                    │     │            │
│ │  id (PK)                            │     │            │
│ │  category_id ────────────────────────┘     │            │
│ │  user_id (users.db)                       │            │
│ │  title                                    │            │
│ │  content                                  │            │
│ │  status (bitflags)                        │            │
│ │  reply_count                              │            │
│ │  view_count                               │            │
│ │  created_at                               │            │
│ │  deleted_at (soft delete)                 │            │
│ │  last_activity_at                         │            │
│ └──────┬──────────────────────┬──────────────┘            │
│        │                      │                           │
│        │ id (PK)              │ (N)                       │
│        │                      │                           │
│        │            ┌─────────┴────────────────┐          │
│        │            │ topic_id (FK)           │          │
│        │            ▼                         │          │
│        │   ┌─ forum_replies (N)              │          │
│        │   │  id (PK)                        │          │
│        │   │  topic_id ────────────────────────┘         │
│        │   │  parent_id (self-referencing FK)           │
│        │   │  user_id (users.db)                        │
│        │   │  content                                    │
│        │   │  reply_depth                                │
│        │   │  path (materialized path)                   │
│        │   │  is_solution                                │
│        │   │  created_at                                 │
│        │   │  deleted_at (soft delete)                   │
│        │   └─────────────────────────────────────────────┘
│        │
│        │ (virtual, auto-synced)
│        │
│        └──────┬──────────┬───────┬────────┐
│               │          │       │        │
│               ▼          ▼       ▼        ▼
│   ┌─ forum_search_fts (FTS5 virtual table) ─┐
│   │  content_id                              │
│   │  content_type ('topic' or 'reply')       │
│   │  title                                   │
│   │  content                                 │
│   │  author_username                         │
│   │  category_name                           │
│   │  created_at                              │
│   │  vote_score                              │
│   │  topic_id                                │
│   │  is_locked, is_pinned (status bits)      │
│   └──────────────────────────────────────────┘
│
└──────────────────────────────────────────────────────────────┘
```

### Relationship Rules

1. **Forum Categories → Topics**: 1-to-many
   - One category has many topics
   - Foreign key: `forum_topics.category_id → forum_categories.id`
   - Cascade behavior: Deleting category orphans topics

2. **Topics → Replies**: 1-to-many
   - One topic has many replies
   - Foreign key: `forum_replies.topic_id → forum_topics.id`
   - Cascade behavior: Deleting topic soft-deletes replies

3. **Replies → Replies (Nesting)**: Self-referencing many-to-many
   - Reply can have parent reply (one-to-many)
   - Foreign key: `forum_replies.parent_id → forum_replies.id`
   - Materialized path in `path` column for tree navigation
   - Max depth: 5 levels

4. **Cross-Database: Users**
   - Topics reference users: `forum_topics.user_id → users.users.id`
   - Replies reference users: `forum_replies.user_id → users.users.id`
   - NO foreign key constraint (different database)
   - Validation handled at service layer

5. **FTS5 Virtual Table** (Auto-synced)
   - Mirrors topics and replies
   - Triggers keep in sync automatically
   - Not part of data integrity, purely for search

---

## Triggers & Automation

### Topic Triggers

#### FTS5 Synchronization Triggers (3)
1. **`forum_fts_topic_insert`** - Adds to search index when topic created
2. **`forum_fts_topic_update`** - Updates search index when topic edited
3. **`forum_fts_topic_delete`** - Removes from search index when topic soft-deleted

#### Auto-Population on First Run
- `forum_categories` pre-populated with 6 default categories
- Runs only if table is empty
- Includes forum-rules, noxii-general, noxii-modding, etc.

### Reply Triggers

#### FTS5 Synchronization Triggers (3)
1. **`forum_fts_reply_insert`** - Adds to search index when reply created
2. **`forum_fts_reply_update`** - Updates search index when reply edited
3. **`forum_fts_reply_delete`** - Removes from search index when deleted

### Statistics Updates

When reply is created/deleted, topic is updated:
```sql
UPDATE forum_topics
SET reply_count = reply_count + 1,
    last_activity_at = CURRENT_TIMESTAMP
WHERE id = ?
```

---

## Service Layer Architecture

### Service Stack

```
API Routes (Next.js App Router)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
    ↓
Database Pool (Connection Management)
    ↓
SQLite Database (forums.db)
```

### 4 Specialized Services

#### 1. **ForumService** (Legacy Wrapper)

**File**: `src/lib/forums/service.ts`

**Responsibility**: Backward compatibility, delegates to specialized services

**Key Methods**:
- `getCategories()` → ForumService.getAllCategories()
- `getTopics()` → ForumService.getTopicsByCategory()
- `getTopicById()` → ForumService.getTopicById()
- `createTopic()` → ForumService.createTopic()
- `updateTopic()` → ForumService.updateTopic()
- `deleteTopic()` → ForumService.deleteTopic()
- `createReply()` → ForumService.createReply()
- `getReply()` → ForumService.getReply()
- `updateReply()` → ForumService.updateReply()

**Note**: New code should use `forumServices` object directly (see below)

#### 2. **ForumModerationService**

**File**: `src/lib/forums/services/ForumModerationService.ts`

**Responsibility**: Moderation actions requiring permission checks

**Key Methods**:
- `pinTopic(topicId, userId)` - Add PINNED bitflag
- `unpinTopic(topicId, userId)` - Remove PINNED bitflag
- `lockTopic(topicId, userId)` - Add LOCKED bitflag
- `unlockTopic(topicId, userId)` - Remove LOCKED bitflag
- `markSolved(topicId, replyId, userId)` - Add SOLVED bitflag + mark reply
- `unmarkSolved(topicId, userId)` - Remove SOLVED bitflag
- `deleteTopic(topicId, userId)` - Soft delete + audit log
- `deleteReply(replyId, userId)` - Soft delete + audit log
- `checkModeratorPermission(userId)` - Permission validation
- `logModerationAction(userId, action, entity, id, metadata)` - Audit trail

**Permission Requirements**: Moderator or Admin role

**Event Broadcasting**: All actions trigger real-time SSE events

#### 3. **ForumSearchService**

**File**: `src/lib/forums/services/ForumSearchService.ts`

**Responsibility**: Full-text search with caching

**Key Methods**:
- `search(query, userId)` - FTS5 search with caching
- `quickSearch(query, limit)` - Autocomplete (topics only)
- `getSearchSuggestions(query)` - Topic title suggestions
- `getRecentSearches(userId)` - User's search history
- `addRecentSearch(userId, query)` - Track user search

**Caching**:
- Search results: 10 minutes TTL, 200 entry LRU cache
- Suggestions: 30 minutes TTL, 100 entry LRU cache
- Recent searches: In-memory per-user (not persisted)

#### 4. **ForumStatsService**

**File**: `src/lib/forums/services/ForumStatsService.ts`

**Responsibility**: Analytics and statistics

**Key Methods**:
- `getForumStats()` - Overall forum metrics
- `getCategoryStats(categoryId)` - Category breakdown
- `getUserStats(userId)` - User contribution metrics
- `getRecentActivity(limit)` - Latest 24-hour activity
- `getTopContributors(limit)` - Most active users

### 6 Repositories

All repositories extend `BaseRepository` for common functionality.

#### 1. **TopicRepository**

```typescript
class TopicRepository extends BaseRepository {
  create(data: CreateTopicData): Result<ForumTopic>
  findById(id: TopicId, options?: FindByIdOptions): Result<ForumTopic | null>
  findByCategory(categoryId: CategoryId, options?: PaginationOptions): Result<ForumTopic[]>
  update(id: TopicId, data: UpdateTopicData): Result<ForumTopic>
  delete(id: TopicId): Result<boolean>
  incrementViewCount(id: TopicId): Result<void>
  // Plus moderation helpers
}
```

#### 2. **ReplyRepository**

```typescript
class ReplyRepository extends BaseRepository {
  create(data: CreateReplyData): Result<ForumReply>
  findById(id: ReplyId): Result<ForumReply | null>
  findByTopic(topicId: TopicId, options?: ReplyFilterOptions): Result<ForumReply[]>
  update(id: ReplyId, data: UpdateReplyData): Result<ForumReply>
  delete(id: ReplyId): Result<boolean>
  getReplyTree(topicId: TopicId, maxDepth?: number): Result<ForumReply[]>
  markAsSolution(replyId: ReplyId): Result<ForumReply>
  // Plus nesting helpers
}
```

#### 3. **CategoryRepository**

```typescript
class CategoryRepository extends BaseRepository {
  findAll(): Result<ForumCategory[]>
  findBySlug(slug: string): Result<ForumCategory | null>
  findById(id: CategoryId): Result<ForumCategory | null>
  create(data: CreateCategoryData): Result<ForumCategory>
  update(id: CategoryId, data: UpdateCategoryData): Result<ForumCategory>
  delete(id: CategoryId): Result<boolean>
  getStats(categoryId: CategoryId): Result<CategoryStats>
}
```

#### 4. **SearchRepository**

```typescript
class SearchRepository extends BaseRepository {
  searchTopics(query: string, options?: SearchOptions): Result<PaginatedResponse<SearchResultDTO>>
  searchReplies(query: string, options?: SearchOptions): Result<PaginatedResponse<SearchResultDTO>>
  searchAll(query: string, options?: SearchOptions): Result<PaginatedResponse<SearchResultDTO>>
  getSuggestions(query: string, limit?: number): Result<string[]>
  // FTS5 helpers
  prepareFTS5Query(query: string): string
  transformSearchResult(row: FTS5SearchResult, query: string): SearchResultDTO
}
```

#### 5. **BaseRepository**

```typescript
abstract class BaseRepository {
  protected execute<T>(operation: string, callback: (db: Database) => T): Result<T, RepositoryError>
  protected transaction<T>(operation: string, callback: (db: Database) => T): Result<T, RepositoryError>
  protected fetchUser(userId: UserId): Result<ForumUser | null, RepositoryError>
  protected fetchUsers(userIds: UserId[]): Result<Map<UserId, ForumUser>, RepositoryError>
  protected getDb(): Database
  protected getUsersDb(): Database
  protected handleError(operation: string, error: unknown): Result<never, RepositoryError>
  // Transformation helpers
  protected transformTopic(row: TopicRow): ForumTopic
  protected transformReply(row: ReplyRow): ForumReply
  protected transformCategory(row: CategoryRow): ForumCategory
}
```

#### 6. **StatsRepository**

```typescript
class StatsRepository extends BaseRepository {
  getForumStats(): Result<ForumStats>
  getCategoryStats(categoryId: CategoryId): Result<CategoryStats>
  getUserStats(userId: UserId): Result<UserStats>
  getRecentActivity(limit?: number): Result<ForumActivity[]>
  getTopContributors(limit?: number): Result<UserStats[]>
}
```

### Service Exports

```typescript
// src/lib/forums/services/index.ts

export const forumServices = {
  forum: new ForumService(),
  search: new ForumSearchService(),
  moderation: new ForumModerationService(),
  stats: new ForumStatsService(),
};

export type ForumServices = typeof forumServices;
```

---

## API Routes

### Complete API Reference (17 Routes)

#### Categories (4 routes)

**GET `/api/forums/categories`**
- Returns all categories with stats
- Response: `ForumCategory[]`
- No authentication required

**GET `/api/forums/categories/[slug]`**
- Returns single category by slug
- Response: `ForumCategory | 404`
- No authentication required

**POST `/api/forums/categories`**
- Create new category
- Body: `{ name, description, color, icon, section }`
- Requires: Moderator/Admin
- Response: `ForumCategory | 401/403`

**PATCH `/api/forums/categories/[slug]`**
- Update category
- Body: Partial category data
- Requires: Moderator/Admin
- Response: `ForumCategory | 401/403`

#### Batch Category Updates (1 route)

**POST `/api/forums/categories/batch-update`**
- Reorder multiple categories
- Body: `{ updates: [{ id, sort_order }] }`
- Requires: Admin
- Response: `{ success: true } | error`

#### Topics (4 routes)

**GET `/api/forums/topics`**
- List topics with filtering
- Query params: `?category_id=1&page=1&limit=20&sort=recent`
- Response: `PaginatedResponse<ForumTopic>`
- No authentication required

**POST `/api/forums/topics`**
- Create topic
- Body: `{ category_id, title, content }`
- Requires: Authenticated user
- Response: `ForumTopic | 401/400`

**GET `/api/forums/topics/[id]`**
- Get topic with replies
- Response: `TopicWithReplies | 404`
- Increments view count
- No authentication required

**PATCH `/api/forums/topics/[id]`**
- Edit topic
- Body: `{ title, content }`
- Requires: Topic author or Moderator
- Response: `ForumTopic | 401/403/404`

**DELETE `/api/forums/topics/[id]`**
- Soft delete topic
- Requires: Topic author or Moderator
- Response: `{ success: true } | error`

#### Topic Moderation (3 routes)

**POST `/api/forums/topics/[id]/pin`**
- Toggle pin status
- Body: `{ pinned: boolean }`
- Requires: Moderator/Admin
- Response: `{ success: true, is_pinned: boolean } | error`
- Broadcasts: Real-time event

**POST `/api/forums/topics/[id]/lock`**
- Toggle lock status
- Body: `{ locked: boolean }`
- Requires: Moderator/Admin
- Response: `{ success: true, is_locked: boolean } | error`
- Broadcasts: Real-time event

**POST `/api/forums/topics/[id]/solved`**
- Mark topic as solved
- Body: `{ reply_id: number, solved: boolean }`
- Requires: Topic author or Moderator
- Response: `{ success: true } | error`
- Broadcasts: Real-time event

#### Replies (3 routes)

**POST `/api/forums/replies`**
- Create reply
- Body: `{ topic_id, parent_id?, content }`
- Requires: Authenticated user
- Response: `ForumReply | 401/400`

**PATCH `/api/forums/replies/[id]`**
- Edit reply
- Body: `{ content }`
- Requires: Reply author or Moderator
- Response: `ForumReply | 401/403/404`

**DELETE `/api/forums/replies/[id]`**
- Soft delete reply
- Requires: Reply author or Moderator
- Response: `{ success: true } | error`

**POST `/api/forums/replies/[id]/solution`**
- Mark reply as solution
- Body: `{ is_solution: boolean }`
- Requires: Topic author or Moderator
- Response: `{ success: true } | error`

#### Search (1 route)

**GET `/api/forums/search`**
- Full-text search
- Query params: `?q=rust&category=1&page=1&limit=20`
- Response: `PaginatedResponse<SearchResultDTO>`
- No authentication required

#### Stats (1 route)

**GET `/api/forums/stats`**
- Forum statistics
- Response: `ForumStats`
- No authentication required

#### Sections (3 routes)

**GET `/api/forums/sections`**
- List all sections
- Response: `ForumSection[]`
- No authentication required

**POST `/api/forums/sections`**
- Create section
- Requires: Admin
- Response: `ForumSection | 401/403`

**POST `/api/forums/sections/batch-reorder`**
- Reorder sections
- Requires: Admin
- Response: `{ success: true } | error`

#### Real-Time Events (1 route)

**GET `/api/forums/events`**
- Server-Sent Events stream
- Returns: EventSource stream
- No authentication required (broadcasts to all)
- Event types: topic:pinned, topic:locked, topic:solved, topic:created, reply:created, etc.

---

## Data Flow Examples

### Example 1: Creating a Topic

```
User submits form with:
  category_id: 2 (Noxii General Discussion)
  title: "How to install mods?"
  content: "I'm new to modding..."

  ↓ Frontend sends POST /api/forums/topics
  
  ↓ API Route validates (withSecurity) & authenticates user
  
  ↓ ForumService.createTopic(data, userId)
  
  ↓ TopicRepository.create(data)
    - Validates title length ≥ 3 chars
    - Validates content not empty
    - INSERT INTO forum_topics (category_id, user_id, title, content, ...)
      VALUES (2, 42, "How to install mods?", "I'm new to modding...", ...)
    - Gets lastInsertRowid = 157
    - FETCHES created topic row
    - Returns ForumTopic object with id=157, status=0 (open)
  
  ↓ Trigger: forum_fts_topic_insert
    - INSERT INTO forum_search_fts
      (content_id=157, content_type='topic', title="How to install mods?", 
       content="I'm new to modding...", category_name="Noxii General Discussion", ...)
  
  ↓ ForumModerationService broadcasts SSE event
    - Event: "topic:created" with topic data
    - All connected clients get notified in real-time
  
  ↓ API returns 200 OK with created ForumTopic
  
  ↓ Frontend updates UI, cache invalidation
```

### Example 2: Pinning a Topic

```
Moderator clicks "Pin" button on topic #157

  ↓ Frontend sends POST /api/forums/topics/157/pin
    { pinned: true }
  
  ↓ API Route: ForumModerationService.pinTopic(157, moderatorId)
  
  ↓ Checks moderator permission (role = 'moderator' or 'admin')
    - Returns 403 if not authorized
  
  ↓ TopicRepository.findById(157)
    - Fetches current topic, status = 0 (open)
    - Returns topic with computed: is_pinned = false
  
  ↓ Add PINNED bitflag
    newStatus = addFlag(0, TopicStatusFlags.PINNED)
    // 0 | 2 = 2
  
  ↓ TopicRepository.update(157, { status: 2 })
    - UPDATE forum_topics SET status=2, updated_at=NOW() WHERE id=157
  
  ↓ Trigger: forum_fts_topic_update
    - DELETE FROM forum_search_fts WHERE content_id=157
    - INSERT INTO forum_search_fts (content_id=157, is_pinned=2, ...)
  
  ↓ Log moderation action
    - INSERT INTO moderation_log (...) VALUES (moderatorId, 'pin', 'topic', 157, ...)
  
  ↓ Broadcast SSE event
    - Event: "topic:pinned" with topic_id=157, is_pinned=true
    - All clients see pin badge immediately
  
  ↓ API returns 200 with updated topic (status=2)
```

### Example 3: Searching Forums

```
User types "rust programming" in search box

  ↓ Frontend sends GET /api/forums/search?q=rust%20programming&page=1

  ↓ ForumSearchService.search(query, userId)
  
  ↓ Validate query length ≥ 2 chars
    - "rust programming" ✓
  
  ↓ Generate cache key: "rust programming|1|20"
  
  ↓ Check LRU cache for results (TTL: 10 minutes)
    - Cache miss (first search for this query)
  
  ↓ SearchRepository.searchAll("rust programming")
    - prepareFTS5Query("rust programming")
      → Sanitizes, returns "rust programming" (FTS5 syntax)
    
    ↓ Execute FTS5 query:
      SELECT content_id, content_type, title, content, category_name, 
             created_at, vote_score, rank, ...
      FROM forum_search_fts
      WHERE forum_search_fts MATCH 'rust programming'
      ORDER BY rank ASC
      LIMIT 20 OFFSET 0
    
    Note: FTS5 tokenizer applies:
    - Porter stemming: "programming" → "program", "rust" → "rust"
    - Unicode normalization
    - Diacritic removal
    
    Results include:
    - Topic: "Rust vs Go for systems programming" (high rank, title match)
    - Topic: "My first Rust program" (medium rank)
    - Reply: "Try the Rust book chapter on pattern matching" (medium rank)
    
  ↓ Transform results to SearchResultDTO
    - Highlight snippets matching query
    - Calculate BM25 ranking
  
  ↓ Build pagination
    - total: 47 results
    - page: 1
    - limit: 20
    - hasMore: true
  
  ↓ Cache results for 10 minutes
  
  ↓ Track user search
    - Add to recentSearches["userId"] = [..., "rust programming"]
    - Keep last 10 searches per user
  
  ↓ API returns 200 with SearchResult[]
  
  ↓ Frontend displays results, pagination controls
```

### Example 4: Creating a Nested Reply

```
User replies to a reply (nesting)

  Topic: "How to install mods?" (id=157)
  ├─ Reply by Alice (id=1001, depth=0)
  │  └─ Reply by Bob to Alice (id=1002, depth=1)
  │     └─ User wants to reply to Bob (creating id=1003, depth=2)

User submits reply to Bob's reply:
  topic_id: 157
  parent_id: 1002
  content: "Thanks for the tip\!"

  ↓ ReplyRepository.create({
      topic_id: 157,
      parent_id: 1002,
      content: "Thanks for the tip\!"
    })
  
  ↓ Transaction starts
  
  ↓ Fetch parent reply (id=1002)
    - SELECT id, reply_depth as depth, path FROM forum_replies WHERE id=1002
    - Result: depth=1, path="1001/1002"
  
  ↓ Calculate new depth
    - newDepth = parentDepth + 1 = 1 + 1 = 2
    - Check: 2 ≤ MAX_REPLY_DEPTH (5) ✓
  
  ↓ Build materialized path
    - newPath = "1001/1002" (parent's path includes parent)
  
  ↓ INSERT reply
    INSERT INTO forum_replies (
      topic_id, parent_id, user_id, content,
      reply_depth, path, created_at, updated_at
    ) VALUES (
      157, 1002, userId, "Thanks for the tip\!",
      2, "1001/1002", NOW(), NOW()
    )
    - lastInsertRowid = 1003
  
  ↓ Update materialized path to include self
    - newPath = "1001/1002/1003"
    - UPDATE forum_replies SET path="1001/1002/1003" WHERE id=1003
  
  ↓ Update topic stats
    - UPDATE forum_topics
      SET reply_count = reply_count + 1,
          last_activity_at = NOW()
      WHERE id=157
  
  ↓ Trigger: forum_fts_reply_insert
    - INSERT INTO forum_search_fts (content_id=1003, content_type='reply', ...)
  
  ↓ Transaction commits
  
  ↓ Return created reply with depth=2, parent_id=1002
  
  ↓ Frontend displays nested reply indented under Bob's reply
```

### Example 5: Building Reply Tree

```
User views topic #157 with nested replies

  ↓ ReplyRepository.getReplyTree(topicId=157)
  
  ↓ Query with ORDER BY path ASC
    SELECT * FROM forum_replies
    WHERE topic_id=157 AND deleted_at IS NULL
    ORDER BY path ASC
    
    Result (materialized paths):
    - id=1001, path="1001", depth=0 (Alice's root reply)
    - id=1002, path="1001/1002", depth=1 (Bob's reply to Alice)
    - id=1003, path="1001/1002/1003", depth=2 (User's reply to Bob)
    - id=1004, path="1001/1004", depth=1 (Carol's reply to Alice)
  
  ↓ Build tree structure (recursive or iterative)
    ForumReply {
      id: 1001,
      content: "Great guide\!",
      children: [
        ForumReply {
          id: 1002,
          content: "Thanks\!",
          children: [
            ForumReply {
              id: 1003,
              content: "Thanks for the tip\!"
            }
          ]
        },
        ForumReply {
          id: 1004,
          content: "Me too\!"
        }
      ]
    }
  
  ↓ Frontend renders with CSS indentation based on depth
    ┌─ Alice (depth 0, indent 0)
    │  ├─ Bob (depth 1, indent 20px)
    │  │  └─ User (depth 2, indent 40px)
    │  └─ Carol (depth 1, indent 20px)
```

---

## Summary

The forums database architecture is a **modern, performant forum system** featuring:

- **Efficient storage** via bitflags (6 flags in 1 INTEGER column)
- **High-speed search** via FTS5 with automatic synchronization
- **Flexible nesting** via materialized paths (up to 5 levels)
- **Real-time updates** via Server-Sent Events
- **Moderation-ready** with permission checks and audit logging
- **Scalable design** with proper indexing and caching
- **Type-safe** with branded types preventing ID mixing

**Key Characteristics**:
- **3 base tables** + 1 virtual FTS5 table
- **19 indexes** for optimal query performance
- **12+ triggers** for automatic FTS5 synchronization and denormalization
- **4 services** with 6 repositories and Result pattern
- **17 API routes** covering all operations
- **Cross-database capability** for user data without JOINs

---

*Complete analysis including table structures, indexes, bitflags, FTS5 search, relationships, triggers, services, repositories, and API routes.*

