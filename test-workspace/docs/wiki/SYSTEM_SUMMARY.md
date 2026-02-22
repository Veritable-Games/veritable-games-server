# Wiki System - Quick Reference Summary

**Last Updated**: November 9, 2025
**Status**: Production-Ready (174 wiki pages exported to markdown)
**Database**: PostgreSQL 15 (production) | SQLite (localhost development)

## System Overview

- **Type**: Multi-layered wiki with full-text search, versioning, and automatic categorization
- **Database**: PostgreSQL (production) | SQLite (development) with 10 core tables + FTS5 virtual table
- **Services**: 6 specialized, single-responsibility service classes
- **Tech Stack**: Next.js 15, TypeScript, React 19, PostgreSQL 15 | better-sqlite3, FTS5
- **Scale**: Optimized for 10K-100K pages with BM25 ranking
- **Git Integration**: Bidirectional sync between markdown files and PostgreSQL

---

## Database Layer

### Core Tables (10 core + 1 virtual)

1. **wiki_pages** - Primary content (slug, title, namespace, status, category_id)
2. **wiki_revisions** - Version history (append-only, latest found via MAX(id))
3. **wiki_categories** - Hierarchical organization (TEXT PK, parent_id for hierarchy)
4. **wiki_page_categories** - Many-to-many junction (single category active currently)
5. **wiki_tags** - Flexible labeling (unlimited unique tags)
6. **wiki_page_tags** - Tag relationships (many-to-many)
7. **wiki_page_views** - Analytics (aggregated by day, UNIQUE on page_id+date)
8. **wiki_page_links** - Wikilink tracking (source, target slug, target page_id)
9. **unified_activity** - Cross-system activity log (wiki_edit action type)
10. **wiki_search** (FTS5 virtual) - Full-text search index (title, content, tags, category)

### Key Design Patterns

- **Slug vs Namespace**: Stored separately in database; slug must NOT include namespace prefix
- **Single Category**: Although junction table exists for multi-category, only category_id column is actively used
- **FTS5 Sync**: Automatic via triggers (DELETE+INSERT pattern for contentless table)
- **Revisions**: Append-only, no UPDATE; restore = create new revision with old content
- **Views**: Aggregated daily with UNIQUE constraint, incremented via ON CONFLICT
- **Permissions**: Role-based via is_public column on categories

### Indexes (30+)

- Page queries (slug, namespace, status, updated, author)
- Revision queries (page+timestamp, author, global timeline)
- Category queries (parent relationships, sort order)
- Analytics (view dates, page-specific, combined)
- Tags (name, usage)
- Links (source, target, backlinks)

---

## Service Layer (6 Specialized Services)

### 1. WikiPageService

**CRUD Operations**:
- `createPage()` - Transaction: INSERT pages → INSERT revisions → INSERT categories
- `updatePage()` - Track changes, create new revision, sync categories
- `deletePage()` - Cascade cleanup (tags, categories, revisions, views, links)
- `getPageBySlug(slug, namespace)` - **CRITICAL**: slug without namespace prefix
- `getPageById(pageId)` - By numeric ID
- `getAllPages(category, limit, userRole)` - Paginated with role filtering
- `recordPageView(pageId)` - Increment daily counter
- `getPageTags()`, `getPageInfoboxes()` - Related data

**Key Features**:
- Auto-categorization (only if no category provided)
- Cache invalidation (search + content)
- User lookup validation (userLookupService)

---

### 2. WikiRevisionService

**Version History Management**:
- `getPageRevisions(pageId, limit, offset)` - Full history with author info
- `getLatestRevision(pageId)` - Single revision only
- `createRevision(pageId, content, options)` - Manual new revision
- `restoreToRevision(pageId, revisionId)` - Restore as new revision
- `deleteRevision(revisionId)` - Safety: prevents deleting last revision
- `getRevisionStats(pageId)` - Contributors, dates, size totals
- `compareRevisions(id1, id2)` - Diff metrics (size diff, time delta)

**Design Notes**:
- Latest = MAX(id) for page
- Restore creates history trail (not destructive)
- size_bytes enables diff metrics

---

### 3. WikiCategoryService

**Hierarchical Organization**:
- `createCategory(data)` - Validate parent, check unique ID
- `updateCategory(categoryId, data)` - Prevent circular refs
- `deleteCategory(categoryId, moveToCategory?)` - Handle pages/subcategories
- `getAllCategories(userRole)` - Role-based filtering (is_public)
- `getCategoryById(categoryId)` - Single category with page count
- `getSubcategories(parentId)` - Direct children only
- `getRootCategories(userRole)` - Categories without parent
- `getCategoryHierarchy(userRole)` - Build tree structure
- `getCategoryStats()` - Aggregate statistics
- `searchCategories(query)` - Name/description search

**Design Notes**:
- TEXT PK allows readable IDs ('noxii', 'tutorials', etc.)
- Hierarchical via parent_id
- is_public field: 0=admin-only, 1=public

---

### 4. WikiSearchService

**Discovery & Search**:
- `searchPages(params, userRole)` - Two-path execution (FTS5 or filtered SQL)
- `fullTextSearch(query, options)` - Three-step BM25 process
- `getPopularPages(limit, userRole)` - Cached, top 10 by views
- `getRecentPages(limit, userRole)` - Recently created/updated
- `getRelatedPages(pageId, limit)` - By category + tags (relevance scoring)
- `getSearchSuggestions(partialQuery)` - Autocomplete

**FTS5 Search Algorithm (3 Steps)**:
1. **Ranking**: BM25 via FTS5 MATCH (max 500 results)
2. **Filtering**: Apply category, tags, namespace, author filters
3. **Re-ranking**: Sort by BM25 score then views, paginate

**Why Three Steps?**
- SQLite FTS5 limitation: bm25() incompatible with GROUP BY
- Solution: Get FTS rowids, then apply complex filters in main query

---

### 5. WikiTagService

**Flexible Labeling**:
- `getAllTags()` - All tags with usage counts
- `getPageTags(pageId)` - Tags for specific page
- `addTagToPage(pageId, tagId)` - Create relationship
- `removeTagFromPage(pageId, tagId)` - Delete relationship
- `createAndAddTags(pageId, tagNames, userId)` - Bulk creation

**Design Notes**:
- Unlimited unique tags (unlike categories)
- Many-to-many via wiki_page_tags
- usage_count tracked (can be denormalized)

---

### 6. WikiAnalyticsService

**Activity Tracking & Insights**:
- `logActivity(userId, activityType, entityType, entityId, action, metadata)` - Create activity record
- `getRecentActivity(limit)` - Last N activities with joined data
- `getUserActivity(userId, options)` - User contribution timeline
- `getWikiStats()` - Total pages, views, editors, categories, tags, avg size
- `getActivityTrends(days)` - Daily edits, top editors, category activity
- `getPageViewAnalytics(pageId, days)` - Per-page view analytics
- `getUserContributionStats(userId)` - Edit count, pages created, favorite categories
- `generateAnalyticsReport(timeframe)` - Comprehensive report

**Auto-Cleanup**:
- Keeps only 6 most recent wiki_edit activities
- Prevents unbounded table growth

---

### 7. WikiAutoCategorizer

**Intelligent Content-Based Categorization**:
- `categorizePage(pageData)` - Analyze and suggest category
- `autoCategorizePage(pageId)` - Auto-categorize new page (if no category)
- `categorizeOrphanedPages()` - Batch categorize all uncategorized pages

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

**Built-In Rules**:
- Game projects (noxii, on-command, autumn, cosmic-knights, dodec)
- Meta categories (development, systems, tutorials, community)
- Library/reference (uncategorized for manual review)

---

## API Routes (16 Total)

### Pages
- `GET /api/wiki/pages?category=X&search=Y&limit=20` - List/search
- `POST /api/wiki/pages` - Create new page
- `GET /api/wiki/pages/[slug]` - Get single page (with revisions, tags, views)
- `PUT /api/wiki/pages/[slug]` - Update page + create revision
- `DELETE /api/wiki/pages/[slug]` - Delete with cascade cleanup

### Revisions
- `GET /api/wiki/pages/[slug]/revisions?limit=20&offset=0` - History
- `POST /api/wiki/pages/[slug]/revisions/restore` - Restore to revision

### Tags
- `GET /api/wiki/pages/[slug]/tags` - Get page tags
- `PUT /api/wiki/pages/[slug]/tags` - Update tags

### Categories
- `GET /api/wiki/categories` - List all (role-filtered)
- `POST /api/wiki/categories` - Create category
- `GET /api/wiki/categories/[id]` - Single category
- `PUT /api/wiki/categories/[id]` - Update category
- `DELETE /api/wiki/categories/[id]` - Delete category
- `PATCH /api/wiki/categories/batch-update` - Bulk update

### Search & Discovery
- `GET /api/wiki/search?q=...` - Full-text search with filters

### Auto-Categorization
- `POST /api/wiki/auto-categorize` - Categorize page by content

### Activity
- `GET /api/wiki/activity?limit=10` - Recent activity

---

## Frontend Components (17 Components)

### Pages (8 Page Templates)
- `/wiki/` - Landing (stats, recent, popular, categories)
- `/wiki/create` - Create new page
- `/wiki/[slug]` - View page (content, metadata, tags, revisions)
- `/wiki/[slug]/edit` - Edit existing page
- `/wiki/[slug]/history` - Revision history
- `/wiki/category/[id]` - Category view with pages
- `/wiki/search` - Search results with filters

### Display Components
- `WikiSearch` - Search box with autocomplete
- `WikiCategoriesGrid` - Category card grid
- `CategoryFilterBar` - Filter by category/tag
- `TableOfContents` - Auto-generated from headers
- `WikiLandingTabs` - Recent/Popular/Categories tabs

### Editing Components
- `WikiCreateForm` - Create new page form
- `WikiEditForm` - Edit existing page
- `TagEditor` - Add/remove tags
- `InlineTagEditor` - Quick tag editing

### Display Components
- `ClientWikiHeader` - Header with user options
- `InfoboxRenderer` - Display infobox data

---

## Git Integration (Markdown Files)

**File Structure**:
```
frontend/content/wiki/{category}/{slug}.md
```

**Categories** (9 total):
- archive, autumn, cosmic-knights, dodec, journals, noxii, on-command, systems, tutorials

**Sync Commands**:
```bash
npm run wiki:export      # PostgreSQL → Markdown files
npm run wiki:import      # Markdown files → PostgreSQL
npm run wiki:reindex     # Rebuild FTS5 search indexes
```

**Workflow**:
1. Edit pages via web UI or markdown files
2. Export: `npm run wiki:export`
3. Commit: `git add frontend/content/wiki && git commit`
4. Push: `git push origin main`
5. On production: `git pull && npm run wiki:import`

See [WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md) for complete workflow details.

---

## Data Flow Patterns

### Page Creation Flow
```
User → Create Form → POST /api/wiki/pages
  → WikiPageService.createPage()
    → Transaction: INSERT pages + revisions + categories
    → Auto-categorize (if needed)
    → Cache invalidation
  → FTS5 triggers fire
  → Response: new page
  → Client: redirect to page view
```

### Page Edit Flow
```
User → Edit Form → PUT /api/wiki/pages/[slug]
  → WikiPageService.updatePage()
    → Get current page for comparison
    → Transaction: UPDATE pages + INSERT revision + UPDATE categories
    → Cache invalidation
  → FTS5 triggers fire
  → Response: updated page
  → Client: redirect to page view
```

### Search Flow
```
User → Enter query → GET /api/wiki/search?q=...
  → WikiSearchService.searchPages()
    → Step 1: FTS5 BM25 ranking (max 500)
    → Step 2: Apply filters (category, tags, author)
    → Step 3: Re-rank and paginate
  → Response: sorted results
  → Client: display with pagination
```

### Restore Flow
```
User → Click Restore → POST /api/wiki/pages/[slug]/revisions/restore
  → WikiRevisionService.restoreToRevision()
    → Get target revision
    → Create NEW revision with old content
    → Update page timestamp
  → FTS5 triggers fire
  → Response: new revision
  → Client: redirect to page
```

---

## Caching Strategy

### Cache Layers
1. **API Response** - HTTP headers (ETag, max-age)
2. **Application** - In-memory manager (redis in prod)
3. **Database** - Indexes on all filter columns

### TTLs
- Search results: 5 minutes
- Popular pages: 10 minutes
- Recent pages: 5 minutes
- Single page: 60 minutes
- Categories: 5 minutes (disabled)
- Stats: 10 minutes
- Activity: 2 minutes

### Invalidation Events
- Page create/update/delete → invalidate search + stats
- Category change → invalidate all category caches + search
- New activity → invalidate activity + stats

---

## Security & Access Control

### Authentication
- Session-based (auth database, not wiki database)
- getCurrentUser(request) → User | null
- requireAuth decorator for protected routes

### Authorization (RBAC)
- **Anonymous**: Published public pages only
- **User**: Same as anonymous
- **Moderator**: Can see library pages
- **Admin**: All pages, all categories

### Admin-Only Categories
```
['library', 'archive', 'development', 'uncategorized', 'journals']
```

### Content Security
- Sanitization via DOMPurify (API routes)
- SQL injection prevention (prepared statements)
- CSRF protection (double submit cookie pattern)

---

## Common Pitfalls & Solutions

### 1. Slug vs Namespace Confusion
```typescript
// ❌ WRONG
getPageBySlug("library/doom-bible", "main")

// ✅ CORRECT
getPageBySlug("doom-bible", "library")
```

### 2. FTS5 Not Updating
- Check triggers exist: `SELECT * FROM sqlite_master WHERE type='trigger'`
- Verify wiki_search table has rows
- Check trigger syntax in database.ts

### 3. Page Appears Twice
- Ensure `GROUP BY p.id` in all aggregate queries

### 4. Category Cache Not Updating
- Currently disabled (temporarily)
- Will expire after 5 minutes

### 5. Orphaned Revisions
- Always use transactions for page + revision
- Cascade delete prevents orphans

---

## Performance Characteristics

### Query Times
| Query | Time | Notes |
|-------|------|-------|
| Get page by slug | <1ms | Slug index O(1) |
| List pages (20 items) | <10ms | Index scan |
| FTS5 search | 5-30ms | BM25 ranking |
| Popular pages | <50ms | Aggregate with sort |
| Revision history | <20ms | Composite index |

### Scalability
- **Optimal**: <10K pages
- **Good**: 10K-100K pages (with optimization)
- **Limit**: >100K pages (migrate to PostgreSQL)

### FTS5 Limits
- Max results per search: 500
- Cache hit rate: 5-10% typical

---

## File Locations

### Core Files
- Schema: `frontend/src/lib/wiki/database.ts` (604 lines)
- Types: `frontend/src/lib/wiki/types.ts`
- Services: `frontend/src/lib/wiki/services/` (6 files)
- API: `frontend/src/app/api/wiki/` (16 routes)
- Pages: `frontend/src/app/wiki/` (8 pages)
- Components: `frontend/src/components/wiki/` (17 components)
- Auto-categorizer: `frontend/src/lib/wiki/auto-categorization.ts`

---

## Future Improvements

### Short-Term
- Wikilink parser for [[...]] syntax
- Side-by-side revision diff viewer
- Multi-category support (already in schema)

### Medium-Term
- Template system (re-enable wiki_templates)
- Markdown enhancements (syntax highlighting, tables)
- Real-time collaboration (CRDTs)

### Long-Term
- Advanced dashboard analytics
- Content moderation workflow
- Import from external wiki systems

---

**Analysis Date**: November 9, 2025
**Wiki Version**: Phase 3 (Git-Based Versioning)
**Database**: PostgreSQL 15 (production) | SQLite (development)
**Status**: Production-ready, fully functional (174 pages exported)
