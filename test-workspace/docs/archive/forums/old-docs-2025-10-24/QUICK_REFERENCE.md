# Forum Repositories - Quick Reference

One-page reference for common repository operations.

## Import

```typescript
import { repositories } from '@/lib/forums/repositories';
// Or individual imports:
import { topicRepository, replyRepository, categoryRepository, searchRepository } from '@/lib/forums/repositories';
```

## Categories

```typescript
// Get all categories
const result = repositories.categories.findAll();

// Get category by slug
const result = repositories.categories.findBySlug('general-discussion');

// Get category stats
const result = repositories.categories.getStats(categoryId);
```

## Topics

```typescript
// Create topic
const result = repositories.topics.create({
  title: 'My Topic',
  content: 'Content here...',
  category_id: categoryId,
  author_id: userId,
});

// Find topic with author
const result = repositories.topics.findById(topicId, true);

// List topics in category (with pagination)
const result = repositories.topics.findByCategory(categoryId, {
  page: 1,
  limit: 20,
  sort_by: 'last_activity_at',
  sort_order: 'desc',
});

// Update topic
const result = repositories.topics.update(topicId, {
  title: 'Updated Title',
  is_pinned: true,
});

// Delete topic
const result = repositories.topics.delete(topicId);

// Moderation
repositories.topics.pin(topicId, true);
repositories.topics.lock(topicId, true);
repositories.topics.markSolved(topicId);

// Track view
repositories.topics.incrementViewCount(topicId);
```

## Replies

```typescript
// Create top-level reply
const result = repositories.replies.create({
  topic_id: topicId,
  parent_id: null,
  author_id: userId,
  content: 'My reply...',
});

// Create nested reply (up to 5 levels)
const result = repositories.replies.create({
  topic_id: topicId,
  parent_id: parentReplyId,
  author_id: userId,
  content: 'Nested reply...',
});

// Get all replies for topic (flat list)
const result = repositories.replies.findByTopic(topicId);

// Get nested reply tree
const result = repositories.replies.getReplyTree(topicId);

// Update reply
const result = repositories.replies.update(replyId, {
  content: 'Updated content...',
});

// Mark as solution
const result = repositories.replies.markAsSolution(replyId);

// Delete reply (cascades to children)
const result = repositories.replies.delete(replyId);
```

## Search

```typescript
// Search topics
const result = repositories.search.searchTopics('rust programming', {
  page: 1,
  limit: 20,
  sort_by: 'relevance',
  category_id: categoryId, // Optional
});

// Search replies
const result = repositories.search.searchReplies('error handling');

// Search both topics and replies
const result = repositories.search.searchAll('react hooks', {
  page: 1,
  limit: 20,
  sort_by: 'relevance',
});

// Get search suggestions (autocomplete)
const result = repositories.search.getSearchSuggestions('react', 10);

// FTS5 query syntax:
// - Simple: "rust programming"
// - Phrase: '"exact match"'
// - Boolean: "rust AND programming"
// - Exclude: "rust NOT javascript"
// - Prefix: "prog*"
```

## Result Pattern

```typescript
const result = repositories.topics.findById(topicId);

// Check success
if (result.isOk()) {
  const topic = result.value;
  console.log('Topic:', topic.title);
} else {
  const error = result.error;
  console.error('Error:', error.type, error.message);
}

// Error types:
// - not_found: Entity doesn't exist
// - database: Database operation failed
// - validation: Input validation failed
// - constraint: Database constraint violation
```

## Pagination

```typescript
const result = repositories.topics.findByCategory(categoryId, {
  page: 1,
  limit: 20,
});

if (result.isOk()) {
  const { results, pagination } = result.value;

  console.log('Topics:', results);
  console.log('Page:', pagination.page);
  console.log('Total:', pagination.total);
  console.log('Total pages:', pagination.total_pages);
  console.log('Has next:', pagination.has_next);
}
```

## Nested Reply Tree

```typescript
const result = repositories.replies.getReplyTree(topicId);

if (result.isOk()) {
  const replies = result.value;

  // Render nested structure
  replies.forEach(reply => {
    console.log('Reply:', reply.content);
    console.log('Depth:', reply.reply_depth);

    // Nested children
    reply.children?.forEach(child => {
      console.log('  - Child:', child.content);
      console.log('    Depth:', child.reply_depth);
    });
  });
}
```

## Common Patterns

### Create → Check → Use

```typescript
const result = repositories.topics.create(data);

if (result.isErr()) {
  return handleError(result.error);
}

const topic = result.value;
// Use topic...
```

### Find → Check Null → Use

```typescript
const result = repositories.topics.findById(topicId);

if (result.isErr()) {
  return handleError(result.error);
}

if (result.value === null) {
  return notFound();
}

const topic = result.value;
// Use topic...
```

### List → Check → Render

```typescript
const result = repositories.topics.findByCategory(categoryId, {
  page: pageNum,
  limit: 20,
});

if (result.isErr()) {
  return handleError(result.error);
}

const { results: topics, pagination } = result.value;
// Render topics and pagination...
```

## Type Safety

All IDs are branded types:

```typescript
import type { TopicId, ReplyId, CategoryId, UserId } from '@/lib/forums/types';

// Type-safe IDs prevent mixing
const topicId: TopicId = 1 as TopicId;
const replyId: ReplyId = 2 as ReplyId;

// This would be a compile error:
// repositories.topics.findById(replyId); // Error!
```

## Transaction Safety

All write operations use transactions:

```typescript
// Automatic transaction with rollback on error
const result = repositories.topics.create(data);

// If any error occurs during creation, the entire
// transaction is rolled back automatically
```

## Cross-Database Queries

Users are in auth.db, automatically fetched:

```typescript
// Topic includes author info
const result = repositories.topics.findById(topicId, true);

if (result.isOk() && result.value) {
  const topic = result.value;
  console.log('Author:', topic.author?.username);
}
```

## Performance Tips

1. **Use pagination** - Don't fetch all results at once
2. **Include author flag** - Set to false if you don't need user data
3. **Batch operations** - Repositories automatically batch user queries
4. **Use FTS5** - For search, don't use LIKE queries
5. **Cache results** - Consider caching frequently accessed data

## Common Mistakes

❌ **Don't create Database instances**
```typescript
// WRONG
const db = new Database('forums.db');
```

✅ **Use repositories**
```typescript
// CORRECT
const result = repositories.topics.findAll();
```

❌ **Don't ignore errors**
```typescript
// WRONG
const topic = repositories.topics.findById(id).value; // Can crash!
```

✅ **Check Result**
```typescript
// CORRECT
const result = repositories.topics.findById(id);
if (result.isOk()) {
  const topic = result.value;
}
```

❌ **Don't mix ID types**
```typescript
// WRONG (if not using branded types properly)
repositories.topics.findById(replyId);
```

✅ **Use correct types**
```typescript
// CORRECT
repositories.topics.findById(topicId as TopicId);
```

## Documentation

- Full documentation: `README.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- This quick reference: `QUICK_REFERENCE.md`
