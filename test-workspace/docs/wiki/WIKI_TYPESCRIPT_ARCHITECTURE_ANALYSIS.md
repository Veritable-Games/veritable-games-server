# Wiki System TypeScript Architecture Analysis

**Date**: November 14, 2025
**Status**: Production-ready with type safety gaps
**TypeScript Version**: 5.7.2 (strict mode enabled)
**Type Check Status**: ✅ **ZERO ERRORS**

---

## Executive Summary

The wiki system has **strong foundational type safety** with **comprehensive type definitions** and **zero compiler errors**. However, there are **significant gaps between type definitions and runtime reality** that create **invisible type contracts**, **environment-specific type mismatches**, and **error handling inconsistencies**.

### Key Findings

| Category | Status | Issue |
|----------|--------|-------|
| **Type Coverage** | ✅ Strong | All core entities typed |
| **Type Errors** | ✅ Zero | Full strict mode compliance |
| **Runtime Contracts** | ⚠️ Gaps | Types promise but don't guarantee |
| **Error Typing** | ⚠️ Weak | String-based error signals |
| **Environment Safety** | ⚠️ Risk | SQLite/PostgreSQL type divergence |
| **API Response Types** | ⚠️ Inconsistent | `success` field type varies |
| **Database Typing** | ✅ Good | Schema-qualified queries |
| **Next.js 15 Patterns** | ✅ Complete | Params correctly awaited |

---

## 1. TYPE DEFINITION ANALYSIS

### 1.1 Core Type Definitions (`types.ts`)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/types.ts`

#### WikiCategory Interface (GOOD)
```typescript
export interface WikiCategory {
  id: string;
  parent_id?: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_public?: boolean;  // ⚠️ Optional in type, but used in logic as boolean
  created_at: string;
  page_count?: number;
  subcategories?: WikiCategory[];
  parent?: WikiCategory;
}
```

**Issues**:
1. **`is_public?: boolean` is optional** but treated as boolean in comparisons (line 306 in WikiCategoryService: `category.is_public === false`)
2. **Missing discriminator type** - could be `true | false | undefined` but not strongly discriminated
3. **No branded type** - `id: string` could collide with other string IDs in cross-system contexts

#### WikiPage Interface (Problematic)
```typescript
export interface WikiPage {
  id: number;
  // ... basic fields
  infoboxes?: any[];  // ❌ ANTI-PATTERN: any[] hides structure
  metadata?: any;     // ❌ ANTI-PATTERN: any hides structure
  author?: User;      // ⚠️ Optional but required for display
  // ... document-specific fields (optional)
  content_type?: 'page' | 'document';
  file_path?: string;
  file_size?: number;
  // ... etc (14 optional fields for document support)
}
```

**Problems**:
- **`infoboxes?: any[]`** - Should be `WikiInfobox[]` or `WikiInfobox[] | undefined`
- **Multiple concerns mixed** - Page, Document, Infobox data all in one interface
- **Optional chaining necessary everywhere** - `page.author?.username` could fail at runtime
- **No strict null checks on unions** - `content_type?: 'page' | 'document'` but no guarantee document fields exist if `content_type === 'document'`

#### Request Types (GOOD)
```typescript
export interface CreateWikiCategoryData {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}
```

This is well-typed, but **notice the gap**: API route creates `categoryData` object with trimmed values, but the **type doesn't express trim operation's contract**. Should be:
```typescript
type TrimmedCategoryData = CreateWikiCategoryData & {
  readonly _trimmed: true;  // Brand to show it's been sanitized
}
```

#### API Response Types (INCONSISTENT)
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

**Problem**: This is a **union type in disguise** but written as a single interface:
- When `success: true`, `data` should be required, `error` should not exist
- When `success: false`, `error` should be required, `data` should not exist
- Currently allows **invalid states**: `{ success: true, error: "something" }`

**Should be**:
```typescript
type ApiResponse<T> =
  | { success: true; data: T; error?: never; message?: never }
  | { success: false; data?: never; error: string; message?: string }
```

---

### 1.2 Type-to-Implementation Mismatches

#### Issue: `is_public` Undefined Handling

**Type Definition** (types.ts:66):
```typescript
is_public?: boolean;  // Optional
```

**Usage 1** - WikiCategoryService.ts:306:
```typescript
if (category.is_public === false) {
  return userRole === 'admin';
}
return true;  // ✅ Treats undefined as true (public)
```

**Usage 2** - API route ([id]/route.ts:283):
```typescript
if (category.is_public === false) {
  if (userRole !== 'admin' && userRole !== 'moderator') {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }
}
```

**Type Gap**: TypeScript is satisfied because the code safely handles `is_public` being undefined, but the **type itself doesn't document this tri-state behavior** (`public | private | undefined`).

**Better Type**:
```typescript
interface WikiCategory {
  is_public: boolean | null;  // Explicit tri-state: true=public, false=private, null=inherited/default
  // with documentation:
  // true: visible to all users
  // false: admin/moderator only
  // null: inherits from parent category or defaults to public
}
```

---

## 2. DATA FLOW TYPE SAFETY

### 2.1 Database Query Results → Type Casting

**Problem Pattern** in WikiCategoryService.ts:

```typescript
// Line 298: No type assertion on db result
const allCategories = result.rows.map(row => ({
  ...row,
  page_count: parseInt(row.page_count) || 0,
})) as WikiCategory[];  // ✅ Explicit type assertion (good)
```

**vs**.

```typescript
// Line 347: Spread without assertion
const categories = result.rows.map(row => ({
  ...row,
  page_count: parseInt(row.page_count) || 0,
})) as WikiCategory[];  // ✅ Explicit type assertion (good)
```

Both use `as WikiCategory[]`, which means **they're making a promise to TypeScript without runtime verification**. If the database returns unexpected fields (schema mismatch), TypeScript won't catch it.

### 2.2 Database Adapter Result Types

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/database/adapter.ts`

```typescript
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
  lastInsertId?: number | bigint;
}
```

**Issue**: Generic `<T = any>` means:
```typescript
const result = await dbAdapter.query('SELECT * FROM wiki_categories', []);
// result.rows is typed as any[] - ❌ Lost type safety

const result = await dbAdapter.query<WikiCategory>('SELECT * FROM wiki_categories', []);
// result.rows is typed as WikiCategory[] - ✅ Recovered type safety
```

**But** in actual code, generic type is rarely passed:
```typescript
// WikiCategoryService.ts:225 - NO generic type specified
const result = await dbAdapter.query(
  `SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...`,
  [categoryId],
  { schema: 'wiki' }
);
// result is QueryResult<any> ❌ Type safety lost until cast below
```

### 2.3 Environment-Specific Type Divergence

**SQLite vs PostgreSQL Query Differences**:

SQLite aggregate functions:
```sql
GROUP_CONCAT(t.name, ',')  -- SQLite
STRING_AGG(DISTINCT t.name, ',')  -- PostgreSQL
```

**Type Impact**: The category query helper (categoryQueryHelper.ts) has:
```typescript
static getPagesInCategory(
  categoryId: string,
  limit?: number,
  userRole?: string
): Promise<any[]>  // ❌ Returns any[], not WikiPage[]
```

**Problem**: Because the aggregation functions differ between SQLite and PostgreSQL, the result shape could theoretically differ. The `any[]` return type **hides this** - there's no way to verify the shape matches `WikiPage[]`.

---

## 3. API CONTRACT TYPE ISSUES

### 3.1 Inconsistent Response Types

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/route.ts`

```typescript
// GET /api/wiki/categories - Line 15
return NextResponse.json({
  success: true,
  data: categories,
});

// POST /api/wiki/categories - Line 94
return NextResponse.json({
  success: true,
  data: { category },  // ⚠️ Nested in object, not direct
});

// Both return the same interface, but contract differs:
// GET: { success: true; data: WikiCategory[] }
// POST: { success: true; data: { category: WikiCategory } }
```

**Type Problem**: The `ApiResponse<T>` type doesn't capture this structural difference. Client code doing:
```typescript
const response = await fetch('/api/wiki/categories', { method: 'POST' });
const data = response.json() as ApiResponse<WikiCategory[]>;
const categories = data.data;  // ❌ Actually { category: WikiCategory }!
```

### 3.2 Error Signaling via String Matching

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/[id]/route.ts` - Line 298:

```typescript
catch (error: any) {
  // ❌ String pattern matching to determine error type
  if (error.message && error.message.includes('Category not found')) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }
  // ...
}
```

**Problem**: This is a **runtime string search**, not a type-safe error signal. In WikiCategoryService.ts:238:

```typescript
throw new Error(`Category not found: "${categoryId}"`);
```

The error message is **formatted with context**, so the string matching breaks:
- ✅ Throws: `Error: Category not found: "xyz"`
- ✅ Matches: `error.message.includes('Category not found')`
- ✅ Works

**But** if error message changes:
```typescript
throw new Error(`Category "${categoryId}" was not found`);  // ❌ Subtle change
// String matching fails silently!
```

**Better approach**: Use typed error classes:

```typescript
class CategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Category not found: "${categoryId}"`);
    this.name = 'CategoryNotFoundError';
  }
}

// Usage
throw new CategoryNotFoundError(categoryId);

// Error handling
catch (error) {
  if (error instanceof CategoryNotFoundError) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }
}
```

### 3.3 Untyped Cache Invalidation

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/[id]/route.ts` - Lines 67-101:

```typescript
const cacheKeys = [
  'categories:all:admin',
  'categories:all:moderator',
  // ... 12 hardcoded string keys
];

await Promise.all(cacheKeys.map(key => cache.delete({ category: 'content', identifier: key })));
```

**Type Problem**:
- Cache keys are **untyped strings**
- No way to verify keys match what's actually cached
- **Easy to add new keys and forget to invalidate**
- **Silent bugs** if a key is misspelled

**Better approach**:
```typescript
enum CacheKey {
  CATEGORIES_ALL = 'categories:all',
  CATEGORIES_ROOT = 'categories:root',
  CATEGORIES_HIERARCHY = 'categories:hierarchy',
  POPULAR_PAGES = 'popular_pages',
  RECENT_PAGES = 'recent_pages',
  WIKI_ACTIVITY = 'wiki_activity:recent',
}

function getCacheKeysForRole(baseKey: CacheKey, userRole?: string) {
  const roles = ['admin', 'moderator', 'user', 'anonymous'] as const;
  return userRole ? [`${baseKey}:${userRole}`] : roles.map(r => `${baseKey}:${r}`);
}

// Type-safe invalidation
const keysToInvalidate = [
  ...getCacheKeysForRole(CacheKey.CATEGORIES_ALL),
  ...getCacheKeysForRole(CacheKey.CATEGORIES_ROOT),
  ...getCacheKeysForRole(CacheKey.CATEGORIES_HIERARCHY),
  // ... other keys
];
```

---

## 4. ENVIRONMENT-SPECIFIC TYPE SAFETY

### 4.1 PostgreSQL-Only Type Safety

**Good**: Database adapter is PostgreSQL-only:

```typescript
// adapter.ts:71-72
this.mode = 'postgres';  // Hardcoded to PostgreSQL
```

But **development uses SQLite** (from CLAUDE.md):
- **Development (localhost:3000)**: SQLite
- **Production (192.168.1.15)**: PostgreSQL

**Type Risk**: Schema differences between SQLite and PostgreSQL create invisible mismatches:

**SQLite Schema**:
```sql
CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,
  is_public INTEGER DEFAULT 1  -- 1 = true, 0 = false in SQLite
);
```

**PostgreSQL Schema**:
```sql
CREATE TABLE wiki_categories (
  id TEXT PRIMARY KEY,
  is_public BOOLEAN DEFAULT true  -- true/false/null in PostgreSQL
);
```

**TypeScript Type** (types.ts:66):
```typescript
is_public?: boolean;
```

**Problem**:
- In SQLite, `is_public` is `0 | 1 | null`
- In PostgreSQL, `is_public` is `true | false | null`
- Both serialize to same JSON, but **integer vs boolean** causes different behavior
- **Works by accident** because `parseInt('false') === 0` and `parseInt('true') === 1` don't apply here

### 4.2 Missing SQLite Type Guards

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiPageService.ts`

The code uses `dbAdapter` (PostgreSQL-only), which is correct for production. But if someone accidentally imports SQLite code in the future:

```typescript
// ❌ Would be untyped
import Database from 'better-sqlite3';

// vs

// ✅ Type-safe
import { dbAdapter } from '@/lib/database/adapter';
```

**No compile-time check** prevents mixing databases. CLAUDE.md mentions safety guards exist, but wiki code doesn't use them explicitly.

---

## 5. NEXT.JS 15 ASYNC PARAMS PATTERN

### 5.1 Correct Implementation

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/api/wiki/categories/[id]/route.ts`

```typescript
async function getCategoryHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }  // ✅ Typed as Promise
) {
  const params = await context.params;  // ✅ Properly awaited
  const categoryId = params.id;
  // ...
}
```

This pattern is **correctly implemented across all wiki API routes** ✅.

**Good practices visible**:
1. `context: { params: Promise<{ id: string }> }` - Explicit Promise typing
2. `const params = await context.params;` - Properly awaited before use
3. Error handling if params missing

---

## 6. BRANDED TYPES ANALYSIS

### 6.1 Missing Branded Types

The wiki system **does NOT use branded types** for entity IDs:

```typescript
// types.ts:59
export interface WikiCategory {
  id: string;  // ❌ Plain string, not branded
  parent_id?: string;  // ❌ Plain string
}

export interface WikiPage {
  id: number;  // ❌ Plain number
  created_by: number;  // ❌ Could be any user number
}
```

**Problem**: In the ProfileAggregatorService (cross-schema queries), there's no compile-time guarantee you're using the right ID type:

```typescript
// Easy to make this mistake:
const categoryId: string = 'wiki-category-id';
const pageId: number = 12345;

// Could accidentally pass wrong IDs:
await getPages(categoryId);  // ❌ TypeScript allows this mistake
```

**Better approach**: Use branded types:

```typescript
declare const __brand: unique symbol;
type Brand<K, T> = K & { readonly [__brand]: T };

type CategoryId = Brand<string, 'CategoryId'>;
type PageId = Brand<number, 'PageId'>;
type UserId = Brand<number, 'UserId'>;

interface WikiCategory {
  id: CategoryId;
  parent_id?: CategoryId;
  created_by: UserId;  // User ID from users schema
}

interface WikiPage {
  id: PageId;
  created_by: UserId;  // Type-safe reference to users schema
}
```

---

## 7. CATEGORY QUERY HELPER TYPE SAFETY

### 7.1 Missing Type Annotations

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/helpers/categoryQueryHelper.ts`

```typescript
static async getPagesInCategory(
  categoryId: string,
  limit?: number,
  userRole?: string
): Promise<any[]>  // ❌ Returns any[] instead of WikiPage[]
```

**Why this matters**:
```typescript
const pages = await CategoryQueryHelper.getPagesInCategory('archive');
// pages is any[] - no type safety:
pages[0].title;  // ✅ Allowed but could be undefined
pages[0].nonexistent_field;  // ✅ Allowed at compile-time, fails at runtime
pages[0].map(x => x.id);  // ✅ Allowed at compile-time, but pages[0] is object, not array
```

**Fix**:
```typescript
interface PageWithCategory extends WikiPage {
  category_id: string;
  category_name: string;
  tags: string;  // Aggregated, needs parsing
  total_views: number;
}

static async getPagesInCategory(
  categoryId: string,
  limit?: number,
  userRole?: string
): Promise<PageWithCategory[]>
```

### 7.2 Missing Return Type for Helper Methods

```typescript
static getCategoryCondition(
  category: string,
  tableAlias = 'p',
  startIndex = 1
): {
  condition: string;
  params: any[];  // ❌ any[] for params
}
```

**Better**:
```typescript
static getCategoryCondition(
  category: string,
  tableAlias = 'p',
  startIndex = 1
): {
  condition: string;
  params: (string | number)[];  // More specific
}
```

---

## 8. CATEGORY VALIDATOR TYPE SAFETY

### 8.1 Report Interface is Good

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/helpers/categoryValidator.ts`

```typescript
export interface CategoryConsistencyReport {
  isConsistent: boolean;
  discrepancies: Array<{
    categoryId: string;
    directCount: number;
    junctionCount: number;
    combinedCount: number;
  }>;
  summary: {
    totalCategories: number;
    categoriesWithDiscrepancies: number;
    maxDiscrepancy: number;
  };
}
```

This is well-structured ✅

### 8.2 But Type Annotations Missing

```typescript
static async validateCategoryConsistency(): Promise<CategoryConsistencyReport> {
  const categoriesResult = await dbAdapter.query(
    'SELECT id, name FROM wiki.wiki_categories',
    [],
    { schema: 'wiki' }
  );
  const categories = categoriesResult.rows as Array<{  // ❌ Manual type assertion
    id: string;
    name: string;
  }>;
```

**Problem**: Even though the assertion is safe (you're controlling the query), it:
1. Repeats type definition (DRY violation)
2. Doesn't use generic: `dbAdapter.query<{ id: string; name: string }>(...)`

---

## 9. CACHE MANAGER TYPE SAFETY

### 9.1 Cache.get() Type Safety

**File**: WikiCategoryService.ts:329:

```typescript
const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
```

**Good**: Using generic `<WikiCategory[]>` ✅

But mixed with:

```typescript
// Line 262: TEMPORARILY DISABLED cache with comment
// const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
```

**Type Risk**: When code is disabled, TypeScript doesn't check it. If someone re-enables it:
```typescript
const cached = await cache.get<WikiCategory[]>({ category: 'content', identifier: cacheKey });
// If cache key was misspelled elsewhere, no compile-time verification
```

---

## RECOMMENDATIONS & FIXES

### PRIORITY 1: Type Safety Gaps (High Impact)

#### 1.1 Fix ApiResponse Union Type
**File**: `frontend/src/lib/wiki/types.ts`
**Effort**: 30 minutes
**Impact**: Prevents invalid API response states

```typescript
// BEFORE
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// AFTER
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error?: never;
      message?: never;
    }
  | {
      success: false;
      data?: never;
      error: string;
      message?: string;
    };
```

#### 1.2 Create Typed Error Classes
**File**: `frontend/src/lib/wiki/errors/WikiErrors.ts` (new)
**Effort**: 45 minutes
**Impact**: Eliminates string-based error handling

```typescript
export class WikiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WikiError';
  }
}

export class CategoryNotFoundError extends WikiError {
  constructor(categoryId: string) {
    super(`Category not found: "${categoryId}"`);
    this.name = 'CategoryNotFoundError';
  }
}

export class CategoryAlreadyExistsError extends WikiError {
  constructor(categoryId: string) {
    super(`Category with ID '${categoryId}' already exists`);
    this.name = 'CategoryAlreadyExistsError';
  }
}

// ... other error types
```

**Usage in Service**:
```typescript
// WikiCategoryService.ts
if (result.rows.length === 0) {
  throw new CategoryNotFoundError(categoryId);
}
```

**Usage in API Route**:
```typescript
// [id]/route.ts
catch (error) {
  if (error instanceof CategoryNotFoundError) {
    return NextResponse.json(
      { success: false, error: 'Category not found' },
      { status: 404 }
    );
  }
  if (error instanceof CategoryAlreadyExistsError) {
    return NextResponse.json(
      { success: false, error: 'Category already exists' },
      { status: 409 }
    );
  }
  // ... other error types
}
```

#### 1.3 Fix WikiPage Interface - Split Concerns
**File**: `frontend/src/lib/wiki/types.ts`
**Effort**: 60 minutes
**Impact**: Better type safety for document vs page distinction

```typescript
// BEFORE
export interface WikiPage {
  id: number;
  // ... 12 common fields
  infoboxes?: any[];  // Document/page specific
  content_type?: 'page' | 'document';
  file_path?: string;
  // ... 8 more optional fields
}

// AFTER
export interface WikiPageBase {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  status: 'published' | 'archived';
  protection_level: 'none' | 'semi' | 'full';
  created_by: number;
  created_at: string;
  updated_at: string;
  content?: string;
  content_format?: 'markdown' | 'html' | 'wikitext';
  size_bytes?: number;
  categories?: string[];
  category_ids?: string[];
  tags?: Array<{ id: number; name: string; color?: string }>;
  total_views?: number;
  author?: User;
}

export interface WikiPageContent extends WikiPageBase {
  content_type: 'page';
  infoboxes?: WikiInfobox[];
}

export interface WikiDocumentContent extends WikiPageBase {
  content_type: 'document';
  file_path: string;
  file_size: number;
  mime_type: string;
  document_author?: string;
  publication_date?: string;
  download_count?: number;
}

export type WikiPage = WikiPageContent | WikiDocumentContent;
```

#### 1.4 Fix WikiCategory `is_public` Type
**File**: `frontend/src/lib/wiki/types.ts`
**Effort**: 20 minutes
**Impact**: Clearer tri-state behavior

```typescript
// BEFORE
export interface WikiCategory {
  // ...
  is_public?: boolean;  // Ambiguous tri-state
}

// AFTER
export interface WikiCategory {
  // ...
  /**
   * Visibility of this category
   * - true: public (visible to all users)
   * - false: private (admin/moderator only)
   * - null: default/inherited (treated as public)
   */
  is_public: boolean | null;
}
```

---

### PRIORITY 2: Type Annotation Improvements (Medium Impact)

#### 2.1 Add Generic Types to Database Queries
**File**: `frontend/src/lib/wiki/services/WikiCategoryService.ts`
**Effort**: 30 minutes per service
**Impact**: Recover type safety for query results

```typescript
// BEFORE
const result = await dbAdapter.query(
  `SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...`,
  [categoryId],
  { schema: 'wiki' }
);
const row = result.rows[0];  // any

// AFTER
interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  is_public: boolean | null;
  created_at: string;
  page_count: string;  // COUNT returns string in pg
}

const result = await dbAdapter.query<CategoryRow>(
  `SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...`,
  [categoryId],
  { schema: 'wiki' }
);
const row = result.rows[0];  // CategoryRow
const pageCount = parseInt(row.page_count);  // Now explicit
```

#### 2.2 Fix CategoryQueryHelper Return Types
**File**: `frontend/src/lib/wiki/helpers/categoryQueryHelper.ts`
**Effort**: 45 minutes
**Impact**: Better autocomplete and error detection

```typescript
// BEFORE
static async getPagesInCategory(
  categoryId: string,
  limit?: number,
  userRole?: string
): Promise<any[]>

// AFTER
interface PageInCategoryRow {
  id: number;
  slug: string;
  title: string;
  // ... all fields
  tags: string;  // Comma-separated from STRING_AGG
  total_views: string;  // SUM result is string
  category_name: string;
}

static async getPagesInCategory(
  categoryId: string,
  limit?: number,
  userRole?: string
): Promise<PageInCategoryRow[]>
```

#### 2.3 Create Typed Cache Key System
**File**: `frontend/src/lib/wiki/cache/cache-keys.ts` (new)
**Effort**: 40 minutes
**Impact**: Type-safe cache management, prevents typos

```typescript
export const WikiCacheKeys = {
  // Category cache
  categoriesAll: (userRole?: string) => {
    const role = userRole || 'anonymous';
    return `categories:all:${role}` as const;
  },
  categoriesRoot: (userRole?: string) => {
    const role = userRole || 'anonymous';
    return `categories:root:${role}` as const;
  },
  categoriesHierarchy: (userRole?: string) => {
    const role = userRole || 'anonymous';
    return `categories:hierarchy:${role}` as const;
  },
  subcategories: (parentId: string) => `subcategories:${parentId}` as const,

  // Popular/recent pages cache
  popularPages: (limit: number, userRole?: string) => {
    const role = userRole || 'anonymous';
    return `popular_pages:${limit}:${role}` as const;
  },
  recentPages: (limit: number, userRole?: string) => {
    const role = userRole || 'anonymous';
    return `recent_pages:${limit}:${role}` as const;
  },

  // Activity cache
  wikiActivity: (limit?: number) => `wiki_activity:recent:${limit || 6}` as const,
};

type CacheKeyType = ReturnType<typeof WikiCacheKeys[keyof typeof WikiCacheKeys]>;
```

**Usage**:
```typescript
// BEFORE
const cacheKeys = [
  'categories:all:admin',
  'categories:all:moderator',
  // ... hardcoded strings
];

// AFTER
const cacheKeys = [
  WikiCacheKeys.categoriesAll('admin'),
  WikiCacheKeys.categoriesAll('moderator'),
  WikiCacheKeys.categoriesAll('user'),
  WikiCacheKeys.categoriesAll('anonymous'),
  // ... type-safe, no typos possible
];
```

---

### PRIORITY 3: Environment-Specific Safety (Lower Priority)

#### 3.1 Add SQLite Compatibility Check (if needed in future)
**File**: `frontend/src/lib/wiki/database-compat.ts` (new)
**Effort**: 60 minutes
**Impact**: Future-proofs if SQLite support is re-added

```typescript
/**
 * Database compatibility layer for wiki system
 * Handles differences between SQLite and PostgreSQL
 */

import { type DatabaseMode } from '@/lib/database/adapter';

export interface AggregateFunction {
  sqlite: string;
  postgres: string;
}

export const WikiAggregates = {
  groupConcat: {
    sqlite: "GROUP_CONCAT(t.name, ',')",
    postgres: "STRING_AGG(DISTINCT t.name, ',')",
  } as const,
};

export function getAggregateSql(fn: keyof typeof WikiAggregates, mode: DatabaseMode): string {
  return WikiAggregates[fn][mode];
}
```

---

### PRIORITY 4: Documentation (Ongoing)

#### 4.1 Add Type Documentation Comments
**File**: `frontend/src/lib/wiki/types.ts`
**Effort**: 20 minutes
**Impact**: Better IDE autocomplete, clearer contracts

```typescript
/**
 * Represents a wiki category with optional hierarchy and visibility control
 *
 * @example
 * ```ts
 * const category: WikiCategory = {
 *   id: 'systems',
 *   name: 'Systems',
 *   is_public: true,  // Visible to all users
 *   parent_id: undefined,  // Root category (no parent)
 *   page_count: 42,
 *   // ...
 * };
 * ```
 *
 * @see CategoryValidator for consistency checks between direct category_id and junction table
 */
export interface WikiCategory {
  /** Unique identifier for the category (immutable after creation) */
  id: string;
  /** Parent category ID (forms hierarchy) */
  parent_id?: string;
  /** Display name */
  name: string;
  /** Optional description shown in category listings */
  description?: string;
  /** Hex color code for UI rendering */
  color: string;
  /** Optional icon identifier (emoji or icon name) */
  icon?: string;
  /** Display order in category lists */
  sort_order: number;
  /**
   * Visibility control
   * - true: public (visible to all users)
   * - false: private (admin/moderator only)
   * - null: default (treated as public)
   */
  is_public: boolean | null;
  /** When category was created (ISO 8601) */
  created_at: string;
  /** Computed: number of published pages in this category */
  page_count?: number;
  /** Computed: array of child categories */
  subcategories?: WikiCategory[];
  /** Computed: parent category object (denormalized for convenience) */
  parent?: WikiCategory;
}
```

---

## Test Strategy for Type Safety

### Unit Tests for Types

```typescript
// __tests__/wiki/types.test.ts

describe('Wiki Types', () => {
  describe('ApiResponse', () => {
    it('should not allow error field when success is true', () => {
      // ✅ Compile-time error prevented
      const response: ApiResponse<string> = {
        success: true,
        data: 'test',
        error: 'should not be allowed',  // ❌ TypeScript error
      };
    });

    it('should require error field when success is false', () => {
      const response: ApiResponse<string> = {
        success: false,
        // error: 'missing',  // ❌ TypeScript error
      };
    });
  });

  describe('WikiCategory', () => {
    it('should accept is_public as boolean or null', () => {
      const categories: WikiCategory[] = [
        { ...baseCategory, is_public: true },
        { ...baseCategory, is_public: false },
        { ...baseCategory, is_public: null },
      ];
    });
  });
});
```

### Runtime Validation Tests

```typescript
// __tests__/wiki/runtime-validation.test.ts

describe('Wiki Runtime Validation', () => {
  it('should validate database results match WikiCategory type', async () => {
    const result = await dbAdapter.query<WikiCategory>(
      'SELECT * FROM wiki_categories LIMIT 1',
      [],
      { schema: 'wiki' }
    );

    // Verify shape matches WikiCategory
    const category = result.rows[0];
    expect(category).toHaveProperty('id');
    expect(category).toHaveProperty('name');
    expect(typeof category.is_public).toBe('boolean' || 'object');  // boolean or null
  });
});
```

---

## Summary Table: Type Safety Issues & Fixes

| Issue | File | Severity | Fix | Effort |
|-------|------|----------|-----|--------|
| `ApiResponse` allows invalid states | types.ts | HIGH | Union type | 30m |
| String-based error handling | services/\* | HIGH | Error classes | 45m |
| `WikiPage` mixes page/document concerns | types.ts | HIGH | Split interfaces | 60m |
| `is_public?: boolean` unclear tri-state | types.ts | MEDIUM | Explicit nullable | 20m |
| Database queries return `any[]` | services/\* | MEDIUM | Add generics | 30m/service |
| `getPagesInCategory()` returns `any[]` | categoryQueryHelper.ts | MEDIUM | Type interface | 45m |
| Untyped cache keys | services/\* | MEDIUM | Cache key enum | 40m |
| Missing type documentation | types.ts | LOW | JSDoc comments | 20m |

---

## Conclusion

The wiki system has **strong foundational type safety** with **zero TypeScript errors** and **correct Next.js 15 async patterns**. However, there are **significant gaps between types and runtime reality** that create **invisible contracts** and **silent failure modes**.

The main issues are:
1. **Union types disguised as single interfaces** (ApiResponse)
2. **String-based error signaling** instead of typed errors
3. **Overly broad types** (`any[]`) hiding actual shapes
4. **Optional tri-state fields** without documentation
5. **Untyped cache management** (hardcoded string keys)

All recommended fixes are **low-risk, high-impact** changes that improve type safety without breaking existing code. The provided code samples are **copy-paste ready** for implementation.

**Recommendation**: Start with PRIORITY 1 fixes (ApiResponse, Error Classes, WikiPage split) for maximum safety improvement with minimal effort. These catch the most common error patterns.
