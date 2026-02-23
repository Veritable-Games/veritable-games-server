# Wiki System Architecture

**Last Updated**: November 9, 2025
**Status**: Production-Ready (Phase 3: Git-Based Versioning)
**Database**: PostgreSQL 15 (production) | SQLite (localhost development)

## Executive Summary

The Veritable Games wiki system is a comprehensive, multi-layered architecture built on Next.js 15 with PostgreSQL (production) or SQLite (development), 6 specialized service classes, and git-based versioning. The system uses FTS5 full-text search, automatic categorization, revision tracking, and role-based access control.

**Key Stats**:
- **Database**: 10 core tables (plus FTS5 virtual table)
- **Services**: 6 specialized services (Pages, Revisions, Categories, Search, Tags, Analytics)
- **API Routes**: 16 API endpoints with standardized validation/security
- **Components**: 17 frontend components for content display and editing
- **Page Templates**: 8 page templates for different wiki operations
- **Namespaces**: 5 namespaces (main, library, dev, project, noxii/on-command/autumn/cosmic-knights)
- **Auto-Categorization**: 10+ configurable rules
- **Production**: 174 wiki pages exported to markdown (November 9, 2025)

---

## 1. DATABASE LAYER

### 1.1 Core Tables

#### **wiki_pages** (Primary Content Table)
```sql
CREATE TABLE wiki_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,                    -- URL identifier
  title TEXT NOT NULL,                          -- Page title
  namespace TEXT DEFAULT 'main',                -- Namespace: main, library, project, dev
  project_slug TEXT,                            -- Project integration reference
  template_type TEXT,                           -- Template type (if any)
  category_id TEXT,                             -- Primary category identifier
  status TEXT DEFAULT 'published',              -- published, archived
  protection_level TEXT DEFAULT 'none',         -- Access level: none, semi, full
  created_by INTEGER,                           -- Author user ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
)
```

**Indexes** (8 total):
- `idx_wiki_pages_slug` - Fast lookups by slug
- `idx_wiki_pages_namespace` - Namespace filtering
- `idx_wiki_pages_status` - Published status filtering
- `idx_wiki_pages_updated` - Recent changes queries
- `idx_wiki_pages_created_by` - Author filtering
- `idx_wiki_pages_category` - Category relationships
- `idx_wiki_pages_project` - Project integration
- `idx_wiki_pages_template` - Template filtering

**Key Design Notes**:
- Slug must be UNIQUE (no duplicate page URLs)
- Namespace allows content organization by type
- `status` column filters for "published" pages in all queries
- `created_by` links to users database
- Single direct `category_id` column for primary categorization

---

#### **wiki_revisions** (Version History)
```sql
CREATE TABLE wiki_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,                      -- Which page this is a revision of
  content TEXT NOT NULL,                         -- Full markdown content
  summary TEXT,                                  -- Edit summary/message
  content_format TEXT DEFAULT 'markdown',        -- markdown, html, wikitext
  author_id INTEGER,                             -- User who made the edit
  author_ip TEXT,                                -- IP address of editor
  is_minor BOOLEAN DEFAULT FALSE,                -- Minor edit flag
  size_bytes INTEGER,                            -- Content size for diff calculations
  revision_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
)
```

**Indexes** (3 total):
- `idx_wiki_revisions_page_timestamp` - Get revisions for a page, ordered by time
- `idx_wiki_revisions_author` - Contributions by user
- `idx_wiki_revisions_timestamp` - Recent revisions globally

**Key Design Notes**:
- Latest revision always has `MAX(id)` for that `page_id`
- FTS5 trigger keeps `wiki_search` table in sync with latest content
- `size_bytes` enables diff calculations and change analysis
- Append-only design (no UPDATE support, revisions are immutable)

---

#### **wiki_categories** (Hierarchical Organization)
```sql
CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,                           -- Category identifier (e.g., 'noxii', 'tutorials')
  parent_id TEXT,                                -- For hierarchical categories
  name TEXT NOT NULL,                            -- Display name
  description TEXT,                              -- Category description
  color TEXT DEFAULT '#6B7280',                  -- Color for UI display
  icon TEXT,                                     -- Icon/emoji identifier
  sort_order INTEGER DEFAULT 0,                  -- Display ordering
  is_public INTEGER DEFAULT 1,                   -- 0 = admin-only, 1 = public
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES wiki_categories(id)
)
```

**Indexes** (2 total):
- `idx_wiki_categories_parent` - Subcategory lookups
- `idx_wiki_categories_sort` - Ordering queries

**Key Design Notes**:
- TEXT PRIMARY KEY allows readable IDs (not auto-increment integers)
- Hierarchical: `parent_id` creates subcategory relationships
- `is_public` field enables admin-only categories (not visible to regular users)
- Built-in categories: 'uncategorized', 'library', 'noxii', 'on-command', 'autumn', 'cosmic-knights', 'development', 'systems', 'tutorials', 'community'

---

#### **wiki_page_categories** (Many-to-Many Junction)
```sql
CREATE TABLE wiki_page_categories (
  page_id INTEGER,
  category_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_id, category_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES wiki_categories(id) ON DELETE CASCADE
)
```

**Purpose**:
- Tracks which categories each page belongs to
- Currently only single category per page is actively used (via `category_id` in `wiki_pages`)
- Kept for potential future multi-categorization support

---

#### **wiki_tags** (Flexible Labeling)
```sql
CREATE TABLE wiki_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,                     -- Tag name (e.g., 'game-mechanics')
  description TEXT,
  color TEXT DEFAULT '#3b82f6',                  -- UI color
  usage_count INTEGER DEFAULT 0,                 -- Pages using this tag
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Indexes** (2 total):
- `idx_wiki_tags_name` - Fast tag lookups
- `idx_wiki_tags_usage` - Popular tags query

---

#### **wiki_page_tags** (Tag Relationships)
```sql
CREATE TABLE wiki_page_tags (
  page_id INTEGER,
  tag_id INTEGER,
  tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_id, tag_id),
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES wiki_tags(id) ON DELETE CASCADE
)
```

---

#### **wiki_page_views** (Analytics)
```sql
CREATE TABLE wiki_page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  view_date DATE NOT NULL,                       -- Aggregated by day
  view_count INTEGER DEFAULT 1,                  -- Incremented by 1 per unique visitor/session
  unique_visitors INTEGER DEFAULT 1,
  UNIQUE(page_id, view_date),                    -- One row per page per day
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE
)
```

**Indexes** (3 total):
- `idx_wiki_page_views_date` - Time-range queries
- `idx_wiki_page_views_page` - Per-page analytics
- `idx_wiki_page_views_page_date` - Combination queries

**Insert Strategy**:
```sql
INSERT INTO wiki_page_views (page_id, view_date, view_count)
VALUES (?, ?, 1)
ON CONFLICT(page_id, view_date)
DO UPDATE SET view_count = view_count + 1
```

---

#### **wiki_page_links** (Wikilink Tracking)
```sql
CREATE TABLE wiki_page_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_page_id INTEGER NOT NULL,               -- Page containing the link
  target_slug TEXT NOT NULL,                     -- [[Linked Page]] slug
  target_page_id INTEGER,                        -- NULL if link is broken
  link_text TEXT,                                -- Display text
  link_context TEXT,                             -- Surrounding content
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_page_id) REFERENCES wiki_pages(id) ON DELETE CASCADE,
  FOREIGN KEY (target_page_id) REFERENCES wiki_pages(id) ON DELETE SET NULL
)
```

**Indexes** (3 total):
- `idx_wiki_page_links_source` - Find links from a page
- `idx_wiki_page_links_target` - Find backlinks to a page
- `idx_wiki_page_links_target_page` - Orphaned link detection

---

#### **wiki_search** (FTS5 Virtual Table)
```sql
CREATE VIRTUAL TABLE wiki_search USING fts5(
  title,                                         -- Page title (searchable)
  content,                                       -- Latest revision content (searchable)
  tags,                                          -- Comma-separated tag names (searchable)
  category,                                      -- Category name (searchable)
  content='',                                    -- Contentless table (data in main table)
  contentless_delete=1                           -- Enable DELETE on FTS table
)
```

**FTS5 Triggers (Automatic Sync)**:
- `wiki_search_ai`: After INSERT on wiki_pages
- `wiki_search_au`: After UPDATE on wiki_pages (DELETE+INSERT pattern for contentless)
- `wiki_search_revision_ai`: After INSERT on wiki_revisions
- `wiki_search_ad`: After DELETE on wiki_pages

**Search Method (BM25 Ranking)**:
```sql
SELECT rowid, bm25(wiki_search) as rank
FROM wiki_search
WHERE wiki_search MATCH ?
ORDER BY rank
```

---

### 1.2 Index Strategy

**Total Indexes: 30+**

Organized into categories:

1. **Page Queries (8 indexes)**: Slug lookups, namespace filtering, status filtering, time-based, author-based
2. **Revision Queries (3 indexes)**: Page+time combinations, author tracking, global timeline
3. **Category Queries (2 indexes)**: Parent relationships, display ordering
4. **Analytics Queries (3 indexes)**: View date ranges, page-specific views, combined
5. **Tag Queries (2 indexes)**: Name lookups, usage statistics
6. **Link Tracking (3 indexes)**: Backlink resolution, orphaned link detection

**Index Performance Implications**:
- Slug index makes URL lookups O(1)
- Composite (page_id, timestamp) index enables efficient pagination
- Status index ensures published-only queries are fast
- All indexes use B-tree structure for range queries

---

### 1.3 Git Integration (Markdown Files)

**Markdown File Structure**:
```
frontend/content/wiki/{category}/{slug}.md
```

**Categories** (9 total):
- archive
- autumn
- cosmic-knights
- dodec
- journals
- noxii
- on-command
- systems
- tutorials

**File Format**:
```markdown
---
title: Page Title
slug: page-slug
namespace: main
category: noxii
tags: [tag1, tag2]
created_at: 2025-11-09T12:00:00Z
updated_at: 2025-11-09T12:30:00Z
---

# Page Content

Markdown content here...
```

**Sync Mechanism**:
- `npm run wiki:export` - PostgreSQL → Markdown files
- `npm run wiki:import` - Markdown files → PostgreSQL
- `npm run wiki:reindex` - Rebuild FTS5 search indexes

See [WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md) for complete workflow.

---

## 2. SERVICE LAYER ARCHITECTURE

### 2.1 Service Overview

```typescript
// Service Factory Pattern
WikiServiceFactory {
  pages: WikiPageService          // CRUD operations
  revisions: WikiRevisionService   // Version history
  categories: WikiCategoryService  // Organization
  search: WikiSearchService        // Discovery with FTS5
  tags: WikiTagService             // Flexible labeling
  analytics: WikiAnalyticsService  // Activity & insights
}
```

Each service:
- Uses `dbPool.getConnection('wiki')` for consistent access
- Has async/await API for all database operations
- Implements error handling with descriptive error messages
- Uses prepared statements to prevent SQL injection
- Integrates with cache system for performance

---

### 2.2 WikiPageService

**File**: `frontend/src/lib/wiki/services/WikiPageService.ts`

**Responsibilities**:
- Page CRUD (Create, Read, Update, Delete)
- Content management with revision creation
- Category assignment
- View tracking
- Permission checks

**Key Methods**:

```typescript
async createPage(
  data: CreateWikiPageData,
  authorId?: number,
  authorIp?: string
): Promise<WikiPage>
```

**Flow**:
1. Validate user exists (userLookupService)
2. Validate category exists
3. Transaction:
   - INSERT into wiki_pages (slug, title, namespace, status, category_id)
   - INSERT into wiki_revisions (content, summary, format, author_id)
   - INSERT into wiki_page_categories (junction table)
4. Auto-categorization (if no category provided)
5. Cache invalidation
6. Return full page with tags, infoboxes, views

```typescript
async updatePage(
  pageId: number,
  data: UpdateWikiPageData,
  authorId?: number,
  authorIp?: string
): Promise<WikiPage>
```

**Flow**:
1. Get current page data for comparison
2. Transaction:
   - UPDATE wiki_pages (title, status, protection_level, category_id if provided)
   - INSERT INTO wiki_revisions (new content, format, summary)
   - Update junction tables for categories
3. Cache invalidation
4. Return updated page

```typescript
async getPageBySlug(
  slug: string,
  namespace: string = 'main'
): Promise<WikiPage>
```

**CRITICAL DESIGN PATTERN**:
```
IMPORTANT: Slug parameter must NOT include namespace prefix!

Database stores them separately:
  slug column: "doom-bible" (without prefix)
  namespace column: "library"

So call as: getPageBySlug("doom-bible", "library")
NOT:        getPageBySlug("library/doom-bible", "main")
```

---

### 2.3 WikiRevisionService

**File**: `frontend/src/lib/wiki/services/WikiRevisionService.ts`

**Responsibilities**:
- Revision CRUD and comparison
- Edit history retrieval
- Restore functionality
- Statistics tracking

**Key Methods**:

```typescript
async getPageRevisions(
  pageId: number,
  options: { limit?: number; offset?: number }
): Promise<WikiRevision[]>
```

```typescript
async restoreToRevision(
  pageId: number,
  revisionId: number,
  authorId?: number,
  summary?: string
): Promise<WikiRevision>
```

**Implementation**:
1. Get target revision (verify it exists and belongs to this page)
2. Create NEW revision with old content
3. Summary: "Restored to revision {revisionId}"
4. This creates a restore history trail

---

### 2.4 WikiCategoryService

**File**: `frontend/src/lib/wiki/services/WikiCategoryService.ts`

**Responsibilities**:
- Category CRUD
- Hierarchy management
- Role-based access
- Statistics

**Key Methods**:

```typescript
async getAllCategories(userRole?: string): Promise<WikiCategory[]>
```

**Role-Based Filtering**:
- `is_public = 0` (false) → Admin/Moderator only
- `is_public = 1` (true) → Everyone

```typescript
async getCategoryHierarchy(userRole?: string): Promise<WikiCategory[]>
```

**Creates Tree Structure**:
1. Get all categories with filtering
2. Build Map<id → category_with_children>
3. Find root categories (parent_id IS NULL)
4. Attach children recursively

---

### 2.5 WikiSearchService

**File**: `frontend/src/lib/wiki/services/WikiSearchService.ts`

**Responsibilities**:
- FTS5 full-text search
- Filtered browsing (no text query)
- Popular/recent pages
- Related pages (by tags/category)
- Search suggestions
- BM25 ranking

**Key Method**:

```typescript
async fullTextSearch(
  query: string,
  options: {...}
): Promise<WikiSearchResult>
```

**Algorithm (Three Steps)**:

**Step 1: FTS5 Ranking**
```sql
SELECT rowid, bm25(wiki_search) as rank
FROM wiki_search
WHERE wiki_search MATCH ?
ORDER BY rank
LIMIT 500
```

**Step 2: Apply Filters**
```sql
SELECT p.*, r.content, ..., u.display_name
FROM wiki_pages p
WHERE p.id IN (${pageIds})  -- From FTS5 step
AND p.namespace = ?
AND p.status = 'published'
AND p.category_id IN (${categories})
-- Tag filter with AND logic
```

**Step 3: Re-rank and Paginate**
1. Map filter results back to rank values
2. Sort by rank (ASC = lower is better in BM25)
3. Secondary sort: total_views DESC
4. Apply limit/offset
5. Format and return

**Why This Complex Three-Step Approach?**
- SQLite FTS5 limitation: bm25() can't be used with GROUP BY
- Solution: Get FTS rowids first, then apply filters in main query
- Maintains BM25 ranking while allowing complex filters

---

### 2.6 WikiTagService

**File**: `frontend/src/lib/wiki/services/WikiTagService.ts`

**Responsibilities**:
- Multi-tag support per page
- Tag usage tracking
- Tag autocomplete
- Tag caching

---

### 2.7 WikiAnalyticsService

**File**: `frontend/src/lib/wiki/services/WikiAnalyticsService.ts`

**Responsibilities**:
- Page view tracking
- User activity logging
- Edit frequency analytics
- Contribution patterns

**Key Methods**:

```typescript
async getWikiStats(): Promise<{
  total_pages: number;
  total_views: number;
  active_editors_month: number;
  recent_edits_week: number;
  total_categories: number;
  total_tags: number;
  average_page_size: number;
  most_active_category: string | null;
}>
```

**10-Minute Cache**

---

### 2.8 Wiki Auto-Categorizer

**File**: `frontend/src/lib/wiki/auto-categorization.ts`

**Responsibilities**:
- Intelligent content-based categorization
- Pattern matching (title, content, slug, namespace)
- Confidence scoring
- Batch categorization of orphaned pages

**Scoring Algorithm**:
1. Match patterns (title, content, slug, namespace)
2. Accumulate scores by rule
3. Weight by rule importance (0.6-0.9)
4. Score < 0.4 or no match → fallback to 'uncategorized'
5. Return with confidence + reasoning

**Pattern Scoring**:
- Title match: +0.4 per pattern
- Content match: +0.3 per pattern (first 1000 chars)
- Slug match: +0.4 per pattern
- Namespace match: +0.5

---

## 3. API ROUTES (16 Total)

### 3.1 Route Organization

**Base Path**: `/api/wiki/`

```
├── pages/
│   ├── GET, POST               /api/wiki/pages
│   ├── GET, PUT, DELETE        /api/wiki/pages/[slug]
│   ├── GET, POST               /api/wiki/pages/[slug]/revisions
│   ├── POST                    /api/wiki/pages/[slug]/revisions/restore
│   ├── GET, PUT                /api/wiki/pages/[slug]/tags
│   └── POST                    /api/wiki/pages/validate
├── categories/
│   ├── GET, POST               /api/wiki/categories
│   ├── GET, PUT, DELETE        /api/wiki/categories/[id]
│   └── PATCH                   /api/wiki/categories/batch-update
├── search/
│   └── GET                     /api/wiki/search
├── auto-categorize/
│   └── POST                    /api/wiki/auto-categorize
└── activity/
    └── GET                     /api/wiki/activity
```

### 3.2 Security Implementation

**All routes use `withSecurity()` middleware**:

```typescript
export const POST = withSecurity(async (request) => {
  // Automatic security features:
  // - CSRF protection (double submit cookie pattern)
  // - CSP headers with dynamic nonce
  // - X-Frame-Options: DENY
  // - HSTS headers
  // - Input validation
  // - Content sanitization
});
```

---

## 4. FRONTEND COMPONENTS (17 Components)

### 4.1 Page Components (Server + Client Split)

**Page Routes**:
- `/wiki/` - Landing (stats, recent, popular, categories)
- `/wiki/create` - Create new page
- `/wiki/[slug]` - View page (content, metadata, tags, revisions)
- `/wiki/[slug]/edit` - Edit existing page
- `/wiki/[slug]/history` - Revision history
- `/wiki/category/[id]` - Category view with pages
- `/wiki/search` - Search results with filters

### 4.2 Component Library

**Display Components**:
- WikiSearch.tsx - Search box with autocomplete
- WikiCategoriesGrid.tsx - Grid of category cards
- CategoryPageContent.tsx - Category detail view
- CategoryFilterBar.tsx - Filter by category/tag
- TableOfContents.tsx - Auto-generated from headers

**Editing Components**:
- MarkdownEditor - Rich markdown editing
- TagEditor.tsx - Add/remove tags
- InlineTagEditor.tsx - Quick tag editing
- CategorySelector - Dropdown for category selection

---

## 5. SECURITY & ACCESS CONTROL

### 5.1 Authentication

**Session-Based (Server-Side)**:
- Location: auth database (separate from wiki)
- Sessions table: id, user_id, expires_at, created_at
- getCurrentUser(request) → User | null
- requireAuth decorator → force login

### 5.2 Authorization & Permissions

**Role-Based Access Control (RBAC)**:

**Rules**:
- **Anonymous users**: See only published, public pages
- **Authenticated users**: Same as anonymous
- **Moderators**: Can see library pages
- **Admins**: Can see all pages including admin-only categories

**Admin-Only Categories**:
```typescript
const adminOnlyCategories = [
  'library',
  'archive',
  'development',
  'uncategorized',
  'journals'
];
```

### 5.3 Content Security

**Sanitization (DOMPurify)**:
- Applied in API routes to user input
- Strips XSS vectors
- Allowed tags: configurable per route

**SQL Injection Prevention**:
- All queries use prepared statements
- No string interpolation
- Parameter binding via `?` placeholders

**CSRF Protection**:
- Double submit cookie pattern
- Timing-safe comparison (crypto.timingSafeEqual)
- Auto-validated by withSecurity()

---

## 6. PERFORMANCE CHARACTERISTICS

### 6.1 Query Performance

**Typical Query Times**:

| Query | Complexity | Expected Time |
|-------|-----------|----------------|
| Get single page by slug | O(1) lookup | <1ms |
| List all pages (20 limit) | O(n) with index | <10ms |
| Full-text search (FTS5) | BM25 ranking | 5-30ms |
| Popular pages (top 10) | Aggregate with sort | <50ms |
| Category with pages count | JOIN + aggregate | <10ms |
| Revision history (paginated) | Index scan + limit | <20ms |

### 6.2 Scalability Limits

**Current Architecture**:
- Best performance: <10K pages
- Acceptable: 10K-100K pages (with query optimization)
- PostgreSQL recommended: >100K pages

**FTS5 Scaling**:
- Contentless table: small main database
- BM25 ranking: O(log n) with proper indexing
- 500-result limit in full-text search

---

## 7. FILE LOCATIONS

### Core Files

**Schema**: `frontend/src/lib/wiki/database.ts` (604 lines)
**Types**: `frontend/src/lib/wiki/types.ts`
**Services**: `frontend/src/lib/wiki/services/` (6 files)
**API**: `frontend/src/app/api/wiki/` (16 routes)
**Pages**: `frontend/src/app/wiki/` (8 pages)
**Components**: `frontend/src/components/wiki/` (17 components)
**Auto-categorizer**: `frontend/src/lib/wiki/auto-categorization.ts`

### Configuration

**Database pool**: `frontend/src/lib/database/pool.ts`
**Service registry**: `frontend/src/lib/services/registry.ts`
**Validation schemas**: `frontend/src/lib/validation/schemas.ts`
**Security middleware**: `frontend/src/lib/security/middleware.ts`

---

**Document Generated**: November 9, 2025
**Wiki System Version**: Phase 3 (Git-Based Versioning)
**Database**: PostgreSQL 15 (production) | SQLite (development)
**Total Pages**: 174 exported markdown files
