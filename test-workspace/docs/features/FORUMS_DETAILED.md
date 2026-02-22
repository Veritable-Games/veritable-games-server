# Forums System - Detailed Developer Documentation

**Status**: ✅ Production-ready (6 services, 17 API routes)
**Last Updated**: November 10, 2025
**Audience**: Developers building or maintaining forum features

---

## Quick Navigation

### Inline Documentation (Code-Adjacent - Read These!)
These documents are located in the source code next to the actual implementation:

- **[Validation Rules & Schemas](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md)** ⭐ START HERE
  - Zod-based validation system
  - Content sanitization and XSS prevention
  - 32 detailed validation constraints
  - Test examples (467 lines of tests)
  - Type-safe input validation patterns

- **[Type System Quick Reference](../../frontend/src/lib/forums/TYPE_SYSTEM_QUICK_REFERENCE.md)**
  - Forum types and interfaces
  - Reply types and structures
  - Category and section types
  - Validation schema types
  - Quick reference for common types

- **[Type System Full Documentation](../../frontend/src/lib/forums/TYPE_SYSTEM_DOCUMENTATION.md)**
  - Complete type definitions
  - Enum values and constants
  - Type relationships

- **[Validation Quick Reference](../../frontend/src/lib/forums/VALIDATION_QUICK_REFERENCE.md)**
  - Quick lookup for validation rules
  - Min/max constraints
  - Allowed values
  - Error messages

- **[Repository Pattern Implementation](../../frontend/src/lib/forums/repositories/README.md)**
  - Repository pattern overview
  - Service layer architecture
  - Data access patterns
  - Query building strategies

- **[Repository Implementation Summary](../../frontend/src/lib/forums/repositories/IMPLEMENTATION_SUMMARY.md)**
  - How repositories work
  - Service integration
  - Transaction handling

### Central Documentation (System-Level Overview)
High-level guides in the docs folder:

- **[Forums Documentation Index](../forums/FORUMS_DOCUMENTATION_INDEX.md)**
  - Complete forums documentation hub
  - Feature overview
  - API quick reference
  - Service documentation

- **[Forums Database Architecture](../forums/FORUMS_DATABASE_ARCHITECTURE.md)**
  - Database schema
  - Table relationships
  - Indexes and performance

- **[Forums Services Architecture](../forums/FORUMS_SERVICES_ARCHITECTURE.md)**
  - Service descriptions
  - Service interactions
  - Data flow

- **[Forums API Quick Reference](../forums/FORUMS_API_QUICK_REFERENCE.md)**
  - All API endpoints
  - Request/response examples
  - Error handling

### Critical Patterns to Follow
**MUST READ before writing forum code:**

- **[Database Access Pattern](../architecture/CRITICAL_PATTERNS.md#1-database-access-most-critical)**
  - Must use `dbPool.getConnection()` or `dbAdapter`
  - Never create Database instances directly
  - See inline VALIDATION_DOCUMENTATION.md for examples

- **[API Security Pattern](../architecture/CRITICAL_PATTERNS.md#2-api-security)**
  - Wrap routes with `withSecurity` middleware
  - Provides CSRF, session, rate limiting, security headers

- **[Next.js 15 Async Params](../architecture/CRITICAL_PATTERNS.md#3-nextjs-15-async-params)**
  - Routes receive `context: { params: Promise<{...}> }`
  - Must `await context.params` before using

---

## System Overview

### Architecture at a Glance

```
User Request
    ↓
API Route: /api/forums/[action]
    ↓
withSecurity Middleware (CSRF, session, rate limiting)
    ↓
Route Handler (Validation via Zod schemas)
    ↓
Service Layer (ForumService, etc.)
    ↓
Repository Layer (Data access)
    ↓
Database Adapter (PostgreSQL or SQLite)
    ↓
Data Store (PostgreSQL in production, SQLite in dev)
```

### 6 Core Services

| Service | Purpose | File |
|---------|---------|------|
| **ForumService** | Core forum operations (CRUD topics, replies) | `lib/forums/services/forum.ts` |
| **ForumModerationService** | Moderation actions (pin, lock, delete, restore) | `lib/forums/services/moderation.ts` |
| **ForumSearchService** | Full-text search and filtering | `lib/forums/services/search.ts` |
| **ForumStatsService** | Statistics, trending, popular topics | `lib/forums/services/stats.ts` |
| **ForumCategoryService** | Category and section management | `lib/forums/services/category.ts` |
| **ForumSectionService** | Section organization and management | `lib/forums/services/section.ts` |

### 17 API Routes

**Topic Management**:
- `GET /api/forums/topics` - List topics
- `POST /api/forums/topics` - Create topic
- `GET /api/forums/topics/:id` - Get topic
- `PUT /api/forums/topics/:id` - Update topic
- `DELETE /api/forums/topics/:id` - Delete topic

**Replies**:
- `GET /api/forums/topics/:id/replies` - List replies
- `POST /api/forums/topics/:id/replies` - Create reply
- `PUT /api/forums/replies/:id` - Update reply
- `DELETE /api/forums/replies/:id` - Delete reply

**Search & Filter**:
- `GET /api/forums/search` - Full-text search
- `GET /api/forums/topics/category/:id` - Filter by category
- `GET /api/forums/topics/trending` - Trending topics

**Management**:
- `PUT /api/forums/topics/:id/pin` - Pin/unpin
- `PUT /api/forums/topics/:id/lock` - Lock/unlock
- `POST /api/forums/topics/:id/restore` - Restore deleted

**Statistics**:
- `GET /api/forums/stats` - Forum statistics

### Database Schema

**Main Tables**:
- `forums.topics` - Forum topics with content, author, status
- `forums.replies` - Replies to topics with nesting support
- `forums.categories` - Forum categories
- `forums.sections` - Forum sections
- `forums.tags` - Topic tags
- `forums.topic_tags` - Topic to tag mapping
- `forums.moderation_logs` - Moderation action history

See [Forums Database Architecture](../forums/FORUMS_DATABASE_ARCHITECTURE.md) for complete schema.

---

## How to Develop Forum Features

### Adding a New API Route

1. **Define validation schema** in `lib/forums/validation.ts`
   - Use Zod for type-safe validation
   - See [VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md)

2. **Create route handler** in `src/app/api/forums/[feature]/route.ts`
   - Wrap with `withSecurity` middleware
   - Parse and validate request
   - Call appropriate service
   - Handle errors with `errorResponse()`

3. **Use service layer** from `lib/forums/services/`
   - Services handle business logic
   - Services call repositories
   - Services return typed results

4. **Test the route**
   - Create test file in `src/app/api/forums/__tests__/[feature].test.ts`
   - Test validation (valid and invalid inputs)
   - Test authorization (own posts vs others)
   - See [TESTING.md](../guides/TESTING.md)

### Example: Create Topic Route

```typescript
// 1. Validation is already in lib/forums/validation.ts
import { CreateTopicSchema } from '@/lib/forums/validation';

// 2. Create the route
export const POST = withSecurity(async (request) => {
  // Parse request
  const body = await request.json();
  const result = CreateTopicSchema.safeParse(body);

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  // 3. Call service
  const forumService = new ForumService();
  const topic = await forumService.createTopic({
    ...result.data,
    created_by: session.user.id,
  });

  return successResponse(topic, 201);
});

// 4. Write tests
describe('POST /api/forums/topics', () => {
  it('should create a topic', async () => { /* ... */ });
  it('should validate required fields', async () => { /* ... */ });
  it('should prevent XSS in content', async () => { /* ... */ });
});
```

---

## Key Concepts

### Validation (CRITICAL)

All forum input MUST be validated using Zod schemas:

```typescript
import { CreateTopicSchema } from '@/lib/forums/validation';

const result = CreateTopicSchema.safeParse(input);
if (!result.success) {
  // Handle validation errors
  const errors = result.error.issues;
}
```

See [VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md) for all schemas.

### Type Safety

All forum types are in `lib/forums/types.ts`:

```typescript
interface Topic {
  id: number;
  title: string;
  content: string;
  category_id: number;
  created_by: number;
  created_at: Date;
  // ...
}

interface Reply {
  id: number;
  topic_id: number;
  content: string;
  created_by: number;
  parent_id?: number;
  // ...
}
```

See [TYPE_SYSTEM_QUICK_REFERENCE.md](../../frontend/src/lib/forums/TYPE_SYSTEM_QUICK_REFERENCE.md).

### Database Safety

Forum routes use the database adapter safely:

```typescript
import { dbAdapter } from '@/lib/database/adapter';

// Safe - adapter routes to correct DB
const result = await dbAdapter.query(
  'SELECT * FROM forums.topics WHERE id = $1',
  [topicId]
);

// WRONG - creates a new instance
import Database from 'better-sqlite3';
const db = new Database('forums.db'); // ❌ NEVER DO THIS
```

See [CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md#1-database-access-most-critical).

### Security

All forum routes use `withSecurity` middleware:

```typescript
export const POST = withSecurity(async (request) => {
  // Automatically gets:
  // - CSRF protection
  // - Session validation
  // - Rate limiting
  // - Security headers
  // - User identity (session.user.id)
});
```

See [SECURITY_PATTERNS.md](../architecture/SECURITY_PATTERNS.md).

---

## Common Tasks

### Add a New Forum Feature
1. See [FORUMS_DOCUMENTATION_INDEX.md](../forums/FORUMS_DOCUMENTATION_INDEX.md) for planning
2. Update validation schema: `lib/forums/validation.ts`
3. Update types: `lib/forums/types.ts`
4. Create service method in appropriate service class
5. Create API route with `withSecurity`
6. Write tests
7. Update [FORUMS_API_QUICK_REFERENCE.md](../forums/FORUMS_API_QUICK_REFERENCE.md)

### Fix a Validation Bug
1. Review [VALIDATION_DOCUMENTATION.md](../../frontend/src/lib/forums/VALIDATION_DOCUMENTATION.md)
2. Look at test cases (467 tests)
3. Update validation in `validation.ts`
4. Update tests in `__tests__/validation.test.ts`
5. Update relevant API route if needed

### Understand the Data Flow
1. See Architecture Overview above
2. Trace through example in "Example: Create Topic Route"
3. Check database schema in [FORUMS_DATABASE_ARCHITECTURE.md](../forums/FORUMS_DATABASE_ARCHITECTURE.md)
4. See [FORUMS_SERVICES_ARCHITECTURE.md](../forums/FORUMS_SERVICES_ARCHITECTURE.md)

---

## Related Documentation

- **Main Index**: [docs/README.md](../README.md)
- **Critical Patterns**: [docs/architecture/CRITICAL_PATTERNS.md](../architecture/CRITICAL_PATTERNS.md)
- **Forum Index**: [docs/forums/FORUMS_DOCUMENTATION_INDEX.md](../forums/FORUMS_DOCUMENTATION_INDEX.md)
- **Testing Guide**: [docs/guides/TESTING.md](../guides/TESTING.md)
- **Component Guide**: [docs/guides/COMPONENTS.md](../guides/COMPONENTS.md) (TBD)

---

**Status**: ✅ Complete and current
**Last Updated**: November 10, 2025
