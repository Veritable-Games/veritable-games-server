# Forums Type System - Quick Start Guide

This guide provides quick examples for using the new type-safe foundation in the forums module.

## Table of Contents

1. [Basic Imports](#basic-imports)
2. [Working with Branded Types](#working-with-branded-types)
3. [Validating Input with Schemas](#validating-input-with-schemas)
4. [Using the Result Pattern](#using-the-result-pattern)
5. [API Route Example](#api-route-example)
6. [Service Layer Example](#service-layer-example)
7. [React Component Example](#react-component-example)
8. [Common Patterns](#common-patterns)

---

## Basic Imports

```typescript
// Branded types
import { TopicId, ReplyId, CategoryId, UserId } from '@/lib/forums/branded-types';
import { toTopicId, toCategoryId, unsafeToTopicId } from '@/lib/forums/branded-types';

// Schemas
import { CreateTopicDTOSchema, parseSchema } from '@/lib/forums/schemas';

// Type definitions
import { ForumTopic, ForumReply, ServiceError, NotFoundError } from '@/lib/forums/types';

// Result pattern
import { Result, Ok, Err } from '@/lib/utils/result';
```

---

## Working with Branded Types

### Converting User Input to Branded Types

```typescript
// Safe conversion (throws on invalid)
try {
  const topicId = toTopicId(request.params.id);
  // Use topicId...
} catch (error) {
  return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
}

// Safe conversion with fallback (returns null on invalid)
const topicId = toTopicIdSafe(request.params.id);
if (!topicId) {
  return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 });
}
```

### Using Branded Types in Function Signatures

```typescript
// ✅ GOOD: Explicit about what type of ID is needed
async function getTopicById(id: TopicId): Promise<Result<ForumTopic, NotFoundError>> {
  // Implementation...
}

// ❌ BAD: Ambiguous - could be any ID
async function getTopicById(id: number): Promise<ForumTopic> {
  // Implementation...
}
```

### Database Layer Conversion

```typescript
// Convert database results to branded types
function queryTopic(id: TopicId): ForumTopic | null {
  const row = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);

  if (!row) return null;

  return {
    ...row,
    id: unsafeToTopicId(row.id), // Unsafe = no validation (trusted source)
    category_id: unsafeToCategoryId(row.category_id),
    user_id: unsafeToUserId(row.user_id),
  };
}
```

---

## Validating Input with Schemas

### Validate API Request Body

```typescript
export const POST = withSecurity(async (request) => {
  const body = await request.json();

  // Validate and transform in one step
  try {
    const validatedData = parseSchema(CreateTopicDTOSchema, body, 'Topic');

    // validatedData is now type-safe with branded types
    // validatedData.category_id is CategoryId (not string)
    // validatedData.title is guaranteed to be 3-200 characters

    const result = await createTopic(validatedData);
    // ...
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: { message: error.message },
    }, { status: 400 });
  }
}, {
  csrfEnabled: true,
  requireAuth: true,
});
```

### Validate with Custom Error Handling

```typescript
import { validateSchema, CreateTopicDTOSchema } from '@/lib/forums/schemas';

const body = await request.json();
const result = validateSchema(CreateTopicDTOSchema, body);

if (!result.success) {
  return NextResponse.json({
    success: false,
    errors: result.errors, // Array of detailed error messages
  }, { status: 400 });
}

const validatedData = result.data; // Type-safe data
```

---

## Using the Result Pattern

### Basic Result Pattern

```typescript
import { Result, Ok, Err } from '@/lib/utils/result';
import { NotFoundError, DatabaseError } from '@/lib/forums/types';

async function getTopic(id: TopicId): Promise<Result<ForumTopic, NotFoundError | DatabaseError>> {
  try {
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(id);

    if (!topic) {
      return Err(new NotFoundError('Topic', id));
    }

    return Ok(topic);
  } catch (error) {
    return Err(new DatabaseError('Failed to fetch topic', error));
  }
}
```

### Handling Result in API Routes

```typescript
const result = await getTopic(topicId);

if (result.isErr()) {
  const error = result.error;

  if (isNotFoundError(error)) {
    return NextResponse.json({
      success: false,
      error: { code: error.code, message: error.message },
    }, { status: 404 });
  }

  if (isDatabaseError(error)) {
    return NextResponse.json({
      success: false,
      error: { code: error.code, message: error.message },
    }, { status: 500 });
  }
}

// If we get here, result.value is guaranteed to exist
const topic = result.value;
return NextResponse.json({ success: true, data: topic });
```

### Chaining Results

```typescript
import { ResultUtils } from '@/lib/utils/result';

// Transform success value
const result = await getTopic(topicId);
const titleResult = ResultUtils.map(result, topic => topic.title.toUpperCase());

// Chain operations
const enrichedResult = ResultUtils.andThen(result, async (topic) => {
  return await getTopicWithReplies(topic.id);
});

// Handle errors
if (enrichedResult.isErr()) {
  console.error(enrichedResult.error.message);
}
```

---

## API Route Example

Complete example of a type-safe API route:

```typescript
// /app/api/forums/topics/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { toTopicId } from '@/lib/forums/branded-types';
import { isNotFoundError, isDatabaseError } from '@/lib/forums/types';
import { forumService } from '@/lib/forums/service';

export const GET = withSecurity(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    // 1. Validate and convert ID
    const topicId = toTopicId(Number(params.id));

    // 2. Call service layer (returns Result)
    const result = await forumService.getTopicById(topicId);

    // 3. Handle result
    if (result.isErr()) {
      const error = result.error;

      if (isNotFoundError(error)) {
        return NextResponse.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: { code: error.code, message: error.message },
      }, { status: 500 });
    }

    // 4. Return success
    return NextResponse.json({
      success: true,
      data: result.value,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    }, { status: 500 });
  }
}, {
  csrfEnabled: false, // GET requests don't need CSRF
  requireAuth: false, // Public endpoint
  rateLimitConfig: 'api',
});

export const DELETE = withSecurity(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const session = await getSession(request);
  const userId = toUserId(session.userId);

  try {
    const topicId = toTopicId(Number(params.id));
    const result = await forumService.deleteTopic(topicId, userId);

    if (result.isErr()) {
      const error = result.error;

      if (isPermissionError(error)) {
        return NextResponse.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, { status: 403 });
      }

      if (isNotFoundError(error)) {
        return NextResponse.json({
          success: false,
          error: { code: error.code, message: error.message },
        }, { status: 404 });
      }

      return NextResponse.json({
        success: false,
        error: { code: error.code, message: error.message },
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    }, { status: 500 });
  }
}, {
  csrfEnabled: true,
  requireAuth: true,
  rateLimitConfig: 'api',
});
```

---

## Service Layer Example

Complete example of a type-safe service method:

```typescript
// /lib/forums/services/ForumTopicService.ts
import { dbPool } from '@/lib/database/pool';
import { Result, Ok, Err } from '@/lib/utils/result';
import { TopicId, UserId, CategoryId, unsafeToTopicId } from '@/lib/forums/branded-types';
import { TopicSchema, parseSchema } from '@/lib/forums/schemas';
import {
  ForumTopic,
  CreateTopicData,
  NotFoundError,
  DatabaseError,
  ValidationError,
  PermissionError,
  DatabaseRow,
} from '@/lib/forums/types';

export class ForumTopicService {
  private db = dbPool.getConnection('forums');

  /**
   * Get topic by ID
   */
  async getTopicById(
    id: TopicId,
    incrementView = true
  ): Promise<Result<ForumTopic, NotFoundError | DatabaseError>> {
    try {
      // Increment view count if requested
      if (incrementView) {
        this.db.prepare('UPDATE topics SET view_count = view_count + 1 WHERE id = ?').run(id);
      }

      // Query database
      const row = this.db.prepare(`
        SELECT
          t.*,
          u.username,
          u.display_name,
          c.name as category_name,
          c.color as category_color
        FROM topics t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
      `).get(id) as DatabaseRow<ForumTopic> | undefined;

      if (!row) {
        return Err(new NotFoundError('Topic', id));
      }

      // Convert to domain entity
      const topic: ForumTopic = {
        ...row,
        id: unsafeToTopicId(row.id),
        category_id: unsafeToCategoryId(row.category_id),
        user_id: unsafeToUserId(row.user_id),
        last_reply_user_id: row.last_reply_user_id
          ? unsafeToUserId(row.last_reply_user_id)
          : undefined,
      };

      // Validate with schema (extra safety layer)
      const validated = parseSchema(TopicSchema, topic, 'Topic');

      return Ok(validated);

    } catch (error) {
      if (error instanceof NotFoundError) {
        return Err(error);
      }
      return Err(new DatabaseError('Failed to fetch topic', error));
    }
  }

  /**
   * Create new topic
   */
  async createTopic(
    data: CreateTopicData,
    userId: UserId
  ): Promise<Result<ForumTopic, ValidationError | DatabaseError>> {
    try {
      // Validate category exists
      const categoryExists = this.db.prepare(
        'SELECT 1 FROM categories WHERE id = ?'
      ).get(data.category_id);

      if (!categoryExists) {
        return Err(new ValidationError('Category not found', {
          category_id: ['Invalid category'],
        }));
      }

      // Insert topic
      const stmt = this.db.prepare(`
        INSERT INTO topics (
          category_id, title, content, user_id,
          status, is_pinned, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const info = stmt.run(
        data.category_id,
        data.title,
        data.content,
        userId,
        data.status || 'open',
        data.is_pinned ? 1 : 0
      );

      // Fetch created topic
      const topicId = unsafeToTopicId(Number(info.lastInsertRowid));
      return await this.getTopicById(topicId, false);

    } catch (error) {
      return Err(new DatabaseError('Failed to create topic', error));
    }
  }

  /**
   * Delete topic
   */
  async deleteTopic(
    id: TopicId,
    userId: UserId
  ): Promise<Result<void, NotFoundError | PermissionError | DatabaseError>> {
    try {
      // Get topic to check permissions
      const topicResult = await this.getTopicById(id, false);

      if (topicResult.isErr()) {
        return topicResult as Result<void, NotFoundError | DatabaseError>;
      }

      const topic = topicResult.value;

      // Check permissions
      if (topic.user_id !== userId) {
        // Check if user is admin
        const user = this.db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;

        if (!user || user.role !== 'admin') {
          return Err(new PermissionError('You can only delete your own topics'));
        }
      }

      // Delete topic
      this.db.prepare('DELETE FROM topics WHERE id = ?').run(id);

      return Ok(undefined);

    } catch (error) {
      return Err(new DatabaseError('Failed to delete topic', error));
    }
  }
}
```

---

## React Component Example

Complete example of a type-safe React component:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { TopicId } from '@/lib/forums/branded-types';
import { ForumTopic, APIResponse } from '@/lib/forums/types';

interface TopicViewProps {
  topicId: TopicId; // Branded type in props
}

export function TopicView({ topicId }: TopicViewProps) {
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTopic() {
      try {
        const response = await fetch(`/api/forums/topics/${topicId}`);
        const data: APIResponse<ForumTopic> = await response.json();

        if (data.success) {
          setTopic(data.data);
        } else {
          setError(data.error.message);
        }
      } catch (err) {
        setError('Failed to load topic');
      } finally {
        setLoading(false);
      }
    }

    fetchTopic();
  }, [topicId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!topic) {
    return <div>Topic not found</div>;
  }

  return (
    <div>
      <h1>{topic.title}</h1>
      <div>{topic.content}</div>
      <div>By: {topic.username}</div>
      <div>Views: {topic.view_count}</div>
      <div>Replies: {topic.reply_count}</div>
    </div>
  );
}
```

---

## Common Patterns

### Pattern 1: API Input Validation

```typescript
// Always validate user input with schemas
const body = await request.json();
const validatedData = parseSchema(CreateTopicDTOSchema, body);
// Now validatedData has branded types and is validated
```

### Pattern 2: Database Query Results

```typescript
// Convert database results to branded types
const rows = db.prepare('SELECT * FROM topics').all() as DatabaseRow<ForumTopic>[];

const topics: ForumTopic[] = rows.map(row => ({
  ...row,
  id: unsafeToTopicId(row.id),
  category_id: unsafeToCategoryId(row.category_id),
  user_id: unsafeToUserId(row.user_id),
}));
```

### Pattern 3: Error Handling with Result

```typescript
const result = await service.getTopic(topicId);

if (result.isErr()) {
  // Handle specific error types
  if (isNotFoundError(result.error)) {
    return notFound();
  }
  if (isPermissionError(result.error)) {
    return unauthorized();
  }
  return serverError();
}

// Success case
const topic = result.value;
```

### Pattern 4: Type-Safe Function Signatures

```typescript
// ✅ GOOD: Clear what types are expected
function updateTopic(
  topicId: TopicId,
  userId: UserId,
  data: UpdateTopicData
): Promise<Result<ForumTopic, ServiceError>> {
  // Implementation
}

// ❌ BAD: Ambiguous types
function updateTopic(
  topicId: number,
  userId: number,
  data: any
): Promise<ForumTopic> {
  // Implementation
}
```

### Pattern 5: Chaining Service Calls

```typescript
// Chain multiple operations with Result pattern
async function getTopicWithUserProfile(topicId: TopicId) {
  const topicResult = await topicService.getTopicById(topicId);

  if (topicResult.isErr()) {
    return topicResult;
  }

  const topic = topicResult.value;
  const profileResult = await userService.getProfile(topic.user_id);

  if (profileResult.isErr()) {
    return profileResult;
  }

  return Ok({
    topic: topic,
    profile: profileResult.value,
  });
}
```

---

## Testing with Branded Types

```typescript
import { unsafeToTopicId, unsafeToUserId } from '@/lib/forums/branded-types';

describe('ForumService', () => {
  it('should get topic by ID', async () => {
    const topicId = unsafeToTopicId(1); // Use unsafe in tests for convenience
    const result = await service.getTopicById(topicId);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.id).toBe(topicId);
    }
  });

  it('should return NotFoundError for invalid topic', async () => {
    const topicId = unsafeToTopicId(999999);
    const result = await service.getTopicById(topicId);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(isNotFoundError(result.error)).toBe(true);
    }
  });
});
```

---

## Migration Checklist

When updating existing code to use the new type system:

- [ ] Update function signatures to use branded types
- [ ] Add schema validation at API boundaries
- [ ] Convert service methods to return `Result<T, E>`
- [ ] Replace thrown exceptions with `Err()` returns
- [ ] Add proper error type checking with type guards
- [ ] Update tests to use branded types
- [ ] Verify TypeScript compilation passes
- [ ] Test error handling paths

---

For more details, see:
- **Full Documentation**: `/frontend/FORUMS_TYPE_SYSTEM_REPORT.md`
- **Branded Types**: `/frontend/src/lib/forums/branded-types.ts`
- **Schemas**: `/frontend/src/lib/forums/schemas.ts`
- **Types**: `/frontend/src/lib/forums/types.ts`
- **Result Pattern**: `/frontend/src/lib/utils/result.ts`
