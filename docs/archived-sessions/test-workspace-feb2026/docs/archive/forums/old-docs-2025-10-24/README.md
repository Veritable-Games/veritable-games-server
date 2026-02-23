# Forum Repositories

Comprehensive data access layer for the forum system using the Result pattern for type-safe error handling.

## Overview

The repository layer provides a clean abstraction over database operations with:

- **Result Pattern**: Type-safe error handling without exceptions
- **Singleton Pool**: Uses `dbPool.getConnection()` for all database access
- **Cross-Database Queries**: Handles user data from auth.db properly
- **Transaction Support**: Automatic rollback on errors
- **Branded Types**: Type-safe IDs (TopicId, ReplyId, etc.)
- **FTS5 Search**: Full-text search with SQLite FTS5

## Architecture

```
repositories/
├── base-repository.ts       # Base class with common operations
├── category-repository.ts   # Category CRUD and statistics
├── topic-repository.ts      # Topic management and moderation
├── reply-repository.ts      # Nested replies with tree structure
├── search-repository.ts     # FTS5 full-text search
├── index.ts                # Central export point
└── README.md               # This file
```

## Usage Examples

### Basic Usage

```typescript
import { topicRepository, replyRepository } from '@/lib/forums/repositories';

// Create a topic
const topicResult = await topicRepository.create({
  title: 'How to use React 19?',
  content: 'I need help understanding the new features...',
  category_id: 1 as CategoryId,
  author_id: userId,
});

if (topicResult.isOk()) {
  const topic = topicResult.value;
  console.log('Created topic:', topic.id);
} else {
  console.error('Error:', topicResult.error);
}
```

### Result Pattern

All repository methods return `Result<T, RepositoryError>`:

```typescript
// Check if operation succeeded
if (result.isOk()) {
  const data = result.value; // Type: T
  // Use data...
} else {
  const error = result.error; // Type: RepositoryError
  // Handle error...
}

// Error types:
// - not_found: Entity not found
// - database: Database operation failed
// - validation: Input validation failed
// - constraint: Database constraint violation
```

### Category Repository

```typescript
import { categoryRepository } from '@/lib/forums/repositories';

// Get all categories
const categoriesResult = categoryRepository.findAll();

// Get category by slug
const categoryResult = categoryRepository.findBySlug('general-discussion');

// Get category statistics
const statsResult = categoryRepository.getStats(categoryId);
if (statsResult.isOk()) {
  console.log('Topics:', statsResult.value.topic_count);
  console.log('Replies:', statsResult.value.reply_count);
}

// Create category (admin only)
const newCategoryResult = categoryRepository.create({
  slug: 'announcements',
  name: 'Announcements',
  description: 'Official announcements',
  color: '#10b981',
  display_order: 1,
});
```

### Topic Repository

```typescript
import { topicRepository } from '@/lib/forums/repositories';

// Create topic
const topicResult = topicRepository.create({
  title: 'Welcome to the forums!',
  content: 'This is the first post...',
  category_id: categoryId,
  author_id: userId,
});

// Find topic with author info
const topicResult = topicRepository.findById(topicId, true);

// List topics in category with pagination
const topicsResult = topicRepository.findByCategory(categoryId, {
  page: 1,
  limit: 20,
  sort_by: 'last_activity_at',
  sort_order: 'desc',
  pinned_only: false,
});

if (topicsResult.isOk()) {
  const { results, pagination } = topicsResult.value;
  console.log('Topics:', results);
  console.log('Total pages:', pagination.total_pages);
}

// Update topic
const updateResult = topicRepository.update(topicId, {
  title: 'Updated title',
  is_pinned: true,
});

// Delete topic (cascades to replies)
const deleteResult = topicRepository.delete(topicId);

// Moderation actions
topicRepository.pin(topicId, true);
topicRepository.lock(topicId, true);
topicRepository.markSolved(topicId);

// Increment view count
topicRepository.incrementViewCount(topicId);
```

### Reply Repository

```typescript
import { replyRepository } from '@/lib/forums/repositories';

// Create top-level reply
const replyResult = replyRepository.create({
  topic_id: topicId,
  parent_id: null, // Top-level reply
  author_id: userId,
  content: 'Great question! Here is my answer...',
});

// Create nested reply (up to 5 levels)
const nestedReplyResult = replyRepository.create({
  topic_id: topicId,
  parent_id: parentReplyId, // Reply to another reply
  author_id: userId,
  content: 'I agree with the previous comment...',
});

// Get all replies for a topic (flat list, ordered by path)
const repliesResult = replyRepository.findByTopic(topicId);

// Get nested reply tree (hierarchical structure)
const treeResult = replyRepository.getReplyTree(topicId);
if (treeResult.isOk()) {
  const tree = treeResult.value;
  // tree is an array of top-level replies with nested children
  tree.forEach(reply => {
    console.log('Reply:', reply.content);
    reply.children?.forEach(child => {
      console.log('  - Nested reply:', child.content);
    });
  });
}

// Update reply
const updateResult = replyRepository.update(replyId, {
  content: 'Updated content...',
});

// Mark reply as solution
const solutionResult = replyRepository.markAsSolution(replyId);

// Delete reply (cascades to child replies)
const deleteResult = replyRepository.delete(replyId);
```

### Search Repository

```typescript
import { searchRepository } from '@/lib/forums/repositories';

// Search topics
const topicSearchResult = searchRepository.searchTopics('rust programming', {
  page: 1,
  limit: 20,
  sort_by: 'relevance',
  category_id: categoryId, // Optional filter
});

// Search replies
const replySearchResult = searchRepository.searchReplies('error handling');

// Search both topics and replies
const allSearchResult = searchRepository.searchAll('react hooks', {
  page: 1,
  limit: 20,
  sort_by: 'relevance',
});

if (allSearchResult.isOk()) {
  const { results, pagination } = allSearchResult.value;
  results.forEach(result => {
    if (result.type === 'topic') {
      console.log('Topic:', result.topic?.title);
    } else {
      console.log('Reply in:', result.reply?.topic.title);
    }
    console.log('Excerpt:', result.excerpt);
  });
}

// Get search suggestions (autocomplete)
const suggestionsResult = searchRepository.getSearchSuggestions('react', 10);
if (suggestionsResult.isOk()) {
  console.log('Suggestions:', suggestionsResult.value);
}

// FTS5 query syntax:
// - Simple: "rust programming"
// - Phrase: '"exact match"'
// - Boolean: "rust AND programming"
// - Exclude: "rust NOT javascript"
// - Prefix: "prog*" (matches "programming", "program", etc.)
```

### Using the Convenience Object

```typescript
import { repositories } from '@/lib/forums/repositories';

// Access all repositories through a single object
const categoriesResult = repositories.categories.findAll();
const topicsResult = repositories.topics.findByCategory(categoryId);
const repliesResult = repositories.replies.findByTopic(topicId);
const searchResult = repositories.search.searchAll('query');
```

## Key Features

### 1. Cross-Database User Fetching

Users are stored in `auth.db`, not `forums.db`. The repositories handle this automatically:

```typescript
// BaseRepository provides fetchUser() and fetchUsers()
const userResult = this.fetchUser(userId);
const usersResult = this.fetchUsers([userId1, userId2, userId3]);
```

### 2. Transaction Support

All write operations use transactions for atomicity:

```typescript
// In repository class
protected transaction<T>(
  operation: string,
  callback: (db: Database.Database) => T
): Result<T, RepositoryError> {
  // Automatic rollback on error
}
```

### 3. Nested Replies

Replies support up to 5 levels of nesting with materialized paths:

```typescript
// Materialized path examples:
// Top-level: "1"
// Level 2: "1/5"
// Level 3: "1/5/12"
// Level 4: "1/5/12/25"
// Level 5: "1/5/12/25/42"

// Efficient tree traversal
const treeResult = replyRepository.getReplyTree(topicId);
```

### 4. FTS5 Full-Text Search

SQLite FTS5 with porter stemming and unicode normalization:

```typescript
// Tokenizer: porter unicode61 remove_diacritics 2
// BM25 ranking for relevance scoring
// Supports phrase queries, boolean operators, prefix matching
```

## Error Handling

Repository errors follow a consistent structure:

```typescript
type RepositoryError =
  | { type: 'not_found'; entity: string; id: number | string }
  | { type: 'database'; operation: string; message: string; cause?: unknown }
  | { type: 'validation'; field: string; message: string }
  | { type: 'constraint'; constraint: string; message: string };
```

Example:

```typescript
const result = topicRepository.findById(999);
if (result.isErr()) {
  const error = result.error;
  if (error.type === 'not_found') {
    console.error(`Topic ${error.id} not found`);
  } else if (error.type === 'database') {
    console.error(`Database error in ${error.operation}: ${error.message}`);
  }
}
```

## Performance Considerations

### Connection Pooling

All repositories use `dbPool.getConnection()` which:
- Maintains up to 50 concurrent connections
- Uses LRU eviction policy
- Enables WAL mode for better concurrency
- Thread-safe with mutex

### Pagination

Always use pagination for large result sets:

```typescript
const topicsResult = topicRepository.findByCategory(categoryId, {
  page: 1,
  limit: 20, // Default: 20, max: 100
});
```

### Batch User Fetching

Repositories automatically batch user queries:

```typescript
// Fetches all authors in a single query
const topicsResult = topicRepository.findByCategory(categoryId);
// topics array includes author data for all topics
```

### Search Optimization

FTS5 is highly optimized for text search:
- Indexes are updated automatically via triggers
- BM25 ranking provides relevance scoring
- Supports phrase queries and boolean operators

## Testing

```typescript
import { topicRepository } from '@/lib/forums/repositories';

describe('TopicRepository', () => {
  it('should create a topic', () => {
    const result = topicRepository.create({
      title: 'Test Topic',
      content: 'Test content',
      category_id: 1 as CategoryId,
      author_id: 1 as UserId,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.title).toBe('Test Topic');
    }
  });

  it('should handle not found error', () => {
    const result = topicRepository.findById(99999 as TopicId);

    expect(result.isOk()).toBe(true);
    expect(result.value).toBeNull();
  });
});
```

## Best Practices

1. **Always use Result pattern**: Check `isOk()` before accessing `value`
2. **Use branded types**: Import TopicId, ReplyId, etc. from types
3. **Handle errors explicitly**: Don't ignore `.error` when `isErr()`
4. **Use transactions**: For multi-step operations
5. **Batch user queries**: Repositories do this automatically
6. **Paginate results**: Avoid loading thousands of records
7. **Use FTS5 for search**: Don't use LIKE queries
8. **Validate input**: Repositories do basic validation, but add more in service layer

## Migration from Old Code

If migrating from direct database access:

```typescript
// OLD (direct database access)
const db = new Database('forums.db');
const topics = db.prepare('SELECT * FROM topics WHERE category_id = ?').all(categoryId);

// NEW (repository pattern)
const result = topicRepository.findByCategory(categoryId);
if (result.isOk()) {
  const { results: topics } = result.value;
  // Use topics...
}
```

## Further Reading

- [Result Pattern Documentation](/lib/utils/result.ts)
- [Database Pool Documentation](/lib/database/pool.ts)
- [Forum Types Documentation](/lib/forums/types.ts)
- [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)
