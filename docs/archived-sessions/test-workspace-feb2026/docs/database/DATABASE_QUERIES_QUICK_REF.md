# Database Queries Quick Reference

**TL;DR**: Always use `dbPool.getConnection()`, never create Database instances, always use prepared statements.

---

## Access Pattern (ALWAYS)

```typescript
// ✅ CORRECT - Use the singleton pool
import { dbPool } from '@/lib/database/pool';

const db = dbPool.getConnection('users');
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

**Never do this**:
```typescript
// ❌ WRONG - Creates connection leak
import Database from 'better-sqlite3';
const db = new Database('./data/users.db'); // NEVER
```

---

## Prepared Statements (Always Use)

### Positional Placeholders (?)
```typescript
// ✅ CORRECT
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

const rows = db.prepare(
  'SELECT * FROM users WHERE age > ? AND status = ?'
).all(minAge, 'active');
```

### Named Placeholders (@)
```typescript
// ✅ CORRECT - More readable for multiple params
const user = db.prepare(
  'SELECT * FROM users WHERE id = @id AND email = @email'
).get({ id: userId, email: userEmail });
```

### Named Placeholders ($)
```typescript
// ✅ CORRECT - Alternative syntax
const user = db.prepare(
  'SELECT * FROM users WHERE id = $id'
).get({ $id: userId });
```

---

## SELECT Queries

### Single Row
```typescript
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
// Returns: { id: 1, name: 'Alice', ... } or undefined
```

### Multiple Rows
```typescript
const activeUsers = db.prepare('SELECT * FROM users WHERE status = ?').all('active');
// Returns: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
```

### Single Value
```typescript
const count = db.prepare('SELECT COUNT(*) as total FROM users').get();
// Returns: { total: 42 }
console.log(count.total); // 42
```

### Column Count
```typescript
const result = db.prepare('SELECT id FROM posts WHERE author_id = ?').all(userId);
const count = result.length;
```

---

## INSERT Queries

### Single Insert
```typescript
const result = db.prepare(
  'INSERT INTO users (name, email) VALUES (?, ?)'
).run(name, email);

console.log(result.lastInsertRowid); // New ID
console.log(result.changes); // Number of rows inserted (1)
```

### Insert with Returning (SQLite 3.35+)
```typescript
const user = db.prepare(
  'INSERT INTO users (name, email) VALUES (?, ?) RETURNING *'
).get(name, email);

console.log(user.id); // Newly inserted ID
```

### Bulk Insert
```typescript
const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');

// Start transaction for performance
const transaction = db.transaction((users) => {
  for (const user of users) {
    insert.run(user.name, user.email);
  }
});

const usersToInsert = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
];

transaction(usersToInsert);
```

---

## UPDATE Queries

### Simple Update
```typescript
const result = db.prepare(
  'UPDATE users SET name = ? WHERE id = ?'
).run(newName, userId);

console.log(result.changes); // 1 if successful
```

### Conditional Update
```typescript
const result = db.prepare(
  'UPDATE posts SET status = ? WHERE author_id = ? AND created_at > ?'
).run(newStatus, authorId, cutoffDate);
```

### Update Multiple Columns
```typescript
db.prepare(
  'UPDATE users SET name = @name, email = @email, updated_at = @now WHERE id = @id'
).run({
  name: newName,
  email: newEmail,
  now: new Date().toISOString(),
  id: userId,
});
```

---

## DELETE Queries

### Delete with WHERE
```typescript
const result = db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
console.log(result.changes); // Number of rows deleted
```

### Soft Delete (Better)
```typescript
// Prefer soft deletes over hard deletes
db.prepare(
  'UPDATE posts SET deleted_at = ? WHERE id = ?'
).run(new Date().toISOString(), postId);

// When selecting, filter out soft-deleted rows
const activePosts = db.prepare(
  'SELECT * FROM posts WHERE deleted_at IS NULL'
).all();
```

---

## Transactions

### Basic Transaction
```typescript
const transaction = db.transaction(() => {
  db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice');
  db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(1);
  // If either fails, both are rolled back
});

transaction();
```

### Transaction with Error Handling
```typescript
try {
  db.transaction(() => {
    db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice');
    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(1);
  })();
} catch (error) {
  console.error('Transaction failed:', error);
  // All changes rolled back automatically
}
```

### Transaction with Arguments
```typescript
const createUserWithProfile = db.transaction((userData, profileData) => {
  const userResult = db.prepare(
    'INSERT INTO users (name, email) VALUES (?, ?)'
  ).run(userData.name, userData.email);

  db.prepare(
    'INSERT INTO profiles (user_id, bio) VALUES (?, ?)'
  ).run(userResult.lastInsertRowid, profileData.bio);
});

createUserWithProfile(
  { name: 'Alice', email: 'alice@example.com' },
  { bio: 'A developer' }
);
```

---

## Common Patterns

### Get or Create
```typescript
// Check if exists, create if not
let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

if (!user) {
  const result = db.prepare(
    'INSERT INTO users (email, name) VALUES (?, ?)'
  ).run(email, name);

  user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

return user;
```

### Increment Counter
```typescript
db.prepare(
  'UPDATE posts SET view_count = view_count + 1 WHERE id = ?'
).run(postId);
```

### Get Recent Items
```typescript
const recentPosts = db.prepare(
  'SELECT * FROM posts ORDER BY created_at DESC LIMIT ?'
).all(10);
```

### Join Query
```typescript
const postsWithAuthor = db.prepare(`
  SELECT
    p.id, p.title, p.content,
    u.id as author_id, u.name as author_name
  FROM posts p
  JOIN users u ON p.author_id = u.id
  WHERE p.id = ?
`).get(postId);
```

### Count with GROUP BY
```typescript
const stats = db.prepare(`
  SELECT status, COUNT(*) as count
  FROM posts
  GROUP BY status
`).all();

// Returns: [
//   { status: 'published', count: 42 },
//   { status: 'draft', count: 8 }
// ]
```

---

## Error Handling

### Catch Database Errors
```typescript
try {
  db.prepare(
    'INSERT INTO users (id, name) VALUES (?, ?)'
  ).run(duplicateId, 'Alice');
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.error('User already exists');
    } else if (error.message.includes('FOREIGN KEY constraint failed')) {
      console.error('Referenced user does not exist');
    } else {
      console.error('Database error:', error.message);
    }
  }
}
```

### Use Result Pattern (Services)
```typescript
// lib/forums/repositories/topic-repository.ts
import { Result, success, failure } from '@/lib/utils/result';

export class TopicRepository {
  createTopic(data: CreateTopicInput): Result<Topic> {
    try {
      const db = dbPool.getConnection('forums');
      const result = db.prepare(
        'INSERT INTO topics (title, content, category_id, author_id) VALUES (?, ?, ?, ?)'
      ).run(data.title, data.content, data.categoryId, data.authorId);

      const topic = db.prepare('SELECT * FROM topics WHERE id = ?')
        .get(result.lastInsertRowid);

      return success(topic);
    } catch (error) {
      return failure({
        code: 'DB_INSERT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
```

---

## Performance Tips

### 1. Use Transactions for Bulk Operations
```typescript
// ❌ SLOW - 1000 individual queries
for (const user of users) {
  db.prepare('INSERT INTO users (name) VALUES (?)').run(user.name);
}

// ✅ FAST - Single transaction
const insert = db.transaction((users) => {
  for (const user of users) {
    db.prepare('INSERT INTO users (name) VALUES (?)').run(user.name);
  }
});
insert(users);
```

### 2. Use Indexes for Frequently Queried Columns
```typescript
// Schema already has indexes, but remember:
// - Users: id (primary key), email (unique)
// - Posts: id, author_id, created_at
// - Searches use FTS5 virtual tables

// Check if query uses index:
db.prepare('EXPLAIN QUERY PLAN SELECT * FROM posts WHERE author_id = ?').all(userId);
```

### 3. Limit Results Early
```typescript
// ✅ GOOD - Fetch only what you need
const posts = db.prepare(
  'SELECT * FROM posts ORDER BY created_at DESC LIMIT 20'
).all();

// ❌ BAD - Fetch all then slice in code
const allPosts = db.prepare('SELECT * FROM posts').all();
const posts = allPosts.slice(0, 20);
```

### 4. Use Pagination for Large Datasets
```typescript
const page = 1;
const pageSize = 20;
const offset = (page - 1) * pageSize;

const posts = db.prepare(
  'SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?'
).all(pageSize, offset);
```

---

## Database Selection Guide

| Data | Database | Table |
|------|----------|-------|
| User profiles | users.db | users |
| Sessions | auth.db | sessions |
| Forum topics | forums.db | topics |
| Forum replies | forums.db | replies |
| Forum categories | forums.db | categories |
| Wiki pages | wiki.db | wiki_pages |
| Wiki revisions | wiki.db | wiki_revisions |
| Library documents | library.db | library_documents |
| Messages | messaging.db | messages |
| Projects | content.db | projects |
| Workspaces | content.db | workspaces |
| System config | system.db | system_config |

---

## See Also

- Full database architecture: [docs/DATABASE.md](../../docs/DATABASE.md)
- Banned patterns: [BANNED_PATTERNS.md](./BANNED_PATTERNS.md)
- Pool implementation: [frontend/src/lib/database/pool.ts](../../frontend/src/lib/database/pool.ts)
