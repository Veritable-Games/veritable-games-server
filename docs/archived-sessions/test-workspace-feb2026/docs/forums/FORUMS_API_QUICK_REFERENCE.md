# Forums API Quick Reference Guide

**Companion Document**: See `/docs/FORUMS_SERVICES_ARCHITECTURE.md` for detailed service architecture

---

## Service Imports

### Using Specialized Services

```typescript
// Import individual services
import { 
  forumService, 
  forumModerationService, 
  forumSearchService, 
  forumStatsService,
  forumCategoryService,
  forumSectionService
} from '@/lib/forums/services';

// Or use the convenience object
import { forumServices } from '@/lib/forums/services';
forumServices.forum.createTopic(data, userId);
forumServices.moderation.pinTopic(topicId, userId);
```

### Handling Results

```typescript
// Every service method returns Result<T, Error>
const result = await forumService.createTopic(data, userId);

if (result.isOk()) {
  const topic = result.value;  // Use topic data
  console.log(topic.id, topic.title);
} else {
  const error = result.error;  // Handle error
  console.error(error.message);
}
```

---

## ForumService (Core Operations)

### Topic Operations

#### Create Topic
```typescript
const result = await forumService.createTopic(
  {
    category_id: 1,
    title: 'How to use TypeScript',
    content: 'I want to learn TypeScript basics',
    status: 0,  // Optional: initial status flags
    tags: [1, 2, 3],  // Optional: tag IDs
  },
  userId  // Author user ID
);

if (result.isOk()) {
  const topic = result.value;
  console.log(`Created topic ${topic.id}`);
}
```

#### Get Topic with Replies
```typescript
const result = await forumService.getTopic(
  topicId,
  true  // includeReplies (default: true)
);

if (result.isOk()) {
  const { topic, replies, total_replies, has_more } = result.value;
  console.log(`Topic has ${total_replies} replies`);
}
```

#### Get Topics by Category
```typescript
const result = await forumService.getTopicsByCategory(
  categoryId,
  1,     // page (1-indexed)
  20     // limit (items per page)
);

if (result.isOk()) {
  const { data, pagination } = result.value;
  console.log(`Showing ${data.length} of ${pagination.total} topics`);
}
```

#### Update Topic
```typescript
const result = await forumService.updateTopic(
  topicId,
  {
    title: 'Updated Title',
    content: 'Updated content',
    // status: Can be updated but prefer ForumModerationService for status changes
  },
  userId  // Requester user ID (for permission check)
);
```

#### Delete Topic
```typescript
const result = await forumService.deleteTopic(
  topicId,
  userId  // Requester user ID
);

if (result.isOk()) {
  console.log('Topic deleted');
}
```

### Reply Operations

#### Create Reply
```typescript
const result = await forumService.createReply(
  {
    topic_id: topicId,
    content: 'Great question! Here is my answer...',
    parent_id: parentReplyId,  // Optional: for nested replies (max 5 levels)
    is_solution: false,  // Optional: mark as solution
  },
  userId  // Author user ID
);

if (result.isOk()) {
  const reply = result.value;
  console.log(`Created reply ${reply.id}`);
}
```

#### Get Replies by Topic
```typescript
const result = await forumService.getRepliesByTopicId(topicId);

if (result.isOk()) {
  const replies = result.value;
  console.log(`Topic has ${replies.length} replies`);
}
```

#### Update Reply
```typescript
const result = await forumService.updateReply(
  replyId,
  {
    content: 'Updated reply content',
    is_solution: false,
  },
  userId  // Requester user ID
);
```

#### Delete Reply
```typescript
const result = await forumService.deleteReply(
  replyId,
  userId  // Requester user ID
);
```

#### Mark as Solution
```typescript
// Mark reply as solution
const result = await forumService.markReplyAsSolution(
  replyId,
  userId
);

// Unmark solution
const result = await forumService.unmarkReplyAsSolution(
  replyId,
  userId
);
```

### Category Operations

#### Get All Categories
```typescript
const result = await forumService.getAllCategories();

if (result.isOk()) {
  const categories = result.value;
  categories.forEach(cat => {
    console.log(`${cat.name}: ${cat.topic_count} topics`);
  });
}
```

#### Create Category
```typescript
const result = await forumService.createCategory({
  name: 'TypeScript Questions',
  description: 'Ask questions about TypeScript',
  parent_id: null,
  color: '#FF5733',
  section: 'programming',
});
```

#### Update Category
```typescript
const result = await forumService.updateCategory(
  categoryId,
  {
    name: 'Updated Name',
    description: 'Updated description',
    color: '#00FF00',
  }
);
```

#### Delete Category
```typescript
const result = await forumService.deleteCategory(categoryId);
```

---

## ForumModerationService (Moderation)

**All methods require moderator/admin permissions.**

### Topic Moderation

#### Pin/Unpin Topic
```typescript
// Pin topic to top
const result = await forumModerationService.pinTopic(
  topicId,
  moderatorId
);

// Unpin topic
const result = await forumModerationService.unpinTopic(
  topicId,
  moderatorId
);
```

#### Lock/Unlock Topic
```typescript
// Lock (prevent new replies)
const result = await forumModerationService.lockTopic(
  topicId,
  moderatorId
);

// Unlock (allow replies)
const result = await forumModerationService.unlockTopic(
  topicId,
  moderatorId
);
```

#### Mark as Solved/Unsolved
```typescript
// Mark as solved
const result = await forumModerationService.markTopicAsSolved(
  topicId,
  moderatorId
);

// Unmark as solved
const result = await forumModerationService.unmarkTopicAsSolved(
  topicId,
  moderatorId
);
```

#### Archive/Unarchive Topic
```typescript
// Archive (hide from main view)
const result = await forumModerationService.archiveTopic(
  topicId,
  moderatorId
);

// Unarchive
const result = await forumModerationService.unarchiveTopic(
  topicId,
  moderatorId
);
```

#### Delete with Reason
```typescript
const result = await forumModerationService.deleteTopic(
  topicId,
  moderatorId,
  'Spam content'  // Optional: moderation reason
);
```

---

## ForumSearchService (Search & Discovery)

### Full-Text Search
```typescript
const result = await forumSearchService.search(
  {
    query: 'typescript generics',
    page: 1,
    limit: 10,
    // Optional filters:
    // category_id: 1,
    // status: 4,  // SOLVED status flag
    // tag_ids: [1, 2],
  },
  userId  // Optional: for tracking recent searches
);

if (result.isOk()) {
  const { data, pagination } = result.value;
  data.forEach(result => {
    console.log(`[${result.content_type}] ${result.title}`);
    console.log(`  Author: ${result.author_username}`);
    console.log(`  Rank: ${result.rank}`);
  });
}
```

### Quick Search (Autocomplete)
```typescript
const result = await forumSearchService.quickSearch(
  'type',  // Partial query
  10       // Max results
);

if (result.isOk()) {
  const titles = result.value;
  console.log('Suggestions:', titles);
}
```

### Get Suggestions
```typescript
const result = await forumSearchService.getSuggestions(
  'react',
  5  // limit
);
```

### Get User's Recent Searches
```typescript
const result = await forumSearchService.getRecentSearches(
  userId,
  10  // limit
);

if (result.isOk()) {
  console.log('Recent searches:', result.value);
}
```

### Clear Search History
```typescript
const result = await forumSearchService.clearUserSearchHistory(userId);
```

---

## ForumStatsService (Analytics)

### Get Forum Statistics
```typescript
const result = await forumStatsService.getForumStats();

if (result.isOk()) {
  const stats = result.value;
  console.log(`Total topics: ${stats.total_topics}`);
  console.log(`Total replies: ${stats.total_replies}`);
  console.log(`Active users today: ${stats.active_users_today}`);
  console.log(`Recent topics: ${stats.recent_topics.length}`);
}
```

### Get Category Statistics
```typescript
const result = await forumStatsService.getCategoryStats(categoryId);

if (result.isOk()) {
  const stats = result.value;
  console.log(`Topics: ${stats.topic_count}`);
  console.log(`Replies: ${stats.reply_count}`);
}
```

### Get User Statistics
```typescript
const result = await forumStatsService.getUserForumStats(userId);

if (result.isOk()) {
  const stats = result.value;
  console.log(`User topics: ${stats.topic_count}`);
  console.log(`User replies: ${stats.reply_count}`);
  console.log(`Solutions: ${stats.solution_count}`);
  console.log(`Reputation: ${stats.reputation}`);
}
```

### Get Trending Topics
```typescript
const result = await forumStatsService.getTrendingTopics(
  10,      // limit
  'week'   // period: 'day' | 'week' | 'month'
);
```

### Get Active Users
```typescript
const result = await forumStatsService.getActiveUsers(
  'today'  // period: 'today' | 'week' | 'month'
);
```

### Get Cache Statistics
```typescript
const cacheStats = forumStatsService.getCacheStats();
console.log(`Forum stats cache size: ${cacheStats.forumStatsCacheSize}`);
console.log(`Category stats cache size: ${cacheStats.categoryStatsCacheSize}`);
console.log(`User stats cache size: ${cacheStats.userStatsCacheSize}`);
```

---

## ForumCategoryService (Simple API)

**Note: This service uses throw-on-error pattern, not Result.**

```typescript
// Get all categories (with role-based filtering)
const categories = forumCategoryService.getAllCategories('user');
// Roles: 'admin' | 'moderator' | 'user' | 'anonymous'

// Get by ID
const category = forumCategoryService.getCategoryById(categoryId);

// Get by slug
const category = forumCategoryService.getCategoryBySlug('general-discussion');

// Create
const newCategory = forumCategoryService.createCategory({
  name: 'New Category',
  slug: 'new-category',
  description: 'Description',
  color: '#FF0000',
  section: 'general',
});

// Update
const updated = forumCategoryService.updateCategory(categoryId, {
  name: 'Updated Name',
});

// Reorder categories
forumCategoryService.reorderCategories([
  { id: '1', sort_order: 1 },
  { id: '2', sort_order: 2 },
  { id: '3', sort_order: 3 },
]);
```

---

## ForumSectionService (Simple API)

**Note: This service uses throw-on-error pattern, not Result.**

```typescript
// Get all sections
const sections = forumSectionService.getAllSections();

// Get section by ID
const section = forumSectionService.getSectionById('general');

// Update section name
forumSectionService.updateSectionName('general', 'General Discussion');

// Reorder sections (with transaction)
forumSectionService.reorderSections([
  { id: 'general', sort_order: 1 },
  { id: 'technical', sort_order: 2 },
  { id: 'off-topic', sort_order: 3 },
]);
```

---

## Utility Functions

### Clear All Service Caches
```typescript
import { ForumServiceUtils } from '@/lib/forums/services';

// Clear all caches after bulk operations
ForumServiceUtils.clearAllCaches();

// Or just invalidate (after content changes)
ForumServiceUtils.invalidateCaches();
```

### Get Cache Statistics
```typescript
const stats = ForumServiceUtils.getCacheStats();
console.log(stats);
// Output:
// {
//   forum: { topicCacheSize: 42, categoryCacheSize: 5 },
//   search: { searchCacheSize: 15, suggestionsCacheSize: 8, recentSearchesCount: 3 },
//   stats: { forumStatsCacheSize: 1, categoryStatsCacheSize: 12, userStatsCacheSize: 34 }
// }
```

---

## Status Flags (Bit Operations)

```typescript
import { 
  TopicStatusFlags, 
  hasFlag, 
  addFlag, 
  removeFlag, 
  getActiveFlags 
} from '@/lib/forums/status-flags';

// Check if topic is pinned
if (hasFlag(topic.status, TopicStatusFlags.PINNED)) {
  console.log('Topic is pinned');
}

// Add multiple flags
let status = 0;
status = addFlag(status, TopicStatusFlags.PINNED);
status = addFlag(status, TopicStatusFlags.SOLVED);
// status is now 6 (binary: 0110)

// Remove a flag
status = removeFlag(status, TopicStatusFlags.PINNED);
// status is now 4 (binary: 0100, SOLVED only)

// Get all active flags
const flags = getActiveFlags(status);
console.log(flags);  // ['SOLVED']
```

---

## Real-Time Events

### Using useForumEvents Hook (Client)

```typescript
import { useForumEvents } from '@/hooks/useForumEvents';

function TopicView({ topicId }) {
  useForumEvents((event) => {
    switch (event.type) {
      case 'topic:pinned':
        if (event.data.topic_id === topicId) {
          console.log('Topic was pinned!');
          // Update UI
        }
        break;
        
      case 'topic:locked':
        console.log('Topic is now locked');
        break;
        
      case 'reply:created':
        console.log(`New reply from ${event.data.author_username}`);
        break;
        
      case 'reply:solution':
        console.log(`Reply marked as solution`);
        break;
    }
  });
  
  return ...;
}
```

### Broadcasting Events (Server)

```typescript
import { forumEventBroadcaster, createTopicStatusEvent } from '@/lib/forums/events';

// Broadcast event
forumEventBroadcaster.broadcast(
  createTopicStatusEvent('topic:pinned', {
    topic_id: topicId,
    category_id: topic.category_id,
    status: newStatus,
    is_pinned: true,
    moderator_id: userId,
  })
);
```

---

## Error Handling Examples

### Service Error Pattern

```typescript
import { 
  ValidationError, 
  NotFoundError, 
  PermissionError 
} from '@/lib/forums/types';

const result = await forumService.createTopic(data, userId);

if (result.isErr()) {
  const error = result.error;
  
  if (error.type === 'validation') {
    console.error(`Validation error on ${error.field}: ${error.message}`);
  } else if (error.type === 'not_found') {
    console.error(`${error.entity} with ID ${error.id} not found`);
  } else if (error.type === 'forbidden') {
    console.error(`Permission denied: ${error.reason}`);
  } else if (error.type === 'database') {
    console.error(`Database error in ${error.operation}: ${error.message}`);
  }
}
```

### API Route Error Response

```typescript
import { errorResponse } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request) => {
  try {
    const result = await forumService.createTopic(data, userId);
    
    if (result.isErr()) {
      // Automatically converts to HTTP response
      return errorResponse(result.error);
    }
    
    return NextResponse.json({ success: true, data: result.value });
  } catch (error) {
    return errorResponse(error);
  }
});
```

---

## Common Patterns

### Creating a Topic with Error Handling

```typescript
async function createForumTopic(formData: FormData, userId: number) {
  try {
    const result = await forumService.createTopic(
      {
        category_id: Number(formData.get('category_id')),
        title: formData.get('title') as string,
        content: formData.get('content') as string,
      },
      userId
    );
    
    if (result.isOk()) {
      return { success: true, topic: result.value };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: 'Unexpected error' };
  }
}
```

### Loading and Displaying a Topic

```typescript
async function loadTopic(topicId: number) {
  const result = await forumService.getTopic(topicId, true);
  
  if (result.isOk()) {
    const { topic, replies } = result.value;
    return {
      topic,
      replies,
      isLocked: hasFlag(topic.status, TopicStatusFlags.LOCKED),
      isPinned: hasFlag(topic.status, TopicStatusFlags.PINNED),
      isSolved: hasFlag(topic.status, TopicStatusFlags.SOLVED),
    };
  } else {
    throw new Error('Topic not found');
  }
}
```

### Searching with Pagination

```typescript
async function searchForums(query: string, page: number = 1) {
  const result = await forumSearchService.search(
    {
      query,
      page,
      limit: 20,
    },
    userId
  );
  
  if (result.isOk()) {
    return result.value;  // { data: [...], pagination: {...} }
  } else {
    return { data: [], pagination: { total: 0, ... } };
  }
}
```

---

## Type Definitions

### For Custom Code

```typescript
import type {
  ForumTopic,
  ForumReply,
  ForumCategory,
  ForumSection,
  ForumTag,
  ForumStats,
  CreateTopicData,
  UpdateTopicData,
  CreateReplyData,
  UpdateReplyData,
  CreateCategoryData,
  UpdateCategoryData,
  SearchResultDTO,
  TopicId,
  ReplyId,
  CategoryId,
  UserId,
  TopicStatus,
} from '@/lib/forums/types';

// Branded types (compile-time safety)
const topicId: TopicId = 123 as TopicId;
const userId: UserId = 456 as UserId;
```

---

## Performance Tips

1. **Use Result Pattern**: Always check `result.isOk()` before accessing values
2. **Cache Queries**: Services implement LRU caches automatically
3. **Batch Operations**: Use `ForumServiceUtils.invalidateCaches()` after bulk changes
4. **Limit Pagination**: Default limit is 20, max is 100
5. **Search Optimization**: Use category/tag filters to narrow results
6. **Monitor Caches**: Call `ForumServiceUtils.getCacheStats()` to monitor cache performance

---

**Last Updated**: October 24, 2025
**Architecture**: See `/docs/FORUMS_SERVICES_ARCHITECTURE.md`
