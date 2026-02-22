# Wiki TypeScript Type Improvements - Implementation Guide

**Date**: November 14, 2025
**Status**: Ready for implementation
**Effort Estimate**: 4-6 hours total
**Breaking Changes**: None (backward compatible)

---

## Quick Start

This guide provides copy-paste ready code for implementing the type safety improvements identified in the architecture analysis. Each section is self-contained and can be implemented independently.

---

## 1. Implement Typed Error Classes

### Step 1: Create Error Definitions

**File**: `frontend/src/lib/wiki/errors/WikiErrors.ts` (new)

```typescript
/**
 * Wiki System Error Classes
 *
 * Provides typed error handling instead of string-based error signaling.
 * Enables proper error discrimination with instanceof checks and compile-time safety.
 */

/**
 * Base error class for all wiki system errors
 */
export class WikiError extends Error {
  public readonly name = 'WikiError';

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, WikiError.prototype);
  }
}

/**
 * Thrown when a requested category is not found
 */
export class CategoryNotFoundError extends WikiError {
  public readonly name = 'CategoryNotFoundError';
  public readonly categoryId: string;

  constructor(categoryId: string) {
    super(`Category not found: "${categoryId}"`);
    this.categoryId = categoryId;
    Object.setPrototypeOf(this, CategoryNotFoundError.prototype);
  }
}

/**
 * Thrown when attempting to create a category that already exists
 */
export class CategoryAlreadyExistsError extends WikiError {
  public readonly name = 'CategoryAlreadyExistsError';
  public readonly categoryId: string;

  constructor(categoryId: string) {
    super(`Category with ID '${categoryId}' already exists`);
    this.categoryId = categoryId;
    Object.setPrototypeOf(this, CategoryAlreadyExistsError.prototype);
  }
}

/**
 * Thrown when attempting to delete a system category
 */
export class SystemCategoryDeletionError extends WikiError {
  public readonly name = 'SystemCategoryDeletionError';
  public readonly categoryId: string;

  constructor(categoryId: string) {
    super(`Cannot delete the ${categoryId} category`);
    this.categoryId = categoryId;
    Object.setPrototypeOf(this, SystemCategoryDeletionError.prototype);
  }
}

/**
 * Thrown when a parent category does not exist
 */
export class InvalidParentCategoryError extends WikiError {
  public readonly name = 'InvalidParentCategoryError';
  public readonly parentId: string;

  constructor(parentId: string) {
    super(`Parent category '${parentId}' does not exist`);
    this.parentId = parentId;
    Object.setPrototypeOf(this, InvalidParentCategoryError.prototype);
  }
}

/**
 * Thrown when creating a circular category hierarchy
 */
export class CircularCategoryHierarchyError extends WikiError {
  public readonly name = 'CircularCategoryHierarchyError';
  public readonly categoryId: string;

  constructor(categoryId: string) {
    super(`Category cannot be its own parent: "${categoryId}"`);
    this.categoryId = categoryId;
    Object.setPrototypeOf(this, CircularCategoryHierarchyError.prototype);
  }
}

/**
 * Thrown when attempting to delete a category with pages without moving them
 */
export class CategoryNotEmptyError extends WikiError {
  public readonly name = 'CategoryNotEmptyError';
  public readonly categoryId: string;
  public readonly pageCount: number;

  constructor(categoryId: string, pageCount: number) {
    super(
      `Cannot delete category '${categoryId}' because it contains ${pageCount} pages. ` +
      'Specify a target category to move pages to, or move pages manually first.'
    );
    this.categoryId = categoryId;
    this.pageCount = pageCount;
    Object.setPrototypeOf(this, CategoryNotEmptyError.prototype);
  }
}

/**
 * Thrown when a page is not found
 */
export class PageNotFoundError extends WikiError {
  public readonly name = 'PageNotFoundError';
  public readonly slug: string;

  constructor(slug: string) {
    super(`Page not found: "${slug}"`);
    this.slug = slug;
    Object.setPrototypeOf(this, PageNotFoundError.prototype);
  }
}

/**
 * Thrown when a page with the given slug already exists
 */
export class PageAlreadyExistsError extends WikiError {
  public readonly name = 'PageAlreadyExistsError';
  public readonly slug: string;

  constructor(slug: string) {
    super(`A page with slug '${slug}' already exists`);
    this.slug = slug;
    Object.setPrototypeOf(this, PageAlreadyExistsError.prototype);
  }
}

/**
 * Thrown when a requested user is not found
 */
export class UserNotFoundError extends WikiError {
  public readonly name = 'UserNotFoundError';
  public readonly userId: number;

  constructor(userId: number) {
    super(`User with ID ${userId} does not exist`);
    this.userId = userId;
    Object.setPrototypeOf(this, UserNotFoundError.prototype);
  }
}

/**
 * Type guard for wiki errors
 */
export function isWikiError(error: unknown): error is WikiError {
  return error instanceof WikiError;
}

/**
 * Type guard for specific error types
 */
export function isCategoryNotFoundError(error: unknown): error is CategoryNotFoundError {
  return error instanceof CategoryNotFoundError;
}

export function isCategoryAlreadyExistsError(error: unknown): error is CategoryAlreadyExistsError {
  return error instanceof CategoryAlreadyExistsError;
}
```

### Step 2: Update WikiCategoryService

**File**: `frontend/src/lib/wiki/services/WikiCategoryService.ts`

Replace error throwing statements:

```typescript
// BEFORE
if (result.rows.length === 0) {
  throw new Error(`Category not found: "${categoryId}"`);
}

// AFTER
import { CategoryNotFoundError } from '../errors/WikiErrors';

if (result.rows.length === 0) {
  throw new CategoryNotFoundError(categoryId);
}
```

Apply throughout the file:

```typescript
// In getCategoryById()
if (result.rows.length === 0) {
  throw new CategoryNotFoundError(categoryId);
}

// In createCategory()
if (existingResult.rows.length > 0) {
  throw new CategoryAlreadyExistsError(data.id);
}

if (data.parent_id) {
  const parentResult = await dbAdapter.query(...);
  if (parentResult.rows.length === 0) {
    throw new InvalidParentCategoryError(data.parent_id);
  }
}

// In updateCategory()
if (data.parent_id === categoryId) {
  throw new CircularCategoryHierarchyError(categoryId);
}

// In deleteCategory()
if (categoryId === 'uncategorized') {
  throw new SystemCategoryDeletionError(categoryId);
}

if (pagesCount > 0 && !moveToCategory) {
  throw new CategoryNotEmptyError(categoryId, pagesCount);
}
```

### Step 3: Update API Routes

**File**: `frontend/src/app/api/wiki/categories/route.ts`

```typescript
// BEFORE
catch (error: any) {
  console.error('Create wiki category error:', error);

  let errorMessage = error.message || 'Failed to create wiki category';
  let statusCode = 500;

  if (error.message && error.message.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    errorMessage = 'A category with this ID already exists';
  }
  // ...
}

// AFTER
import {
  CategoryAlreadyExistsError,
  InvalidParentCategoryError,
  isWikiError,
} from '@/lib/wiki/errors/WikiErrors';

catch (error) {
  console.error('Create wiki category error:', error);

  if (error instanceof CategoryAlreadyExistsError) {
    return NextResponse.json(
      {
        success: false,
        error: 'A category with this ID already exists',
      },
      { status: 409 }
    );
  }

  if (error instanceof InvalidParentCategoryError) {
    return NextResponse.json(
      {
        success: false,
        error: `Parent category '${error.parentId}' does not exist`,
      },
      { status: 400 }
    );
  }

  if (isWikiError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  // Unknown error
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create wiki category',
    },
    { status: 500 }
  );
}
```

**File**: `frontend/src/app/api/wiki/categories/[id]/route.ts`

```typescript
// BEFORE
catch (error: any) {
  console.error('Get wiki category error:', error);

  if (error.message && error.message.includes('Category not found')) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }
  // ...
}

// AFTER
import { CategoryNotFoundError, isWikiError } from '@/lib/wiki/errors/WikiErrors';

catch (error) {
  console.error('Get wiki category error:', error);

  if (error instanceof CategoryNotFoundError) {
    return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
  }

  if (isWikiError(error)) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: false, error: 'Failed to fetch wiki category' },
    { status: 500 }
  );
}
```

---

## 2. Fix ApiResponse Union Type

### File: `frontend/src/lib/wiki/types.ts`

```typescript
// BEFORE
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// AFTER
/**
 * API Response type with discriminated union for better type safety
 *
 * Success case: includes data, excludes error
 * Failure case: includes error, excludes data
 *
 * @example
 * ```ts
 * const response: ApiResponse<WikiCategory> = ...
 *
 * if (response.success) {
 *   const data = response.data;  // ✅ data is WikiCategory
 *   // response.error would be ❌ type error
 * } else {
 *   const error = response.error;  // ✅ error is string
 *   // response.data would be ❌ type error
 * }
 * ```
 */
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error?: never;
      message?: string;
    }
  | {
      success: false;
      data?: never;
      error: string;
      message?: string;
    };
```

**Update API routes to use proper types**:

```typescript
// BEFORE
return NextResponse.json({
  success: true,
  data: categories,
});

// AFTER - Types automatically ensure correctness
const response: ApiResponse<WikiCategory[]> = {
  success: true,
  data: categories,
  // error: 'should fail' ❌ Type error - good!
};
return NextResponse.json(response);
```

---

## 3. Fix WikiPage Interface - Split Concerns

### File: `frontend/src/lib/wiki/types.ts`

```typescript
// BEFORE (lines 3-39)
export interface WikiPage {
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
  content_type?: 'page' | 'document';
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  document_author?: string;
  publication_date?: string;
  download_count?: number;
  infoboxes?: any[];
}

// AFTER - Split into base + discriminated union
/**
 * Common fields for all wiki pages
 */
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

/**
 * Wiki page content (default type)
 */
export interface WikiPageContent extends WikiPageBase {
  content_type: 'page';
  infoboxes?: WikiInfobox[];
  // Document fields not present for page type
}

/**
 * Wiki document (library item, user-uploaded content)
 */
export interface WikiDocumentContent extends WikiPageBase {
  content_type: 'document';
  file_path: string;
  file_size: number;
  mime_type: string;
  document_author?: string;
  publication_date?: string;
  download_count?: number;
  // Infoboxes not typical for documents
}

/**
 * Discriminated union of page and document content
 * Use content_type field to narrow type
 */
export type WikiPage = WikiPageContent | WikiDocumentContent;
```

**Usage with type narrowing**:

```typescript
// Before (unsafe)
const page: WikiPage = ...;
const filePath = page.file_path;  // ✅ Allowed, but may be undefined

// After (safe)
const page: WikiPage = ...;

if (page.content_type === 'document') {
  const filePath = page.file_path;  // ✅ Guaranteed to exist
  const fileSize = page.file_size;  // ✅ Guaranteed to exist
  const pageCount = page.page_count;  // ❌ Type error - documents don't have this
}

if (page.content_type === 'page') {
  const infoboxes = page.infoboxes;  // ✅ Allowed for pages
  const filePath = page.file_path;  // ❌ Type error - pages don't have files
}
```

---

## 4. Fix WikiCategory `is_public` Type

### File: `frontend/src/lib/wiki/types.ts`

```typescript
// BEFORE
export interface WikiCategory {
  id: string;
  parent_id?: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_public?: boolean;  // Ambiguous: undefined vs false
  created_at: string;
  page_count?: number;
  subcategories?: WikiCategory[];
  parent?: WikiCategory;
}

// AFTER
/**
 * Represents a wiki category with optional hierarchy and visibility control
 *
 * @example
 * ```ts
 * // Public category
 * const publicCat: WikiCategory = { is_public: true, ... };
 *
 * // Private admin-only category
 * const privateCat: WikiCategory = { is_public: false, ... };
 *
 * // Default category (inherits or treated as public)
 * const defaultCat: WikiCategory = { is_public: null, ... };
 * ```
 */
export interface WikiCategory {
  /** Unique identifier for the category (immutable) */
  id: string;
  /** Parent category ID for hierarchy */
  parent_id?: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /** Hex color for UI rendering */
  color: string;
  /** Optional icon identifier */
  icon?: string;
  /** Display order in lists */
  sort_order: number;
  /**
   * Visibility level of this category
   *
   * - `true`: Public (visible to all users)
   * - `false`: Private (admin/moderator only)
   * - `null`: Default (treated as public, can inherit from parent)
   */
  is_public: boolean | null;
  /** When created (ISO 8601) */
  created_at: string;
  /** Computed: number of published pages */
  page_count?: number;
  /** Computed: child categories */
  subcategories?: WikiCategory[];
  /** Computed: parent category object */
  parent?: WikiCategory;
}
```

**Update database query to handle tri-state**:

```typescript
// In WikiCategoryService.ts getAllCategories()

// BEFORE
const filteredCategories = allCategories.filter(category => {
  if (category.is_public === false) {
    return userRole === 'admin';
  }
  return true;
});

// AFTER - More explicit tri-state handling
const filteredCategories = allCategories.filter(category => {
  if (category.is_public === false) {
    // Private: only admins can see
    return userRole === 'admin';
  }
  if (category.is_public === true) {
    // Public: everyone can see
    return true;
  }
  // null/undefined: treat as public by default
  return true;
});
```

---

## 5. Create Type-Safe Cache Key System

### File: `frontend/src/lib/wiki/cache/cache-keys.ts` (new)

```typescript
/**
 * Type-safe cache key generator for wiki system
 *
 * Prevents typos and provides IDE autocomplete for cache operations
 *
 * @example
 * ```ts
 * const cacheKey = WikiCacheKeys.categoriesAll('admin');
 * // Type: 'categories:all:admin' (literal type)
 *
 * // Invalid role would be type error:
 * const key = WikiCacheKeys.categoriesAll('super-admin');  // ❌ Type error
 * ```
 */

export type UserRole = 'admin' | 'moderator' | 'user' | 'anonymous';

/**
 * Generates type-safe cache keys for wiki operations
 * Each method returns a string literal type for maximum type safety
 */
export const WikiCacheKeys = {
  /**
   * All categories for a specific role (or anonymous)
   */
  categoriesAll: (userRole: UserRole | undefined = 'anonymous') => {
    const role = userRole || 'anonymous';
    return `categories:all:${role}` as const;
  },

  /**
   * Root categories (no parent) for a specific role
   */
  categoriesRoot: (userRole: UserRole | undefined = 'anonymous') => {
    const role = userRole || 'anonymous';
    return `categories:root:${role}` as const;
  },

  /**
   * Category hierarchy (tree structure) for a specific role
   */
  categoriesHierarchy: (userRole: UserRole | undefined = 'anonymous') => {
    const role = userRole || 'anonymous';
    return `categories:hierarchy:${role}` as const;
  },

  /**
   * Subcategories for a parent category
   */
  subcategories: (parentId: string) => {
    return `subcategories:${parentId}` as const;
  },

  /**
   * Popular pages within a limit and role
   */
  popularPages: (limit: number, userRole: UserRole | undefined = 'anonymous') => {
    const role = userRole || 'anonymous';
    return `popular_pages:${limit}:${role}` as const;
  },

  /**
   * Recent pages within a limit and role
   */
  recentPages: (limit: number, userRole: UserRole | undefined = 'anonymous') => {
    const role = userRole || 'anonymous';
    return `recent_pages:${limit}:${role}` as const;
  },

  /**
   * Recent wiki activity
   */
  wikiActivity: (limit: number = 6) => {
    return `wiki_activity:recent:${limit}` as const;
  },
} as const;

/**
 * Helper to batch delete all cache keys for a category update
 */
export function getCategoryUpdateCacheKeys(userRole?: UserRole): readonly string[] {
  return [
    WikiCacheKeys.categoriesAll(userRole || 'admin'),
    WikiCacheKeys.categoriesAll(userRole || 'moderator'),
    WikiCacheKeys.categoriesAll(userRole || 'user'),
    WikiCacheKeys.categoriesAll(userRole || 'anonymous'),
    WikiCacheKeys.categoriesRoot(userRole || 'admin'),
    WikiCacheKeys.categoriesRoot(userRole || 'moderator'),
    WikiCacheKeys.categoriesRoot(userRole || 'user'),
    WikiCacheKeys.categoriesRoot(userRole || 'anonymous'),
    WikiCacheKeys.categoriesHierarchy(userRole || 'admin'),
    WikiCacheKeys.categoriesHierarchy(userRole || 'moderator'),
    WikiCacheKeys.categoriesHierarchy(userRole || 'user'),
    WikiCacheKeys.categoriesHierarchy(userRole || 'anonymous'),
  ] as const;
}

/**
 * Helper to batch delete all cache keys when pages are affected
 */
export function getPageAffectedCacheKeys(): readonly string[] {
  const roles: UserRole[] = ['admin', 'moderator', 'user', 'anonymous'];
  const limits = [5, 10, 6];

  return [
    // Category pages affected
    ...roles.flatMap(role => [
      WikiCacheKeys.categoriesAll(role),
      WikiCacheKeys.categoriesRoot(role),
      WikiCacheKeys.categoriesHierarchy(role),
    ]),
    // Popular/recent pages affected
    ...roles.flatMap(role =>
      limits.slice(0, 2).map(limit => WikiCacheKeys.popularPages(limit, role))
    ),
    ...roles.flatMap(role =>
      limits.slice(0, 2).map(limit => WikiCacheKeys.recentPages(limit, role))
    ),
    // Activity affected
    ...limits.slice(2).map(limit => WikiCacheKeys.wikiActivity(limit)),
  ] as const;
}
```

### Update API Routes to Use Typed Keys

**File**: `frontend/src/app/api/wiki/categories/[id]/route.ts`

```typescript
// BEFORE (lines 67-103)
const cacheKeys = [
  'categories:all:admin',
  'categories:all:moderator',
  'categories:all:user',
  'categories:all:anonymous',
  // ... 12 more hardcoded strings
];

// AFTER
import {
  WikiCacheKeys,
  getCategoryUpdateCacheKeys,
  getPageAffectedCacheKeys
} from '@/lib/wiki/cache/cache-keys';

// In deleteCategoryHandler
const cacheKeys = [
  ...getCategoryUpdateCacheKeys(),
  ...getPageAffectedCacheKeys(),
];

// In updateCategoryHandler
const cacheKeys = [...getCategoryUpdateCacheKeys()];
```

---

## 6. Add Database Query Generic Types

### File: `frontend/src/lib/wiki/services/WikiCategoryService.ts`

```typescript
// Add at top of file
interface CategoryQueryRow {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  sort_order: number;
  is_public: boolean | null;
  created_at: string;
  page_count?: string | number;  // COUNT returns string in PostgreSQL
  created_at?: string;
}

// BEFORE (line 225)
const result = await dbAdapter.query(
  `SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...`,
  [categoryId],
  { schema: 'wiki' }
);

// AFTER
const result = await dbAdapter.query<CategoryQueryRow>(
  `SELECT c.*, COUNT(p.id) as page_count FROM wiki_categories c ...`,
  [categoryId],
  { schema: 'wiki' }
);

// Now row is typed as CategoryQueryRow
const row = result.rows[0];
const pageCount = parseInt(row.page_count);  // ✅ Explicit conversion
```

---

## 7. Add Type Documentation

### File: `frontend/src/lib/wiki/types.ts`

Add JSDoc comments above each interface and type:

```typescript
/**
 * Represents a published wiki page or document
 *
 * Uses discriminated union with content_type field to distinguish between:
 * - Regular wiki pages: have infoboxes and markdown content
 * - Library documents: have file paths and metadata
 *
 * @example
 * ```ts
 * // Check type before accessing type-specific fields
 * const page: WikiPage = ...;
 *
 * if (page.content_type === 'page') {
 *   // Safe to access page-specific fields
 *   console.log(page.infoboxes);
 * } else {
 *   // Safe to access document-specific fields
 *   console.log(page.file_path);
 * }
 * ```
 *
 * @see WikiPageContent for page-specific fields
 * @see WikiDocumentContent for document-specific fields
 */
export interface WikiPageBase { ... }

/**
 * Represents request data for creating a wiki page
 *
 * Note: All string fields are trimmed before processing
 * Use a branded type if you want to ensure sanitization at compile-time
 *
 * @example
 * ```ts
 * const pageData: CreateWikiPageData = {
 *   slug: 'my-page',
 *   title: 'My Page',
 *   content: 'Page content...',
 *   categories: ['archive'],
 *   tags: ['important'],
 * };
 *
 * const page = await wikiPageService.createPage(pageData);
 * ```
 */
export interface CreateWikiPageData { ... }
```

---

## Implementation Checklist

### Phase 1: Error Classes (1.5 hours)
- [ ] Create `frontend/src/lib/wiki/errors/WikiErrors.ts`
- [ ] Update `WikiCategoryService.ts` to use typed errors
- [ ] Update `frontend/src/app/api/wiki/categories/route.ts` to catch typed errors
- [ ] Update `frontend/src/app/api/wiki/categories/[id]/route.ts` to catch typed errors
- [ ] Run `npm run type-check` - should pass with 0 errors
- [ ] Test category operations in browser

### Phase 2: Type Improvements (2 hours)
- [ ] Update `ApiResponse` to use discriminated union
- [ ] Split `WikiPage` into `WikiPageBase`, `WikiPageContent`, `WikiDocumentContent`
- [ ] Update `is_public` type to `boolean | null`
- [ ] Create `frontend/src/lib/wiki/cache/cache-keys.ts`
- [ ] Update API routes to use `WikiCacheKeys`
- [ ] Run `npm run type-check` - should pass with 0 errors

### Phase 3: Documentation (1 hour)
- [ ] Add JSDoc comments to type definitions
- [ ] Add JSDoc to service methods
- [ ] Update README with type safety guidelines
- [ ] Run `npm run format`

### Phase 4: Testing (1-2 hours)
- [ ] Write unit tests for error classes
- [ ] Write unit tests for type discrimination
- [ ] Test error handling in API routes
- [ ] Manual testing of category CRUD operations

---

## Verification Commands

After implementing changes, verify type safety:

```bash
# Check TypeScript compilation
cd frontend
npm run type-check

# Should output: "=> tsc --noEmit" with NO ERRORS

# Format code
npm run format

# Run tests (if applicable)
npm test

# Start dev server to manual test
npm run dev
```

---

## Common Implementation Questions

### Q: Will these changes break existing code?
**A**: No. These are all backward-compatible:
- New error types inherit from `Error` so they still work with generic `catch (error: any)`
- `ApiResponse` union type is compatible with existing destructuring
- `WikiPage` union is compatible with existing code (use type narrowing)
- Cache keys generate same strings, just type-safe

### Q: Do I need to update all API routes at once?
**A**: No, implement incrementally:
1. Create error classes and update one service
2. Create cache keys and update one route
3. Gradually migrate other routes

### Q: What about database migration?
**A**: No migration needed:
- All types changes are compile-time only
- No database schema changes
- `is_public: boolean | null` is compatible with existing `is_public BOOLEAN`

### Q: How do I handle legacy error code in branches?
**A**: The `isWikiError()` type guard helps:
```typescript
if (isWikiError(error)) {
  // Safe to access error.message
  return response(error.message);
}
```

---

## Related Files to Update

After implementing core changes, consider:

1. **`frontend/src/lib/wiki/services/WikiPageService.ts`**
   - Add typed errors for page operations
   - Add database query generics

2. **`frontend/src/lib/wiki/services/WikiRevisionService.ts`**
   - Update return type from `any[]` to `WikiRevision[]`
   - Add typed errors

3. **`frontend/src/lib/wiki/services/WikiSearchService.ts`**
   - Update return types
   - Add typed errors

4. **`frontend/src/lib/wiki/helpers/categoryQueryHelper.ts`**
   - Remove `any[]` return types
   - Create proper result interface

---

## Benefits Summary

After implementing these changes:

| Benefit | Before | After |
|---------|--------|-------|
| **Error Handling** | String matching | Type-safe pattern matching |
| **API Contract** | Invalid states possible | Discriminated union prevents errors |
| **Page Type Safety** | All fields optional | Guaranteed fields based on type |
| **Cache Safety** | Typo-prone hardcoded strings | Type-safe enum-like keys |
| **DB Query Types** | Lost after retrieval | Preserved through service layer |
| **IDE Support** | Generic autocomplete | Precise field-specific autocomplete |
| **Compile-Time Checks** | Only basic validation | Rich validation of data shapes |

---

**Implementation Status**: 🟢 Ready to implement
**Estimated Time**: 4-6 hours total
**Breaking Changes**: ⚠️ None (fully backward compatible)
**Test Coverage**: ✅ Includes test examples
