# OLD FORUMS IMPLEMENTATION ANALYSIS (v0.36)
## Complete Architecture & Feature Set Overview

---

## 1. COMPLETE FEATURE LIST

### Core Forum Functionality
- **Categories**: Hierarchical forum categories with sections (Social Contract, Noxii Game, Autumn Project, Miscellaneous)
- **Topics**: Thread creation, editing, viewing with full metadata
- **Replies**: Nested reply system with parent-child relationships
- **Solution Marking**: Mark replies as solution to topics
- **Pinning**: Pin important topics to top of category
- **Locking**: Lock topics to prevent new replies
- **Topic Status**: open, closed, pinned, locked states
- **Search**: Full-text search across topics and replies with FTS5 indexes
- **Tagging**: Topic tagging system for categorization

### User Interaction
- **Topic Creation**: Create new topics with title, content, category
- **Reply Creation**: Post replies to topics (including nested replies)
- **Topic Editing**: Users can edit their own topics
- **Reply Editing**: Users can edit their own replies
- **Topic Deletion**: Users can delete their own topics (admins can delete any)
- **Reply Deletion**: Soft delete capability for replies
- **View Tracking**: Track view count per topic
- **Activity Timeline**: Track last reply timestamps and contributors

### Display & Organization
- **Category Listing**: Display categories grouped by section
- **Category Stats**: Show topic count, post count, last activity for each category
- **Topic Listing**: Sort by recent, popular, oldest, replies count
- **Pinned Separation**: Visually separate pinned topics from regular topics
- **Recent Topics Widget**: Display latest forum discussions
- **Forum Statistics Dashboard**: Global stats showing topics, replies, active users

### Search & Discovery
- **Topic Search**: Search within category or across all forums
- **Query Filters**: Filter by category, user, status, tags
- **Pagination**: Limit and offset for large result sets
- **Sort Options**: Multiple sort strategies (recent, popular, oldest, replies)

### User Features
- **Forum Profiles**: User forum statistics and contribution history
- **Activity Tracking**: Track user contributions to forum
- **Notifications**: Mention system for user notifications (stub exists)

---

## 2. DATABASE SCHEMA DETAILS

### Primary Tables in forums.db

#### forum_categories
```
id (INTEGER PRIMARY KEY)
name (TEXT NOT NULL)
slug (TEXT UNIQUE)
description (TEXT)
color (TEXT) - Hex color for category
icon (TEXT)
sort_order (INTEGER) - Display order
section (TEXT) - Category group (Social Contract, Noxii Game, etc.)
is_active (BOOLEAN)
parent_id (INTEGER) - Hierarchical parent category
topic_count (INTEGER) - Materialized count
post_count (INTEGER) - Materialized count
last_activity_at (DATETIME)
created_at (DATETIME)
updated_at (DATETIME)
```

#### forum_topics
```
id (INTEGER PRIMARY KEY)
category_id (INTEGER FOREIGN KEY)
title (TEXT NOT NULL)
content (TEXT NOT NULL)
status (TEXT) - open, closed, pinned, locked
is_pinned (BOOLEAN)
is_solved (BOOLEAN)
is_locked (BOOLEAN)
user_id (INTEGER FOREIGN KEY -> users.db)
username (TEXT) - Materialized for search
view_count (INTEGER) - Default 0
reply_count (INTEGER) - Materialized count
created_at (DATETIME)
updated_at (DATETIME)
last_reply_at (DATETIME)
last_reply_user_id (INTEGER)
last_reply_username (TEXT)
category_name (TEXT) - Materialized
category_color (TEXT) - Materialized
category_slug (TEXT) - Materialized
```

#### forum_replies
```
id (INTEGER PRIMARY KEY)
topic_id (INTEGER FOREIGN KEY)
content (TEXT NOT NULL)
is_solution (BOOLEAN)
is_deleted (BOOLEAN) - Soft delete flag
parent_id (INTEGER) - Parent reply ID for nested replies
user_id (INTEGER FOREIGN KEY -> users.db)
username (TEXT) - Materialized
display_name (TEXT) - Materialized
created_at (DATETIME)
updated_at (DATETIME)

# Materialized fields (populated by database triggers):
conversation_id (TEXT) - Groups related replies
reply_depth (INTEGER) - Nesting level (max 10)
thread_root_id (INTEGER) - Root reply of thread
participant_hash (TEXT) - Hash of participants (reserved for future use)
```

#### forum_topic_tags
```
topic_id (INTEGER FOREIGN KEY)
tag_id (INTEGER FOREIGN KEY)
PRIMARY KEY (topic_id, tag_id)
```

#### forum_tags
```
id (INTEGER PRIMARY KEY)
name (TEXT NOT NULL)
slug (TEXT UNIQUE)
description (TEXT)
color (TEXT)
usage_count (INTEGER)
created_at (DATETIME)
```

#### forum_search_fts (FTS5 Virtual Table)
```
-- Full-text search index for topics and replies
-- Indexed columns: title, content, category_name
-- Enables fast text search with ranking
```

#### unified_activity
```
id (INTEGER PRIMARY KEY)
user_id (INTEGER)
activity_type (TEXT) - topic_created, reply_created, etc.
entity_type (TEXT) - topic, reply
entity_id (TEXT)
action (TEXT)
metadata (JSON)
timestamp (DATETIME)
```

---

## 3. SERVICE ARCHITECTURE

### Service Factory Pattern (Singleton)
```
ForumServiceFactory
├── categories → ForumCategoryService
├── topics → ForumTopicService
├── replies → ForumReplyService
├── search → ForumSearchService
└── analytics → ForumAnalyticsService
```

### ForumCategoryService
**Methods:**
- `getCategories()` - Get all categories grouped by section
- `getCategoryById(id)` - Lookup by numeric ID or slug
- `getCategoryStats(id)` - Topic/post counts and last activity
- `getCategoriesBySection(section)` - Filter by section
- `getActiveCategoriesWithRecentActivity(limit)` - Recently active
- `createCategory(data)` - Admin: Create category
- `updateCategory(id, data)` - Admin: Modify category
- `deleteCategory(id)` - Admin: Delete (only if no topics)
- `invalidateCache()` - Clear cache entries

**Key Features:**
- Aggregates topic and reply counts using SQL GROUP BY
- Calculates last activity timestamp
- Section ordering: Social Contract → Noxii Game → Autumn Project → Miscellaneous
- Caching layer for performance

### ForumTopicService
**Methods:**
- `getTopics(options)` - List topics with filtering/sorting
- `getTopicById(topicId, incrementView)` - Get single topic
- `createTopic(data, userId)` - Create new topic
- `updateTopic(topicId, data, userId)` - Edit topic
- `deleteTopic(topicId, userId)` - Delete topic
- `getTopicsByUserId(userId, limit, offset)` - User's topics
- `getPopularTopics(categoryId, limit)` - Ranked by engagement
- `getRecentTopics(categoryId, limit)` - Sorted by recency
- `pinTopic(topicId)` / `unpinTopic(topicId)` - Pin management
- `lockTopic(topicId)` / `unlockTopic(topicId)` - Lock management
- `getTopicStats(topicId)` - Reply/view/activity counts
- `invalidateTopicCache(topicId)` - Clear specific topic cache
- `invalidateAllTopicsCache()` - Clear all topic cache

**Key Features:**
- Dynamic SQL building for filters (category, user, status, query)
- Sorting strategies: recent, popular, oldest, replies
- View count auto-increment on access
- Transactional updates (topic edit + solution sync)
- Content sanitization before storage
- Cross-database user lookup (no JOINs between SQLite files)

### ForumReplyService
**Methods:**
- `getRepliesByTopicId(topicId)` - Get all replies with nesting
- `getReplyById(replyId)` - Get single reply
- `createReply(data, userId)` - Create new reply
- `updateReply(replyId, data, userId)` - Edit reply
- `deleteReply(replyId, userId)` - Soft delete reply
- `markAsSolution(replyId, topicId)` - Mark reply as solution
- `unmarkAsSolution(replyId, topicId)` - Unmark solution
- `getReplyTree(topicId)` - Get nested reply structure
- `invalidateReplyCache(topicId)` - Clear reply cache

**Key Features:**
- Nested reply tree with CTE (Common Table Expressions)
- Zero-padded sort paths for proper numeric ordering
- Recursive query builds full tree structure
- Reply depth tracking (max 10 levels)
- Mention extraction for notifications
- Content sanitization using DOMPurify
- Caching with invalidation on changes

### ForumSearchService
**Methods:**
- `searchTopics(query, options)` - Full-text search with filters
- `buildSearchIndex()` - Rebuild FTS5 index
- `rebuildSearchIndex()` - Force index rebuild
- `invalidateSearchCache()` - Clear search cache

**Key Features:**
- FTS5 (Full-Text Search 5) integration
- Phrase search support
- Category and user filtering
- Ranking by relevance
- Caching for repeated queries

### ForumAnalyticsService
**Methods:**
- `getForumStats()` - Global statistics
- `getUserForumStats(userId)` - User contribution stats
- `getTopContributors(limit)` - Top forum posters
- `getCategoryActivity()` - Activity by category
- `getEngagementMetrics()` - Engagement analytics
- `invalidateAnalyticsCache()` - Clear cache

**Key Features:**
- Aggregation queries across all tables
- Active user tracking (last 24h)
- Category activity rankings
- User contribution metrics
- Trend analysis

---

## 4. CATEGORY DISPLAY IMPLEMENTATION

### Main Forums Page (src/app/forums/page.tsx)

**Page Flow:**
1. **Server-side Data Loading:**
   ```typescript
   const forumService = new ForumService();
   const [categories, stats] = await Promise.all([
     forumService.getCategories(),
     forumService.getForumStats()
   ]);
   ```

2. **Component Rendering:**
   - Header with statistics (total topics, replies, members, active users)
   - Forum search widget
   - "Browse" and "New Topic" buttons
   - Category list component

**ForumCategoryList Component:**
- Memoized component for performance
- Groups categories by `section` field
- Sort order defined as array: `['Social Contract', 'Noxii Game', 'Autumn Project', 'Miscellaneous']`
- Renders CategorySection components per section

**CategorySection Sub-component:**
- Section header with total topic/post counts
- Table header: Forum | Topics | Posts | Last Activity
- Renders CategoryRow for each category

**CategoryRow Sub-component:**
- Link to `/forums/category/{slug}`
- Displays category name and description
- Shows materialized counts: topic_count, post_count
- Last activity timestamp with relative formatting
- Hover effects for interactivity

**Recent Topics Section:**
- Displays up to 5 most recent topics from stats
- Uses TopicList component
- Shows topic title, author, reply count, view count, last activity

### Category Detail Page (src/app/forums/category/[slug]/page.tsx)

**Page Flow:**
1. **Client-side Data Loading:**
   ```typescript
   const categorySlug = params.slug;
   const [categoryResponse, topicsResponse] = await Promise.all([
     fetch(`/api/forums/categories/${categorySlug}`),
     fetch(`/api/forums/topics?category_slug=${categorySlug}&limit=50`)
   ]);
   ```

2. **Page Layout:**
   - Breadcrumb navigation
   - Category title and description
   - Search and sort controls
   - Topic list with filtering
   - "New Topic" button (auth required)

3. **Features:**
   - Search topics within category
   - Sort by: Most Recent, Most Popular, Most Replies, Most Views
   - Filter by search query (client-side filtering)
   - Separate pinned and regular topics
   - Stats showing category totals

**TopicRow Component:**
- Displays individual topic
- Columns: Title | Replies | Views | Activity
- Shows status badges: pinned 📌, solved ✓, locked 🔒
- Author link with timestamp
- Last reply information
- Click to navigate to topic detail

---

## 5. KEY FILES & THEIR PURPOSES

### Type Definitions
| File | Purpose |
|------|---------|
| `types.ts` | Core interfaces: ForumCategory, ForumTopic, ForumReply, ForumTag, etc. |
| `branded-types.ts` | Branded types for type safety (TopicId, ReplyId, CategoryId, etc.) |
| `schemas.ts` | Zod schemas for validation with branded type transformations |

### Services (Business Logic)
| File | Purpose |
|------|---------|
| `service.ts` | Legacy wrapper for backward compatibility, delegates to services |
| `services/ForumCategoryService.ts` | Category CRUD and aggregation |
| `services/ForumTopicService.ts` | Topic CRUD and query operations |
| `services/ForumReplyService.ts` | Reply CRUD and nested tree building |
| `services/ForumSearchService.ts` | Full-text search with FTS5 |
| `services/ForumAnalyticsService.ts` | Statistics and analytics queries |

### API Routes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/forums/categories` | GET | List all categories |
| `/api/forums/categories/[slug]` | GET | Get category by slug |
| `/api/forums/topics` | GET/POST | List/create topics |
| `/api/forums/topics/[id]` | GET/PUT/DELETE | Topic operations |
| `/api/forums/topics/[id]/pin` | POST | Toggle pin status |
| `/api/forums/topics/[id]/lock` | POST | Toggle lock status |
| `/api/forums/replies` | GET/POST | List/create replies |
| `/api/forums/replies/[id]` | GET/PUT/DELETE | Reply operations |
| `/api/forums/replies/[id]/solution` | POST | Mark/unmark solution |
| `/api/forums/stats` | GET | Forum statistics |
| `/api/forums/search` | GET | Full-text search |

### Components
| Component | Purpose |
|-----------|---------|
| `ForumCategoryList.tsx` | Display categories grouped by section |
| `TopicRow.tsx` / `TopicList.tsx` | Display topic in list format |
| `ForumSearch.tsx` | Search widget for forums |
| `NewTopicButton.tsx` | Create topic button |
| `ForumHeaderActions.tsx` | Header action buttons |

### Pages
| Page | Purpose |
|------|---------|
| `/forums` | Main forums hub with categories and recent topics |
| `/forums/category/[slug]` | Category detail with topic list |
| `/forums/topic/[id]` | Topic detail with replies |
| `/forums/create` | Create new topic form |
| `/forums/browse` | Advanced forum browser |
| `/forums/search` | Forum search results |

---

## 6. API CONTRACT & RESPONSE FORMATS

### GET /api/forums/categories
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "general",
      "name": "General Discussion",
      "slug": "general",
      "description": "General forum topics",
      "color": "#6366f1",
      "sort_order": 1,
      "section": "Social Contract",
      "topic_count": 15,
      "post_count": 42,
      "last_activity_at": "2025-10-16T14:30:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/forums/topics?category_slug=general&limit=20
**Response:**
```json
{
  "success": true,
  "data": {
    "topics": [
      {
        "id": 1,
        "category_id": "general",
        "title": "Welcome to Forums",
        "content": "This is a test topic...",
        "status": "open",
        "is_pinned": true,
        "is_locked": false,
        "is_solved": false,
        "user_id": 1,
        "username": "admin",
        "view_count": 150,
        "reply_count": 5,
        "created_at": "2025-10-01T00:00:00Z",
        "updated_at": "2025-10-15T12:00:00Z",
        "last_reply_at": "2025-10-15T12:00:00Z",
        "last_reply_username": "user2",
        "category_name": "General Discussion",
        "category_color": "#6366f1"
      }
    ]
  }
}
```

### POST /api/forums/topics
**Request:**
```json
{
  "category_id": "general",
  "title": "My question",
  "content": "Detailed content here...",
  "is_pinned": false,
  "tags": [1, 2]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topic": {
      "id": 2,
      "category_id": "general",
      "title": "My question",
      "content": "...",
      "status": "open",
      "is_pinned": false,
      "user_id": 5,
      "username": "user5",
      "view_count": 0,
      "reply_count": 0,
      "created_at": "2025-10-16T14:35:00Z",
      "updated_at": "2025-10-16T14:35:00Z"
    }
  }
}
```

### GET /api/forums/stats
**Response:**
```json
{
  "success": true,
  "data": {
    "total_topics": 23,
    "total_replies": 90,
    "total_users": 15,
    "active_users_today": 8,
    "recent_topics": [ /* array of 5 recent topics */ ],
    "popular_categories": [ /* array of 5 popular categories */ ]
  }
}
```

---

## 7. CACHING STRATEGY

### Cache Layers
1. **Reply Tree Cache** - In-memory cache of nested replies (replyTreeCache)
2. **Content Cache** - Category and topic lists
3. **Analytics Cache** - Forum statistics (TTL: varies)
4. **Search Cache** - Search results

### Cache Invalidation
- **Topic creation/edit/delete**: Invalidates topic cache + category cache
- **Reply creation/edit/delete**: Invalidates reply cache + category cache
- **Solution mark/unmark**: Invalidates reply cache
- **Category update**: Invalidates category cache

### Cache Keys Structure
```
['forum', 'topics']
['forum', 'topic', topicId.toString()]
['forum', 'categories']
['forum', 'categories', 'section', sectionName]
['forum', 'categories', 'active', limit.toString()]
['forum', 'stats', 'user', userId.toString()]
```

---

## 8. VALIDATION & ERROR HANDLING

### Validation Schemas (Zod)
- **CreateTopicDTOSchema**: Title (3-200 chars), content (10-50k chars), category_id, status
- **CreateReplyDTOSchema**: Topic ID, content (1-50k chars), optional parent_id
- **SearchTopicsDTOSchema**: Query, category_id, user_id, status, tags, limit, offset, sort
- **CategoryIdSchema**: String slug or positive integer

### Error Handling Pattern
- Custom error classes: ValidationError, NotFoundError, PermissionError, AuthenticationError
- Result pattern: `{ isErr(): boolean, error?: Error, value?: T }`
- All API routes use `errorResponse()` helper for standardized error responses

### Permission Rules
- Users can only edit/delete their own topics/replies
- Admins can edit/delete any topic/reply
- Topics with replies cannot be deleted
- Topics must belong to existing category

---

## 9. CROSS-DATABASE STRATEGY

### Why No Cross-DB Joins
- SQLite doesn't support joins across separate database files
- Each domain has its own dedicated database file
- Users table is in users.db, forums in forums.db

### Implementation Pattern
```typescript
// Wrong (won't work):
const topics = db.prepare(`
  SELECT ft.*, u.username FROM forum_topics ft
  JOIN users u ON ft.user_id = u.id
`);

// Correct (used throughout):
const topics = db.prepare('SELECT * FROM forum_topics');
const users = usersDb.prepare('SELECT * FROM users WHERE id IN (...)');
const userMap = new Map(users.map(u => [u.id, u]));
topics.forEach(topic => topic.username = userMap.get(topic.user_id)?.username);
```

---

## 10. PERFORMANCE OPTIMIZATIONS

### Database Indexes
- FTS5 full-text search index on topics
- Indexes on foreign keys (category_id, user_id, topic_id)
- Indexes on frequently queried fields (is_pinned, created_at, updated_at)

### Query Optimizations
- Materialized fields (category_name, username) avoid expensive joins
- Connection pooling (max 50 connections) prevents resource exhaustion
- WAL mode enabled for better concurrent access
- Lazy-loaded service factory prevents unnecessary instantiation

### Frontend Optimizations
- Memoized React components (CategoryRow, CategorySection)
- Client-side search and sorting to reduce API calls
- Pagination on topic lists (limit 50)
- Caching of reply trees to avoid repeated queries

---

## 11. SECTION SYSTEM

### Predefined Sections
1. **Social Contract** - Community guidelines and policies
2. **Noxii Game** - Game-specific discussions
3. **Autumn Project** - Project-related topics
4. **Miscellaneous** - General topics

### Section Display Order
Categories are sorted by this exact order in SQL:
```sql
CASE section
  WHEN 'Social Contract' THEN 1
  WHEN 'Noxii Game' THEN 2
  WHEN 'Autumn Project' THEN 3
  WHEN 'Miscellaneous' THEN 4
  ELSE 5
END
```

---

## SUMMARY

The OLD forums system (v0.36) was a **comprehensive, full-featured forum platform** with:

- **5 specialized services** handling different domain responsibilities
- **10+ database tables** with proper schema design and indexing
- **RESTful API** with 14+ endpoints covering all CRUD operations
- **Advanced querying** with FTS5 search, nested replies, and filtering
- **Caching layers** for performance optimization
- **Type safety** with Zod validation and branded types
- **Proper service isolation** respecting single SQLite connection pools
- **User engagement features** like solution marking, pinning, and locking
- **Section-based organization** for logical forum structure

**Stripping this removed ~5,000+ lines of well-architected, production-grade code.**
