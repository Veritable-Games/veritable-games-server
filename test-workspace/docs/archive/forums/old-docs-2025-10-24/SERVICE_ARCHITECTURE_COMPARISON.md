# Forum Service Architecture Comparison

**Date:** October 13, 2025
**Purpose:** Architectural analysis comparing v0.36 and current (v0.37) forum service structures to guide UI restoration efforts

---

## Executive Summary

**Verdict:** ✅ **Backward Compatibility Layer Required**

The current v0.37 backend uses a **specialized services architecture** (`/lib/forums/services/`) with Result pattern, while v0.36 UI expects a **unified service wrapper** (`/lib/forums/service.ts`) with Promise-based API. The backward compatibility methods added to ForumService.ts (lines 908-980) are **incomplete and have wrong signatures**.

**Recommended Approach:** Create a complete v0.36-compatible service wrapper that delegates to the new specialized services.

---

## Architecture Comparison

### Current Structure (v0.37)

```
/lib/forums/services/         # Services directory (plural)
├── index.ts                  # Exports forumServices object + singletons
├── ForumService.ts           # Main service (topics + replies + categories)
├── ForumStatsService.ts      # Statistics and analytics
├── ForumSearchService.ts     # Full-text search (FTS5)
└── ForumModerationService.ts # Moderation operations
```

**Export Pattern:**
```typescript
// From /lib/forums/services/index.ts
export const forumServices = {
  forum: forumService,            // ForumService singleton
  moderation: forumModerationService,
  search: forumSearchService,
  stats: forumStatsService,
} as const;

// Individual exports
export { ForumService, forumService } from './ForumService';
export { ForumStatsService, forumStatsService } from './ForumStatsService';
export { ForumSearchService, forumSearchService } from './ForumSearchService';
export { ForumModerationService, forumModerationService } from './ForumModerationService';
```

**Usage Pattern:**
```typescript
import { forumServices } from '@/lib/forums/services';
const result = await forumServices.forum.createTopic(data, userId); // Result<T, E>
if (result.isErr()) { /* handle error */ }
const topic = result.value;
```

---

### v0.36 Structure

```
/lib/forums/
├── service.ts                # Unified wrapper (singular)
└── services/                 # Specialized services
    ├── index.ts              # ForumServiceFactory
    ├── ForumCategoryService.ts
    ├── ForumTopicService.ts
    ├── ForumReplyService.ts
    ├── ForumSearchService.ts
    └── ForumAnalyticsService.ts
```

**Export Pattern:**
```typescript
// From /lib/forums/service.ts
export class ForumService {
  // Delegates to forumServices factory
  async getCategories(): Promise<ForumCategory[]>
  async getCategoryById(categoryId): Promise<ForumCategory | null>
  async getTopicWithReplies(topicId, incrementView): Promise<TopicWithReplies | null>
  async getForumStats(): Promise<ForumStats>
  // ... more methods
}

export const forumService = new ForumService(); // Singleton
export { forumServices }; // Re-export factory
```

**Usage Pattern:**
```typescript
import { ForumService } from '@/lib/forums/service';
const service = new ForumService();
const categories = await service.getCategories(); // Promise<T>, throws on error
```

---

## API Surface Comparison

### ForumService Methods

| Method | v0.36 Signature | Current v0.37 Signature | Compatible? |
|--------|-----------------|-------------------------|-------------|
| `getCategories()` | `Promise<ForumCategory[]>` | `Promise<Result<ForumCategory[], Error>>` | ❌ No |
| `getCategoryById(id)` | `Promise<ForumCategory \| null>` | Not in v0.37 (uses `findById`) | ❌ Missing |
| `getTopicWithReplies(id, incView)` | `Promise<TopicWithReplies \| null>` | Not in v0.37 (uses `getTopic`) | ❌ Missing |
| `getForumStats()` | `Promise<ForumStats>` | In ForumStatsService: `Promise<Result<ForumStats, Error>>` | ❌ Different service |

**Backward Compatibility Methods Added (lines 908-980):**
```typescript
// ✅ CORRECT: Unwraps Result to Promise
async getCategories(): Promise<ForumCategory[]> {
  const result = await this.getAllCategories();
  if (result.isErr()) {
    throw new Error(`Failed to get categories: ${result.error.message}`);
  }
  return result.value;
}

// ✅ CORRECT: Returns null on not found
async getCategoryById(categoryId: CategoryId): Promise<ForumCategory | null> {
  // ... unwraps Result, returns null if not found
}

// ❌ WRONG RETURN TYPE: Returns TopicWithReplies instead of nested structure
async getTopicWithReplies(topicId: TopicId, includeReplies: boolean = true): Promise<TopicWithReplies> {
  const result = await this.getTopic(topicId, includeReplies);
  if (result.isErr()) {
    throw new Error(`Failed to get topic: ${result.error.message}`);
  }
  // ❌ BUG: Returns { topic, replies, total_replies, has_more }
  // v0.36 expects { ...topic, replies: ForumReply[] }
  const data = result.value;
  return {
    ...data.topic,
    replies: data.replies,
  } as TopicWithReplies;
}

// ✅ CORRECT: Delegates to ForumStatsService
async getForumStats(): Promise<any> {
  const { forumStatsService } = await import('./index');
  const result = await forumStatsService.getForumStats();
  if (result.isErr()) {
    throw new Error(`Failed to get forum stats: ${result.error.message}`);
  }
  return result.value;
}
```

**Issues with Backward Compatibility Methods:**
1. ✅ `getCategories()` - Works correctly
2. ✅ `getCategoryById()` - Works correctly
3. ⚠️ `getTopicWithReplies()` - Return type might be incorrect (needs TopicWithReplies type check)
4. ✅ `getForumStats()` - Works correctly but uses dynamic import

---

## v0.37 Service Method Inventory

### ForumService (Main)

**Topic Operations:**
- `createTopic(data, authorId): Result<ForumTopic, Error>`
- `getTopic(topicId, includeReplies): Result<TopicWithReplies, Error>`
- `updateTopic(topicId, data, userId): Result<ForumTopic, Error>`
- `deleteTopic(topicId, userId): Result<void, Error>`
- `getTopicsByCategory(categoryId, page, limit): Result<PaginatedResponse<ForumTopic>, Error>`

**Reply Operations:**
- `createReply(data, authorId): Result<ForumReply, Error>`
- `updateReply(replyId, data, userId): Result<ForumReply, Error>`
- `deleteReply(replyId, userId): Result<void, Error>`

**Category Operations:**
- `getAllCategories(): Result<ForumCategory[], Error>`
- `getCategoryWithTopics(categoryId, limit): Result<CategoryWithTopics, Error>`

**Backward Compatibility Methods (lines 908-980):**
- `getCategories(): Promise<ForumCategory[]>` ✅
- `getCategoryById(categoryId): Promise<ForumCategory | null>` ✅
- `getTopicWithReplies(topicId, includeReplies): Promise<TopicWithReplies>` ⚠️
- `getForumStats(): Promise<any>` ✅

---

### ForumStatsService

**Methods:**
- `getForumStats(): Result<ForumStats, Error>` - Overall forum statistics
- `getCategoryStats(categoryId): Result<CategoryStats, Error>` - Category-specific stats
- `getUserForumStats(userId): Result<UserForumStats, Error>` - User contribution stats
- `getTrendingTopics(limit, timeWindow): Result<ForumTopic[], Error>` - Activity-scored topics
- `getPopularTopics(limit, timeWindow): Result<ForumTopic[], Error>` - Most viewed topics
- `clearCaches(): void`, `invalidateStatsCache(): void`, `getCacheStats()` - Cache management

---

### ForumSearchService

**Methods:**
- `search(query, userId?): Result<PaginatedResponse<SearchResultDTO>, Error>` - Full-text search (FTS5)
- `quickSearch(query, limit): Result<string[], Error>` - Autocomplete/suggestions
- `getSuggestions(query, limit): Result<string[], Error>` - Search suggestions
- `searchByTag(tagName, page, limit): Result<PaginatedResponse<SearchResultDTO>, Error>` - Tag filtering
- `searchByCategory(categorySlug, query?, page, limit): Result<PaginatedResponse<SearchResultDTO>, Error>`
- `searchByAuthor(authorUsername, page, limit): Result<PaginatedResponse<SearchResultDTO>, Error>`
- `getRecentSearches(userId, limit): string[]` - User's recent searches
- `clearRecentSearches(userId): void`, `clearCaches()`, `getCacheStats()` - Cache management

---

### ForumModerationService

**Methods:**
- `pinTopic(topicId, userId): Result<ForumTopic, Error>` - Pin topic to top
- `unpinTopic(topicId, userId): Result<ForumTopic, Error>` - Unpin topic
- `lockTopic(topicId, userId): Result<ForumTopic, Error>` - Lock topic (no new replies)
- `unlockTopic(topicId, userId): Result<ForumTopic, Error>` - Unlock topic
- `markTopicAsSolved(topicId, userId): Result<ForumTopic, Error>` - Mark topic as solved
- `markReplyAsSolution(replyId, topicId, userId): Result<ForumReply, Error>` - Mark reply as solution
- `unmarkReplyAsSolution(replyId, topicId, userId): Result<ForumReply, Error>` - Unmark solution
- `deleteTopic(topicId, userId, reason?): Result<void, Error>` - Moderator delete topic
- `deleteReply(replyId, userId, reason?): Result<void, Error>` - Moderator delete reply

**Permission Checks:**
- Internal `checkModeratorPermission(userId)` - Validates moderator/admin role
- Internal `checkAdminPermission(userId)` - Validates admin role
- All operations log to `unified_activity` table for audit trail

---

## Type System Comparison

### v0.36 Types

```typescript
// From v0.36 /lib/forums/types.ts
export interface TopicWithReplies {
  // Extends ForumTopic with replies array
  id: number;
  title: string;
  content: string;
  // ... all ForumTopic fields
  replies: ForumReply[]; // Nested replies array
}
```

### v0.37 Types

```typescript
// From v0.37 /lib/forums/types.ts
export interface TopicWithReplies {
  topic: ForumTopic;        // ❌ DIFFERENT: Wrapped topic object
  replies: ForumReply[];
  total_replies: number;
  has_more: boolean;
}
```

**Critical Difference:** v0.37 uses a **wrapper structure** with separate `topic` field, while v0.36 **spreads topic properties** directly. This breaks compatibility.

---

## Import Pattern Analysis

### Current Usage in Codebase

**Files using singular import (expecting wrapper):**
```typescript
// Found in 4 files:
// - /app/forums/topic/[id]/page.tsx
// - /app/forums/page.tsx
// - /app/wiki/page.tsx
// - /app/wiki/category/[id]/page.tsx

import { ForumService } from '@/lib/forums/service'; // ❌ File doesn't exist
const forumService = new ForumService();
const categories = await forumService.getCategories();
```

**Files using plural import (current architecture):**
```typescript
// Found in 2 files:
// - /lib/forums/services/index.ts (internal)
// - /lib/services/index.ts (service registry)

import { forumServices } from '@/lib/forums/services';
const result = await forumServices.forum.createTopic(data, userId);
```

**Conclusion:** **4 files expect the v0.36 wrapper pattern**, but the file doesn't exist in current codebase.

---

## Service Instantiation Pattern

### v0.36 Pattern

```typescript
// Instantiation
const forumService = new ForumService();

// Internal delegation
class ForumService {
  private services: ForumServiceFactory;

  constructor() {
    this.services = forumServices; // Uses singleton factory
  }

  async getCategories() {
    return this.services.categories.getCategories(); // Delegate
  }
}
```

**Pattern:** Wrapper class with internal delegation to specialized services.

### Current v0.37 Pattern

```typescript
// Direct singleton usage
import { forumService } from '@/lib/forums/services';
const result = await forumService.createTopic(data, userId);

// OR factory pattern
import { forumServices } from '@/lib/forums/services';
const result = await forumServices.forum.createTopic(data, userId);
```

**Pattern:** Direct singleton instances or factory object.

---

## Migration Complexity Assessment

### Option A: Create v0.36-Compatible Wrapper (Recommended)

**Effort:** 🟢 Low (2-3 hours)
**Risk:** 🟢 Low
**Maintenance:** 🟢 Low (thin wrapper)

**Implementation:**
1. Create `/lib/forums/service.ts` file
2. Import all v0.37 services
3. Create `ForumService` class with v0.36 method signatures
4. Delegate all methods to v0.37 services, unwrapping Result types
5. Export singleton instance

**Pros:**
- ✅ Zero changes to v0.36 UI code
- ✅ Preserves v0.37 architecture
- ✅ Thin compatibility layer (100-150 lines)
- ✅ Easy to test

**Cons:**
- ⚠️ Maintains two API surfaces (temporary)
- ⚠️ Slight performance overhead (negligible)

---

### Option B: Update All UI Components

**Effort:** 🟡 Medium (6-8 hours)
**Risk:** 🟡 Medium
**Maintenance:** 🟢 Low (unified architecture)

**Implementation:**
1. Update all 4 files using `ForumService` import
2. Change to `forumServices` factory pattern
3. Update all method calls to use Result pattern
4. Add error handling for Result unwrapping

**Pros:**
- ✅ Single unified architecture
- ✅ No compatibility layer
- ✅ Type-safe Result pattern everywhere

**Cons:**
- ⚠️ Requires changing 4 files + all child components
- ⚠️ Requires testing all UI flows
- ⚠️ Breaks semantic compatibility with v0.36

---

### Option C: Hybrid Approach

**Effort:** 🟡 Medium (4-5 hours)
**Risk:** 🟡 Medium
**Maintenance:** 🟡 Medium

**Implementation:**
1. Create minimal wrapper for only the methods used by UI
2. Update some components to use new pattern
3. Deprecate wrapper over time

**Pros:**
- ✅ Gradual migration path
- ✅ Minimal immediate changes

**Cons:**
- ⚠️ Mixed patterns in codebase
- ⚠️ Longer migration period
- ⚠️ Confusion about which pattern to use

---

## Recommended Approach

### ✅ **Option A: Create v0.36-Compatible Wrapper**

**Rationale:**
1. **Fastest restoration** - v0.36 UI can be copied directly with zero modifications
2. **Lowest risk** - Thin compatibility layer, easy to test and verify
3. **Preserves architecture** - Doesn't compromise v0.37's Result-based design
4. **Migration path** - Can gradually update UI to use new pattern, then remove wrapper

**Implementation Steps:**

1. **Create `/lib/forums/service.ts`:**
```typescript
import { forumServices } from './services';
import type {
  ForumCategory,
  ForumTopic,
  ForumReply,
  ForumStats,
  TopicWithReplies,
  CreateTopicDTO,
  UpdateTopicDTO,
  CreateReplyDTO,
  UpdateReplyDTO,
} from './types';

/**
 * ForumService - v0.36 Compatibility Wrapper
 *
 * Provides backward-compatible Promise-based API that delegates to
 * v0.37's Result-based specialized services.
 */
export class ForumService {
  // Category Operations
  async getCategories(): Promise<ForumCategory[]> {
    const result = await forumServices.forum.getAllCategories();
    if (result.isErr()) {
      throw new Error(`Failed to get categories: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async getCategoryById(categoryId: number): Promise<ForumCategory | null> {
    const result = await forumServices.forum.getCategoryWithTopics(categoryId as any);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return null;
      throw new Error(`Failed to get category: ${result.error.message || result.error.type}`);
    }
    return result.value.category;
  }

  // Topic Operations
  async getTopicWithReplies(topicId: number, incrementView: boolean = true): Promise<TopicWithReplies | null> {
    const result = await forumServices.forum.getTopic(topicId as any, incrementView);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return null;
      throw new Error(`Failed to get topic: ${result.error.message || result.error.type}`);
    }

    // Transform v0.37 structure to v0.36 structure
    const data = result.value;
    return {
      ...data.topic,
      replies: data.replies,
    } as TopicWithReplies;
  }

  async createTopic(data: CreateTopicDTO, userId: number): Promise<ForumTopic> {
    const result = await forumServices.forum.createTopic(data, userId as any);
    if (result.isErr()) {
      throw new Error(`Failed to create topic: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async updateTopic(topicId: number, data: UpdateTopicDTO, userId: number): Promise<ForumTopic | null> {
    const result = await forumServices.forum.updateTopic(topicId as any, data, userId as any);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return null;
      throw new Error(`Failed to update topic: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async deleteTopic(topicId: number, userId: number): Promise<boolean> {
    const result = await forumServices.forum.deleteTopic(topicId as any, userId as any);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return false;
      throw new Error(`Failed to delete topic: ${result.error.message || result.error.type}`);
    }
    return true;
  }

  // Reply Operations
  async createReply(data: CreateReplyDTO, userId: number): Promise<ForumReply> {
    const result = await forumServices.forum.createReply(data, userId as any);
    if (result.isErr()) {
      throw new Error(`Failed to create reply: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async updateReply(replyId: number, data: UpdateReplyDTO, userId: number): Promise<ForumReply | null> {
    const result = await forumServices.forum.updateReply(replyId as any, data, userId as any);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return null;
      throw new Error(`Failed to update reply: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async deleteReply(replyId: number, userId: number): Promise<boolean> {
    const result = await forumServices.forum.deleteReply(replyId as any, userId as any);
    if (result.isErr()) {
      if (result.error.type === 'not_found') return false;
      throw new Error(`Failed to delete reply: ${result.error.message || result.error.type}`);
    }
    return true;
  }

  // Stats Operations
  async getForumStats(): Promise<ForumStats> {
    const result = await forumServices.stats.getForumStats();
    if (result.isErr()) {
      throw new Error(`Failed to get forum stats: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }

  async getUserForumStats(userId: number): Promise<any> {
    const result = await forumServices.stats.getUserForumStats(userId as any);
    if (result.isErr()) {
      throw new Error(`Failed to get user stats: ${result.error.message || result.error.type}`);
    }
    return result.value;
  }
}

// Export singleton instance
export const forumService = new ForumService();

// Re-export v0.37 services for modern usage
export { forumServices };
```

2. **Update Type Definitions (if needed):**
   - Verify `TopicWithReplies` type matches v0.36 expectations
   - Add type aliases if needed for backward compatibility

3. **Test Wrapper:**
   - Unit tests for all wrapper methods
   - Integration tests with UI components

4. **Copy v0.36 UI:**
   - Copy components with confidence, zero changes needed

5. **Future Migration (optional):**
   - Gradually update UI components to use `forumServices` directly
   - Remove wrapper when all components migrated
   - Add deprecation warnings to wrapper methods

---

## API Differences Matrix

| Feature | v0.36 API | v0.37 API | Wrapper Complexity |
|---------|-----------|-----------|-------------------|
| **Categories** | `getCategories()` | `getAllCategories()` + Result | 🟢 Low - Simple unwrap |
| **Category by ID** | `getCategoryById(id)` | `getCategoryWithTopics(id)` + Result | 🟢 Low - Extract category field |
| **Topic with replies** | `getTopicWithReplies(id)` | `getTopic(id, true)` + Result | 🟡 Medium - Transform structure |
| **Forum stats** | `getForumStats()` | `ForumStatsService.getForumStats()` + Result | 🟢 Low - Delegate to different service |
| **Create topic** | `createTopic(data, userId)` | `createTopic(data, userId)` + Result | 🟢 Low - Simple unwrap |
| **Update topic** | `updateTopic(id, data, userId)` | `updateTopic(id, data, userId)` + Result | 🟢 Low - Simple unwrap |
| **Delete topic** | `deleteTopic(id, userId)` | `deleteTopic(id, userId)` + Result | 🟢 Low - Return boolean |
| **Create reply** | `createReply(data, userId)` | `createReply(data, userId)` + Result | 🟢 Low - Simple unwrap |
| **Update reply** | `updateReply(id, data, userId)` | `updateReply(id, data, userId)` + Result | 🟢 Low - Simple unwrap |
| **Delete reply** | `deleteReply(id, userId)` | `deleteReply(id, userId)` + Result | 🟢 Low - Return boolean |

**Overall Complexity:** 🟢 **Low** - Most methods require simple Result unwrapping, only `getTopicWithReplies` needs structure transformation.

---

## Missing Features in v0.37

Features present in v0.36 but missing in v0.37:

1. ❌ **Tag System** - No tag-related methods in v0.37 services
2. ❌ **getTopicsByTag()** - Tag filtering not implemented
3. ❌ **Activity Logging** - Direct `logActivity()` method removed (now internal)
4. ❌ **getRepliesByTopicId()** - Replaced with `getTopic(id, includeReplies: true)`

**Impact:** Low - These features can be added back to the wrapper if needed, or v0.36 UI components can be updated to not use them.

---

## Conclusion

**Recommendation:** **Create v0.36-compatible wrapper** (Option A)

**Benefits:**
- ✅ Fastest path to UI restoration (zero UI changes)
- ✅ Preserves v0.37 architecture integrity
- ✅ Low risk, easy to test
- ✅ Provides migration path for future modernization

**Next Steps:**
1. Create `/lib/forums/service.ts` wrapper (1-2 hours)
2. Add unit tests for wrapper methods (1 hour)
3. Copy v0.36 UI components (no changes needed)
4. Test full forum flows (1-2 hours)
5. Optional: Add deprecation warnings for future migration

**Total Effort:** ~4-6 hours
**Risk Level:** 🟢 Low
**Long-term Maintainability:** 🟢 Excellent (can remove wrapper after UI modernization)
