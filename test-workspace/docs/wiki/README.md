# Wiki System Documentation

**Last Updated**: November 17, 2025
**Status**: Production-Ready (174 wiki pages exported to markdown)
**Database**: PostgreSQL (production) | SQLite (localhost development)
**Recent Fix**: ✅ Category page bug resolved (1-month investigation) - See [WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md](./WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md)

## Overview

The Veritable Games wiki system is a comprehensive content management platform with full-text search, revision tracking, automatic categorization, and git-based versioning. The system uses a bidirectional workflow where markdown files serve as the source of truth and PostgreSQL acts as a queryable cache.

**Key Features**:
- Full CRUD operations with security (CSRF, authentication, rate limiting)
- Git-based versioning with markdown files
- FTS5 full-text search with BM25 ranking
- Automatic categorization with confidence scoring
- Revision tracking with restore capabilities
- Role-based access control (admin, moderator, user, anonymous)
- 174 wiki pages across 9 categories

## Documentation Index

### Core Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture
  - Database schema (PostgreSQL wiki schema)
  - Service layer (6 specialized services)
  - API routes (16 endpoints)
  - Frontend components (17 components)
  - Security implementation
  - Performance characteristics

- **[SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md)** - Quick reference guide
  - System overview
  - Database tables
  - Service capabilities
  - Common workflows
  - Performance metrics

- **[WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md)** - Git-based versioning workflow
  - Bidirectional sync (markdown ↔ PostgreSQL)
  - Edit locally, push to production
  - Edit on production, pull to localhost
  - Merge changes from both environments
  - Important notes and best practices

- **[COMMANDS.md](./COMMANDS.md)** - Wiki npm scripts reference
  - `npm run wiki:export` - Export wiki pages to markdown
  - `npm run wiki:import` - Import markdown files to database
  - `npm run wiki:reindex` - Rebuild full-text search indexes

### Troubleshooting & Historical Context

- **[WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md](./WIKI_CATEGORY_BUG_FINAL_RESOLUTION_NOV_2025.md)** - ✅ **Critical Bug Resolution**
  - Complete documentation of 1-month category page bug investigation
  - Root cause: SQL query referencing non-existent columns
  - Resolution: November 17, 2025 (commit 35607ed)
  - Key learnings: Production logging, schema validation, deployment verification

- **[troubleshooting-history/README.md](./troubleshooting-history/README.md)** - Complete investigation history
  - 11 debugging sessions documented
  - Multiple hypotheses tested (authentication, GROUP BY, caching, logging)
  - Archive of all investigation documents (October-November 2025)

### Quick Links

- **Wiki Routes**: `/wiki/`, `/wiki/create`, `/wiki/[slug]`, `/wiki/[slug]/edit`, `/wiki/search`
- **API Routes**: `/api/wiki/pages`, `/api/wiki/categories`, `/api/wiki/search`, `/api/wiki/activity`
- **Database**: PostgreSQL schema: `wiki` | SQLite database (dev): `frontend/data/wiki.db`

## System Statistics

**Current Status (November 9, 2025)**:
- **Pages**: 174 wiki pages exported to markdown
- **Categories**: 9 categories (archive, autumn, cosmic-knights, dodec, journals, noxii, on-command, systems, tutorials)
- **Markdown Files**: `frontend/content/wiki/{category}/{slug}.md`
- **Database**: PostgreSQL with full revision history
- **Search**: FTS5 full-text search (5-30ms queries)

## Quick Start

### Development Workflow

```bash
# Start development server
cd frontend
npm run dev

# Access wiki at http://localhost:3000/wiki
```

### Git-Based Versioning

```bash
# Export latest database state to markdown
npm run wiki:export

# Import markdown files to database
npm run wiki:import

# Rebuild search indexes
npm run wiki:reindex
```

See [WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md) for complete workflow details.

## Architecture Overview

### Database Layer (PostgreSQL)
- **wiki_pages** - Primary content (slug, title, namespace, status, category_id)
- **wiki_revisions** - Version history (append-only, latest = MAX(id))
- **wiki_categories** - Hierarchical organization (TEXT PK, parent_id)
- **wiki_tags** - Flexible labeling (many-to-many)
- **wiki_search** - FTS5 virtual table for full-text search
- **wiki_page_views** - Analytics (aggregated by day)

### Service Layer (6 Services)
1. **WikiPageService** - CRUD operations, auto-categorization
2. **WikiRevisionService** - Version history, restore
3. **WikiCategoryService** - Hierarchical categories
4. **WikiSearchService** - FTS5 search, filtering, ranking
5. **WikiTagService** - Tag management
6. **WikiAnalyticsService** - Activity tracking, statistics

### API Routes (16 Endpoints)
- Pages: GET/POST `/api/wiki/pages`, GET/PUT/DELETE `/api/wiki/pages/[slug]`
- Revisions: GET `/api/wiki/pages/[slug]/revisions`, POST `/api/wiki/pages/[slug]/revisions/restore`
- Categories: GET/POST `/api/wiki/categories`, GET/PUT/DELETE `/api/wiki/categories/[id]`
- Search: GET `/api/wiki/search`
- Activity: GET `/api/wiki/activity`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete details.

## Common Workflows

### Create a New Wiki Page

1. Navigate to `/wiki/create`
2. Fill in title, content, category, tags
3. Click "Create Page"
4. Export to markdown: `npm run wiki:export`
5. Commit to git: `git add frontend/content/wiki && git commit`

### Edit an Existing Page

1. Navigate to `/wiki/[slug]` and click "Edit"
2. Modify content in markdown editor
3. Add edit summary
4. Click "Save"
5. Export to markdown: `npm run wiki:export`
6. Commit changes to git

### Search for Content

1. Navigate to `/wiki/search`
2. Enter search query
3. Filter by category, tags, namespace
4. Results ranked by BM25 relevance + views

### Sync Between Environments

```bash
# On localhost: Export and push
npm run wiki:export
git add frontend/content/wiki
git commit -m "docs: Update wiki pages"
git push

# On production: Pull and import
git pull origin main
npm run wiki:import
```

See [WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md) for complete workflow.

## Security Features

- **Authentication**: Session-based with 30-day expiration
- **CSRF Protection**: Double submit cookie pattern with timing-safe comparison
- **Input Validation**: Zod schemas for all API inputs
- **Content Sanitization**: DOMPurify prevents XSS
- **Rate Limiting**: Optional per-route IP-based limiting
- **Role-Based Access**: Admin, moderator, user, anonymous permissions

## Performance

**Query Times** (Measured):
- Page load: 100-300ms
- Page save: 200-500ms
- FTS5 search: 5-30ms
- Category listing: <10ms

**Scalability**:
- Optimal: <10K pages
- Good: 10K-100K pages (with optimization)
- PostgreSQL recommended for >100K pages

## Integration Points

- **Forums**: Cross-references via `forum_wiki_references` table
- **Library**: Document integration via `library` namespace
- **User System**: Unified activity tracking, permissions
- **Search**: Unified search across wiki, forums, library

## Known Limitations

1. **Single Category**: Pages limited to one primary category (schema supports multiple)
2. **Manual Sync**: Git workflow requires explicit export/import (not automatic)
3. **Schema Compatibility**: Export/import scripts handle localhost/production differences

## Future Enhancements

### Short-Term
- Multi-category support (schema already exists)
- Automatic markdown export on save
- Real-time collaborative editing

### Medium-Term
- Advanced template system
- Markdown enhancements (syntax highlighting, tables)
- Semantic search and recommendations

### Long-Term
- Advanced analytics dashboard
- Content moderation workflow
- Import from external wiki systems

## Related Documentation

- **Main Documentation**: [docs/README.md](../README.md)
- **CLAUDE.md**: [CLAUDE.md](../../CLAUDE.md) - Wiki Content Versioning section
- **Database Architecture**: [docs/DATABASE.md](../DATABASE.md)
- **API Reference**: [docs/api/README.md](../api/README.md)
- **React Patterns**: [docs/REACT_PATTERNS.md](../REACT_PATTERNS.md)

## Support

For issues or questions:
1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
2. Review [WIKI_GIT_WORKFLOW.md](./WIKI_GIT_WORKFLOW.md) for workflow help
3. See [COMMANDS.md](./COMMANDS.md) for npm script usage
4. Refer to [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for common issues

---

**System Version**: Phase 3 (Git-Based Versioning)
**Database**: PostgreSQL 15 (production) | SQLite (dev)
**Total Pages**: 174 exported markdown files
**Last Export**: November 9, 2025
