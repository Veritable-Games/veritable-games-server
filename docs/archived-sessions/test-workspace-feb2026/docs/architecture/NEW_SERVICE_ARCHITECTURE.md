# Clean Service Architecture Design

**Status**: Design Document (Not Yet Implemented)
**Created**: 2025-10-08
**Purpose**: Define a clean, maintainable service architecture from scratch

---

## Table of Contents
1. [Architecture Principles](#architecture-principles)
2. [Layer Diagram](#layer-diagram)
3. [Current Architecture Problems](#current-architecture-problems)
4. [Proposed Architecture](#proposed-architecture)
5. [Layer Specifications](#layer-specifications)
6. [Implementation Guide](#implementation-guide)
7. [Testing Strategy](#testing-strategy)
8. [Migration Path](#migration-path)

---

## Architecture Principles

### 1. Separation of Concerns
- **One responsibility per layer**: Each layer should have a single, well-defined purpose
- **Clear boundaries**: Layers communicate only through well-defined interfaces
- **Dependency direction**: Always flows inward (API → Service → Repository → Database)

### 2. Type Safety
- **Result pattern**: All operations return `Result<T, E>` instead of throwing exceptions
- **Branded types**: Use branded types for IDs to prevent mixing different entity IDs
- **Compile-time safety**: Leverage TypeScript's type system to catch errors at compile time

### 3. Testability
- **Pure functions**: Business logic should be pure and deterministic
- **Dependency injection**: All dependencies are injected, not imported directly
- **Mockable interfaces**: Each layer has interfaces that can be mocked

### 4. Maintainability
- **Small, focused modules**: Each file should be under 300 lines
- **Self-documenting code**: Clear naming and minimal comments needed
- **Consistent patterns**: Same patterns across all domains

---

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│           Frontend (React/Next.js)          │
│  - Forms, Lists, Detail Views              │
│  - Client-side validation (Zod)            │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│          API Routes (HTTP Handlers)         │
│  - Request validation (Zod schemas)         │
│  - Authentication check                     │
│  - Error response formatting                │
│  - Thin glue layer (< 50 LOC per endpoint)  │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│       Services (Business Logic Layer)       │
│  - Business rules validation                │
│  - Cross-entity operations                  │
│  - Permission checks                        │
│  - Cache invalidation                       │
│  - Returns Result<T, ServiceError>          │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│      Repositories (Data Access Layer)       │
│  - Pure data access (CRUD only)             │
│  - SQL query construction                   │
│  - No business logic                        │
│  - Returns Result<T, DbError>               │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│      Database (PostgreSQL via dbAdapter)    │
│  - Connection pooling                       │
│  - Transaction management                   │
│  - Schema routing                           │
└─────────────────────────────────────────────┘
```

**Data Flow**:
1. **Request** → API validates & authenticates
2. **API** → Service performs business logic
3. **Service** → Repository fetches/mutates data
4. **Repository** → Database executes SQL
5. **Response** ← Results bubble up through layers

---

## Current Architecture Problems

### ❌ Problem 1: Mixed Concerns in Services
**Current**: `ForumCategoryService` mixes data access and business logic
```typescript
// PROBLEM: Service directly executes SQL
async getCategories(): Promise<ForumCategory[]> {
  const db = this.getDb();
  const stmt = db.prepare(`SELECT ... FROM forum_categories ...`);
  const categories = stmt.all();
  return categories;
}
```

**Why it's bad**:
- Services cannot be tested without a database
- Business logic is tangled with SQL queries
- No clear separation of data access from domain logic

### ❌ Problem 2: Exception-Based Error Handling
**Current**: Services throw errors, forcing try-catch everywhere
```typescript
// PROBLEM: Throws exceptions
async createCategory(data): Promise<ForumCategory> {
  // ...
  throw new Error('Failed to create forum category');
}

// API must wrap everything in try-catch
try {
  const category = await service.createCategory(data);
} catch (error) {
  return errorResponse(error);
}
```

**Why it's bad**:
- Errors are not part of the function signature
- Easy to forget error handling
- Can't compose operations without nested try-catch

### ❌ Problem 3: No Repository Pattern
**Historical**: Services used to directly access the database (now use dbAdapter)
```typescript
// OLD PATTERN (legacy SQLite): Service knew about SQL
const db = dbPool.getConnection('forums');
const stmt = db.prepare('SELECT ...');

// CURRENT PATTERN: Services use dbAdapter
const result = await dbAdapter.query('SELECT ...', [], { schema: 'forums' });
```

**Why it's bad**:
- Tight coupling to database implementation
- Cannot swap data sources (e.g., for testing or caching)
- SQL is scattered across service files

### ❌ Problem 4: Inconsistent Validation
**Current**: Validation happens in multiple places
```typescript
// Service validates
if (!data.name) throw new Error('Name required');

// API also validates
const bodyResult = await safeParseRequest(request, Schema);

// Repository might also validate
if (data.name.trim().length === 0) return Err(...);
```

**Why it's bad**:
- Duplicated validation logic
- Unclear which layer is responsible
- Different error formats

### ❌ Problem 5: Poor Type Safety for IDs
**Current**: IDs are just numbers
```typescript
async getTopicById(topicId: number): Promise<Topic>
async getCategoryById(categoryId: number): Promise<Category>

// DANGER: Can pass category ID to topic function
const topic = await getTopicById(categoryId); // Compiles!
```

**Why it's bad**:
- Can accidentally mix different entity IDs
- No compile-time safety for ID types
- Bugs only caught at runtime

### ❌ Problem 6: Tight Coupling to Database Implementation
**Historical**: Services used to import dbPool directly (legacy SQLite pattern)
```typescript
// OLD PATTERN (legacy SQLite)
import { dbPool } from '@/lib/database/pool';

class ForumService {
  private getDb() {
    return dbPool.getConnection('forums');
  }
}

// CURRENT PATTERN (PostgreSQL)
import { dbAdapter } from '@/lib/database/adapter';

class ForumService {
  async getTopic(id: number) {
    const result = await dbAdapter.query(
      'SELECT * FROM topics WHERE id = ?',
      [id],
      { schema: 'forums' }
    );
    return result.rows[0];
  }
}
```

**Issue with old pattern**:
- Cannot test services without real database
- Cannot mock database layer
- Difficult to add caching or other data sources

---

## Proposed Architecture

### ✅ Solution Overview
1. **Repository Layer**: Pure data access with Result pattern
2. **Service Layer**: Business logic with no SQL
3. **API Layer**: Thin HTTP handlers
4. **Validation Layer**: Single source of truth (Zod schemas at API boundary)
5. **Error Handling**: Type-safe Result pattern throughout

---

## Layer Specifications

### 1. Repository Layer (Pure Data Access)

**Purpose**: Encapsulate all database operations with no business logic

**Characteristics**:
- Pure CRUD operations
- SQL query construction
- Returns `Result<T, DbError>` for all operations
- No business rules or validation (except basic data integrity)
- No cache invalidation (that's service layer responsibility)

**CategoryRepository Example**:
```typescript
/**
 * Category Repository
 *
 * Handles all database operations for forum categories.
 * Pure data access layer with no business logic.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { Result, Ok, Err } from '@/lib/utils/result';
import { CategoryId, Category, DbError } from './types';

export interface ICategoryRepository {
  findAll(): Promise<Result<Category[], DbError>>;
  findById(id: CategoryId): Promise<Result<Category | null, DbError>>;
  findBySlug(slug: string): Promise<Result<Category | null, DbError>>;
  create(data: CategoryCreateData): Promise<Result<Category, DbError>>;
  update(id: CategoryId, data: CategoryUpdateData): Promise<Result<Category, DbError>>;
  delete(id: CategoryId): Promise<Result<void, DbError>>;
  countTopics(id: CategoryId): Promise<Result<number, DbError>>;
}

export class CategoryRepository implements ICategoryRepository {
  constructor() {} // dbAdapter is singleton, no injection needed

  async findAll(): Promise<Result<Category[], DbError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, name, slug, description, color, section,
                sort_order, is_active, created_at, updated_at
         FROM forum_categories
         WHERE is_active = 1
         ORDER BY sort_order ASC, name ASC`,
        [],
        { schema: 'forums' }
      );

      return Ok(result.rows as Category[]);
    } catch (error) {
      return Err(new DbError('Failed to fetch categories', error));
    }
  }

  async findById(id: CategoryId): Promise<Result<Category | null, DbError>> {
    try {
      const category = this.db
        .prepare<[number]>(`
          SELECT id, name, slug, description, color, section,
                 sort_order, is_active, created_at, updated_at
          FROM forum_categories
          WHERE id = ?
        `)
        .get(id) as Category | undefined;

      return Ok(category ?? null);
    } catch (error) {
      return Err(new DbError(`Failed to fetch category ${id}`, error));
    }
  }

  async create(data: CategoryCreateData): Promise<Result<Category, DbError>> {
    try {
      const result = this.db
        .prepare<[string, string, string, string, string, number]>(`
          INSERT INTO forum_categories
            (name, slug, description, color, section, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          data.name,
          data.slug,
          data.description || '',
          data.color || '#6B7280',
          data.section || 'General',
          data.sort_order || 0
        );

      const categoryId = result.lastInsertRowid as CategoryId;
      return this.findById(categoryId);
    } catch (error) {
      return Err(new DbError('Failed to create category', error));
    }
  }

  async countTopics(id: CategoryId): Promise<Result<number, DbError>> {
    try {
      const result = this.db
        .prepare<[number]>(`
          SELECT COUNT(*) as count
          FROM forum_topics
          WHERE category_id = ?
        `)
        .get(id) as { count: number };

      return Ok(result.count);
    } catch (error) {
      return Err(new DbError(`Failed to count topics for category ${id}`, error));
    }
  }
}
```

**TopicRepository Example**:
```typescript
export interface ITopicRepository {
  findById(id: TopicId): Promise<Result<Topic | null, DbError>>;
  findByCategory(categoryId: CategoryId, opts: PaginationOpts):
    Promise<Result<PaginatedResult<Topic>, DbError>>;
  create(data: TopicCreateData): Promise<Result<Topic, DbError>>;
  update(id: TopicId, data: TopicUpdateData): Promise<Result<Topic, DbError>>;
  delete(id: TopicId): Promise<Result<void, DbError>>;
  incrementViewCount(id: TopicId): Promise<Result<void, DbError>>;
  updateReplyCount(id: TopicId, delta: number): Promise<Result<void, DbError>>;
}

export class TopicRepository implements ITopicRepository {
  constructor() {} // dbAdapter is singleton, no injection needed

  async findById(id: TopicId): Promise<Result<Topic | null, DbError>> {
    try {
      const topic = this.db
        .prepare<[number]>(`
          SELECT id, category_id, user_id, title, content,
                 is_pinned, is_locked, is_solved, reply_count,
                 view_count, created_at, updated_at
          FROM forum_topics
          WHERE id = ?
        `)
        .get(id) as Topic | undefined;

      return Ok(topic ?? null);
    } catch (error) {
      return Err(new DbError(`Failed to fetch topic ${id}`, error));
    }
  }

  async findByCategory(
    categoryId: CategoryId,
    opts: PaginationOpts
  ): Promise<Result<PaginatedResult<Topic>, DbError>> {
    try {
      const { page = 1, limit = 20, sort = 'recent' } = opts;
      const offset = (page - 1) * limit;

      // Order by clause based on sort option
      const orderBy = {
        recent: 'is_pinned DESC, updated_at DESC',
        popular: 'is_pinned DESC, view_count DESC',
        oldest: 'is_pinned DESC, created_at ASC',
        replies: 'is_pinned DESC, reply_count DESC',
      }[sort] || 'is_pinned DESC, updated_at DESC';

      // Get total count
      const countResult = this.db
        .prepare<[number]>(`
          SELECT COUNT(*) as count
          FROM forum_topics
          WHERE category_id = ?
        `)
        .get(categoryId) as { count: number };

      // Get paginated data
      const topics = this.db
        .prepare<[number, number, number]>(`
          SELECT * FROM forum_topics
          WHERE category_id = ?
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `)
        .all(categoryId, limit, offset) as Topic[];

      const total = countResult.count;
      const totalPages = Math.ceil(total / limit);

      return Ok({
        data: topics,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      });
    } catch (error) {
      return Err(new DbError('Failed to fetch topics by category', error));
    }
  }

  async incrementViewCount(id: TopicId): Promise<Result<void, DbError>> {
    try {
      this.db
        .prepare<[number]>(`
          UPDATE forum_topics
          SET view_count = view_count + 1
          WHERE id = ?
        `)
        .run(id);

      return Ok(undefined);
    } catch (error) {
      return Err(new DbError(`Failed to increment view count for topic ${id}`, error));
    }
  }
}
```

**ReplyRepository Example**:
```typescript
export interface IReplyRepository {
  findById(id: ReplyId): Promise<Result<Reply | null, DbError>>;
  findByTopic(topicId: TopicId): Promise<Result<Reply[], DbError>>;
  create(data: ReplyCreateData): Promise<Result<Reply, DbError>>;
  update(id: ReplyId, data: ReplyUpdateData): Promise<Result<Reply, DbError>>;
  delete(id: ReplyId): Promise<Result<void, DbError>>;
  markAsSolution(id: ReplyId): Promise<Result<void, DbError>>;
  unmarkSolution(topicId: TopicId): Promise<Result<void, DbError>>;
}

export class ReplyRepository implements IReplyRepository {
  constructor() {} // dbAdapter is singleton, no injection needed

  async findByTopic(topicId: TopicId): Promise<Result<Reply[], DbError>> {
    try {
      const replies = this.db
        .prepare<[number]>(`
          SELECT id, topic_id, user_id, parent_id, content,
                 is_solution, created_at, updated_at
          FROM forum_replies
          WHERE topic_id = ?
          ORDER BY created_at ASC
        `)
        .all(topicId) as Reply[];

      return Ok(replies);
    } catch (error) {
      return Err(new DbError(`Failed to fetch replies for topic ${topicId}`, error));
    }
  }

  async markAsSolution(id: ReplyId): Promise<Result<void, DbError>> {
    try {
      this.db
        .prepare<[number]>(`
          UPDATE forum_replies
          SET is_solution = 1
          WHERE id = ?
        `)
        .run(id);

      return Ok(undefined);
    } catch (error) {
      return Err(new DbError(`Failed to mark reply ${id} as solution`, error));
    }
  }

  async unmarkSolution(topicId: TopicId): Promise<Result<void, DbError>> {
    try {
      this.db
        .prepare<[number]>(`
          UPDATE forum_replies
          SET is_solution = 0
          WHERE topic_id = ?
        `)
        .run(topicId);

      return Ok(undefined);
    } catch (error) {
      return Err(new DbError(`Failed to unmark solutions for topic ${topicId}`, error));
    }
  }
}
```

### 2. Service Layer (Business Logic)

**Purpose**: Orchestrate business operations using repositories

**Characteristics**:
- Contains all business logic and rules
- No SQL queries (delegates to repositories)
- Returns `Result<T, ServiceError>`
- Handles permissions, validation, and side effects
- Manages cache invalidation
- Coordinates multiple repositories if needed

**CategoryService Example**:
```typescript
/**
 * Category Service
 *
 * Handles business logic for forum categories.
 * Validates permissions, enforces business rules, manages cache.
 */

import { Result, Ok, Err, ResultUtils } from '@/lib/utils/result';
import { cache } from '@/lib/cache';
import { ICategoryRepository } from './category-repository';
import { CategoryId, UserId, ServiceError } from './types';

export class CategoryService {
  constructor(
    private categoryRepo: ICategoryRepository,
    private cacheManager = cache
  ) {}

  async getCategories(): Promise<Result<Category[], ServiceError>> {
    // Check cache first
    const cached = await this.cacheManager.get<Category[]>(['forum', 'categories']);
    if (cached) return Ok(cached);

    // Fetch from repository
    const result = await this.categoryRepo.findAll();

    if (result.isErr()) {
      return Err(ServiceError.fromDbError(result.error));
    }

    // Cache the result
    await this.cacheManager.set(['forum', 'categories'], result.value, {
      ttl: 300, // 5 minutes
      tags: ['forums']
    });

    return Ok(result.value);
  }

  async getCategoryById(id: CategoryId): Promise<Result<Category, ServiceError>> {
    const result = await this.categoryRepo.findById(id);

    if (result.isErr()) {
      return Err(ServiceError.fromDbError(result.error));
    }

    if (!result.value) {
      return Err(ServiceError.notFound('Category', id));
    }

    return Ok(result.value);
  }

  async createCategory(
    data: CreateCategoryInput,
    userId: UserId
  ): Promise<Result<Category, ServiceError>> {
    // 1. Validate permissions (business rule)
    const permCheck = await this.checkCreatePermission(userId);
    if (permCheck.isErr()) return permCheck;

    // 2. Validate business rules
    const validationResult = this.validateCategoryData(data);
    if (validationResult.isErr()) return validationResult;

    // 3. Generate slug from name (business logic)
    const slug = this.generateSlug(data.name);

    // 4. Check for duplicate slug (business rule)
    const existingResult = await this.categoryRepo.findBySlug(slug);
    if (existingResult.isErr()) {
      return Err(ServiceError.fromDbError(existingResult.error));
    }
    if (existingResult.value) {
      return Err(ServiceError.conflict(`Category with slug "${slug}" already exists`));
    }

    // 5. Create via repository
    const createResult = await this.categoryRepo.create({
      ...data,
      slug,
    });

    if (createResult.isErr()) {
      return Err(ServiceError.fromDbError(createResult.error));
    }

    // 6. Invalidate cache (side effect)
    await this.cacheManager.delete(['forum', 'categories']);

    return Ok(createResult.value);
  }

  async deleteCategory(
    id: CategoryId,
    userId: UserId
  ): Promise<Result<void, ServiceError>> {
    // 1. Permission check
    const permCheck = await this.checkDeletePermission(userId);
    if (permCheck.isErr()) return permCheck;

    // 2. Business rule: Cannot delete category with topics
    const topicCountResult = await this.categoryRepo.countTopics(id);
    if (topicCountResult.isErr()) {
      return Err(ServiceError.fromDbError(topicCountResult.error));
    }

    if (topicCountResult.value > 0) {
      return Err(
        ServiceError.validationError(
          `Cannot delete category with ${topicCountResult.value} topics. ` +
          `Please move or delete topics first.`
        )
      );
    }

    // 3. Delete via repository
    const deleteResult = await this.categoryRepo.delete(id);
    if (deleteResult.isErr()) {
      return Err(ServiceError.fromDbError(deleteResult.error));
    }

    // 4. Invalidate caches
    await this.cacheManager.delete(['forum', 'categories']);
    await this.cacheManager.delete(['forum', 'category', id.toString()]);

    return Ok(undefined);
  }

  // Private helper methods (business logic)

  private async checkCreatePermission(userId: UserId): Promise<Result<void, ServiceError>> {
    // Permission logic here
    // For now, only admins can create categories
    const user = await this.getUserRole(userId);
    if (user !== 'admin') {
      return Err(ServiceError.forbidden('Only admins can create categories'));
    }
    return Ok(undefined);
  }

  private validateCategoryData(data: CreateCategoryInput): Result<void, ServiceError> {
    if (data.name.length < 3) {
      return Err(ServiceError.validationError('Category name must be at least 3 characters'));
    }
    if (data.name.length > 100) {
      return Err(ServiceError.validationError('Category name cannot exceed 100 characters'));
    }
    return Ok(undefined);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async getUserRole(userId: UserId): Promise<string> {
    // Fetch user role (would use UserRepository in real impl)
    return 'admin';
  }
}
```

**TopicService Example**:
```typescript
export class TopicService {
  constructor(
    private topicRepo: ITopicRepository,
    private categoryRepo: ICategoryRepository,
    private cacheManager = cache
  ) {}

  async getTopicById(
    id: TopicId,
    incrementView: boolean = true
  ): Promise<Result<Topic, ServiceError>> {
    // Check cache first
    const cacheKey = ['forum', 'topic', id.toString()];
    const cached = await this.cacheManager.get<Topic>(cacheKey);

    if (cached && !incrementView) {
      return Ok(cached);
    }

    // Fetch from repository
    const result = await this.topicRepo.findById(id);

    if (result.isErr()) {
      return Err(ServiceError.fromDbError(result.error));
    }

    if (!result.value) {
      return Err(ServiceError.notFound('Topic', id));
    }

    // Increment view count (side effect)
    if (incrementView) {
      await this.topicRepo.incrementViewCount(id);
      // Don't cache when incrementing (stale data)
    } else {
      // Cache for reads
      await this.cacheManager.set(cacheKey, result.value, { ttl: 60 });
    }

    return Ok(result.value);
  }

  async createTopic(
    data: CreateTopicInput,
    userId: UserId
  ): Promise<Result<Topic, ServiceError>> {
    // 1. Validate category exists (business rule)
    const categoryResult = await this.categoryRepo.findById(data.category_id);
    if (categoryResult.isErr()) {
      return Err(ServiceError.fromDbError(categoryResult.error));
    }
    if (!categoryResult.value) {
      return Err(ServiceError.notFound('Category', data.category_id));
    }

    // 2. Permission check (business rule)
    const permCheck = await this.checkCreatePermission(userId, data.category_id);
    if (permCheck.isErr()) return permCheck;

    // 3. Sanitize content (business logic)
    const sanitizedContent = DOMPurify.sanitize(data.content, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'title'],
    });

    // 4. Create topic via repository
    const createResult = await this.topicRepo.create({
      ...data,
      content: sanitizedContent,
      user_id: userId,
      is_pinned: false, // Default
      is_locked: false,
      is_solved: false,
      reply_count: 0,
      view_count: 0,
    });

    if (createResult.isErr()) {
      return Err(ServiceError.fromDbError(createResult.error));
    }

    // 5. Invalidate caches (side effect)
    await this.cacheManager.delete(['forum', 'topics']);
    await this.cacheManager.delete(['forum', 'categories']); // Category topic counts changed

    return Ok(createResult.value);
  }

  async lockTopic(
    id: TopicId,
    userId: UserId
  ): Promise<Result<Topic, ServiceError>> {
    // 1. Permission check
    const permCheck = await this.checkModeratePermission(userId);
    if (permCheck.isErr()) return permCheck;

    // 2. Update via repository
    const updateResult = await this.topicRepo.update(id, {
      is_locked: true,
      updated_at: new Date().toISOString(),
    });

    if (updateResult.isErr()) {
      return Err(ServiceError.fromDbError(updateResult.error));
    }

    // 3. Invalidate cache
    await this.cacheManager.delete(['forum', 'topic', id.toString()]);

    return Ok(updateResult.value);
  }

  private async checkCreatePermission(
    userId: UserId,
    categoryId: CategoryId
  ): Promise<Result<void, ServiceError>> {
    // Permission logic
    return Ok(undefined);
  }

  private async checkModeratePermission(userId: UserId): Promise<Result<void, ServiceError>> {
    // Only admins/moderators can lock topics
    return Ok(undefined);
  }
}
```

**ReplyService Example**:
```typescript
export class ReplyService {
  constructor(
    private replyRepo: IReplyRepository,
    private topicRepo: ITopicRepository,
    private cacheManager = cache
  ) {}

  async getRepliesByTopic(topicId: TopicId): Promise<Result<Reply[], ServiceError>> {
    // Check cache
    const cacheKey = ['forum', 'replies', topicId.toString()];
    const cached = await this.cacheManager.get<Reply[]>(cacheKey);
    if (cached) return Ok(cached);

    // Fetch from repository
    const result = await this.replyRepo.findByTopic(topicId);

    if (result.isErr()) {
      return Err(ServiceError.fromDbError(result.error));
    }

    // Cache replies
    await this.cacheManager.set(cacheKey, result.value, { ttl: 60 });

    return Ok(result.value);
  }

  async createReply(
    data: CreateReplyInput,
    userId: UserId
  ): Promise<Result<Reply, ServiceError>> {
    // 1. Validate topic exists and is not locked (business rule)
    const topicResult = await this.topicRepo.findById(data.topic_id);
    if (topicResult.isErr()) {
      return Err(ServiceError.fromDbError(topicResult.error));
    }
    if (!topicResult.value) {
      return Err(ServiceError.notFound('Topic', data.topic_id));
    }
    if (topicResult.value.is_locked) {
      return Err(ServiceError.forbidden('Cannot reply to locked topic'));
    }

    // 2. Sanitize content
    const sanitizedContent = DOMPurify.sanitize(data.content, {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'code', 'pre'],
    });

    // 3. Create reply via repository
    const createResult = await this.replyRepo.create({
      ...data,
      content: sanitizedContent,
      user_id: userId,
      is_solution: false,
    });

    if (createResult.isErr()) {
      return Err(ServiceError.fromDbError(createResult.error));
    }

    // 4. Update topic reply count (side effect)
    await this.topicRepo.updateReplyCount(data.topic_id, 1);

    // 5. Invalidate caches
    await this.cacheManager.delete(['forum', 'replies', data.topic_id.toString()]);
    await this.cacheManager.delete(['forum', 'topic', data.topic_id.toString()]);

    return Ok(createResult.value);
  }

  async markAsSolution(
    replyId: ReplyId,
    userId: UserId
  ): Promise<Result<void, ServiceError>> {
    // 1. Get reply to check topic ownership
    const replyResult = await this.replyRepo.findById(replyId);
    if (replyResult.isErr()) {
      return Err(ServiceError.fromDbError(replyResult.error));
    }
    if (!replyResult.value) {
      return Err(ServiceError.notFound('Reply', replyId));
    }

    // 2. Get topic to check ownership
    const topicResult = await this.topicRepo.findById(replyResult.value.topic_id);
    if (topicResult.isErr()) {
      return Err(ServiceError.fromDbError(topicResult.error));
    }

    // 3. Business rule: Only topic author can mark solution
    if (topicResult.value?.user_id !== userId) {
      return Err(ServiceError.forbidden('Only topic author can mark solution'));
    }

    // 4. Unmark any existing solution (business rule: only one solution per topic)
    await this.replyRepo.unmarkSolution(replyResult.value.topic_id);

    // 5. Mark new solution
    const markResult = await this.replyRepo.markAsSolution(replyId);
    if (markResult.isErr()) {
      return Err(ServiceError.fromDbError(markResult.error));
    }

    // 6. Update topic as solved
    await this.topicRepo.update(replyResult.value.topic_id, {
      is_solved: true,
    });

    // 7. Invalidate caches
    await this.cacheManager.delete(['forum', 'replies', replyResult.value.topic_id.toString()]);
    await this.cacheManager.delete(['forum', 'topic', replyResult.value.topic_id.toString()]);

    return Ok(undefined);
  }
}
```

### 3. API Layer (HTTP Handlers)

**Purpose**: Handle HTTP requests and responses

**Characteristics**:
- Thin glue layer (< 50 LOC per endpoint)
- Request validation (Zod schemas)
- Authentication check
- Call service layer
- Format response
- Error handling

**Example API Routes**:
```typescript
/**
 * POST /api/forums/categories
 * Create a new forum category
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/utils';
import { categoryService } from '@/lib/forums/services';
import { withSecurity } from '@/lib/security/middleware';
import { safeParseRequest, CreateCategorySchema } from '@/lib/forums/validation';
import { errorResponse, AuthenticationError, ValidationError } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // 1. Authenticate
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    // 2. Validate input
    const bodyResult = await safeParseRequest(request, CreateCategorySchema);
    if (bodyResult.isErr()) {
      throw new ValidationError(bodyResult.error.message, bodyResult.error.details);
    }

    // 3. Call service
    const result = await categoryService.createCategory(bodyResult.value, user.id);

    // 4. Handle result
    if (result.isErr()) {
      // Service errors are thrown to be caught by errorResponse
      throw result.error;
    }

    // 5. Return success
    return NextResponse.json({
      success: true,
      data: { category: result.value }
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * GET /api/forums/categories
 * List all categories
 */
export async function GET(request: NextRequest) {
  try {
    const result = await categoryService.getCategories();

    if (result.isErr()) {
      throw result.error;
    }

    return NextResponse.json({
      success: true,
      data: { categories: result.value }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

```typescript
/**
 * POST /api/forums/topics
 * Create a new topic
 */

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    const bodyResult = await safeParseRequest(request, CreateTopicSchema);
    if (bodyResult.isErr()) {
      throw new ValidationError(bodyResult.error.message, bodyResult.error.details);
    }

    const result = await topicService.createTopic(bodyResult.value, user.id);

    if (result.isErr()) throw result.error;

    return NextResponse.json({
      success: true,
      data: { topic: result.value }
    });
  } catch (error) {
    return errorResponse(error);
  }
});

/**
 * GET /api/forums/topics?category_id=1&page=1&limit=20
 * List topics with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const paramsResult = safeParseSearchParams(searchParams, SearchTopicsSchema);

    if (paramsResult.isErr()) {
      throw new ValidationError(paramsResult.error.message, paramsResult.error.details);
    }

    const categoryId = paramsResult.value.category_id;
    const result = await topicService.getTopicsByCategory(categoryId, {
      page: paramsResult.value.page,
      limit: paramsResult.value.limit,
      sort: paramsResult.value.sort,
    });

    if (result.isErr()) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.value // Contains { data, total, page, limit, totalPages, ... }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

```typescript
/**
 * POST /api/forums/replies
 * Create a new reply
 */

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    const bodyResult = await safeParseRequest(request, CreateReplySchema);
    if (bodyResult.isErr()) {
      throw new ValidationError(bodyResult.error.message, bodyResult.error.details);
    }

    const result = await replyService.createReply(bodyResult.value, user.id);

    if (result.isErr()) throw result.error;

    return NextResponse.json({
      success: true,
      data: { reply: result.value }
    });
  } catch (error) {
    return errorResponse(error);
  }
});
```

### 4. Validation Layer (Zod Schemas)

**Purpose**: Single source of truth for input validation

**Characteristics**:
- All validation happens at API boundary
- Type-safe schemas with Zod
- Reusable across endpoints
- Clear error messages

**Example Validation Schemas**:
```typescript
/**
 * Forum Validation Schemas
 *
 * Single source of truth for all forum input validation.
 */

import { z } from 'zod';

// ============================================
// Category Schemas
// ============================================

export const CreateCategorySchema = z.object({
  name: z.string()
    .trim()
    .min(3, 'Category name must be at least 3 characters')
    .max(100, 'Category name cannot exceed 100 characters'),

  description: z.string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),

  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color')
    .optional()
    .default('#6B7280'),

  section: z.string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .default('General'),

  sort_order: z.number()
    .int()
    .min(0)
    .optional()
    .default(0),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

// ============================================
// Topic Schemas
// ============================================

export const CreateTopicSchema = z.object({
  category_id: z.number().int().positive('Category ID must be a positive integer'),

  title: z.string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),

  content: z.string()
    .trim()
    .min(20, 'Content must be at least 20 characters')
    .max(50000, 'Content cannot exceed 50,000 characters'),

  tags: z.array(z.number().int().positive())
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),
});

export const UpdateTopicSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  content: z.string().trim().min(20).max(50000).optional(),
  is_pinned: z.boolean().optional(),
  is_locked: z.boolean().optional(),
  is_solved: z.boolean().optional(),
});

export const SearchTopicsSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['recent', 'popular', 'oldest', 'replies']).optional().default('recent'),
});

// ============================================
// Reply Schemas
// ============================================

export const CreateReplySchema = z.object({
  topic_id: z.number().int().positive(),

  content: z.string()
    .trim()
    .min(10, 'Reply must be at least 10 characters')
    .max(10000, 'Reply cannot exceed 10,000 characters'),

  parent_id: z.number().int().positive().optional(),
});

export const UpdateReplySchema = z.object({
  content: z.string().trim().min(10).max(10000),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Parse request body with Zod schema and return Result
 */
export async function safeParseRequest<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<Result<T, { message: string; details: any }>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return Err({
        message: 'Validation failed',
        details: result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    return Ok(result.data);
  } catch (error) {
    return Err({
      message: 'Invalid JSON',
      details: null,
    });
  }
}

/**
 * Parse search params with Zod schema
 */
export function safeParseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): Result<T, { message: string; details: any }> {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    return Err({
      message: 'Invalid query parameters',
      details: result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  return Ok(result.data);
}
```

### 5. Error Handling (Result Pattern)

**Purpose**: Type-safe error handling without exceptions

**Error Types**:
```typescript
/**
 * Error Type Hierarchy
 */

// Database errors (from Repository layer)
export class DbError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'DbError';
  }
}

// Service errors (from Service layer)
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
  }

  static notFound(entity: string, id: string | number): ServiceError {
    return new ServiceError(
      `${entity} not found: ${id}`,
      'NOT_FOUND',
      404
    );
  }

  static validationError(message: string, details?: unknown): ServiceError {
    return new ServiceError(message, 'VALIDATION_ERROR', 400, details);
  }

  static forbidden(message: string): ServiceError {
    return new ServiceError(message, 'FORBIDDEN', 403);
  }

  static conflict(message: string): ServiceError {
    return new ServiceError(message, 'CONFLICT', 409);
  }

  static fromDbError(error: DbError): ServiceError {
    return new ServiceError(
      'A database error occurred',
      'DATABASE_ERROR',
      500,
      { originalMessage: error.message }
    );
  }
}

// Branded ID types for type safety
export type CategoryId = number & { readonly __brand: 'CategoryId' };
export type TopicId = number & { readonly __brand: 'TopicId' };
export type ReplyId = number & { readonly __brand: 'ReplyId' };
export type UserId = number & { readonly __brand: 'UserId' };

// Type constructors
export const CategoryId = (id: number): CategoryId => id as CategoryId;
export const TopicId = (id: number): TopicId => id as TopicId;
export const ReplyId = (id: number): ReplyId => id as ReplyId;
export const UserId = (id: number): UserId => id as UserId;
```

**HTTP Status Mapping**:
```typescript
/**
 * Map ServiceError to HTTP status codes
 */
export function getHttpStatus(error: ServiceError): number {
  return error.statusCode;
}

/**
 * Map ServiceError to API response
 */
export function toApiErrorResponse(error: ServiceError) {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };
}
```

---

## Implementation Guide

### Step 1: Create Type Definitions
```bash
# Create types file
touch src/lib/forums/types.ts
```

```typescript
// src/lib/forums/types.ts
export type CategoryId = number & { readonly __brand: 'CategoryId' };
export type TopicId = number & { readonly __brand: 'TopicId' };
export type ReplyId = number & { readonly __brand: 'ReplyId' };
export type UserId = number & { readonly __brand: 'UserId' };

export interface Category {
  id: CategoryId;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  section: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: TopicId;
  category_id: CategoryId;
  user_id: UserId;
  title: string;
  content: string;
  is_pinned: boolean;
  is_locked: boolean;
  is_solved: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: ReplyId;
  topic_id: TopicId;
  user_id: UserId;
  parent_id: ReplyId | null;
  content: string;
  is_solution: boolean;
  created_at: string;
  updated_at: string;
}

// DTOs, errors, etc.
```

### Step 2: Implement Repositories
```bash
mkdir -p src/lib/forums/repositories
touch src/lib/forums/repositories/{category,topic,reply}-repository.ts
```

### Step 3: Implement Services
```bash
mkdir -p src/lib/forums/services
touch src/lib/forums/services/{category,topic,reply}-service.ts
```

### Step 4: Create Validation Schemas
```bash
touch src/lib/forums/validation.ts
```

### Step 5: Update API Routes
```bash
# Update existing routes to use new services
```

### Step 6: Write Tests
```bash
mkdir -p src/lib/forums/__tests__
touch src/lib/forums/__tests__/{repository,service,api}.test.ts
```

---

## Testing Strategy

### 1. Repository Layer Tests
**Test database operations in isolation**

```typescript
// category-repository.test.ts
import { CategoryRepository } from '../repositories/category-repository';
import { dbAdapter } from '@/lib/database/adapter';

describe('CategoryRepository', () => {
  let repo: CategoryRepository;

  beforeEach(async () => {
    repo = new CategoryRepository();

    // Clean database before each test
    await dbAdapter.query('DELETE FROM forum_categories', [], { schema: 'forums' });
  });

  describe('findAll', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await repo.findAll();

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should return all active categories ordered by sort_order', async () => {
      // Insert test data
      db.prepare(`
        INSERT INTO forum_categories (name, slug, section, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run('Category A', 'category-a', 'General', 2, 1);

      db.prepare(`
        INSERT INTO forum_categories (name, slug, section, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run('Category B', 'category-b', 'General', 1, 1);

      const result = await repo.findAll();

      expect(result.isOk()).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value[0].name).toBe('Category B'); // Lower sort_order first
      expect(result.value[1].name).toBe('Category A');
    });

    it('should not return inactive categories', async () => {
      db.prepare(`
        INSERT INTO forum_categories (name, slug, section, is_active)
        VALUES (?, ?, ?, ?)
      `).run('Active', 'active', 'General', 1);

      db.prepare(`
        INSERT INTO forum_categories (name, slug, section, is_active)
        VALUES (?, ?, ?, ?)
      `).run('Inactive', 'inactive', 'General', 0);

      const result = await repo.findAll();

      expect(result.isOk()).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0].name).toBe('Active');
    });
  });

  describe('create', () => {
    it('should create category and return it', async () => {
      const data = {
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test description',
        color: '#FF0000',
        section: 'Test Section',
        sort_order: 10,
      };

      const result = await repo.create(data);

      expect(result.isOk()).toBe(true);
      expect(result.value.name).toBe(data.name);
      expect(result.value.slug).toBe(data.slug);
      expect(result.value.id).toBeDefined();
    });

    it('should handle database errors', async () => {
      // Force a database error by inserting invalid data
      const data = {
        name: '', // Assuming name has NOT NULL constraint
        slug: '',
        section: '',
      } as any;

      const result = await repo.create(data);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(DbError);
    });
  });

  describe('countTopics', () => {
    it('should return 0 for category with no topics', async () => {
      const categoryResult = await repo.create({
        name: 'Empty Category',
        slug: 'empty',
        section: 'General',
      });

      const countResult = await repo.countTopics(categoryResult.value.id);

      expect(countResult.isOk()).toBe(true);
      expect(countResult.value).toBe(0);
    });

    it('should return correct topic count', async () => {
      // This test would require creating topics in the database
      // Left as an exercise (would use TopicRepository)
    });
  });
});
```

### 2. Service Layer Tests
**Test business logic with mocked repositories**

```typescript
// category-service.test.ts
import { CategoryService } from '../services/category-service';
import { ICategoryRepository } from '../repositories/category-repository';
import { Ok, Err } from '@/lib/utils/result';
import { CategoryId, ServiceError, DbError } from '../types';

describe('CategoryService', () => {
  let service: CategoryService;
  let mockRepo: jest.Mocked<ICategoryRepository>;
  let mockCache: any;

  beforeEach(() => {
    // Create mock repository
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countTopics: jest.fn(),
    };

    // Create mock cache
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    service = new CategoryService(mockRepo, mockCache);
  });

  describe('getCategories', () => {
    it('should return cached categories if available', async () => {
      const cachedCategories = [
        { id: 1 as CategoryId, name: 'Cached Category' } as any,
      ];

      mockCache.get.mockResolvedValue(cachedCategories);

      const result = await service.getCategories();

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(cachedCategories);
      expect(mockRepo.findAll).not.toHaveBeenCalled();
    });

    it('should fetch from repository if not cached', async () => {
      const categories = [
        { id: 1 as CategoryId, name: 'Category 1' } as any,
      ];

      mockCache.get.mockResolvedValue(null);
      mockRepo.findAll.mockResolvedValue(Ok(categories));

      const result = await service.getCategories();

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual(categories);
      expect(mockCache.set).toHaveBeenCalledWith(
        ['forum', 'categories'],
        categories,
        { ttl: 300, tags: ['forums'] }
      );
    });

    it('should handle repository errors', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRepo.findAll.mockResolvedValue(
        Err(new DbError('Database connection failed'))
      );

      const result = await service.getCategories();

      expect(result.isErr()).toBe(true);
      expect(result.error).toBeInstanceOf(ServiceError);
    });
  });

  describe('createCategory', () => {
    const mockUserId = 1 as UserId;
    const createData = {
      name: 'New Category',
      description: 'Test description',
    };

    it('should create category and invalidate cache', async () => {
      const createdCategory = {
        id: 1 as CategoryId,
        ...createData,
        slug: 'new-category',
      } as any;

      mockRepo.findBySlug.mockResolvedValue(Ok(null)); // No duplicate
      mockRepo.create.mockResolvedValue(Ok(createdCategory));

      const result = await service.createCategory(createData, mockUserId);

      expect(result.isOk()).toBe(true);
      expect(result.value).toEqual(createdCategory);
      expect(mockCache.delete).toHaveBeenCalledWith(['forum', 'categories']);
    });

    it('should reject duplicate slugs', async () => {
      const existingCategory = {
        id: 1 as CategoryId,
        slug: 'new-category',
      } as any;

      mockRepo.findBySlug.mockResolvedValue(Ok(existingCategory));

      const result = await service.createCategory(createData, mockUserId);

      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('CONFLICT');
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should validate category name length', async () => {
      const invalidData = { name: 'AB' }; // Too short

      const result = await service.createCategory(invalidData as any, mockUserId);

      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('deleteCategory', () => {
    const categoryId = 1 as CategoryId;
    const mockUserId = 1 as UserId;

    it('should delete category with no topics', async () => {
      mockRepo.countTopics.mockResolvedValue(Ok(0));
      mockRepo.delete.mockResolvedValue(Ok(undefined));

      const result = await service.deleteCategory(categoryId, mockUserId);

      expect(result.isOk()).toBe(true);
      expect(mockCache.delete).toHaveBeenCalledTimes(2);
    });

    it('should reject deletion if category has topics', async () => {
      mockRepo.countTopics.mockResolvedValue(Ok(5));

      const result = await service.deleteCategory(categoryId, mockUserId);

      expect(result.isErr()).toBe(true);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('5 topics');
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });
});
```

### 3. API Layer Tests
**Test HTTP handlers with mocked services**

```typescript
// api routes test
import { POST, GET } from '@/app/api/forums/categories/route';
import { categoryService } from '@/lib/forums/services';
import { Ok, Err } from '@/lib/utils/result';
import { ServiceError } from '@/lib/forums/types';

jest.mock('@/lib/forums/services');
jest.mock('@/lib/auth/utils');

describe('/api/forums/categories', () => {
  describe('POST', () => {
    it('should create category and return 200', async () => {
      const mockCategory = {
        id: 1,
        name: 'Test Category',
        slug: 'test-category',
      };

      (categoryService.createCategory as jest.Mock).mockResolvedValue(
        Ok(mockCategory)
      );

      const request = new Request('http://localhost/api/forums/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Category',
          description: 'Test description',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.category).toEqual(mockCategory);
    });

    it('should return 400 for invalid input', async () => {
      const request = new Request('http://localhost/api/forums/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'AB', // Too short
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 if not authenticated', async () => {
      const { getCurrentUser } = require('@/lib/auth/utils');
      getCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost/api/forums/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 409 for duplicate category', async () => {
      (categoryService.createCategory as jest.Mock).mockResolvedValue(
        Err(ServiceError.conflict('Category already exists'))
      );

      const request = new Request('http://localhost/api/forums/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Category',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('CONFLICT');
    });
  });

  describe('GET', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { id: 1, name: 'Category 1' },
        { id: 2, name: 'Category 2' },
      ];

      (categoryService.getCategories as jest.Mock).mockResolvedValue(
        Ok(mockCategories)
      );

      const request = new Request('http://localhost/api/forums/categories');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.categories).toEqual(mockCategories);
    });
  });
});
```

---

## Migration Path

### Phase 1: Foundation (Week 1)
1. Create type definitions with branded types
2. Implement Result pattern utilities
3. Create DbError and ServiceError classes
4. Set up testing infrastructure

### Phase 2: Repository Layer (Week 2)
1. Implement CategoryRepository
2. Implement TopicRepository
3. Implement ReplyRepository
4. Write repository tests (100% coverage)

### Phase 3: Service Layer (Week 3)
1. Implement CategoryService
2. Implement TopicService
3. Implement ReplyService
4. Write service tests with mocked repositories

### Phase 4: API Layer (Week 4)
1. Create validation schemas
2. Update API routes to use new services
3. Write API integration tests
4. Update error handling

### Phase 5: Migration (Week 5)
1. Run both old and new implementations in parallel
2. Compare results to ensure parity
3. Gradually switch traffic to new implementation
4. Monitor for issues

### Phase 6: Cleanup (Week 6)
1. Remove old service implementations
2. Update documentation
3. Add performance monitoring
4. Conduct final security audit

---

## Comparison: Old vs New Architecture

### Old Architecture (Current)
```
❌ ForumCategoryService (Legacy)
   ├── Direct SQL queries
   ├── Mixed concerns (data + business logic)
   ├── Exception-based errors
   ├── Tight coupling to database implementation
   ├── Hard to test
   └── 340 lines of mixed logic

❌ ForumTopicService
   ├── Direct SQL queries
   ├── Business logic + data access
   ├── Exception-based errors
   ├── 575 lines of mixed logic
   └── Cannot mock database

❌ API Routes
   ├── try-catch everywhere
   ├── Inconsistent error handling
   └── Validation scattered
```

### New Architecture (Proposed)
```
✅ Repository Layer (Pure Data Access)
   ├── CategoryRepository (~200 LOC)
   │   ├── Pure SQL queries
   │   ├── Result<T, DbError>
   │   ├── No business logic
   │   └── Easily testable
   │
   ├── TopicRepository (~250 LOC)
   │   ├── Pure SQL queries
   │   ├── Pagination support
   │   └── Transaction handling
   │
   └── ReplyRepository (~150 LOC)
       ├── Pure SQL queries
       └── Thread operations

✅ Service Layer (Business Logic)
   ├── CategoryService (~200 LOC)
   │   ├── Business rules
   │   ├── Permission checks
   │   ├── Cache management
   │   └── Result<T, ServiceError>
   │
   ├── TopicService (~250 LOC)
   │   ├── Content sanitization
   │   ├── Moderation logic
   │   └── Side effect orchestration
   │
   └── ReplyService (~200 LOC)
       ├── Solution marking
       ├── Thread validation
       └── Reply counting

✅ API Layer (HTTP Handlers)
   ├── Thin glue layer (~30 LOC per endpoint)
   ├── Zod validation at boundary
   ├── Consistent error responses
   └── Type-safe throughout

✅ Validation Layer
   ├── Single source of truth (Zod schemas)
   ├── Reusable across endpoints
   └── Clear error messages

✅ Error Handling
   ├── Result pattern (no exceptions)
   ├── Type-safe error types
   └── HTTP status mapping
```

### Benefits of New Architecture

| Aspect | Old | New | Improvement |
|--------|-----|-----|-------------|
| **Testability** | Cannot test without DB | Fully mockable layers | ✅ 100% coverage possible |
| **Type Safety** | IDs are just numbers | Branded types for IDs | ✅ Compile-time ID safety |
| **Error Handling** | try-catch everywhere | Result pattern | ✅ Type-safe, composable |
| **Separation** | Mixed concerns | Clear layers | ✅ Single responsibility |
| **Maintainability** | 340-575 LOC files | < 250 LOC per file | ✅ 40-50% smaller |
| **Business Logic** | Scattered in services | Centralized in services | ✅ Easy to find & modify |
| **Data Access** | Direct SQL in services | Isolated in repositories | ✅ Swappable data sources |
| **Validation** | Multiple places | API boundary only | ✅ Single source of truth |
| **Caching** | Manual in services | Service layer responsibility | ✅ Clear ownership |
| **Dependencies** | Tight coupling to DB implementation | dbAdapter abstraction | ✅ Flexible & testable |

---

## Conclusion

This architecture provides:

1. **Clear Separation**: Each layer has a single, well-defined responsibility
2. **Type Safety**: Result pattern + branded types prevent entire classes of bugs
3. **Testability**: Every layer can be tested in isolation with mocked dependencies
4. **Maintainability**: Smaller files, consistent patterns, self-documenting code
5. **Flexibility**: Can swap implementations (e.g., add Redis caching) without touching business logic

**Next Steps**:
1. Review and approve this design
2. Create implementation tickets for each phase
3. Begin with Phase 1 (Foundation)
4. Iterate based on feedback

---

**Document Version**: 1.0
**Last Updated**: 2025-10-08
**Status**: Awaiting Review
