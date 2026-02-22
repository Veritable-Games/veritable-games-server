# Library System Documentation

**Date**: December 24, 2025
**Status**: Production-ready
**Total Documents**: ~28,500 (User Library + Anarchist Archive)

---

## Quick Overview

The Library System is a dual-collection document management platform:

| Collection | Documents | Languages | Storage |
|------------|-----------|-----------|---------|
| User Library | ~3,859 | English (expandable) | Markdown files |
| Anarchist Archive | 24,643 | 27 languages | Markdown files |
| **Total** | **~28,500** | **27** | **1.3 GB + metadata** |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│              /api/library/* + /api/documents/*              │
└────────────────────────┬────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼─────────────┐ ┌────▼──────────┐ ┌───────▼──────────┐
│ LibraryService  │ │AnarchistService│ │UnifiedDocService │
│ (User Library)  │ │ (Archive)      │ │ (Combined Search)│
└───┬─────────────┘ └────┬──────────┘ └──────────────────┘
    │                    │
    └────────────────────┼────────────────────┐
                         │                    │
              ┌──────────▼──────────┐ ┌───────▼─────────┐
              │  PostgreSQL         │ │  Filesystem     │
              │  (metadata)         │ │  (content)      │
              │  library + anarchist│ │  /app/*-library │
              │  + shared.tags      │ │  YYYY/MM/slug.md│
              └─────────────────────┘ └─────────────────┘
```

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [LIBRARY_OVERVIEW.md](./LIBRARY_OVERVIEW.md) | Complete system architecture and service layer |
| [DATABASE.md](../database/DATABASE.md) | Database connection and configuration |
| [ANARCHIST_LIBRARY_ARCHITECTURE.md](../features/anarchist-library/ANARCHIST_LIBRARY_ARCHITECTURE.md) | Anarchist archive integration details |

---

## Key Features

### Search & Filtering
- **Full-text search** across title, author, description, content
- **Tag filtering** with unified tags across both collections
- **Language filter** for 27 supported languages
- **Source filter** (Library, Anarchist, or All)
- **Virtual scrolling** with sparse document caching

### Storage Architecture
- **Hybrid model**: Metadata in PostgreSQL, content on filesystem
- **File format**: Markdown with YAML frontmatter
- **Organization**: `YYYY/MM/slug.md` path structure
- **100% migration complete** from database to file storage

### Unified Tagging
- Single `shared.tags` table for all tags
- ~1,000+ tags with auto-calculated usage counts
- Auto-tagging with confidence-based keyword matching
- Cross-collection tag discovery

### Role-Based Access
- **Public users**: See public documents only
- **Authenticated users**: See public + own documents
- **Moderators**: Visibility toggle, tag management
- **Admins**: All operations including bulk import

---

## API Endpoints

### User Library (`/api/library/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/documents` | GET | List/search documents |
| `/documents` | POST | Create document |
| `/documents/[slug]` | GET/PUT/DELETE | Single document CRUD |
| `/documents/[slug]/tags` | GET/POST/DELETE | Tag management |
| `/tags` | GET/POST | List/create tags |
| `/documents/batch-update-visibility` | POST | Bulk visibility toggle |

### Anarchist Archive (`/api/documents/anarchist/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/[slug]` | GET | Get document with content |
| `/[slug]` | DELETE | Delete document (admin) |
| `/[slug]/tags` | GET/POST | Tag management |

### Unified Search (`/api/documents/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Combined search across both sources |
| `/count` | GET | Fast count-only query |
| `/languages` | GET | Available languages with counts |

### Admin Operations (`/api/library/admin/*`)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tags/import` | POST | Import anarchist tags |
| `/tags/auto-tag` | POST | Auto-tag documents |
| `/anarchist/extract-author-date` | POST | Metadata extraction |
| `/anarchist/populate-descriptions` | POST | Description generation |

---

## Database Schema

### PostgreSQL Schemas
- **library**: User-uploaded documents
- **anarchist**: Archived documents (24,643)
- **shared**: Unified tags

### Core Tables
```sql
library.library_documents     -- User documents
library.library_document_tags -- Junction table
anarchist.documents           -- Archive documents
anarchist.document_tags       -- Junction table
shared.tags                   -- Unified tag storage
```

### Key Indexes
- Full-text GIN index on title/author/notes
- B-tree indexes on slug, language, category, view_count
- Junction table indexes for tag lookups

---

## UI Components

### Main Components
- `LibraryPageClient` - Main page orchestrator with filtering
- `DocumentCard` - Grid view card component
- `LibraryListView` - Table view with sortable columns
- `TagFilterSidebar` - Filter panel with tags and language
- `VirtualizedDocuments` - Virtual scrolling with sparse cache

### State Management
- **URL State**: Filters persisted in URL for bookmarkable searches
- **Zustand Store**: Document selection for bulk operations
- **Virtual Cache**: 2,000 document limit with LRU eviction

### Performance Features
- Server-rendered initial 200 documents
- Virtual scrolling for 20,000+ documents
- Debounced filter updates (1.5s)
- Optimistic UI updates with rollback

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/library/service.ts` | Core library service |
| `src/lib/anarchist/service.ts` | Anarchist archive service |
| `src/lib/documents/service.ts` | Unified document service |
| `src/lib/library/file-service.ts` | Filesystem operations |
| `src/app/library/LibraryPageClient.tsx` | Main UI component |
| `src/hooks/useVirtualizedDocuments.ts` | Document caching hook |
| `src/hooks/useLibraryURLState.ts` | URL state management |

---

## Environment Variables

```bash
# Storage paths
LIBRARY_DOCUMENTS_PATH=/app/library-documents
ANARCHIST_LIBRARY_PATH=/app/anarchist-library

# Database
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
```

---

## Maintenance

### Regular Tasks
- Monitor PostgreSQL with `pg_stat_statements`
- VACUUM ANALYZE on document tables monthly
- Check filesystem disk usage for markdown storage

### Common Operations
```bash
# Auto-tag documents (admin API)
POST /api/library/admin/tags/auto-tag?confidence=15

# Import anarchist tags (admin API)
POST /api/library/admin/tags/import

# Check tag coverage
SELECT COUNT(*) FROM anarchist.document_tags;
```

---

## Related Documentation

- [Critical Patterns](../architecture/CRITICAL_PATTERNS.md)
- [Database Guide](../database/DATABASE.md)
- [Anarchist Library](../features/anarchist-library/README.md)
- [Common Pitfalls](../COMMON_PITFALLS.md)
