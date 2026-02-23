# Service Layer Refactoring - Implementation Plan

**Priority:** P2 (Medium - Long-term Architecture)
**Estimated Time:** 62-91 hours
**Impact:** Improved maintainability, type safety, code reuse, developer experience

---

## Overview

This document outlines a comprehensive refactoring plan to improve the service layer architecture, eliminate code duplication, enhance type safety, and create better abstractions for long-term maintainability.

---

## Refactoring 1: Unified Data Access Layer

**Current State:** Duplicated database query logic across anarchist, library, wiki, forums services
**Target State:** Single, type-safe data access layer with repository pattern
**Impact:** 40-50% reduction in code duplication, consistent error handling

### Implementation Plan

**Time Estimate:** 20-25 hours

**Step 1: Design Repository Interface** (3-4 hours)

Create `/frontend/src/lib/db/repository.ts`:

```typescript
export interface Repository<T, ID = number> {
  findById(id: ID): Promise<T | null>;
  findOne(criteria: Partial<T>): Promise<T | null>;
  findMany(criteria: Partial<T>, options?: FindOptions): Promise<T[]>;
  count(criteria?: Partial<T>): Promise<number>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**Step 2: Implement Base Repository** (4-5 hours)

```typescript
// /frontend/src/lib/db/base-repository.ts
import { Pool, QueryResult } from 'pg';

export abstract class BaseRepository<T, ID = number> implements Repository<T, ID> {
  constructor(
    protected pool: Pool,
    protected tableName: string,
    protected schema?: string
  ) {}

  protected get fullTableName(): string {
    return this.schema ? `${this.schema}.${this.tableName}` : this.tableName;
  }

  protected abstract mapRowToEntity(row: any): T;

  async findById(id: ID): Promise<T | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.fullTableName} WHERE id = $1`,
      [id]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findOne(criteria: Partial<T>): Promise<T | null> {
    const { sql, params } = this.buildWhereClause(criteria);

    const result = await this.pool.query(
      `SELECT * FROM ${this.fullTableName} ${sql} LIMIT 1`,
      params
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findMany(
    criteria: Partial<T>,
    options: FindOptions = {}
  ): Promise<T[]> {
    const { sql, params } = this.buildWhereClause(criteria);
    const { limit = 20, offset = 0, orderBy = 'id', orderDirection = 'desc' } = options;

    const query = `
      SELECT * FROM ${this.fullTableName}
      ${sql}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const result = await this.pool.query(query, params);

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async count(criteria?: Partial<T>): Promise<number> {
    if (!criteria) {
      const result = await this.pool.query(
        `SELECT COUNT(*) FROM ${this.fullTableName}`
      );
      return parseInt(result.rows[0].count);
    }

    const { sql, params } = this.buildWhereClause(criteria);

    const result = await this.pool.query(
      `SELECT COUNT(*) FROM ${this.fullTableName} ${sql}`,
      params
    );

    return parseInt(result.rows[0].count);
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const result = await this.pool.query(
      `
      INSERT INTO ${this.fullTableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
      `,
      values
    );

    return this.mapRowToEntity(result.rows[0]);
  }

  async update(id: ID, data: Partial<T>): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const result = await this.pool.query(
      `
      UPDATE ${this.fullTableName}
      SET ${setClause}
      WHERE id = $${values.length + 1}
      RETURNING *
      `,
      [...values, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Entity with id ${id} not found`);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  async delete(id: ID): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.fullTableName} WHERE id = $1`,
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  protected buildWhereClause(criteria: Partial<T>): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    Object.entries(criteria).forEach(([key, value], index) => {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = $${index + 1}`);
        params.push(value);
      }
    });

    const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { sql, params };
  }

  async findPaginated(
    criteria: Partial<T>,
    page: number,
    pageSize: number,
    options?: FindOptions
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.findMany(criteria, { ...options, limit: pageSize, offset }),
      this.count(criteria)
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      hasMore: offset + data.length < total
    };
  }
}
```

**Step 3: Implement Specific Repositories** (6-8 hours)

```typescript
// /frontend/src/lib/anarchist/document-repository.ts
import { BaseRepository } from '@/lib/db/base-repository';

export interface AnarchistDocument {
  id: number;
  title: string;
  slug: string;
  authors: string | null;
  year: number | null;
  language: string;
  category: string | null;
  content: string;
  preview_text: string | null;
  downloads: number;
  reading_ease_score: number | null;
  created_at: Date;
  updated_at: Date;
}

export class AnarchistDocumentRepository extends BaseRepository<AnarchistDocument> {
  constructor(pool: Pool) {
    super(pool, 'documents', 'anarchist');
  }

  protected mapRowToEntity(row: any): AnarchistDocument {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      authors: row.authors,
      year: row.year,
      language: row.language,
      category: row.category,
      content: row.content,
      preview_text: row.preview_text,
      downloads: row.downloads,
      reading_ease_score: row.reading_ease_score,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }

  // Custom methods specific to anarchist documents
  async findBySlug(slug: string): Promise<AnarchistDocument | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.fullTableName} WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findByLanguage(language: string, options?: FindOptions): Promise<AnarchistDocument[]> {
    return this.findMany({ language } as Partial<AnarchistDocument>, options);
  }

  async findByCategory(category: string, options?: FindOptions): Promise<AnarchistDocument[]> {
    return this.findMany({ category } as Partial<AnarchistDocument>, options);
  }

  async findMostDownloaded(limit: number = 20): Promise<AnarchistDocument[]> {
    return this.findMany(
      {},
      { limit, orderBy: 'downloads', orderDirection: 'desc' }
    );
  }

  async incrementDownloads(id: number): Promise<void> {
    await this.pool.query(
      `UPDATE ${this.fullTableName} SET downloads = downloads + 1 WHERE id = $1`,
      [id]
    );
  }
}
```

**Step 4: Implement Tag Repository with Relations** (4-5 hours)

```typescript
// /frontend/src/lib/shared/tag-repository.ts
import { BaseRepository } from '@/lib/db/base-repository';

export interface Tag {
  id: number;
  name: string;
  normalized_name: string;
  created_at: Date;
}

export class TagRepository extends BaseRepository<Tag> {
  constructor(pool: Pool) {
    super(pool, 'tags', 'shared');
  }

  protected mapRowToEntity(row: any): Tag {
    return {
      id: row.id,
      name: row.name,
      normalized_name: row.normalized_name,
      created_at: new Date(row.created_at)
    };
  }

  async findByNormalizedName(normalizedName: string): Promise<Tag | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.fullTableName} WHERE normalized_name = $1`,
      [normalizedName]
    );

    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  async findOrCreate(name: string): Promise<Tag> {
    const normalizedName = name.toLowerCase().trim();

    // Try to find existing
    const existing = await this.findByNormalizedName(normalizedName);
    if (existing) return existing;

    // Create new
    return this.create({
      name,
      normalized_name: normalizedName
    } as Omit<Tag, 'id'>);
  }

  async getDocumentTags(documentId: number, schema: 'anarchist' | 'library'): Promise<Tag[]> {
    const result = await this.pool.query(
      `
      SELECT t.*
      FROM shared.tags t
      INNER JOIN ${schema}.document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = $1
      ORDER BY t.name
      `,
      [documentId]
    );

    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async setDocumentTags(
    documentId: number,
    tagNames: string[],
    schema: 'anarchist' | 'library'
  ): Promise<void> {
    // Start transaction
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Remove existing tags
      await client.query(
        `DELETE FROM ${schema}.document_tags WHERE document_id = $1`,
        [documentId]
      );

      // Add new tags
      for (const tagName of tagNames) {
        const tag = await this.findOrCreate(tagName);

        await client.query(
          `
          INSERT INTO ${schema}.document_tags (document_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [documentId, tag.id]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTopTags(schema: 'anarchist' | 'library', limit: number = 50): Promise<Array<Tag & { usage_count: number }>> {
    const result = await this.pool.query(
      `
      SELECT
        t.*,
        COUNT(dt.document_id) as usage_count
      FROM shared.tags t
      INNER JOIN ${schema}.document_tags dt ON t.id = dt.tag_id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(row => ({
      ...this.mapRowToEntity(row),
      usage_count: parseInt(row.usage_count)
    }));
  }
}
```

**Step 5: Update Services to Use Repositories** (3-4 hours)

```typescript
// /frontend/src/lib/anarchist/service.ts (REFACTORED)
import { AnarchistDocumentRepository } from './document-repository';
import { TagRepository } from '@/lib/shared/tag-repository';
import { pool } from '@/lib/db';

const documentRepo = new AnarchistDocumentRepository(pool);
const tagRepo = new TagRepository(pool);

export async function getDocuments(params: GetAnarchistDocumentsParams): Promise<GetAnarchistDocumentsResult> {
  const { page = 1, limit = 20, sort_by = 'downloads', sort_order = 'desc' } = params;

  const result = await documentRepo.findPaginated(
    {}, // criteria
    page,
    limit,
    {
      orderBy: sort_by,
      orderDirection: sort_order
    }
  );

  return {
    documents: result.data,
    total: result.total,
    page: result.page,
    limit,
    hasMore: result.hasMore
  };
}

export async function getDocumentBySlug(slug: string): Promise<AnarchistDocument | null> {
  return documentRepo.findBySlug(slug);
}

export async function getDocumentTags(documentId: number): Promise<Tag[]> {
  return tagRepo.getDocumentTags(documentId, 'anarchist');
}
```

---

## Refactoring 2: Type-Safe Query Builder

**Current State:** String concatenation for SQL queries, no type safety
**Target State:** Type-safe query builder with autocomplete and compile-time validation
**Impact:** Eliminate SQL injection risks, catch errors at compile time

### Implementation Plan

**Time Estimate:** 15-20 hours

**Step 1: Choose Query Builder Approach** (2 hours)

**Options:**
1. **Kysely** (Recommended)
   - Type-safe SQL query builder
   - Auto-generated types from database schema
   - 100% TypeScript
   - Great DX with autocomplete

2. **Prisma**
   - ORM with type safety
   - Schema-first approach
   - Heavier abstraction
   - Migration tooling included

3. **TypeORM**
   - Mature ORM
   - Decorator-based
   - More complex setup

**Recommendation:** Kysely for maximum control while maintaining type safety

**Step 2: Install and Configure Kysely** (2-3 hours)

```bash
npm install kysely
npm install --save-dev kysely-codegen
```

Generate types from database:

```bash
# Generate types from existing PostgreSQL database
npx kysely-codegen --out-file src/lib/db/types.ts
```

**Step 3: Set Up Kysely Instance** (2 hours)

```typescript
// /frontend/src/lib/db/kysely.ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types'; // Auto-generated

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20
  })
});

export const db = new Kysely<Database>({
  dialect,
  log(event) {
    if (event.level === 'query') {
      console.log('Query:', event.query.sql);
      console.log('Duration:', event.queryDurationMillis, 'ms');
    }
  }
});
```

**Step 4: Refactor Queries to Use Kysely** (6-8 hours)

```typescript
// Before: String concatenation (unsafe)
const sql = `
  SELECT * FROM anarchist.documents
  WHERE language = '${language}'
  AND year > ${year}
`;

// After: Kysely (type-safe)
const documents = await db
  .selectFrom('anarchist.documents')
  .selectAll()
  .where('language', '=', language)
  .where('year', '>', year)
  .execute();
```

**Complex query example:**

```typescript
// /frontend/src/lib/anarchist/queries.ts
import { db } from '@/lib/db/kysely';

export async function getDocumentsWithTags(params: GetDocumentsParams) {
  let query = db
    .selectFrom('anarchist.documents as d')
    .leftJoin('anarchist.document_tags as dt', 'd.id', 'dt.document_id')
    .leftJoin('shared.tags as t', 'dt.tag_id', 't.id')
    .select([
      'd.id',
      'd.title',
      'd.slug',
      'd.authors',
      'd.year',
      'd.language',
      'd.category',
      'd.preview_text',
      'd.downloads',
      // Aggregate tags into JSON array
      (eb) => eb.fn.jsonAgg(
        eb.fn('jsonb_build_object', [
          'id', eb.ref('t.id'),
          'name', eb.ref('t.name')
        ])
      ).as('tags')
    ])
    .groupBy('d.id');

  // Add filters
  if (params.language) {
    query = query.where('d.language', '=', params.language);
  }

  if (params.category) {
    query = query.where('d.category', '=', params.category);
  }

  if (params.query) {
    query = query.where((eb) =>
      eb.or([
        eb('d.title', 'ilike', `%${params.query}%`),
        eb('d.authors', 'ilike', `%${params.query}%`)
      ])
    );
  }

  // Add ordering
  query = query.orderBy(`d.${params.sort_by}`, params.sort_order);

  // Add pagination
  query = query.limit(params.limit).offset((params.page - 1) * params.limit);

  return query.execute();
}
```

**Step 5: Implement Transaction Support** (2-3 hours)

```typescript
// /frontend/src/lib/db/transaction.ts
import { db } from './kysely';

export async function withTransaction<T>(
  callback: (trx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    return callback(trx);
  });
}

// Usage example:
export async function createDocumentWithTags(
  document: NewDocument,
  tagNames: string[]
): Promise<Document> {
  return withTransaction(async (trx) => {
    // Insert document
    const doc = await trx
      .insertInto('anarchist.documents')
      .values(document)
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create/get tags
    for (const tagName of tagNames) {
      const tag = await trx
        .insertInto('shared.tags')
        .values({
          name: tagName,
          normalized_name: tagName.toLowerCase()
        })
        .onConflict((oc) => oc.column('normalized_name').doNothing())
        .returningAll()
        .executeTakeFirst();

      // Link document to tag
      await trx
        .insertInto('anarchist.document_tags')
        .values({
          document_id: doc.id,
          tag_id: tag!.id
        })
        .execute();
    }

    return doc;
  });
}
```

**Step 6: Add Type-Safe Migrations** (2-3 hours)

```typescript
// /frontend/src/lib/db/migrations/001-add-reading-time.ts
import { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('anarchist.documents')
    .addColumn('reading_time_minutes', 'integer')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('anarchist.documents')
    .dropColumn('reading_time_minutes')
    .execute();
}
```

---

## Refactoring 3: Shared Service Abstractions

**Current State:** Similar logic duplicated across anarchist, library, wiki services
**Target State:** Reusable service abstractions with composition
**Impact:** 60% less code duplication, consistent behavior

### Implementation Plan

**Time Estimate:** 12-15 hours

**Step 1: Identify Common Patterns** (2 hours)

Audit all services to find duplicated patterns:
- Document retrieval
- Search/filtering
- Pagination
- Tag management
- Content rendering

**Step 2: Create Base Service Classes** (4-5 hours)

```typescript
// /frontend/src/lib/services/base-document-service.ts
export abstract class BaseDocumentService<T extends BaseDocument> {
  constructor(
    protected repository: Repository<T>,
    protected tagRepository: TagRepository,
    protected schema: string
  ) {}

  async getById(id: number): Promise<T | null> {
    return this.repository.findById(id);
  }

  async getBySlug(slug: string): Promise<T | null> {
    // Assumes repository has findBySlug method
    return (this.repository as any).findBySlug(slug);
  }

  async search(params: SearchParams): Promise<PaginatedResult<T>> {
    // Implement common search logic
    return this.repository.findPaginated(
      this.buildSearchCriteria(params),
      params.page,
      params.limit,
      {
        orderBy: params.sort_by,
        orderDirection: params.sort_order
      }
    );
  }

  async getTags(documentId: number): Promise<Tag[]> {
    return this.tagRepository.getDocumentTags(documentId, this.schema as any);
  }

  async setTags(documentId: number, tagNames: string[]): Promise<void> {
    return this.tagRepository.setDocumentTags(documentId, tagNames, this.schema as any);
  }

  protected abstract buildSearchCriteria(params: SearchParams): Partial<T>;
}
```

**Step 3: Implement Concrete Services** (3-4 hours)

```typescript
// /frontend/src/lib/anarchist/service.ts (REFACTORED)
import { BaseDocumentService } from '@/lib/services/base-document-service';

export class AnarchistDocumentService extends BaseDocumentService<AnarchistDocument> {
  constructor() {
    super(
      new AnarchistDocumentRepository(pool),
      new TagRepository(pool),
      'anarchist'
    );
  }

  protected buildSearchCriteria(params: SearchParams): Partial<AnarchistDocument> {
    const criteria: Partial<AnarchistDocument> = {};

    if (params.language) {
      criteria.language = params.language;
    }

    if (params.category) {
      criteria.category = params.category;
    }

    // ... other anarchist-specific criteria

    return criteria;
  }

  // Anarchist-specific methods
  async getMostDownloaded(limit: number = 20): Promise<AnarchistDocument[]> {
    return (this.repository as AnarchistDocumentRepository).findMostDownloaded(limit);
  }

  async incrementDownloads(id: number): Promise<void> {
    return (this.repository as AnarchistDocumentRepository).incrementDownloads(id);
  }
}

// Export singleton instance
export const anarchistService = new AnarchistDocumentService();
```

**Step 4: Create Service Composition Helpers** (2-3 hours)

```typescript
// /frontend/src/lib/services/mixins.ts

// Taggable mixin
export function withTags<T extends Constructor>(Base: T) {
  return class extends Base {
    async addTag(documentId: number, tagName: string): Promise<void> {
      const tag = await this.tagRepository.findOrCreate(tagName);
      await this.linkDocumentTag(documentId, tag.id);
    }

    async removeTag(documentId: number, tagName: string): Promise<void> {
      const tag = await this.tagRepository.findByNormalizedName(
        tagName.toLowerCase()
      );

      if (tag) {
        await this.unlinkDocumentTag(documentId, tag.id);
      }
    }

    protected abstract linkDocumentTag(documentId: number, tagId: number): Promise<void>;
    protected abstract unlinkDocumentTag(documentId: number, tagId: number): Promise<void>;
  };
}

// Searchable mixin
export function withFullTextSearch<T extends Constructor>(Base: T) {
  return class extends Base {
    async fullTextSearch(query: string, options?: SearchOptions): Promise<any[]> {
      return db
        .selectFrom(this.tableName)
        .selectAll()
        .where((eb) =>
          eb.fn('to_tsvector', ['english', eb.ref(this.searchColumn)]),
          '@@',
          eb.fn('to_tsquery', ['english', query])
        )
        .orderBy((eb) =>
          eb.fn('ts_rank', [
            eb.fn('to_tsvector', ['english', eb.ref(this.searchColumn)]),
            eb.fn('to_tsquery', ['english', query])
          ]),
          'desc'
        )
        .limit(options?.limit || 20)
        .execute();
    }

    protected abstract get tableName(): string;
    protected abstract get searchColumn(): string;
  };
}
```

---

## Refactoring 4: Error Handling and Validation

**Current State:** Inconsistent error handling, no input validation
**Target State:** Centralized error handling, type-safe validation
**Impact:** Better error messages, fewer runtime errors

### Implementation Plan

**Time Estimate:** 8-10 hours

**Step 1: Define Error Types** (2 hours)

```typescript
// /frontend/src/lib/errors/types.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(
      `${resource} with id ${id} not found`,
      'NOT_FOUND',
      404
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DATABASE_ERROR', 500, { originalError });
  }
}
```

**Step 2: Create Error Handler Middleware** (2 hours)

```typescript
// /frontend/src/middleware/error-handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/types';

export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (error) {
      return handleError(error);
    }
  };
}

function handleError(error: unknown): NextResponse {
  // Log error
  console.error('API Error:', error);

  // Handle known errors
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.statusCode }
    );
  }

  // Handle PostgreSQL errors
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as { code: string; detail?: string };

    if (pgError.code === '23505') {
      // Unique violation
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'A record with this value already exists',
            details: pgError.detail
          }
        },
        { status: 409 }
      );
    }

    if (pgError.code === '23503') {
      // Foreign key violation
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REFERENCE',
            message: 'Referenced record does not exist',
            details: pgError.detail
          }
        },
        { status: 400 }
      );
    }
  }

  // Unknown error
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    },
    { status: 500 }
  );
}
```

**Step 3: Implement Input Validation** (2-3 hours)

```typescript
// /frontend/src/lib/validation/schemas.ts
import { z } from 'zod';

export const GetDocumentsSchema = z.object({
  query: z.string().optional(),
  language: z.string().length(2).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.enum(['title', 'year', 'downloads', 'created_at']).default('downloads'),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

export const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(200),
  authors: z.string().max(500).optional(),
  year: z.number().int().min(1800).max(2100).optional(),
  language: z.string().length(2),
  category: z.string().max(100).optional(),
  content: z.string().min(1),
  tags: z.array(z.string()).optional()
});

// Helper to validate and parse
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError(
      'Invalid request data',
      result.error.format()
    );
  }

  return result.data;
}
```

**Step 4: Apply to API Routes** (2-3 hours)

```typescript
// /frontend/src/app/api/anarchist/documents/route.ts
import { withErrorHandler } from '@/middleware/error-handler';
import { validateRequest, GetDocumentsSchema } from '@/lib/validation/schemas';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  // Validate input
  const params = validateRequest(GetDocumentsSchema, {
    query: searchParams.get('query') || undefined,
    language: searchParams.get('language') || undefined,
    category: searchParams.get('category') || undefined,
    tags: searchParams.get('tags')?.split(',') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
    sort_by: searchParams.get('sort_by') || 'downloads',
    sort_order: searchParams.get('sort_order') || 'desc'
  });

  // Call service
  const result = await anarchistService.search(params);

  return NextResponse.json({
    success: true,
    data: result
  });
});
```

---

## Refactoring 5: Testing Infrastructure

**Current State:** Minimal test coverage, no integration tests
**Target State:** Comprehensive test suite with unit and integration tests
**Impact:** Catch bugs before production, safe refactoring

### Implementation Plan

**Time Estimate:** 10-12 hours

**Step 1: Set Up Testing Framework** (2 hours)

```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev supertest @types/supertest
```

Configure Jest:

```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
};
```

**Step 2: Create Test Database Setup** (2 hours)

```typescript
// /frontend/src/__tests__/setup/database.ts
import { Pool } from 'pg';

let testPool: Pool;

export async function setupTestDatabase() {
  testPool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL
  });

  // Run migrations
  await runMigrations(testPool);

  // Seed test data
  await seedTestData(testPool);

  return testPool;
}

export async function teardownTestDatabase() {
  await testPool.end();
}

export async function cleanDatabase() {
  // Truncate all tables
  await testPool.query(`
    TRUNCATE TABLE
      anarchist.documents,
      anarchist.document_tags,
      shared.tags
    CASCADE
  `);
}
```

**Step 3: Write Repository Tests** (3-4 hours)

```typescript
// /frontend/src/lib/anarchist/__tests__/document-repository.test.ts
import { AnarchistDocumentRepository } from '../document-repository';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '@/__tests__/setup/database';

describe('AnarchistDocumentRepository', () => {
  let repo: AnarchistDocumentRepository;
  let pool: Pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    repo = new AnarchistDocumentRepository(pool);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('findById', () => {
    it('returns document when it exists', async () => {
      const doc = await repo.create({
        title: 'Test Document',
        slug: 'test-document',
        language: 'en',
        content: 'Test content'
      });

      const found = await repo.findById(doc.id);

      expect(found).not.toBeNull();
      expect(found?.title).toBe('Test Document');
    });

    it('returns null when document does not exist', async () => {
      const found = await repo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('returns document with matching slug', async () => {
      await repo.create({
        title: 'Test',
        slug: 'unique-slug',
        language: 'en',
        content: 'Content'
      });

      const found = await repo.findBySlug('unique-slug');

      expect(found).not.toBeNull();
      expect(found?.slug).toBe('unique-slug');
    });
  });

  // ... more tests
});
```

**Step 4: Write Service Tests** (2-3 hours)

```typescript
// /frontend/src/lib/anarchist/__tests__/service.test.ts
import { AnarchistDocumentService } from '../service';
import { setupTestDatabase } from '@/__tests__/setup/database';

describe('AnarchistDocumentService', () => {
  let service: AnarchistDocumentService;

  beforeAll(async () => {
    await setupTestDatabase();
    service = new AnarchistDocumentService();
  });

  describe('search', () => {
    it('returns paginated results', async () => {
      // Seed data
      for (let i = 0; i < 50; i++) {
        await service.create({
          title: `Document ${i}`,
          slug: `doc-${i}`,
          language: 'en',
          content: 'Test'
        });
      }

      const result = await service.search({
        page: 1,
        limit: 20
      });

      expect(result.data).toHaveLength(20);
      expect(result.total).toBe(50);
      expect(result.hasMore).toBe(true);
    });

    it('filters by language', async () => {
      await service.create({ title: 'English', slug: 'en', language: 'en', content: 'Test' });
      await service.create({ title: 'Spanish', slug: 'es', language: 'es', content: 'Test' });

      const result = await service.search({
        language: 'en',
        page: 1,
        limit: 20
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('English');
    });
  });
});
```

**Step 5: Write API Integration Tests** (1-2 hours)

```typescript
// /frontend/src/app/api/anarchist/documents/__tests__/route.test.ts
import { GET, POST } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/anarchist/documents', () => {
  it('returns 200 with documents', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/documents');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.documents)).toBe(true);
  });

  it('validates query parameters', async () => {
    const request = new NextRequest('http://localhost/api/anarchist/documents?limit=9999');
    const response = await GET(request);

    expect(response.status).toBe(400); // ValidationError
  });

  it('applies rate limiting', async () => {
    const requests = [];

    for (let i = 0; i < 101; i++) {
      requests.push(
        GET(new NextRequest('http://localhost/api/anarchist/documents'))
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

---

## Migration Plan

**Phase 1: Foundation (Week 1-2)**
- Set up repository pattern
- Implement base repository
- Create first concrete repositories (anarchist documents, tags)
- Write tests

**Phase 2: Query Builder (Week 3-4)**
- Install and configure Kysely
- Generate types from database
- Refactor simple queries
- Refactor complex queries
- Add transaction support

**Phase 3: Services (Week 5-6)**
- Create base service classes
- Implement mixins
- Refactor anarchist service
- Refactor library service
- Refactor wiki service

**Phase 4: Error Handling & Validation (Week 7)**
- Define error types
- Create error handler middleware
- Implement validation schemas
- Apply to all API routes

**Phase 5: Testing (Week 8-9)**
- Set up test infrastructure
- Write repository tests
- Write service tests
- Write API integration tests
- Achieve 80%+ code coverage

**Phase 6: Cleanup (Week 10)**
- Remove deprecated code
- Update documentation
- Performance testing
- Final review

---

## Success Metrics

### Code Quality
- **Before:** ~60% code duplication across services
- **After:** <20% code duplication

### Type Safety
- **Before:** 40% of code has `any` types
- **After:** <5% `any` types, 95%+ type coverage

### Test Coverage
- **Before:** <10% test coverage
- **After:** 80%+ test coverage

### Developer Experience
- **Before:** Manual SQL string building, runtime errors
- **After:** Autocomplete in queries, compile-time type errors

### Maintainability
- **Before:** Changes require updates in 3-4 places
- **After:** Single source of truth, changes in 1 place

---

## Risks and Mitigation

**Risk 1: Breaking Changes**
- **Mitigation:** Implement new layer alongside old, gradual migration
- **Rollback:** Keep old code until full migration complete

**Risk 2: Performance Regression**
- **Mitigation:** Benchmark before/after, add query monitoring
- **Rollback:** Revert to raw SQL if query builder adds overhead

**Risk 3: Learning Curve**
- **Mitigation:** Good documentation, pair programming
- **Time Buffer:** Add 20% buffer to estimates

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-17
**Author:** Claude Code (Architecture Analysis)
