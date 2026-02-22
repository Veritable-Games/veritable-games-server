# Forum Service Architecture - Quick Reference

**Decision:** Create backward compatibility wrapper at `/lib/forums/service.ts`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         v0.36 UI Components                      │
│  (ForumCategoryList, TopicView, ReplyList, SearchBox, etc.)     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ import { ForumService } from '@/lib/forums/service'
                     │ const service = new ForumService()
                     │ const categories = await service.getCategories()
                     │ (Promise-based API, throws on error)
                     │
┌────────────────────▼────────────────────────────────────────────┐
│            COMPATIBILITY WRAPPER (NEW)                          │
│                /lib/forums/service.ts                           │
│                                                                 │
│  class ForumService {                                           │
│    async getCategories(): Promise<ForumCategory[]> {            │
│      const result = await forumServices.forum.getAllCategories()│
│      if (result.isErr()) throw new Error(...)                   │
│      return result.value                                        │
│    }                                                            │
│  }                                                              │
│                                                                 │
│  Unwraps Result<T, E> → Promise<T> for v0.36 compatibility     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Delegates to...
                     │
┌────────────────────▼────────────────────────────────────────────┐
│              v0.37 SPECIALIZED SERVICES                         │
│               /lib/forums/services/                             │
│                                                                 │
│  forumServices = {                                              │
│    forum: ForumService           // Topics, replies, categories│
│    stats: ForumStatsService      // Analytics, trending        │
│    search: ForumSearchService    // FTS5 full-text search      │
│    moderation: ForumModerationService // Pin, lock, delete     │
│  }                                                              │
│                                                                 │
│  All methods return Result<T, ForumServiceError>               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Method Mapping

### Category Operations

| v0.36 UI Calls | Wrapper Translates To | v0.37 Backend Method |
|----------------|-----------------------|----------------------|
| `service.getCategories()` | ➜ | `forumServices.forum.getAllCategories()` |
| `service.getCategoryById(id)` | ➜ | `forumServices.forum.getCategoryWithTopics(id)` |

### Topic Operations

| v0.36 UI Calls | Wrapper Translates To | v0.37 Backend Method |
|----------------|-----------------------|----------------------|
| `service.getTopicWithReplies(id)` | ➜ | `forumServices.forum.getTopic(id, true)` |
| `service.createTopic(data, userId)` | ➜ | `forumServices.forum.createTopic(data, userId)` |
| `service.updateTopic(id, data, userId)` | ➜ | `forumServices.forum.updateTopic(id, data, userId)` |
| `service.deleteTopic(id, userId)` | ➜ | `forumServices.forum.deleteTopic(id, userId)` |

### Reply Operations

| v0.36 UI Calls | Wrapper Translates To | v0.37 Backend Method |
|----------------|-----------------------|----------------------|
| `service.createReply(data, userId)` | ➜ | `forumServices.forum.createReply(data, userId)` |
| `service.updateReply(id, data, userId)` | ➜ | `forumServices.forum.updateReply(id, data, userId)` |
| `service.deleteReply(id, userId)` | ➜ | `forumServices.forum.deleteReply(id, userId)` |

### Stats Operations

| v0.36 UI Calls | Wrapper Translates To | v0.37 Backend Method |
|----------------|-----------------------|----------------------|
| `service.getForumStats()` | ➜ | `forumServices.stats.getForumStats()` |
| `service.getUserForumStats(userId)` | ➜ | `forumServices.stats.getUserForumStats(userId)` |

---

## Type Transformation

### TopicWithReplies Structure Difference

**v0.36 expects (flat structure):**
```typescript
interface TopicWithReplies {
  id: number;
  title: string;
  content: string;
  // ... all topic fields spread
  replies: ForumReply[]; // Just the replies array
}
```

**v0.37 returns (nested structure):**
```typescript
interface TopicWithReplies {
  topic: ForumTopic;     // Topic wrapped in object
  replies: ForumReply[];
  total_replies: number;
  has_more: boolean;
}
```

**Wrapper transformation:**
```typescript
async getTopicWithReplies(topicId: number): Promise<TopicWithReplies | null> {
  const result = await forumServices.forum.getTopic(topicId as any, true);
  if (result.isErr()) {
    if (result.error.type === 'not_found') return null;
    throw new Error(...);
  }

  // Transform nested structure to flat structure
  const data = result.value;
  return {
    ...data.topic,      // Spread topic properties
    replies: data.replies,
  } as TopicWithReplies;
}
```

---

## Error Handling Transformation

### v0.36 Pattern (throws exceptions)

```typescript
try {
  const categories = await service.getCategories();
  // Use categories
} catch (error) {
  console.error('Failed to load categories:', error);
}
```

### v0.37 Pattern (Result type)

```typescript
const result = await forumServices.forum.getAllCategories();
if (result.isErr()) {
  console.error('Failed to load categories:', result.error);
  return;
}
const categories = result.value;
```

### Wrapper Bridges the Gap

The wrapper unwraps Result and throws exceptions for v0.36 compatibility:

```typescript
async getCategories(): Promise<ForumCategory[]> {
  const result = await forumServices.forum.getAllCategories();

  // Unwrap Result → Promise (throws on error)
  if (result.isErr()) {
    throw new Error(`Failed to get categories: ${result.error.message || result.error.type}`);
  }

  return result.value;
}
```

---

## Import Patterns

### v0.36 UI Components

```typescript
// ✅ This works after wrapper is created
import { ForumService } from '@/lib/forums/service';

const service = new ForumService();
const categories = await service.getCategories();
```

### Modern v0.37 Components (optional future migration)

```typescript
// ✅ This works now (no wrapper needed)
import { forumServices } from '@/lib/forums/services';

const result = await forumServices.forum.getAllCategories();
if (result.isOk()) {
  const categories = result.value;
}
```

---

## Implementation Checklist

### Step 1: Create Wrapper File
- [ ] Create `/lib/forums/service.ts`
- [ ] Import `forumServices` from `./services`
- [ ] Import all types from `./types`

### Step 2: Implement Wrapper Class
- [ ] `getCategories()` - Unwrap `getAllCategories()`
- [ ] `getCategoryById()` - Unwrap `getCategoryWithTopics()`, extract category
- [ ] `getTopicWithReplies()` - Unwrap `getTopic()`, transform structure
- [ ] `createTopic()` - Unwrap `createTopic()`
- [ ] `updateTopic()` - Unwrap `updateTopic()`
- [ ] `deleteTopic()` - Unwrap `deleteTopic()`, return boolean
- [ ] `createReply()` - Unwrap `createReply()`
- [ ] `updateReply()` - Unwrap `updateReply()`
- [ ] `deleteReply()` - Unwrap `deleteReply()`, return boolean
- [ ] `getForumStats()` - Unwrap `forumServices.stats.getForumStats()`
- [ ] `getUserForumStats()` - Unwrap `forumServices.stats.getUserForumStats()`

### Step 3: Export Singleton
- [ ] Export `ForumService` class
- [ ] Export singleton instance `forumService`
- [ ] Re-export `forumServices` for modern usage

### Step 4: Testing
- [ ] Unit tests for all wrapper methods
- [ ] Test error handling (Result → Exception)
- [ ] Test structure transformation (TopicWithReplies)
- [ ] Integration test with v0.36 UI components

### Step 5: Copy v0.36 UI
- [ ] Copy components (zero changes needed)
- [ ] Verify imports resolve to wrapper
- [ ] Test full forum flows

---

## Files That Need the Wrapper

These files currently import from non-existent `/lib/forums/service`:

1. `/app/forums/topic/[id]/page.tsx`
2. `/app/forums/page.tsx`
3. `/app/wiki/page.tsx`
4. `/app/wiki/category/[id]/page.tsx`

After creating the wrapper, these imports will resolve correctly.

---

## Estimated Effort

| Task | Time Estimate |
|------|---------------|
| Create wrapper file | 1-2 hours |
| Add unit tests | 1 hour |
| Copy v0.36 UI components | 30 min |
| Integration testing | 1-2 hours |
| **Total** | **4-6 hours** |

---

## Migration Strategy (Future)

Once v0.36 UI is working, optionally modernize components to use v0.37 directly:

1. **Add deprecation warnings** to wrapper methods
2. **Update one component at a time** to use `forumServices` directly
3. **Handle Result types** in UI components
4. **Remove wrapper** when all components migrated

**Benefits of eventual migration:**
- Type-safe error handling with Result pattern
- Direct access to all v0.37 features (stats, search, moderation)
- No extra layer of abstraction

**But this is optional** - the wrapper can remain indefinitely if preferred.

---

## Key Takeaways

1. ✅ **Wrapper is thin** - Just unwraps Result types, minimal logic
2. ✅ **Zero UI changes** - v0.36 components work as-is
3. ✅ **Preserves v0.37 architecture** - No compromise to backend design
4. ✅ **Low maintenance** - Delegates everything to v0.37 services
5. ✅ **Migration path** - Can modernize UI gradually or keep wrapper forever

**Recommendation:** Implement the wrapper, restore v0.36 UI, then decide on future modernization based on team preference.
