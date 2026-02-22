# Forums System Documentation Index

## Overview

This directory contains comprehensive documentation for the forums system in Veritable Games. The forums implement a specialized service-oriented architecture with 6 domain services, repository layer, and real-time event broadcasting.

---

## Documentation Files

### 1. **FORUMS_SERVICES_SUMMARY.md** ⭐ START HERE
**Best for**: Quick overview, executive summary, key insights
- 489 lines
- Service specialization matrix
- Data flow diagrams
- Caching strategy
- Common tasks
- Performance benchmarks

**When to read**: New to forums, want 15-minute overview

---

### 2. **FORUMS_SERVICES_ARCHITECTURE.md** 📘 COMPREHENSIVE REFERENCE
**Best for**: Deep dive, complete technical details, implementation patterns
- 1,161 lines
- Complete service signatures and methods
- Repository layer details
- Result pattern explanation
- Bit flags documentation
- Error handling patterns
- Data flow examples
- Cross-service dependencies

**Sections**:
- Executive Summary
- Architecture Overview (layered diagram)
- Service Architecture Details (all 6 services)
- Repository Layer Architecture
- Result Pattern Implementation
- Bit Flags Implementation
- Data Flow Examples (creating topic, searching, pinning)
- Caching Strategy
- Cross-Service Dependencies
- Database Connection Patterns
- Error Handling Patterns
- Real-Time Event System
- Performance Characteristics

**When to read**: Working on forums features, understanding architecture

---

### 3. **FORUMS_API_QUICK_REFERENCE.md** 💻 PRACTICAL GUIDE
**Best for**: Code examples, API usage, copy-paste patterns
- 450+ lines
- Service imports and usage
- Method signatures with examples
- Error handling patterns
- Common patterns
- Type definitions

**Sections**:
- Service Imports
- ForumService API (Topic, Reply, Category operations)
- ForumModerationService API (Pin, Lock, Solve, Delete)
- ForumSearchService API (Search, Quick Search, Suggestions)
- ForumStatsService API (Forum, Category, User stats)
- ForumCategoryService API
- ForumSectionService API
- Utility Functions
- Status Flags (Bit Operations)
- Real-Time Events
- Error Handling Examples
- Common Patterns

**When to read**: Writing forums code, need examples

---

### 4. **FORUMS_DOCUMENTATION_INDEX.md** 📑 THIS FILE
**Best for**: Navigation, understanding what docs exist
- You are here

---

## Quick Navigation by Task

### I want to...

**Understand the system architecture**
- Read: `FORUMS_SERVICES_SUMMARY.md` (10 min)
- Then: `FORUMS_SERVICES_ARCHITECTURE.md` architecture overview (20 min)

**Create a new feature (e.g., create topic)**
- Read: `FORUMS_API_QUICK_REFERENCE.md` → ForumService section
- Reference: `FORUMS_SERVICES_ARCHITECTURE.md` → ForumService details

**Implement moderation (e.g., pin topics)**
- Read: `FORUMS_API_QUICK_REFERENCE.md` → ForumModerationService section
- Reference: `FORUMS_SERVICES_ARCHITECTURE.md` → ForumModerationService details

**Add search functionality**
- Read: `FORUMS_API_QUICK_REFERENCE.md` → ForumSearchService section
- Reference: `FORUMS_SERVICES_ARCHITECTURE.md` → ForumSearchService details

**Get forum statistics**
- Read: `FORUMS_API_QUICK_REFERENCE.md` → ForumStatsService section
- Reference: `FORUMS_SERVICES_ARCHITECTURE.md` → ForumStatsService details

**Understand error handling**
- Read: `FORUMS_SERVICES_ARCHITECTURE.md` → Result Pattern Implementation
- Reference: `FORUMS_API_QUICK_REFERENCE.md` → Error Handling Examples

**Understand caching**
- Read: `FORUMS_SERVICES_SUMMARY.md` → Caching Strategy
- Deep dive: `FORUMS_SERVICES_ARCHITECTURE.md` → Caching Strategy section

**Understand status flags**
- Read: `FORUMS_SERVICES_SUMMARY.md` → Status Flags
- Deep dive: `FORUMS_SERVICES_ARCHITECTURE.md` → Bit Flags Implementation

**Implement real-time updates**
- Read: `FORUMS_SERVICES_ARCHITECTURE.md` → Real-Time Event System
- Reference: `FORUMS_API_QUICK_REFERENCE.md` → Real-Time Events

**Handle database queries**
- Read: `FORUMS_SERVICES_ARCHITECTURE.md` → Database Connection Patterns
- Reference: `FORUMS_SERVICES_ARCHITECTURE.md` → Repository Layer Architecture

---

## Service Quick Reference

### ForumService (Core Operations)
- **Purpose**: Topic and reply CRUD, category management, permissions, activity logging
- **Caches**: Topic cache (500 items, 5 min), Category cache (50 items, 15 min)
- **Key Methods**: createTopic, getTopic, updateTopic, deleteTopic, createReply, updateReply, deleteReply, markReplyAsSolution
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 1
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumService section

### ForumModerationService (Moderation)
- **Purpose**: Moderation actions (pin, lock, solve, delete) with real-time events
- **Key Methods**: pinTopic, unpinTopic, lockTopic, unlockTopic, markTopicAsSolved, archiveTopic, deleteTopic
- **Events**: Broadcasts SSE events for all actions
- **Requires**: Moderator/admin permissions
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 2
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumModerationService section

### ForumSearchService (Search & Discovery)
- **Purpose**: Full-text search with filtering, suggestions, recent searches
- **Caches**: Search cache (200 items, 10 min), Suggestions cache (100 items, 30 min)
- **Technology**: SQLite FTS5
- **Key Methods**: search, quickSearch, getSuggestions, getRecentSearches
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 3
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumSearchService section

### ForumStatsService (Analytics)
- **Purpose**: Forum statistics, category stats, user contribution stats, trending
- **Caches**: 3 separate LRU caches for different stat types (5 min TTL)
- **Key Methods**: getForumStats, getCategoryStats, getUserForumStats, getTrendingTopics, getActiveUsers
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 4
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumStatsService section

### ForumCategoryService (Categories)
- **Purpose**: Category CRUD with role-based filtering
- **Key Methods**: getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory
- **Design**: Simple throw-on-error (not Result-based)
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 5
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumCategoryService section

### ForumSectionService (Sections)
- **Purpose**: Section management (major category groupings)
- **Key Methods**: getAllSections, getSectionById, updateSectionName, reorderSections
- **Design**: Simple throw-on-error with transaction support
- **Reference**: `FORUMS_SERVICES_ARCHITECTURE.md` → Section 6
- **Examples**: `FORUMS_API_QUICK_REFERENCE.md` → ForumSectionService section

---

## Key Concepts

### Result Pattern
**What**: Type-safe error handling without exceptions
**Why**: Compile-time safety, explicit error handling, composable operations
**How**: Check `result.isOk()` before accessing `result.value`
**Learn more**: `FORUMS_SERVICES_ARCHITECTURE.md` → Result Pattern Implementation

### Bit Flags
**What**: Multiple states (locked, pinned, solved, etc.) packed into 1 INTEGER
**Why**: Efficient storage, fast bitwise operations, 6 states in 32-bit int
**How**: Use `hasFlag()`, `addFlag()`, `removeFlag()` utilities
**Learn more**: `FORUMS_SERVICES_SUMMARY.md` → Status Flags or `FORUMS_SERVICES_ARCHITECTURE.md` → Bit Flags Implementation

### LRU Caching
**What**: 7 separate caches across services
**Why**: Performance optimization, cache locality
**How**: Automatic eviction by LRU policy
**Learn more**: `FORUMS_SERVICES_SUMMARY.md` → Caching Strategy or `FORUMS_SERVICES_ARCHITECTURE.md` → Caching Strategy section

### SSE Events
**What**: Server-Sent Events for real-time updates
**Why**: Real-time moderation notifications to clients
**How**: `forumEventBroadcaster.broadcast()` from service, `useForumEvents()` on client
**Learn more**: `FORUMS_SERVICES_ARCHITECTURE.md` → Real-Time Event System or `FORUMS_API_QUICK_REFERENCE.md` → Real-Time Events

### Repository Pattern
**What**: Data access layer abstraction
**Why**: Separation of concerns, easier testing, consistent error handling
**How**: All repositories extend BaseRepository, return Result<T, RepositoryError>
**Learn more**: `FORUMS_SERVICES_ARCHITECTURE.md` → Repository Layer Architecture

---

## File Locations

### Service Files
```
frontend/src/lib/forums/
├── services/
│   ├── index.ts
│   ├── ForumService.ts              (1,200 LOC)
│   ├── ForumModerationService.ts    (600 LOC)
│   ├── ForumSearchService.ts        (500 LOC)
│   ├── ForumStatsService.ts         (400 LOC)
│   ├── ForumCategoryService.ts      (150 LOC)
│   └── ForumSectionService.ts       (100 LOC)
```

### Repository Files
```
frontend/src/lib/forums/
├── repositories/
│   ├── index.ts
│   ├── base-repository.ts           (200 LOC)
│   ├── topic-repository.ts          (400 LOC)
│   ├── reply-repository.ts          (350 LOC)
│   ├── category-repository.ts       (200 LOC)
│   └── search-repository.ts         (300 LOC)
```

### Supporting Files
```
frontend/src/lib/forums/
├── service.ts                       (legacy wrapper)
├── types.ts                         (type definitions)
├── validation.ts                    (Zod schemas)
├── status-flags.ts                  (bit flag operations)
├── events.ts                        (SSE event types)
├── branded-types.ts                 (branded type definitions)
└── branded-helpers.ts               (type conversion helpers)
```

---

## Code Statistics

| Component | Files | Lines | Avg Size |
|-----------|-------|-------|----------|
| Services | 6 | 2,950 | 492 |
| Repositories | 5 | 1,450 | 290 |
| Supporting files | 7 | 2,200 | 314 |
| **Total** | **18** | **6,600** | - |

---

## Related Documentation

- **Parent**: `/docs/README.md` - All documentation index
- **Architecture**: `/docs/architecture/` - System-wide architecture docs
- **Database**: `/docs/DATABASE.md` - Database architecture
- **React Patterns**: `/docs/REACT_PATTERNS.md` - React/Next.js patterns used in forums
- **API Routes**: `/frontend/src/app/api/forums/` - API route implementations
- **Components**: `/frontend/src/components/forums/` - Forum UI components

---

## Key Files to Study

### For Understanding Core Flow
1. `ForumService.ts` - 1,200 LOC, main operations
2. `topic-repository.ts` - 400 LOC, data access
3. `/app/api/forums/topics/route.ts` - API route using ForumService

### For Understanding Advanced Features
1. `ForumModerationService.ts` - Real-time event broadcasting
2. `ForumSearchService.ts` - FTS5 full-text search
3. `ForumStatsService.ts` - Caching patterns
4. `status-flags.ts` - Bit flag operations

### For Understanding Error Handling
1. `base-repository.ts` - Repository error handling
2. `/lib/utils/result.ts` - Result pattern implementation
3. `ForumService.ts` - Result pattern usage at service level

---

## Learning Path

### Beginner (0-2 hours)
1. Read `FORUMS_SERVICES_SUMMARY.md` (15 min)
2. Scan `FORUMS_SERVICES_ARCHITECTURE.md` overview (15 min)
3. Look at code example: `ForumService.createTopic()` (30 min)
4. Look at code example: API route using service (30 min)

### Intermediate (2-4 hours)
1. Deep read `FORUMS_SERVICES_ARCHITECTURE.md` (1.5 hours)
2. Study bit flags implementation (30 min)
3. Study Result pattern implementation (30 min)
4. Study repository layer (1 hour)

### Advanced (4+ hours)
1. Trace complete request flow (topic creation) (1 hour)
2. Understand caching strategy and invalidation (1 hour)
3. Understand SSE event broadcasting (1 hour)
4. Study moderation service implementation (1 hour)
5. Study search service FTS5 queries (1 hour)

---

## Common Questions

**Q: Where do I find documentation for...?**
- Architecture overview → `FORUMS_SERVICES_SUMMARY.md`
- Specific service details → `FORUMS_SERVICES_ARCHITECTURE.md`
- Code examples → `FORUMS_API_QUICK_REFERENCE.md`
- Type definitions → `frontend/src/lib/forums/types.ts`

**Q: How do I...?**
- Create a topic → `FORUMS_API_QUICK_REFERENCE.md` → ForumService section
- Search forums → `FORUMS_API_QUICK_REFERENCE.md` → ForumSearchService section
- Implement moderation → `FORUMS_API_QUICK_REFERENCE.md` → ForumModerationService section
- Handle errors → `FORUMS_API_QUICK_REFERENCE.md` → Error Handling Examples

**Q: What's the difference between...?**
- Result vs Exception → `FORUMS_SERVICES_ARCHITECTURE.md` → Result Pattern
- Service vs Repository → `FORUMS_SERVICES_ARCHITECTURE.md` → Service Architecture Details
- Cached vs Uncached → `FORUMS_SERVICES_SUMMARY.md` → Caching Strategy
- Bit flag vs Boolean → `FORUMS_SERVICES_SUMMARY.md` → Status Flags

**Q: Where should I make changes?**
- Core CRUD logic → `ForumService.ts`
- Data access → `repositories/*-repository.ts`
- Moderation → `ForumModerationService.ts`
- Search → `ForumSearchService.ts`
- API endpoints → `/app/api/forums/*`

---

## Updates & Maintenance

**Last Updated**: October 24, 2025
**Architecture Version**: Current main branch
**Service Count**: 6 (ForumService, ForumModerationService, ForumSearchService, ForumStatsService, ForumCategoryService, ForumSectionService)
**Repository Count**: 4 (TopicRepository, ReplyRepository, CategoryRepository, SearchRepository)
**Caches**: 7 separate LRU caches across services
**Database Tables**: 9 (forums.db)
**Event Types**: 14+ SSE event types

---

## Getting Help

- **Architecture questions**: Check `FORUMS_SERVICES_ARCHITECTURE.md`
- **Code examples**: Check `FORUMS_API_QUICK_REFERENCE.md`
- **Conceptual questions**: Check `FORUMS_SERVICES_SUMMARY.md`
- **Source code**: Read actual service files in `frontend/src/lib/forums/`

---

**Happy coding!** 🚀

*These documents were generated through thorough codebase analysis on October 24, 2025.*
