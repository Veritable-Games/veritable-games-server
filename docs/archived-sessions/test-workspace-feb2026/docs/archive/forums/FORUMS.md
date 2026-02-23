# Forums System Architecture

Complete architecture documentation for the forums system.

## Status: ✅ Fully Functional

Despite docs previously stating "removed Oct 2025", the forum system is **complete and active**:
- 18 components (~4,208 LOC)
- 6 page routes
- 5 specialized services (factory pattern)
- FTS5 full-text search
- Optimistic UI with React 19's `useOptimistic`

## Service Layer (Factory Pattern)

**ForumServiceFactory** (Singleton):
- `ForumCategoryService` - Category CRUD + statistics
- `ForumTopicService` - Topic CRUD + moderation
- `ForumReplyService` - Reply CRUD + solution marking + threading
- `ForumSearchService` - FTS5 search with LIKE fallback
- `ForumAnalyticsService` - Statistics + engagement metrics

**Key Features**:
- 100% `dbPool.getConnection('forums')` compliance
- 22 transactions for data consistency
- Lazy initialization (via getters)
- Graceful FTS5 fallback to LIKE queries

## Frontend Components (18 Active)

**Pages** (6 routes):
- `/forums` - Home (Server Component)
- `/forums/browse` - Browse topics (Client)
- `/forums/topic/[id]` - Topic detail (Server)
- `/forums/category/[slug]` - Category view (Server)
- `/forums/search` - Search results (Client)
- `/forums/create` - Create topic (Client)

**Key Components**:
- `TopicView.tsx` (290 lines) - Refactored from 683 lines
- `ReplyList.tsx` (755 lines) - Optimistic UI for replies
- `ForumCategoryList.tsx` (158 lines)
- `ConversationGroup.tsx` (~200 lines) - Collapsible threads

## API Endpoints (11 Active)

| Endpoint | Methods | Security | Notes |
|----------|---------|----------|-------|
| `/api/forums/categories` | GET | ✅ | List categories |
| `/api/forums/topics` | GET, POST | ⚠️ Mixed | Create/list |
| `/api/forums/topics/[id]` | GET, PATCH, DELETE | ✅ | CRUD |
| `/api/forums/topics/[id]/pin` | POST, DELETE | ✅ Admin | Pin/unpin |
| `/api/forums/topics/[id]/lock` | POST, DELETE | ✅ Admin | Lock/unlock |
| `/api/forums/replies` | POST | ✅ | Create reply |
| `/api/forums/replies/[id]` | PATCH, DELETE | ✅ | Edit/delete |
| `/api/forums/replies/[id]/solution` | POST, DELETE | ✅ | Mark solution |
| `/api/forums/search` | GET | ✅ | FTS5 search |
| `/api/forums/stats` | GET | ❌ Missing | Statistics |

**Note**: CSRF removed Oct 2025 (relies on sameSite cookies)

## Search Implementation

**FTS5 Configuration**:
```sql
CREATE VIRTUAL TABLE forum_search_fts USING fts5(
  content_id UNINDEXED,
  content_type UNINDEXED,
  title, content, author_username, category_name,
  tokenize='porter unicode61 remove_diacritics 2'
);
```

**Current State**: ✅ Active with 115 indexed rows
**Performance**: 5-30ms queries
**Features**: BM25 ranking, snippet generation, type filtering

## Caching Strategy

**Multi-Tier**:
1. **Reply Tree Cache** - Max 100 topics, 30-min TTL, LRU eviction
2. **LRU Cache Manager** - Policy-based TTLs (search: 30min, content: 2hr)
3. **Tag-based invalidation** - 81+ invalidation points

**Cache Invalidation**:
```typescript
// Topic creation
cache.delete(['forum', 'topics']);
cache.delete(['forum', 'categories']);

// Reply creation
replyTreeCache.invalidate(topicId);
```

## Optimistic UI (October 2025)

**Reply Creation**:
```typescript
const [optimisticReplies, addOptimisticReply] = useOptimistic(
  replies,
  (current, newReply) => [...current, newReply]
);

// Instant UI update (0ms)
addOptimisticReply(tempReply);
// API in background
await fetch('/api/forums/replies', ...);
// Sync with server
router.refresh();
```

**Reply Editing**:
```typescript
const [optimisticContent, setOptimisticContent] = useOptimistic(
  reply.content,
  (_, newContent) => newContent
);

// Instant update + rollback on error
setOptimisticContent(newContent);
setIsEditing(false);
try {
  await fetch(`/api/forums/replies/${id}`, ...);
} catch {
  setOptimisticContent(previousContent);
  setIsEditing(true);
}
```

## Performance

**Database**:
- WAL mode (10x concurrency improvement)
- Connection pool: 50 max, LRU eviction
- Prepared statements throughout

**Benchmarks**:
- Cache read: >50,000 ops/sec, <0.1ms
- FTS5 query: 5-30ms
- Reply tree cache hit rate: ~70%

## Known Issues

**Critical**:
1. Add `withSecurity` to `/api/forums/stats`
2. Remove duplicate tables from forums.db (wiki, projects, monitoring)
3. Move 18,603 monitoring logs from forums.db → system.db

**Medium**:
4. Replace stub hooks (toast, analytics)
5. Implement actual rate limiting
6. Add Zod validation to POST `/api/forums/topics`

**Low**:
7. Split large components (ReplyList 755 lines)
8. Add virtual scrolling for long lists
9. Add event-driven architecture

## Best Practices Demonstrated

✅ Factory pattern for service organization
✅ Transaction management for consistency
✅ Multi-tier caching with intelligent invalidation
✅ Async mention processing (non-blocking)
✅ Privacy-aware cross-domain aggregation
✅ Circuit breaker for fault tolerance
✅ Graceful degradation (FTS5 → LIKE fallback)
✅ Optimistic UI for instant feedback
