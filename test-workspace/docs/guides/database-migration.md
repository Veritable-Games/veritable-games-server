# Database Type Safety Migration Guide

This guide helps migrate from `any` type assertions to fully type-safe database operations.

## Overview

We're eliminating 99% of `any` usage in database operations by:
1. **Generated Types**: Auto-generated TypeScript interfaces from database schemas
2. **Type-Safe Query Builder**: Compile-time type checking for all database operations
3. **Result Pattern**: Consistent error handling without exceptions

## Migration Steps

### Step 1: Generate Database Types

```bash
# Generate types from current database schemas
node scripts/generate-database-types.js
```

This creates:
- `src/types/generated/forums-types.ts`
- `src/types/generated/wiki-types.ts`
- `src/types/generated/users-types.ts`
- etc.

### Step 2: Replace Raw Database Access

**BEFORE (with 'any'):**
```typescript
// ❌ OLD: Direct database access with 'any'
const db = dbPool.getConnection('forums');
const stmt = db.prepare('SELECT * FROM topics WHERE id = ?');
const topic = stmt.get(topicId) as any; // 'any' assertion!
```

**AFTER (type-safe):**
```typescript
// ✅ NEW: Type-safe query builder
import { QueryBuilders } from '@/lib/database/query-builder';
import { Topic } from '@/types/generated/forums-types';

const topicsBuilder = QueryBuilders.forums<Topic>('topics');
const result = topicsBuilder.selectOne('*', { id: topicId });

if (result.isOk()) {
  const topic = result.value; // Fully typed Topic | null
} else {
  console.error('Query failed:', result.error);
}
```

### Step 3: Service Layer Migration Pattern

**Example: Forums Service Migration**

```typescript
// Before: forums/service.ts
export class ForumService {
  private db: Database.Database;

  constructor() {
    this.db = dbPool.getConnection('forums');
  }

  // ❌ OLD: 'any' everywhere
  getTopic(id: number): any {
    const stmt = this.db.prepare('SELECT * FROM topics WHERE id = ?');
    return stmt.get(id) as any;
  }

  createTopic(data: any): any {
    const stmt = this.db.prepare(`
      INSERT INTO topics (title, content, category_id, user_id)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(data.title, data.content, data.categoryId, data.userId) as any;
  }
}
```

```typescript
// After: forums/service.ts
import { QueryBuilders } from '@/lib/database/query-builder';
import { Topic, TopicInsert } from '@/types/generated/forums-types';
import { Result, Ok, Err } from '@/lib/utils/result';

export class ForumService {
  private topics = QueryBuilders.forums<Topic>('topics');

  // ✅ NEW: Fully typed with error handling
  getTopic(id: ForumId): Result<Topic | null, ServiceError> {
    const result = this.topics.selectOne('*', { id });

    if (!result.isOk()) {
      return Err(new ServiceError('Failed to get topic', result.error));
    }

    return Ok(result.value);
  }

  createTopic(data: TopicInsert): Result<Topic, ServiceError> {
    const insertResult = this.topics.insert(data, { returning: ['*'] });

    if (!insertResult.isOk()) {
      return Err(new ServiceError('Failed to create topic', insertResult.error));
    }

    // Get the created topic
    const topicResult = this.topics.selectOne('*', {
      id: insertResult.value.lastInsertRowid
    });

    if (!topicResult.isOk() || !topicResult.value) {
      return Err(new ServiceError('Failed to retrieve created topic'));
    }

    return Ok(topicResult.value);
  }
}
```

## Common Migration Patterns

### 1. Simple SELECT Queries

```typescript
// ❌ BEFORE
const stmt = db.prepare('SELECT id, title FROM topics WHERE category_id = ?');
const topics = stmt.all(categoryId) as any[];

// ✅ AFTER
const result = topicsBuilder.select(['id', 'title'], {
  where: { category_id: categoryId }
});
if (result.isOk()) {
  const topics = result.value; // Pick<Topic, 'id' | 'title'>[]
}
```

### 2. INSERT Operations

```typescript
// ❌ BEFORE
const stmt = db.prepare(`
  INSERT INTO topics (title, content, user_id)
  VALUES (?, ?, ?)
`);
const result = stmt.run(title, content, userId) as any;

// ✅ AFTER
const result = topicsBuilder.insert({
  title,
  content,
  user_id: userId
});
if (result.isOk()) {
  const topicId = result.value.lastInsertRowid;
}
```

### 3. Complex Queries with JOINs

```typescript
// ❌ BEFORE (cross-table queries)
const stmt = db.prepare(`
  SELECT t.*, u.username
  FROM topics t
  JOIN users u ON t.user_id = u.id
  WHERE t.category_id = ?
`);
const results = stmt.all(categoryId) as any[];

// ✅ AFTER (use multiple builders + aggregation)
const topicsResult = topicsBuilder.select('*', {
  where: { category_id: categoryId }
});

if (topicsResult.isOk()) {
  const topics = topicsResult.value;

  // Get user info separately (respects database boundaries)
  const userIds = topics.map(t => t.user_id);
  const usersResult = usersBuilder.select(['id', 'username'], {
    where: { id: { $in: userIds } }
  });

  // Combine results
  const enrichedTopics = topics.map(topic => ({
    ...topic,
    username: users.find(u => u.id === topic.user_id)?.username
  }));
}
```

### 4. Transactions

```typescript
// ❌ BEFORE
const transaction = db.transaction(() => {
  const topicResult = db.prepare('INSERT INTO topics ...').run(...) as any;
  const activityResult = db.prepare('INSERT INTO activity ...').run(...) as any;
  return { topicResult, activityResult };
});

// ✅ AFTER
const result = topicsBuilder.transaction((builder) => {
  const topicResult = builder.insert(topicData);
  if (!topicResult.isOk()) return topicResult;

  const activityResult = activityBuilder.insert({
    type: 'topic_created',
    topic_id: topicResult.value.lastInsertRowid
  });
  if (!activityResult.isOk()) return activityResult;

  return Ok({ topic: topicResult.value, activity: activityResult.value });
});
```

## Service Migration Checklist

For each service file:

- [ ] Import generated types: `import { User, UserInsert } from '@/types/generated/users-types'`
- [ ] Replace `Database.Database` with appropriate query builders
- [ ] Change all method return types from `any` to proper types
- [ ] Wrap operations in `Result<T, E>` pattern
- [ ] Replace `stmt.get()` with `builder.selectOne()`
- [ ] Replace `stmt.all()` with `builder.select()`
- [ ] Replace `stmt.run()` with `builder.insert/update/delete()`
- [ ] Add proper error handling for all database operations
- [ ] Remove all `as any` type assertions

## Type Generation Updates

When database schema changes:

1. **Update schema**: Modify database migration
2. **Regenerate types**: Run `node scripts/generate-database-types.js`
3. **Update services**: TypeScript will show compilation errors for any mismatched types
4. **Test thoroughly**: Type safety catches issues at compile time

## Performance Considerations

- **Query Builder Overhead**: Minimal - the builder generates the same SQL as manual queries
- **Type Checking**: Zero runtime overhead - all type checking happens at compile time
- **Bundle Size**: Generated types don't increase bundle size (they're compile-time only)

## Error Handling Best Practices

```typescript
// ✅ Consistent error handling pattern
async function getUserTopics(userId: UserId): Promise<Result<Topic[], ServiceError>> {
  const result = topicsBuilder.select('*', {
    where: { user_id: userId },
    orderBy: [{ column: 'created_at', direction: 'DESC' }]
  });

  if (!result.isOk()) {
    // Log the database error but return a service error
    logger.error('Database error in getUserTopics:', result.error);
    return Err(new ServiceError('Failed to retrieve user topics'));
  }

  return Ok(result.value);
}
```

## Migration Priority

1. **High Priority**: Services with most database operations (Forums, Wiki, Users)
2. **Medium Priority**: Admin services and content management
3. **Low Priority**: System and monitoring services

Start with one service, test thoroughly, then move to the next. The type system will guide you through any breaking changes.