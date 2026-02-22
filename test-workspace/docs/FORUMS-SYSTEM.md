# Forums System Architecture

Deep dive into the forums system implementation, including service architecture, components, caching, and known issues.

## Overview

The forums system implements a **factory-based service architecture** with 5 specialized services, multi-tier caching, and cross-domain integration via ProfileAggregatorService. The system is fully functional despite documentation indicating removal.

## Service Layer Structure

### ForumServiceFactory (Singleton Pattern)

- `ForumCategoryService` - Category CRUD + statistics
- `ForumTopicService` - Topic CRUD + moderation (pinning, locking)
- `ForumReplyService` - Reply CRUD + solution marking + nested threading
- `ForumSearchService` - FTS5 search with LIKE fallback
- `ForumAnalyticsService` - Statistics + engagement metrics

### Key Patterns

- **100% adapter compliance**: All services use `dbAdapter.query(sql, params, { schema: 'forums' })`
- **22 transactions**: For data consistency (solution marking, counters, metadata)
- **Result pattern**: Type-safe error handling (though services use exceptions for simplicity)
- **Graceful degradation**: FTS5 search falls back to LIKE queries when table missing

## Frontend Components (NOT Removed)

**CRITICAL DISCREPANCY**: Documentation states "Forum UI Removed (Oct 2025)" but **18 components (~4,208 LOC) still exist**:

### Active Page Routes

- `/forums` - Forum home (Server Component)
- `/forums/browse` - Browse topics (Client Component)
- `/forums/topic/[id]` - Topic detail (Server Component)
- `/forums/category/[slug]` - Category view (Server Component)
- `/forums/search` - Search results (Client Component)
- `/forums/create` - Create topic (Client Component)

### Key Components

- `TopicView.tsx` (683 lines) - Topic display with inline editing, moderation
- `ReplyList.tsx` (755 lines) - Reply tree rendering with conversation grouping
- `ForumCategoryList.tsx` (158 lines) - Category listing
- `ConversationGroup.tsx` (~200 lines) - Collapsible conversation threads

### State Management

- React Context for authentication (`useAuth()`)
- Custom hooks for conversation state (`useConversationState`)
- NO TanStack Query (uses native `fetch()` + `router.refresh()`)

### Stub Code Found

- Toast notifications stubbed (monitoring removed)
- Analytics tracking stubbed (APM removed)

## API Endpoints (11 active)

| Endpoint | Methods | Security | Notes |
|----------|---------|----------|-------|
| `/api/forums/categories` | GET | ✅ withSecurity | List categories |
| `/api/forums/topics` | GET, POST | ⚠️ GET public, POST protected | Create/list topics |
| `/api/forums/topics/[id]` | GET, PATCH, DELETE | ✅ Protected | Topic operations |
| `/api/forums/topics/[id]/pin` | POST, DELETE | ✅ Admin only | Pin/unpin |
| `/api/forums/topics/[id]/lock` | POST, DELETE | ✅ Admin only | Lock/unlock |
| `/api/forums/replies` | POST | ✅ Protected | Create reply |
| `/api/forums/replies/[id]` | PATCH, DELETE | ✅ Protected | Edit/delete reply |
| `/api/forums/replies/[id]/solution` | POST, DELETE | ✅ Topic author/admin | Mark solution |
| `/api/forums/search` | GET | ✅ Public with rate limit stub | FTS5 search |
| `/api/forums/stats` | GET | ❌ Missing withSecurity | Forum statistics |

### Security Notes

- CSRF protection enabled (double submit cookie pattern + `sameSite: 'strict'`)
- 94% endpoints use `withSecurity` wrapper (CSRF validation + security headers)

## Search Implementation

### FTS5 Configuration (MISSING TABLE)

```sql
-- Expected but does NOT exist in forums.db
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  content_id UNINDEXED, content_type UNINDEXED,
  title, content, author_username, category_name,
  tokenize='porter unicode61 remove_diacritics 2'
);
```

### Current State

- Code references `forum_search_fts` but table doesn't exist
- All searches fall back to LIKE queries (slow)
- Missing 6 triggers for automatic index sync
- ForumSearchService has graceful degradation

### Search Features

- BM25 ranking algorithm (when FTS5 available)
- Snippet generation with `<mark>` highlighting
- Type filtering (topics vs replies)
- Category and author filtering

## Caching Strategy

### Multi-Tier Caching

1. **Reply Tree Cache** (`replyTreeCache.ts`):
   - Max 100 topics, 30-minute TTL
   - Stores processed reply trees with conversation metadata
   - LRU eviction + staleness checking
   - Invalidated on reply create/update/delete/solution marking

2. **LRU Cache Manager** (`cache/manager.ts`):
   - Policy-based TTLs (search: 30min, content: 2hr, api: 10min)
   - Tag-based invalidation
   - Cache warming for critical data
   - 81+ invalidation points across forum services

### Cache Invalidation Pattern

```typescript
// Topic creation
cache.delete(['forum', 'topics']);
cache.delete(['forum', 'categories']);

// Reply creation
replyTreeCache.invalidate(topicId);

// Solution marking
replyTreeCache.invalidate(topicId);
```

## Cross-Domain Integration

### ProfileAggregatorService Pattern

- Concurrent `Promise.allSettled()` calls to specialized services
- Circuit breaker protection (5 failures, 30s reset)
- Privacy-aware data filtering
- 5-minute cache with LRU eviction

### Forum Integration Example

```typescript
// ForumServiceAdapter wraps ForumService
async getUserForumStats(userId) {
  // Query forums schema
  const stats = await forumAnalyticsService.getUserForumStats(userId);
  // Fetch user data from users schema (cross-schema)
  const userResult = await dbAdapter.query(
    'SELECT * FROM users WHERE id = ?',
    [userId],
    { schema: 'users' }
  );
  const user = userResult.rows[0];
  // Merge and return
  return { ...stats, username: user.username };
}
```

**No Cross-Schema JOINs**: Architectural decision respected, data fetched separately then merged at service layer.

## Performance Characteristics

### Database

- WAL mode enabled (10x concurrency improvement)
- Connection pool: 50 max, LRU eviction
- Prepared statements throughout (SQL injection prevention)

### Benchmarks

- Cache read: >50,000 ops/sec, <0.1ms latency
- FTS5 query: 5-30ms (when table exists)
- LIKE fallback: 50-200ms (current state)
- Reply tree cache hit rate: ~70% (30-min TTL)

## Known Issues & Action Items

### Critical (Immediate)

1. ✅ Create missing `forum_search_fts` table with 6 sync triggers
2. ✅ Add `withSecurity` wrapper to `/api/forums/stats` endpoint
3. ✅ Update documentation: Forum UI is NOT removed (18 components exist)
4. ✅ Remove duplicate tables from forums.db (wiki, projects, library, users)
5. ✅ Move 18,603 monitoring logs from forums.db → system.db

### Medium Priority

6. Replace stub hooks (toast, analytics) with actual implementations or remove
7. Implement rate limiting (currently not enabled)
8. Add Zod validation to `POST /api/forums/topics` (uses manual validation)
9. Fix N+1 query in ForumAnalyticsService.getTopContributors() (batch fetch usernames)

### Low Priority

10. Split large components (ReplyList 755 lines, TopicView 683 lines)
11. Add virtual scrolling for long topic/reply lists
12. Implement optimistic updates for all mutations (currently only solution marking)
13. Add event-driven architecture (event bus for decoupling)

## Best Practices Demonstrated

### ✅ Excellent Patterns

- Factory pattern for service organization
- Transaction management for data consistency
- Multi-tier caching with intelligent invalidation
- Async mention processing (non-blocking via `setImmediate`)
- Privacy-aware cross-domain aggregation
- Circuit breaker for fault tolerance
- Graceful degradation (FTS5 → LIKE fallback)

### ⚠️ Areas for Improvement

- Error handling inconsistency (exceptions vs Result pattern)
- User table duplication across databases
- Stub code indicates incomplete feature removal
- Documentation severely outdated

## Related Documentation

- [Database Architecture](.claude/database.md) - Database bloat issues and cleanup procedures
- [Troubleshooting](.claude/troubleshooting.md) - Forum-specific error solutions
- [Commands Reference](.claude/commands.md) - Forum initialization and testing commands
