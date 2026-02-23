# Library System Complete Overview

**Generated**: December 24, 2025
**Status**: Production-ready
**Document Count**: ~28,500 (User Library + Anarchist Archive)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Layer](#service-layer)
3. [Database Architecture](#database-architecture)
4. [API Layer](#api-layer)
5. [UI Architecture](#ui-architecture)
6. [Search & Filtering](#search--filtering)
7. [File Storage](#file-storage)
8. [Anarchist Library Integration](#anarchist-library-integration)
9. [Performance](#performance)

---

## System Overview

The Library System is a **complete and independent document management system** handling:
- **User Library**: Community-uploaded text documents (~3,859)
- **Anarchist Archive**: Historical archive documents (24,643 in 27 languages)

### Key Characteristics
- Text-only documents (no binary/image content)
- File-based content storage with database metadata
- Unified tagging across both collections
- Virtual scrolling for 20,000+ documents
- Role-based visibility control

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│  [GET/POST/PUT/DELETE] /api/library/* + /api/documents/*    │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴──────────────────┐
    │                               │
┌───▼──────────────────┐   ┌───────▼────────────────┐
│  LibraryService      │   │  AnarchistService      │
│  (User Documents)    │   │  (Archive Documents)   │
└───┬──────────────────┘   └───────┬────────────────┘
    │                               │
    │     ┌───────────────────────┐ │
    └────►│  UnifiedDocService    │◄┘
          │  (Combined Search)    │
          └───────┬───────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼───────────────┐   ┌───────▼───────────────┐
│   PostgreSQL      │   │   Filesystem          │
│   (metadata)      │   │   (content)           │
│   library +       │   │   /app/library-docs   │
│   anarchist +     │   │   /app/anarchist-lib  │
│   shared.tags     │   │   YYYY/MM/slug.md     │
└───────────────────┘   └───────────────────────┘
```

---

## Service Layer

### LibraryService (`src/lib/library/service.ts`)

Core service for user-uploaded documents.

**Key Methods**:
- `getDocuments(params, userRole)` - Search with filtering
- `getDocumentBySlug(slug)` - Fetch single document with content
- `createDocument(input, userId)` - Create with file storage
- `updateDocument(id, input)` - Update metadata and content
- `deleteDocument(id, userId, userRole)` - Permission-checked deletion
- `getAllTags()` - Get tags with usage counts
- `incrementViewCount(documentId)` - Track popularity

**Features**:
- Role-based visibility filtering
- Parameterized SQL queries (injection-safe)
- File-first content reading with database fallback
- Transaction support for tag operations

### AnarchistService (`src/lib/anarchist/service.ts`)

Service for the Anarchist Library archive.

**Key Methods**:
- `getDocuments(params)` - Search archive documents
- `getDocumentBySlug(slug)` - Fetch with frontmatter parsing
- `getDocumentsByLanguage(lang)` - Language-filtered results
- `getAvailableLanguages()` - 27 languages with counts
- `getArchiveStats()` - Overall statistics
- `search(query)` - Full-text search
- `getMostViewedDocuments()` - Popularity ranking
- `getRelatedDocuments(docId)` - Discovery feature

### UnifiedDocumentService (`src/lib/documents/service.ts`)

Combines both collections for unified search.

**Key Features**:
- Parallel queries to both services
- Deduplication by source+id
- Merged result sorting
- Language translation support
- 1-hour cache TTL

### LibraryFileService (`src/lib/library/file-service.ts`)

Handles file system operations.

**Key Methods**:
- `getDocumentContent(filePath)` - Read markdown file
- `writeDocumentContent(filePath, content, metadata)` - Write with frontmatter
- `deleteDocumentFile(filePath)` - Remove file
- `generateFilePath(slug, date)` - Create YYYY/MM/slug.md path
- `parseFrontmatter(content)` - Extract YAML metadata

**File Format**:
```markdown
---
id: 123
slug: "document-title"
title: "Document Title"
author: "Author Name"
publication_date: "2025-01-01"
word_count: 1500
---

# Document Title

Content in markdown...
```

---

## Database Architecture

### Schema Design

```
PostgreSQL
├── library schema
│   ├── library_documents (user uploads)
│   ├── library_document_tags (junction)
│   └── linked_document_groups (translations)
├── anarchist schema
│   ├── documents (24,643 archive docs)
│   └── document_tags (junction)
└── shared schema
    └── tags (unified tag storage)
```

### Key Tables

**library.library_documents**:
- `id`, `slug`, `title`, `author`, `publication_date`
- `document_type`, `notes`, `language`, `file_path`
- `created_by`, `created_at`, `updated_at`
- `view_count`, `is_public`, `reconversion_status`

**anarchist.documents**:
- `id`, `slug`, `title`, `author`, `publication_date`
- `language`, `file_path`, `source_url`, `category`
- `document_type`, `notes`, `original_format`
- `view_count`, `is_public`, `linked_document_group_id`

**shared.tags**:
- `id`, `name`, `description`, `usage_count`
- Single source of truth for all platform tags
- Triggers maintain usage_count automatically

### Indexes

```sql
-- Lookup indexes
CREATE INDEX idx_library_documents_slug ON library.library_documents(slug);
CREATE INDEX idx_anarchist_documents_slug ON anarchist.documents(slug);

-- Filtering indexes
CREATE INDEX idx_library_documents_language ON library.library_documents(language);
CREATE INDEX idx_anarchist_documents_language ON anarchist.documents(language);
CREATE INDEX idx_library_documents_is_public ON library.library_documents(is_public);

-- Performance indexes
CREATE INDEX idx_library_documents_view_count ON library.library_documents(view_count DESC);
CREATE INDEX idx_anarchist_documents_created_at ON anarchist.documents(created_at DESC);

-- Full-text search (GIN)
CREATE INDEX idx_anarchist_documents_fulltext ON anarchist.documents
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(author, '') || ' ' || COALESCE(notes, '')));

-- Tag junction indexes
CREATE INDEX idx_library_document_tags_document ON library.library_document_tags(document_id);
CREATE INDEX idx_library_document_tags_tag ON library.library_document_tags(tag_id);
```

---

## API Layer

### Document Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/library/documents` | GET | - | List/search documents |
| `/api/library/documents` | POST | User | Create document |
| `/api/library/documents/[slug]` | GET | - | Get single document |
| `/api/library/documents/[slug]` | PUT | Owner/Admin | Update document |
| `/api/library/documents/[slug]` | DELETE | Owner/Admin | Delete document |
| `/api/documents` | GET | - | Unified search (both sources) |
| `/api/documents/count` | GET | - | Fast count query |
| `/api/documents/anarchist/[slug]` | GET | - | Get archive document |

### Tag Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/library/tags` | GET | - | List all tags |
| `/api/library/tags` | POST | User | Create tag |
| `/api/library/documents/[slug]/tags` | GET | - | Get document tags |
| `/api/library/documents/[slug]/tags` | POST | User | Add tags |
| `/api/library/documents/[slug]/tags` | DELETE | User | Remove tags |

### Admin Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/library/admin/tags/import` | POST | Admin | Import anarchist tags |
| `/api/library/admin/tags/auto-tag` | POST | Admin | Auto-tag documents |
| `/api/library/admin/anarchist/extract-author-date` | POST | Admin | Extract metadata |
| `/api/library/documents/batch-update-visibility` | POST | Mod/Admin | Bulk visibility |

### Request/Response Patterns

**Search Request**:
```
GET /api/library/documents?query=anarchism&tags=feminism&language=en&page=1&limit=50&sort=title&order=asc
```

**Search Response**:
```json
{
  "success": true,
  "data": {
    "documents": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1234,
      "totalPages": 25,
      "has_more": true
    }
  }
}
```

### Security Patterns

- CSRF protection via `withSecurity()` on POST/PUT/DELETE
- `getCurrentUser()` for authentication
- Role checks: `user.role === 'admin'`
- Parameterized queries prevent SQL injection
- Path validation prevents directory traversal

---

## UI Architecture

### Component Hierarchy

```
LibraryPage (Server Component)
└── LibraryPageClient (Client Component)
    ├── LibraryToolbar
    │   ├── Search Input
    │   ├── View Mode Toggle (Grid/List)
    │   ├── Sort Dropdown
    │   └── Create Button
    ├── TagFilterSidebar
    │   ├── Language Dropdown
    │   └── Tag Selection
    ├── VirtuosoGridView / VirtuosoListView
    │   └── DocumentCard / ListRow
    │       ├── Selection Checkbox
    │       ├── Language Badge
    │       ├── Source Badge
    │       └── Tags Display
    ├── ScrollPositionIndicator
    └── BulkDeleteModal
```

### State Management

**URL State** (`useLibraryURLState`):
- Filters persisted in URL for bookmarkable searches
- Debounced updates (1.5s) to prevent history pollution
- Parameters: `q`, `tags`, `lang`, `source`, `sort`, `order`, `idx`

**Document Cache** (`useVirtualizedDocuments`):
- Sparse caching with 2,000 document limit
- Range-based fetching with 20-doc overscan
- LRU eviction when cache full
- AbortController for fetch cancellation

**Selection Store** (`documentSelectionStore`):
- Zustand store for multi-select
- `Set<string>` for O(1) operations
- Shift+click range selection
- Ctrl+A select all

### Key Components

**DocumentCard** (`src/components/library/DocumentCard.tsx`):
- Fixed 240px height with CSS containment
- Selection checkbox, language badge, source badge
- Delete button when selected
- Private document overlay indicator

**TagFilterSidebar** (`src/components/library/TagFilterSidebar.tsx`):
- Tag list with usage counts
- Language dropdown with document counts
- Active filters display
- Admin tag deletion support

**VirtualizedDocuments Hook** (`src/hooks/useVirtualizedDocuments.ts`):
- Virtual scrolling for 20,000+ documents
- Sparse document cache
- Debounced range fetching
- First-load immediate fetch

### Keyboard Shortcuts

| Key | Action | Requirement |
|-----|--------|-------------|
| Ctrl+A | Select all visible | - |
| Shift+Click | Range select | Click on card |
| Ctrl+Click | Toggle selection | Click on card |
| Delete | Bulk delete modal | Admin, selection |
| Tab | Toggle visibility | Mod/Admin, selection |
| Escape | Clear selection | Selection exists |

---

## Search & Filtering

### Full-Text Search

**Pattern** (PostgreSQL ILIKE):
```sql
WHERE (d.title ILIKE $1 OR
       d.author ILIKE $1 OR
       d.description ILIKE $1 OR
       d.content ILIKE $1)
```

**Coverage**: Title, author, description/notes, full content

### Filter Types

1. **Tags**: Multiple selection (OR logic)
2. **Language**: Single or multiple languages
3. **Author**: ILIKE substring matching
4. **Document Type**: Exact match
5. **Source**: all / library / anarchist
6. **Visibility**: Role-based filtering

### Pagination

**Server-side**:
- Page-based or offset-based
- Default limit: 100 documents
- Response includes `has_more` boolean

**Client-side**:
- Virtual scrolling via Virtuoso
- Sparse caching (load on scroll)
- Overscan buffer: 20 documents

### Performance

- Parallel queries to both collections
- Debounced filter updates (1.5s)
- First fetch immediate (no debounce)
- AbortController for request cancellation

---

## File Storage

### Storage Locations

**Production**:
```
/app/library-documents/      (User Library)
/app/anarchist-library/      (Anarchist Archive)
```

**Development**:
```
frontend/data/library/documents
frontend/data/anarchist-library
```

### File Organization

```
YYYY/
  MM/
    document-slug-1.md
    document-slug-2.md
    ...
```

### Content Format

```markdown
---
id: 123
slug: "my-document"
title: "Document Title"
author: "Author Name"
publication_date: "2025-01-01"
document_type: "article"
notes: "Description"
language: "en"
created_by: 42
created_at: "2025-12-24T12:00:00Z"
word_count: 1500
---

# Document Title

Content in markdown...
```

### Dual-Read Strategy

1. **Primary**: Read from filesystem (`getDocumentContent`)
2. **Fallback**: Read from database content column
3. **Error handling**: Generate placeholder if file missing

---

## Anarchist Library Integration

### Overview

- **Documents**: 24,643 from Anarchist Library Network
- **Languages**: 27 supported
- **Source Format**: .muse (Emacs Muse markup)
- **Storage**: 1.3 GB markdown files

### Import Pipeline

```
.muse files (27 language zips)
    ↓ [Conversion Script]
Markdown + YAML Frontmatter
    ↓ [Docker Volume]
/app/anarchist-library/[language]/...
    ↓ [PostgreSQL Import]
anarchist.documents table
    ↓ [Tag Import]
shared.tags + anarchist.document_tags
    ↓ [Auto-tagging]
194,557 document-tag associations
```

### Tag System

**Core Categories** (8):
1. Political Theory (Anarchism, Direct Action, Autonomy)
2. Economics & Labor (Mutual Aid, Anti-Capitalism, Syndicalism)
3. Social Justice (Feminism, Anti-Racism, Prison Abolition)
4. Technology & Science (Digital Resistance, AI Ethics)
5. History & Movements (Labor History, Resistance)
6. Education & Culture (Critical Pedagogy, Philosophy)
7. Environment & Ecology (Environmental Justice, Permaculture)
8. Community & Organization (Mutual Aid Networks, Consensus)

**Auto-Tagging**:
- Keyword-based matching with confidence threshold (15%)
- Tags assigned based on title, author, content analysis
- Triggers maintain usage_count automatically

### Admin Operations

```bash
# Import tags
POST /api/library/admin/tags/import

# Auto-tag documents
POST /api/library/admin/tags/auto-tag?confidence=15

# Extract metadata
POST /api/library/admin/anarchist/extract-author-date
```

---

## Performance

### Query Optimization

| Operation | Time | Rows |
|-----------|------|------|
| Document lookup by slug | 1-3ms | 1 |
| Full-text search | 15-50ms | 20-100 |
| Tag filter | 5-25ms | 50-500 |
| Language filter | 5-10ms | 500-5,000 |
| Popular by views | 10-20ms | 100 |

### Caching Strategy

- **Document cache**: 2,000 document limit (client)
- **Service cache**: 5-minute TTL for `getAllDocuments`
- **Tag counts**: Maintained via database triggers

### Scaling Considerations

- Parallel queries to both collections
- Sparse caching prevents memory bloat
- Index-first query planning
- Virtual scrolling for large result sets

---

## Quick Reference

### Environment Variables

```bash
LIBRARY_DOCUMENTS_PATH=/app/library-documents
ANARCHIST_LIBRARY_PATH=/app/anarchist-library
DATABASE_URL=postgresql://...
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/library/service.ts` | Core library service |
| `src/lib/anarchist/service.ts` | Archive service |
| `src/lib/documents/service.ts` | Unified search |
| `src/lib/library/file-service.ts` | File operations |
| `src/app/library/LibraryPageClient.tsx` | Main UI |
| `src/hooks/useVirtualizedDocuments.ts` | Virtual scrolling |

### Common Issues

- **Document not found**: Check slug encoding, verify is_public
- **Tags missing**: Check shared.tags table, verify junction entries
- **Search slow**: Check indexes, verify query parameters
- **File read error**: Check LIBRARY_DOCUMENTS_PATH, verify permissions
