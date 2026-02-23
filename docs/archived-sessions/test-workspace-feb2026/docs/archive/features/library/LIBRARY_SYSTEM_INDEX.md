# LIBRARY SYSTEM - DOCUMENTATION INDEX

## Overview

This directory contains comprehensive documentation of the Library System - a complete document management system separate from the Wiki.

**Status**: Fully Functional (October 24, 2025)
**Current Scale**: 19 documents
**Tech Stack**: Next.js 15 + React 19 + TypeScript + SQLite (better-sqlite3)

---

## Documentation Files

### 1. LIBRARY_SYSTEM_SUMMARY.md (Quick Reference)
**Best for**: Quick overview, getting started, high-level understanding

Contains:
- Quick facts and status
- Database schema overview (table-by-table)
- Service layer summary (methods at a glance)
- API endpoint list (grouped by function)
- Key architectural decisions
- Security summary
- Current implementation status
- Next steps for enhancement

**Read this first if**: You need a quick understanding of the library system

---

### 2. LIBRARY_SYSTEM_ARCHITECTURE.md (Comprehensive Reference)
**Best for**: Deep understanding, implementation details, troubleshooting

Contains:
- Executive Summary
- Database Layer (complete schema with SQL, indexes, triggers)
- Service Layer (LibraryService class - all methods documented)
- API Layer (14 endpoints with request/response examples)
- Component Layer (5 React components - detailed breakdown)
- Type System (TypeScript interfaces - 512 lines documented)
- Cross-Database Integration patterns
- Current State & Features (what's done, what's not)
- Performance Characteristics (scaling, caching, optimization)
- Error Handling & Security architecture
- Integration Points (Auth, Users, Security)
- File Structure Reference (complete file tree)
- Deployment Checklist
- Enhancement Recommendations

**Read this when**: You need to understand how something works or implement changes

---

## Quick Navigation

### By Task

**I need to...**

- **Understand the library system** → LIBRARY_SYSTEM_SUMMARY.md
- **Add a new feature** → LIBRARY_SYSTEM_ARCHITECTURE.md (API Layer + Component Layer)
- **Fix a bug** → LIBRARY_SYSTEM_ARCHITECTURE.md (find the relevant section)
- **Optimize performance** → LIBRARY_SYSTEM_ARCHITECTURE.md (Performance Characteristics)
- **Add authentication to a route** → LIBRARY_SYSTEM_ARCHITECTURE.md (API Layer section)
- **Modify the database schema** → LIBRARY_SYSTEM_ARCHITECTURE.md (Database Layer)
- **Create a new API endpoint** → LIBRARY_SYSTEM_ARCHITECTURE.md (API Layer patterns)
- **Add a React component** → LIBRARY_SYSTEM_ARCHITECTURE.md (Component Layer)
- **Deploy changes** → LIBRARY_SYSTEM_ARCHITECTURE.md (Deployment Checklist)

### By Topic

**Database**
- Table structures: LIBRARY_SYSTEM_ARCHITECTURE.md → Database Layer
- FTS5 search: LIBRARY_SYSTEM_ARCHITECTURE.md → Database Layer (library_search_fts)
- Indexes: LIBRARY_SYSTEM_ARCHITECTURE.md → Database Layer
- Cross-database FK: LIBRARY_SYSTEM_ARCHITECTURE.md → Database Layer (section at bottom)

**Service Layer**
- LibraryService methods: LIBRARY_SYSTEM_ARCHITECTURE.md → Service Layer
- Transaction handling: LIBRARY_SYSTEM_ARCHITECTURE.md → Service Layer → Transaction Management
- Cross-database queries: LIBRARY_SYSTEM_ARCHITECTURE.md → Cross-Database Integration

**API**
- All endpoints: LIBRARY_SYSTEM_SUMMARY.md → API Endpoints section
- Security: LIBRARY_SYSTEM_ARCHITECTURE.md → API Layer (every endpoint)
- Request/response examples: LIBRARY_SYSTEM_ARCHITECTURE.md → API Layer → Route Details
- Error responses: LIBRARY_SYSTEM_ARCHITECTURE.md → Error Handling

**React**
- Component tree: LIBRARY_SYSTEM_ARCHITECTURE.md → Component Layer
- State management: LIBRARY_SYSTEM_ARCHITECTURE.md → Component Layer → LibraryPageClient
- Tag management UI: LIBRARY_SYSTEM_ARCHITECTURE.md → Component Layer → UnifiedTagManager

**Types**
- Type definitions: LIBRARY_SYSTEM_ARCHITECTURE.md → Type System
- API types: LIBRARY_SYSTEM_ARCHITECTURE.md → Type System → API Types
- Tag types: LIBRARY_SYSTEM_ARCHITECTURE.md → Type System → Tag Management Types

**Security**
- Authentication: LIBRARY_SYSTEM_ARCHITECTURE.md → Security Architecture
- Authorization: LIBRARY_SYSTEM_ARCHITECTURE.md → Security Architecture + relevant API sections
- CSRF: LIBRARY_SYSTEM_ARCHITECTURE.md → Security Architecture

---

## Key Concepts

### Database Organization

The Library System uses **library.db** (separate from wiki.db, users.db, etc.)

**8 Tables**:
1. `library_documents` - Main content (19 documents)
2. `library_search_fts` - FTS5 virtual table (auto-synced)
3. `library_tags` - Individual tags (~50)
4. `library_tag_categories` - Tag organization (4 types)
5. `library_categories` - Document categories
6. `library_document_tags` - Document-tag mapping
7. `library_document_categories` - Document-category mapping

### Service Pattern

Single `LibraryService` class with 8 methods:
- `getDocuments()` - List/search with FTS5
- `getDocumentBySlug()` - Single document
- `createDocument()` - Create (with transaction)
- `updateDocument()` - Update (with tag replacement)
- `deleteDocument()` - Delete (with authorization)
- `getCategories()` - List categories
- `getTagGroups()` - Group tags by type
- `incrementViewCount()` - Track analytics

### API Organization

**14 endpoints** in 4 groups:
- Documents (5): GET/POST /documents, GET/PUT/DELETE /[slug]
- Tags (5): GET/POST /tags, GET/POST/DELETE /[slug]/tags
- Categories (2): GET/POST /tag-categories
- Annotations (2): GET/POST /annotations

### Component Architecture

- **Server**: LibraryPage (fetches data)
- **Client**: LibraryPageClient (state management)
- **Sub-components**: UnifiedTagManager, LibraryListView, CreateDocumentModal

---

## Architectural Highlights

### Full-Text Search (FTS5)
- BM25 ranking algorithm (relevance scoring)
- Porter stemming (linguistic search)
- Auto-sync via triggers
- Fallback to LIKE if FTS5 unavailable
- ~80% cache hit rate

### Tag Management
- Hierarchical categories (primary/secondary/tertiary/general)
- Color-coded UI (blue/purple/green/gray)
- Drag-and-drop reorg (admin only)
- Usage count tracking
- Auto-assigns to "Unsorted" category

### Cross-Database Design
- Cannot use SQL JOINs across sqlite files
- Uses `getUserById()` helper to fetch user data separately
- Foreign key constraints disabled for cross-DB refs
- Application-level validation required

### Security
- Session-based (not JWT)
- Role-based authorization
- Content sanitization via DOMPurify
- Prepared statements (no string concatenation)
- CSRF protection on mutations
- CSP headers

---

## Current Capabilities

### Fully Implemented
- Full CRUD operations
- FTS5 full-text search
- Tag-based organization
- Drag-and-drop tag management
- View count tracking
- Author/publication metadata
- Document types (article, book, whitepaper, manifesto, transcript)
- Pagination (1-500 results)
- Status filtering (published/draft/archived)
- Multi-field sorting

### Partially Implemented
- Annotations (client-side only, no server persistence)
- Collections (schema exists, no UI)

### Not Yet Implemented
- PDF upload (text-only currently)
- Document revisions/history
- Server-side annotation persistence
- Page count auto-calculation

---

## Getting Started

### 1. Understanding the System (15 minutes)
Read: LIBRARY_SYSTEM_SUMMARY.md

### 2. Deep Dive into a Component (30 minutes)
Choose a section in LIBRARY_SYSTEM_ARCHITECTURE.md:
- Database Layer (how data is stored)
- Service Layer (how operations work)
- API Layer (how frontend communicates)
- Component Layer (how UI works)

### 3. Implementing a Change (60+ minutes)
Use LIBRARY_SYSTEM_ARCHITECTURE.md as reference while coding

### 4. Deploying (15 minutes)
Follow Deployment Checklist in LIBRARY_SYSTEM_ARCHITECTURE.md

---

## File Locations (Absolute Paths)

**Service & Types**:
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/service.ts` (773 lines)
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/types.ts` (170 lines)
- `/home/user/Projects/web/veritable-games-main/frontend/src/lib/library/tag-management-types.ts` (342 lines)

**API Routes**:
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/[slug]/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/documents/[slug]/tags/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/tags/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/tag-categories/route.ts`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/api/library/annotations/route.ts`

**Components**:
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/library/page.tsx`
- `/home/user/Projects/web/veritable-games-main/frontend/src/app/library/LibraryPageClient.tsx`
- `/home/user/Projects/web/veritable-games-main/frontend/src/components/library/*.tsx`

**Database**:
- `/home/user/Projects/web/veritable-games-main/frontend/data/library.db` (SQLite file)
- Schema in `/home/user/Projects/web/veritable-games-main/frontend/src/lib/database/pool.ts`

---

## Common Questions

**Q: Where is the library database?**
A: `/frontend/data/library.db` - SQLite file with 8 tables

**Q: How do documents get searched?**
A: FTS5 full-text search table (`library_search_fts`) with BM25 ranking. Falls back to LIKE query if FTS5 unavailable.

**Q: How are tags organized?**
A: Tags belong to 4 categories (primary/secondary/tertiary/general). Each category is color-coded in UI.

**Q: Can I delete a tag?**
A: No direct tag deletion (schema doesn't allow it). But you can change which documents use which tags.

**Q: Why can't I do JOINs across databases?**
A: SQLite can't enforce foreign keys across separate .db files. Uses application-level lookup instead.

**Q: Who can delete documents?**
A: Only the document author or admins. Returns 403 Forbidden otherwise.

**Q: Are annotations persisted on server?**
A: Currently client-side only (localStorage). Server logging endpoint exists but doesn't persist to DB.

**Q: What's the performance limit?**
A: ~10,000 documents before optimization needed. Currently at 19 documents.

---

## Related Documentation

- **Forums**: `/docs/forums/FORUMS_DOCUMENTATION_INDEX.md`
- **Wiki**: `/docs/architecture/WIKI_SYSTEM_ARCHITECTURE.md`
- **Projects**: `/docs/features/PROJECT_REFERENCES_ARCHITECTURE.md`
- **Database**: `/docs/architecture/DATABASE_ARCHITECTURE.md`
- **Security**: `/docs/architecture/SECURITY_ARCHITECTURE.md`
- **React Patterns**: `/docs/REACT_PATTERNS.md`
- **Commands**: `/docs/guides/COMMANDS_REFERENCE.md`

---

**Last Updated**: October 24, 2025
**Analysis Completeness**: Very Thorough (100%)
**Status**: Documentation Complete
