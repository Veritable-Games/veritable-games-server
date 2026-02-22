# Wiki System Documentation Index

## Overview
Ultra-comprehensive architectural analysis of the Veritable Games wiki system, documenting EVERY layer from database to UI.

## Documents Available

### 1. WIKI_ARCHITECTURE_COMPLETE.md (55KB, 2138 lines)
**The Complete Reference - Read this for thorough understanding**

Ultra-detailed architectural analysis covering:

#### Sections (13 Total)
1. **Executive Summary** - System overview, key stats
2. **Database Layer (wiki.db)** - All 10 tables, indexes, schemas, constraints
   - 9 core tables + 1 FTS5 virtual table
   - 30+ indexes organized by query type
   - Foreign key relationships and cascade behavior
   - Trigger implementation for FTS5 sync

3. **Service Layer Architecture** - 6 specialized services
   - WikiPageService (CRUD operations)
   - WikiRevisionService (version history)
   - WikiCategoryService (hierarchical organization)
   - WikiSearchService (FTS5 + BM25)
   - WikiTagService (flexible labeling)
   - WikiAnalyticsService (activity tracking)
   - WikiAutoCategorizer (intelligent categorization)

4. **API Routes** - 16 routes with detailed specs
   - Request/response formats
   - Validation patterns
   - Authentication/authorization
   - Error handling

5. **Frontend Components** - 17 components mapped
   - Page components (8 templates)
   - Display components (5)
   - Editing components (4)

6. **Data Flow Patterns** - 5 complete workflows
   - Page creation (user → UI → API → DB)
   - Page editing with revisions
   - Search with FTS5
   - Revision restore
   - Auto-categorization

7. **Database Transactions** - Consistency guarantees
   - Transaction usage patterns
   - Foreign key constraints
   - FTS5 sync triggers

8. **Caching Strategy** - Performance optimization
   - 3-layer cache system
   - TTLs by data type
   - Invalidation events

9. **Security & Access Control** - Authentication + RBAC
   - Session management
   - Role-based authorization
   - Content sanitization

10. **Performance Characteristics** - Benchmarks + scalability
    - Query times
    - Index coverage
    - FTS5 scaling

11. **Feature Deep Dives** - 4 complex features
    - Wikilink support
    - Categories vs Tags
    - Revision system
    - Analytics & activity logging

12. **Common Issues & Solutions** - 5 troubleshooting scenarios

13. **Testing & Quality** - Coverage analysis

## Document Usage Guide

### Quick Reference
**For a rapid understanding**: Start with WIKI_SYSTEM_SUMMARY.md (5 min read)

### Detailed Understanding
**For complete architectural knowledge**: Read WIKI_ARCHITECTURE_COMPLETE.md sections:
1. Start: Executive Summary
2. Database: Read tables you need
3. Services: Understand workflows
4. API: Know endpoint contracts
5. Frontend: Map component hierarchy

### Debugging Specific Issues
**For troubleshooting**: Jump to "Common Pitfalls & Solutions" section

### Adding New Features
**For development**: Study relevant sections:
- New page feature → WikiPageService + API routes
- New search filter → WikiSearchService (FTS5 algorithm)
- New category rule → WikiAutoCategorizer
- New activity type → WikiAnalyticsService

### Performance Optimization
**For scaling**: Read:
1. Database Layer (index strategy)
2. Caching Strategy
3. Performance Characteristics
4. FTS5 search algorithm explanation

---

## Key Concepts Quick Reference

### Database Design Patterns
1. **Slug vs Namespace** - CRITICAL: Stored separately, slug doesn't include namespace prefix
2. **Single Category Model** - Only category_id column actively used (junction table for future)
3. **FTS5 Sync** - Automatic via triggers (DELETE+INSERT for contentless tables)
4. **Revisions Append-Only** - Latest found via MAX(id), restore = new revision
5. **Cascade Delete** - Page deletion cleans up all related records

### Service Architecture
1. **Service Factory Pattern** - WikiServiceFactory.getInstance() returns centralized instance
2. **Single Responsibility** - Each service handles one domain (pages, search, categories, etc.)
3. **Prepared Statements** - All queries use parameters (no SQL injection risk)
4. **Error Handling** - Descriptive error messages, custom exception classes
5. **Caching Integration** - Services call cache.get/set directly

### Search Algorithm (FTS5)
1. **Three-Step Process** - FTS5 ranking → filtering → re-ranking
2. **BM25 Scoring** - Full-text search with relevance ranking
3. **Why Complex** - SQLite FTS5 limitation: bm25() incompatible with GROUP BY
4. **Sanitization** - Query sanitized to prevent FTS5 syntax errors
5. **Pagination** - Applied AFTER re-ranking for correct offset

### API Patterns
1. **withSecurity() Middleware** - CSP, X-Frame-Options, HSTS headers
2. **error Response()** - Handles all error types (ValidationError, AuthenticationError, etc.)
3. **Zod Validation** - Schema-based validation for input parameters
4. **Role-Based Filtering** - All list queries filter by userRole
5. **Cache Invalidation** - Manual on mutations (create/update/delete)

### Frontend Patterns
1. **Server/Client Split** - Page servers load data, Client components handle interactivity
2. **Form Components** - Use fetchJSON() wrapper for CSRF handling
3. **State Management** - Limited Zustand store, mostly direct fetch()
4. **No TanStack Query** - Removed October 2025, manual cache busting

---

## File Locations Quick Reference

### Database & Schema
- **Schema definition**: `frontend/src/lib/wiki/database.ts` (604 lines)
- **Type definitions**: `frontend/src/lib/wiki/types.ts`

### Services (6 Total)
- **Base**: `frontend/src/lib/wiki/services/`
  - WikiPageService.ts (716 lines)
  - WikiRevisionService.ts (362 lines)
  - WikiCategoryService.ts (526 lines)
  - WikiSearchService.ts (850 lines)
  - WikiTagService.ts
  - WikiAnalyticsService.ts (730 lines)
  - index.ts (service factory + backward compat)

### API Routes (16 Total)
- **Base**: `frontend/src/app/api/wiki/`
  - pages/route.ts (POST, GET list)
  - pages/[slug]/route.ts (GET, PUT, DELETE)
  - pages/[slug]/revisions/route.ts (GET, POST)
  - pages/[slug]/revisions/restore/route.ts (POST)
  - pages/[slug]/tags/route.ts (GET, PUT)
  - categories/route.ts (GET, POST)
  - categories/[id]/route.ts (GET, PUT, DELETE)
  - search/route.ts (GET)
  - activity/route.ts (GET)

### Pages (8 Templates)
- **Base**: `frontend/src/app/wiki/`
  - page.tsx (landing)
  - create/page.tsx (new page)
  - [slug]/page.tsx (view page)
  - [slug]/edit/page.tsx (edit page)
  - [slug]/history/page.tsx (revision history)
  - category/[id]/page.tsx (category view)
  - search/page.tsx (search results)

### Components (17 Total)
- **Base**: `frontend/src/components/wiki/`
  - WikiPageClient.tsx
  - WikiEditForm.tsx
  - WikiCreateForm.tsx
  - WikiSearch.tsx
  - WikiCategoriesGrid.tsx
  - WikiSearchPageClient.tsx
  - TableOfContents.tsx
  - TagEditor.tsx
  - InfoboxRenderer.tsx
  - (and 8 more...)

### Utilities
- **Auto-categorization**: `frontend/src/lib/wiki/auto-categorization.ts`
- **Database pool**: `frontend/src/lib/database/pool.ts`
- **Service registry**: `frontend/src/lib/services/registry.ts`
- **Validation schemas**: `frontend/src/lib/validation/schemas.ts`

---

## Common Questions & Where to Find Answers

### "How do I create a new wiki page?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 5 "Wiki Page Creation Flow"

### "How does search work?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 2.5 "WikiSearchService" → "Full-Text Search Algorithm"

### "What's the difference between categories and tags?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 10.2 "Categories vs Tags"

### "How do I restore a page to an old version?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 5.4 "Revision History & Restore Flow"

### "What database tables do I need to understand?"
See: WIKI_SYSTEM_SUMMARY.md → "Database Layer" → "Core Tables (9 core + 1 virtual)"

### "How is security handled?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 8 "Security & Access Control"

### "What's causing my search to return wrong results?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 11 "Common Issues & Solutions"

### "How do I scale the wiki to 100K+ pages?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 9 "Performance Characteristics" → "Scalability Limits"

### "How does auto-categorization work?"
See: WIKI_ARCHITECTURE_COMPLETE.md → Section 2.8 "Wiki Auto-Categorizer"

### "What are the API endpoints?"
See: WIKI_SYSTEM_SUMMARY.md → "API Routes (16 Total)"

---

## Development Workflow

### 1. Understanding the System
```
Day 1: Read WIKI_SYSTEM_SUMMARY.md (15 minutes)
Day 2: Read WIKI_ARCHITECTURE_COMPLETE.md sections (2 hours)
Day 3: Explore codebase by following file locations
Day 4: Trace data flows for features you'll work on
```

### 2. Making Changes
```
1. Identify which layer (DB, Service, API, Frontend)
2. Read relevant section in WIKI_ARCHITECTURE_COMPLETE.md
3. Check data flow for context
4. Review existing patterns
5. Implement following existing patterns
6. Test against documented behavior
```

### 3. Debugging Issues
```
1. Check "Common Pitfalls & Solutions" section
2. Verify database schema (wiki.db tables exist)
3. Check FTS5 triggers are firing
4. Verify role-based access control
5. Review cache invalidation
```

### 4. Scaling/Performance
```
1. Read "Performance Characteristics" section
2. Run EXPLAIN PLAN on slow queries
3. Check index coverage
4. Review cache hit rates
5. Consider PostgreSQL migration for >100K pages
```

---

## Document Statistics

| Document | Size | Lines | Purpose |
|----------|------|-------|---------|
| WIKI_ARCHITECTURE_COMPLETE.md | 55KB | 2138 | Complete reference, all layers |
| WIKI_SYSTEM_SUMMARY.md | 15KB | 432 | Quick reference, key concepts |
| WIKI_DOCUMENTATION_INDEX.md | This file | - | Navigation & quick answers |

**Total Documentation**: 70KB, 2570 lines

---

## Last Updated
October 24, 2025

## System Version
Phase 3 (Refactored Services)

## Status
Production-ready, fully functional

---

## How to Use These Documents

### For Quick Answers
1. Start here: WIKI_DOCUMENTATION_INDEX.md
2. Find section: "Common Questions & Where to Find Answers"
3. Jump to relevant document section

### For Complete Understanding
1. Read: WIKI_SYSTEM_SUMMARY.md (overview)
2. Read: WIKI_ARCHITECTURE_COMPLETE.md (deep dive)
3. Explore: File locations + code

### For Development
1. Find: Relevant section in WIKI_ARCHITECTURE_COMPLETE.md
2. Understand: Data flow pattern
3. Follow: Existing code patterns
4. Reference: API/Service signatures

### For Troubleshooting
1. Check: "Common Pitfalls & Solutions"
2. Verify: Database/schema/triggers
3. Review: Data flow for context
4. Compare: With documented patterns

---

**End of Documentation Index**

These three documents provide complete coverage of the wiki system architecture:
- WIKI_SYSTEM_SUMMARY.md - Quick reference (432 lines)
- WIKI_ARCHITECTURE_COMPLETE.md - Complete analysis (2138 lines)
- WIKI_DOCUMENTATION_INDEX.md - Navigation guide (this file)

Total: 2570 lines of comprehensive documentation covering every layer of the system.

