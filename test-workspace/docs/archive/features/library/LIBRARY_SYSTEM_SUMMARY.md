# LIBRARY SYSTEM - EXECUTIVE SUMMARY

## Quick Facts

- **Status**: Fully Functional
- **Database**: `/frontend/data/library.db` (SQLite)
- **Size**: 19 documents as of October 2025
- **Tech Stack**: Next.js 15 + React 19 + TypeScript + better-sqlite3
- **Architecture**: Completely separate from Wiki system
- **Key Features**: CRUD, FTS5 search, tag system, annotations

## Database Schema (8 Tables)

| Table | Purpose | Records |
|-------|---------|---------|
| `library_documents` | Main content storage | ~19 |
| `library_search_fts` | Full-text search virtual table | auto-synced |
| `library_tags` | Individual tags | ~50 (estimated) |
| `library_tag_categories` | Tag organization (4 types) | 4 |
| `library_categories` | Document categories | variable |
| `library_document_tags` | Document-tag mapping | variable |
| `library_document_categories` | Document-category mapping | variable |
| `library_search_fts` (virtual) | FTS5 search index | auto-synced |

## Service Layer (1 Class)

**LibraryService** (773 lines)
- `getDocuments()` - List/search with pagination
- `getDocumentBySlug()` - Single document fetch
- `createDocument()` - Create new document
- `updateDocument()` - Update document
- `deleteDocument()` - Delete with authorization
- `getCategories()` - List categories
- `getTagGroups()` - Group tags by category
- `incrementViewCount()` - Track views

## API Endpoints (14 routes)

### Documents (5 endpoints)
- `GET /api/library/documents` - List/search
- `POST /api/library/documents` - Create
- `GET /api/library/documents/[slug]` - Get
- `PUT /api/library/documents/[slug]` - Update
- `DELETE /api/library/documents/[slug]` - Delete

### Tags (5 endpoints)
- `GET /api/library/tags` - List all
- `POST /api/library/tags` - Create tag
- `GET /api/library/documents/[slug]/tags` - Get doc tags
- `POST /api/library/documents/[slug]/tags` - Add tags
- `DELETE /api/library/documents/[slug]/tags` - Remove tag

### Categories (2 endpoints)
- `GET /api/library/tag-categories` - List
- `POST /api/library/tag-categories` - Create

### Annotations (2 endpoints)
- `GET /api/library/annotations` - Fetch
- `POST /api/library/annotations` - Log

## React Components (5 main)

1. **LibraryPageClient** - State management wrapper
2. **UnifiedTagManager** - Tag filtering + drag/drop
3. **LibraryListView** - Table view
4. **CreateDocumentModal** - Create form
5. **LibraryAnnotationOverlay** - Annotations UI

## Type System

**File**: `/lib/library/types.ts` (170 lines)
- Database types (LibraryDocument, LibraryTag, etc.)
- API types (CreateInput, UpdateInput, SearchParams)
- Response types (SearchResult, WithMetadata)

**File**: `/lib/library/tag-management-types.ts` (342 lines)
- Branded types for type safety
- Drag/drop types
- Admin operation types
- UI constants

## Key Architectural Decisions

### 1. Text-Only Storage
- Content stored in database (not files)
- Markdown format support
- No PDF upload (yet)

### 2. FTS5 Search
- Porter stemming (linguistic search)
- BM25 ranking (relevance scoring)
- Auto-synced via triggers
- Fallback to LIKE queries

### 3. Cross-Database References
- Cannot enforce FK across separate SQLite files
- Uses application logic (getUserById helper)
- No JOINs between library.db and users.db

### 4. Tag Organization
- Hierarchical categories (primary/secondary/tertiary/general)
- Color-coded UI (blue/purple/green/gray)
- Drag-and-drop reorg (admin only)
- Auto-assigns new tags to "Unsorted"

### 5. Authorization
- Author-based deletion rights
- Admin/moderator for tag operations
- Status-based visibility (published/draft/archived)

## Security Architecture

- **Authentication**: Session-based (not JWT)
- **Authorization**: Role-based (admin, moderator, user)
- **Validation**: Zod schemas
- **Sanitization**: DOMPurify for HTML
- **SQL Injection**: Prepared statements only
- **Cross-Site**: CSP headers + CSRF (POST/PUT/DELETE)

## Performance Characteristics

- **Scale**: ~10,000 documents before optimization needed
- **Search**: ~80% FTS5 cache hit rate
- **Pagination**: Default 100, max 500 per page
- **Indexes**: 3 indexes (slug, status, type)
- **WAL Mode**: Better concurrency, auto-checkpoint

## Integration Points

1. **Auth System** - User IDs, sessions
2. **Users Database** - Username, display_name
3. **Security Middleware** - Headers, CSRF, CSP
4. **Content Sanitization** - DOMPurify
5. **Database Pool** - Singleton connection management

## Current State

### Implemented (100%)
- Full CRUD operations
- FTS5 search
- Tag system
- Drag-and-drop UI
- View count tracking
- Author metadata
- Document types

### Partially Done (50%)
- Annotations (client-side only)
- Collections (schema exists)

### Not Yet (0%)
- PDF upload
- Document revisions
- Server-side annotations
- Page auto-calculation

## Files Reference

```
src/
├── lib/library/
│   ├── service.ts              (773 lines) - Business logic
│   ├── types.ts                (170 lines) - Core types
│   └── tag-management-types.ts (342 lines) - Tag system types
├── app/library/
│   ├── page.tsx                - Server component
│   ├── LibraryPageClient.tsx   - State manager
│   └── api/library/
│       ├── documents/route.ts
│       ├── tags/route.ts
│       └── tag-categories/route.ts
└── components/library/
    ├── UnifiedTagManager.tsx
    ├── LibraryListView.tsx
    ├── CreateDocumentModal.tsx
    └── LibraryAnnotationOverlay.tsx
```

## Key Constants

**Document Types**: article, book, whitepaper, manifesto, transcript
**Tag Category Types**: primary (blue), secondary (purple), tertiary (green), general (gray)
**Document Status**: published, draft, archived
**Search Limits**: 1-500 results per page

## Next Steps

1. **High Priority**
   - Server-side annotation persistence
   - Document revisions/history
   - Page auto-calculation from markdown

2. **Medium Priority**
   - PDF upload support
   - Collections implementation
   - Export as PDF

3. **Low Priority**
   - PostgreSQL migration (if >10k docs)
   - Advanced search filters
   - Similarity detection

---

**Complete Detailed Documentation**: See `/docs/features/LIBRARY_SYSTEM_ARCHITECTURE.md`
