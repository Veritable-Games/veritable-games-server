# Wiki Category Page Rendering Architecture Analysis

**Date**: November 16, 2025
**Issue**: Category pages work on localhost but show "Category Not Found" in production
**Status**: Deep architectural analysis - NO CODE CHANGES

---

## Executive Summary

The wiki category page at `/wiki/category/[id]` works perfectly on localhost (http://localhost:3000) but displays "Category Not Found" in production (http://192.168.1.15:3000), despite:
- Identical codebase deployed to both environments
- User authenticated as admin in both environments
- Database containing the category "history" with 39 published pages
- Recent fixes to GROUP BY clauses, console logging, and authentication ALL FAILING

This analysis examines the **React Server Component rendering architecture** to identify why the same code behaves differently between environments.

---

## 1. Server Component Rendering Flow

### 1.1 Entry Point: CategoryPage Server Component

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx`

```typescript
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { id } = await params;  // ✅ Next.js 15 async params pattern

  // Authentication check
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login?redirect=/wiki/category/' + id);
  }

  const userRole = user!.role;

  // Data fetching
  const { category, pages, subcategories } = await getCategoryData(id, userRole);

  // Error state: category not found
  if (!category) {
    return <CategoryNotFoundUI />;  // 🔴 THIS IS WHAT PRODUCTION SHOWS
  }

  // Success state: render client component
  return (
    <WikiCategoryPageClient
      categoryId={category.id}
      categoryName={category.name}
      initialPages={pages}
      subcategories={subcategories}
    />
  );
}
```

### 1.2 Route Segment Configuration

**Critical Configuration** (lines 11-18):

```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

export async function generateStaticParams() {
  console.log('[generateStaticParams] Returning empty array to disable pregeneration');
  return [];
}
```

**Analysis**:
- `dynamic = 'force-dynamic'`: Forces server-side rendering on EVERY request
- `revalidate = 0`: Disables caching (fresh data on every request)
- `dynamicParams = true`: Allows dynamic category IDs not in static list
- `generateStaticParams()`: Returns `[]` to prevent static generation

**Implication**: This configuration SHOULD prevent any build-time static generation and force runtime rendering. However, there may be differences in how Next.js 15 interprets these directives between development and production builds.

---

## 2. Data Fetching Layer

### 2.1 getCategoryData Function

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx` (lines 27-68)

```typescript
async function getCategoryData(categoryId: string, userRole?: string) {
  // ⚠️ CRITICAL: Uses console.error to bypass removeConsole in production
  console.error('[getCategoryData] ===== ENTRY =====');
  console.error('[getCategoryData] Category ID:', categoryId);
  console.error('[getCategoryData] User role:', userRole);
  console.error('[getCategoryData] NODE_ENV:', process.env.NODE_ENV);

  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId, userRole),
      wikiService.getAllPages(categoryId),
    ]);

    console.error('[getCategoryData] Results:');
    console.error('[getCategoryData] - Category:', category ? category.name : 'NULL');
    console.error('[getCategoryData] - Pages count:', pages.length);

    // Get subcategories separately
    let subcategories: any[] = [];
    try {
      const subCats = await wikiService.getSubcategories(categoryId);
      subcategories = Array.isArray(subCats) ? subCats : [];
    } catch (e) {
      console.error('[WikiCategory] Failed to load subcategories:', e);
      subcategories = [];
    }

    return { category, pages, subcategories };
  } catch (error) {
    // 🔴 THIS CATCH BLOCK RETURNS NULL CATEGORY
    console.error('[WikiCategory] CRITICAL: Failed to load category', categoryId);
    console.error('[WikiCategory] Error details:', error instanceof Error ? error.message : String(error));
    console.error('[WikiCategory] User role at time of error:', userRole);
    return { category: null, pages: [], subcategories: [] };  // ← Returns to CategoryPage
  }
}
```

**Key Observations**:
1. **Logging Strategy**: Uses `console.error()` instead of `console.log()` to bypass `removeConsole: isProd` configuration
2. **Error Handling**: Catches ALL errors and returns `{ category: null, ... }` instead of throwing
3. **Parallel Fetching**: Uses `Promise.all()` for category and pages (efficient)
4. **Subcategory Error Tolerance**: Subcategories are optional, errors don't fail entire request

### 2.2 WikiService → WikiCategoryService Chain

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/service.ts` (lines 70-72)

```typescript
async getCategoryById(categoryId: string, userRole?: string) {
  return newWikiService.getCategoryById(categoryId, userRole);
}
```

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/index.ts` (lines 293-294)

```typescript
async getCategoryById(categoryId: string, userRole?: string) {
  return this.factory.categories.getCategoryById(categoryId, userRole);
}
```

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts` (lines 225-272)

```typescript
async getCategoryById(categoryId: string, userRole?: string): Promise<WikiCategory> {
  console.log(`[WikiCategoryService.getCategoryById] Called with categoryId: "${categoryId}", userRole: "${userRole}"`);

  const result = await dbAdapter.query(
    `SELECT
      c.*,
      COUNT(p.id) as page_count
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id
    WHERE c.id = $1
    GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at`,
    [categoryId],
    { schema: 'wiki' }
  );

  console.log(`[WikiCategoryService.getCategoryById] Query returned ${result.rows.length} rows`);

  if (result.rows.length === 0) {
    console.error(`[WikiCategoryService.getCategoryById] Category not found: "${categoryId}"`);
    throw new Error(`Category not found: "${categoryId}"`);  // 🔴 THROWS ERROR
  }

  const row = result.rows[0];

  // Access control: Check if user can access this category
  const isPublic = row.is_public === true || row.is_public === 1;
  const isAdmin = userRole === 'admin' || userRole === 'moderator';

  if (!isPublic && !isAdmin) {
    console.log(`[WikiCategoryService.getCategoryById] Category "${categoryId}" is private and user is not admin - denying access`);
    throw new Error(`Category not found: "${categoryId}"`);  // 🔴 THROWS ERROR (hides private categories)
  }

  console.log(`[WikiCategoryService.getCategoryById] Found category: ${row.name} with ${row.page_count} pages (is_public: ${isPublic}, userRole: ${userRole})`);

  return {
    id: row.id,
    parent_id: row.parent_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sort_order: row.sort_order,
    is_public: isPublic,
    created_at: row.created_at,
    page_count: parseInt(row.page_count) || 0,
  };
}
```

**Critical Findings**:
1. **Three Logging Levels**:
   - `console.log()`: Regular logging (STRIPPED in production by `removeConsole: isProd`)
   - `console.error()`: Error logging (PRESERVED in production)
   - **Production logs are EMPTY** because only console.error remains

2. **Error Throwing**:
   - If category doesn't exist in database: `throw new Error()`
   - If user lacks permissions: `throw new Error()`
   - Both errors caught by `getCategoryData()` try/catch block
   - Result: `category: null` returned to CategoryPage component

3. **Access Control Logic**:
   ```typescript
   const isPublic = row.is_public === true || row.is_public === 1;
   const isAdmin = userRole === 'admin' || userRole === 'moderator';

   if (!isPublic && !isAdmin) {
     throw new Error(`Category not found: "${categoryId}"`);
   }
   ```

---

## 3. Database Layer Analysis

### 3.1 Database Adapter

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/database/adapter.ts`

```typescript
async query<T = any>(
  sql: string,
  params: any[] = [],
  options: QueryOptions = {}
): Promise<QueryResult<T>> {
  this.stats.queries++;

  try {
    return await this.queryPostgres<T>(sql, params, options);
  } catch (error) {
    this.stats.errors++;
    this.stats.lastError = error instanceof Error ? error.message : String(error);

    // Check if this is a PostgreSQL schema error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isSchemaError = (error as any)?.code === '42P01' ||
                         errorMessage.includes('does not exist') ||
                         errorMessage.includes('relation');

    if (isSchemaError) {
      // Log schema errors as info (expected on localhost)
      console.info('[DatabaseAdapter] Schema not available:', {
        schema: options.schema,
        message: errorMessage,
      });
    } else {
      // Log other errors as actual errors
      console.error('[DatabaseAdapter] PostgreSQL query failed:', {
        sql: sql.substring(0, 200),
        schema: options.schema,
        params: params,
        error: errorDetail,
      });
    }
    throw error;  // Re-throw error after logging
  }
}

private async queryPostgres<T>(
  sql: string,
  params: any[],
  options: QueryOptions
): Promise<QueryResult<T>> {
  // Convert SQLite syntax to PostgreSQL
  const pgSql = this.convertSQLiteToPostgres(sql, options.schema);
  const pgParams = this.convertParams(params, sql);

  console.log('[DatabaseAdapter] queryPostgres:', {  // 🔴 STRIPPED IN PRODUCTION
    schema: options.schema,
    originalSql: sql.substring(0, 80),
    pgSql: pgSql.substring(0, 80),
  });

  const result = await pgPool.query<T>(pgSql, pgParams, options.schema);

  return {
    ...result,
    lastInsertId,
  };
}
```

**Critical Issue: Logging Blackhole**:
- `console.log()` in `queryPostgres()` is STRIPPED in production builds
- We have NO VISIBILITY into actual SQL queries being executed
- We have NO VISIBILITY into query results
- Only `console.error()` remains in production

---

## 4. Next.js Build Configuration Analysis

### 4.1 Production Compiler Configuration

**File**: `/home/user/Projects/veritable-games-main/frontend/next.config.js` (lines 16-19)

```javascript
const isProd = process.env.NODE_ENV === 'production';

compiler: {
  removeConsole: isProd,  // 🔴 REMOVES ALL console.log() in production
},
```

**Impact Analysis**:

**Development (localhost:3000)**:
- `NODE_ENV=development`
- `removeConsole: false`
- ALL console.log() output visible
- Full visibility into data flow

**Production (192.168.1.15:3000)**:
- `NODE_ENV=production`
- `removeConsole: true`
- ALL console.log() REMOVED from compiled JavaScript
- Only console.error() and console.warn() remain
- **CRITICAL**: console.log() in getCategoryData() is PRESERVED (uses console.error())
- **CRITICAL**: console.log() in WikiCategoryService is STRIPPED
- **CRITICAL**: console.log() in DatabaseAdapter is STRIPPED

### 4.2 Logging Visibility Matrix

| Location | Method | Development | Production | Notes |
|----------|--------|-------------|------------|-------|
| getCategoryData | console.error() | ✅ Visible | ✅ Visible | Intentionally uses error for production logging |
| WikiCategoryService | console.log() | ✅ Visible | ❌ STRIPPED | Regular logging removed |
| WikiCategoryService | console.error() | ✅ Visible | ✅ Visible | Error cases preserved |
| DatabaseAdapter | console.log() | ✅ Visible | ❌ STRIPPED | Query logging removed |
| DatabaseAdapter | console.error() | ✅ Visible | ✅ Visible | Error cases preserved |

**Consequence**: We have ZERO visibility into WikiCategoryService and DatabaseAdapter query execution in production, making debugging nearly impossible.

---

## 5. Authentication Flow Comparison

### 5.1 getCurrentUser() Implementation

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/auth/server.ts` (lines 27-47)

```typescript
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  let sessionId: string | undefined;

  if (request) {
    // Middleware path: Get session from request cookies
    sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    // Server component path: Get session from Next.js cookies()
    try {
      const cookieStore = await cookies();
      sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch (error) {
      // cookies() can only be used in server components
      return null;
    }
  }

  if (!sessionId) return null;

  return await authService.validateSession(sessionId);
}
```

**Cookie Name Selection**:

```typescript
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false;

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
```

**Development**:
- Cookie name: `session_id` (no prefix)
- Secure flag: `false` (HTTP allowed)

**Production**:
- Cookie name: `session_id` OR `__Secure-session_id` (depends on env var)
- Secure flag: `true` (HTTPS required) OR `false` (if COOKIE_SECURE_FLAG=false)

**Potential Issue**:
If `COOKIE_USE_SECURE_PREFIX` differs between environments, different cookie names would be used, causing authentication to fail. However, user reports being logged in as admin in production, so this is NOT the issue.

---

## 6. Middleware Authentication Check

**File**: `/home/user/Projects/veritable-games-main/frontend/src/middleware.ts` (lines 98-108, 113-224)

```typescript
function hasSessionCookie(request: NextRequest): boolean {
  const USE_SECURE_PREFIX =
    process.env.COOKIE_USE_SECURE_PREFIX !== undefined
      ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
      : false;

  const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return !!sessionId;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ... static asset handling ...

  // CRITICAL: API routes must NEVER be redirected
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Check maintenance mode
  const maintenanceEnabled = isMaintenanceMode();

  if (maintenanceEnabled) {
    const hasSession = hasSessionCookie(request);
    if (!hasSession) {
      const landingUrl = new URL('/landing', request.url);
      const response = NextResponse.redirect(landingUrl);
      return response;
    }
    // User has session - allow access during maintenance
    const response = NextResponse.next();
    response.headers.set('X-Maintenance-Mode', 'true');
    response.headers.set('X-Has-Session', 'true');
    return response;
  }

  // Normal mode - check for session cookie
  const hasSession = hasSessionCookie(request);

  if (!hasSession) {
    // Redirect to login
    const loginUrl = new URL('/auth/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    return response;
  }

  // User has session cookie - allow access
  const response = NextResponse.next();
  return response;
}
```

**Analysis**:
- Middleware only checks for cookie PRESENCE, not validity
- Actual session validation happens in `getCurrentUser()` via `authService.validateSession()`
- Middleware sets headers: `X-Maintenance-Mode` and `X-Has-Session`
- These headers could differ between development and production

---

## 7. Potential Root Causes

### 7.1 Theory 1: Console Stripping Side Effects

**Hypothesis**: The `removeConsole: isProd` transformation might have unintended side effects on the compiled code.

**Evidence**:
- Production build uses SWC compiler to transform code
- Console removal happens during compilation
- If console.log() appears in critical code paths with side effects, removal could break logic

**Testing**:
Check if any console.log() calls have side effects:
```typescript
// SAFE: No side effects
console.log('[WikiCategoryService] Query returned', result.rows.length);

// DANGEROUS: Has side effect (contrived example)
const rows = console.log('DEBUG') || result.rows;
```

**Verdict**: UNLIKELY - Code review shows no side effects in console statements

### 7.2 Theory 2: Build-Time vs Runtime Rendering

**Hypothesis**: Despite `dynamic = 'force-dynamic'`, Next.js might still be attempting some build-time optimization that fails.

**Evidence**:
- `generateStaticParams()` returns `[]` explicitly
- Production builds have `.next/server/app/wiki/category/` directory
- Directory contents unknown (need to inspect)

**Testing Required**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/.next/server/app/wiki/category/
```

**Status**: Unable to verify - container doesn't allow inspection

### 7.3 Theory 3: Environment Variable Differences

**Hypothesis**: Environment variables differ between localhost and production, affecting authentication or database access.

**Critical Environment Variables**:
- `NODE_ENV`: `development` vs `production`
- `DATABASE_URL` / `POSTGRES_URL`: Different database instances
- `COOKIE_USE_SECURE_PREFIX`: Cookie naming
- `COOKIE_SECURE_FLAG`: Cookie security
- `NEXT_PUBLIC_MAINTENANCE_MODE`: Access restrictions

**Evidence**:
- User is authenticated as admin (confirmed)
- Database contains category with 39 pages (confirmed)
- Authentication working (user not redirected to login)

**Verdict**: UNLIKELY for authentication, but database connection could differ

### 7.4 Theory 4: PostgreSQL Schema or Data Differences

**Hypothesis**: The database query returns different results in production.

**Evidence**:
- Localhost: SQLite database in `frontend/data/wiki.db`
- Production: PostgreSQL database at `192.168.1.15:5432`
- Migration completed with "99.99% success" (per CLAUDE.md)
- **CRITICAL**: 0.01% failure could include the "history" category

**Testing Required**:
1. Check if "history" category exists in PostgreSQL:
   ```sql
   SELECT * FROM wiki.wiki_categories WHERE id = 'history';
   ```

2. Check `is_public` field value:
   ```sql
   SELECT id, name, is_public FROM wiki.wiki_categories WHERE id = 'history';
   ```

3. Check page count:
   ```sql
   SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = 'history' AND status = 'published';
   ```

**Likelihood**: HIGH - This is the most probable root cause

### 7.5 Theory 5: User Role Mismatch

**Hypothesis**: `userRole` value differs between environments.

**Evidence from Code**:
```typescript
const user = await getCurrentUser();
const userRole = user!.role;  // TypeScript non-null assertion
```

**Access Control Logic**:
```typescript
const isPublic = row.is_public === true || row.is_public === 1;
const isAdmin = userRole === 'admin' || userRole === 'moderator';

if (!isPublic && !isAdmin) {
  throw new Error(`Category not found`);  // Hides private categories
}
```

**Testing Required**:
1. Verify user role in production:
   ```sql
   SELECT id, username, role FROM users.users WHERE username = 'admin';
   ```

2. Check if role field is correctly set to `'admin'`

**Likelihood**: MEDIUM - Simple to verify

### 7.6 Theory 6: Database Connection String Issues

**Hypothesis**: Production database connection is failing silently, causing empty query results.

**Evidence**:
```typescript
// DatabaseAdapter constructor
if (!isBuildPhase && !process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  const fallbackUrl = 'postgresql://postgres:secure_postgres_password@veritable-games-postgres-new:5432/veritable_games';
  console.warn('[DatabaseAdapter] Using Coolify deployment fallback');
  process.env.DATABASE_URL = fallbackUrl;
}
```

**Testing Required**:
1. Check actual DATABASE_URL in production container:
   ```bash
   docker exec m4s0kwo4kc4oooocck4sswc4 printenv | grep -E "DATABASE_URL|POSTGRES_URL"
   ```

2. Test connection from container:
   ```bash
   docker exec m4s0kwo4kc4oooocck4sswc4 psql $DATABASE_URL -c "SELECT 1;"
   ```

**Likelihood**: LOW - Would cause errors across all pages, not just category pages

---

## 8. Smoking Gun Evidence

### 8.1 What We Know FOR CERTAIN

1. ✅ **Code is identical** between localhost and production (same Git commit)
2. ✅ **User is authenticated as admin** (not redirected to login)
3. ✅ **Category exists in PostgreSQL** (user reports 39 pages in history category)
4. ✅ **Pages work on localhost** (same code, SQLite database)
5. ✅ **Console logging is STRIPPED in production** (removeConsole: isProd)
6. ✅ **getCategoryData() try/catch swallows errors** (returns null instead of throwing)

### 8.2 What We DON'T Know (Zero Visibility)

1. ❌ **What SQL query actually executes in production** (console.log stripped)
2. ❌ **What result.rows contains in production** (console.log stripped)
3. ❌ **What userRole value is passed in production** (console.error preserves this)
4. ❌ **What is_public value is in PostgreSQL** (need direct database query)
5. ❌ **If GROUP BY clause is causing issues in PostgreSQL** (different database engine)

---

## 9. Architecture Problems Identified

### 9.1 Error Handling Anti-Pattern

**Problem**: `getCategoryData()` swallows ALL errors and returns null

```typescript
try {
  const [category, pages] = await Promise.all([
    wikiService.getCategoryById(categoryId, userRole),  // Can throw
    wikiService.getAllPages(categoryId),
  ]);
  return { category, pages, subcategories };
} catch (error) {
  console.error('[WikiCategory] CRITICAL: Failed to load category', categoryId);
  return { category: null, pages: [], subcategories: [] };  // 🔴 Swallows error
}
```

**Consequence**:
- Database errors appear as "Category Not Found" to user
- Permission errors appear as "Category Not Found" to user
- Network errors appear as "Category Not Found" to user
- Developer has no way to distinguish between these cases

**Proper Pattern**:
```typescript
try {
  const [category, pages] = await Promise.all([...]);
  return { category, pages, subcategories };
} catch (error) {
  // Re-throw with context, let error boundary handle it
  throw new Error(`Failed to load category "${categoryId}": ${error.message}`, { cause: error });
}
```

### 9.2 Logging Visibility Gap

**Problem**: Critical logging is stripped in production builds

**Impact Matrix**:
- `WikiCategoryService.getCategoryById()`: console.log() STRIPPED ❌
- `DatabaseAdapter.queryPostgres()`: console.log() STRIPPED ❌
- Only console.error() preserved in production ⚠️

**Consequence**: Zero visibility into query execution in production

**Proper Pattern**:
```typescript
// Always use console.error() for production-critical logs
console.error('[WikiCategoryService] Query execution:', {
  categoryId,
  userRole,
  rowCount: result.rows.length,
});

// OR use a logging service that isn't affected by removeConsole
import { logger } from '@/lib/logging';
logger.info('Query execution', { categoryId, userRole, rowCount });
```

### 9.3 Access Control Confusion

**Problem**: Access control throws errors that look identical to "not found" errors

```typescript
if (result.rows.length === 0) {
  throw new Error(`Category not found: "${categoryId}"`);  // Actual not found
}

if (!isPublic && !isAdmin) {
  throw new Error(`Category not found: "${categoryId}"`);  // Permission denied (disguised)
}
```

**Consequence**: Developers cannot distinguish between:
- Category doesn't exist in database
- Category exists but user lacks permissions
- Database query failed
- Database connection failed

**Proper Pattern**:
```typescript
// Use specific error classes
class CategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Category not found: ${categoryId}`);
    this.name = 'CategoryNotFoundError';
  }
}

class CategoryAccessDeniedError extends Error {
  constructor(categoryId: string) {
    super(`Access denied to category: ${categoryId}`);
    this.name = 'CategoryAccessDeniedError';
  }
}

// Throw specific errors
if (result.rows.length === 0) {
  throw new CategoryNotFoundError(categoryId);
}

if (!isPublic && !isAdmin) {
  throw new CategoryAccessDeniedError(categoryId);
}

// Handle differently in getCategoryData()
try {
  const category = await wikiService.getCategoryById(categoryId, userRole);
  return { category, pages, subcategories };
} catch (error) {
  if (error instanceof CategoryAccessDeniedError) {
    // Show permission error UI
  } else if (error instanceof CategoryNotFoundError) {
    // Show not found UI
  } else {
    // Show generic error UI
  }
}
```

### 9.4 Database Query Complexity

**Problem**: GROUP BY clause lists every column explicitly (PostgreSQL requirement)

```sql
SELECT
  c.*,
  COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
```

**Issues**:
1. Fragile: Adding a column to `wiki_categories` requires updating every GROUP BY
2. Error-prone: Easy to forget a column in GROUP BY
3. PostgreSQL requires ALL non-aggregated columns in GROUP BY
4. SQLite is more permissive (works on localhost without all columns)

**Proper Pattern**:
```sql
-- Use DISTINCT ON instead of GROUP BY
SELECT DISTINCT ON (c.id)
  c.*,
  COUNT(p.id) OVER (PARTITION BY c.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1

-- OR use a subquery
SELECT
  c.*,
  (SELECT COUNT(*) FROM wiki_pages p WHERE p.category_id = c.id) as page_count
FROM wiki_categories c
WHERE c.id = $1
```

---

## 10. Recommended Diagnostic Steps

### Step 1: Verify Database State (HIGHEST PRIORITY)

```bash
# SSH to production server
ssh user@192.168.1.15

# Connect to PostgreSQL
docker exec -it veritable-games-postgres-new psql -U postgres -d veritable_games

# Check if "history" category exists
SELECT id, name, is_public, created_at
FROM wiki.wiki_categories
WHERE id = 'history';

# Check page count
SELECT COUNT(*)
FROM wiki.wiki_pages
WHERE category_id = 'history' AND status = 'published';

# Check full category data with page count
SELECT
  c.*,
  COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'history'
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at;
```

**Expected Results**:
- Category should exist with `id = 'history'`
- `is_public` should be `true` OR user should be admin
- `page_count` should be 39

**If category doesn't exist**: Migration issue - category not transferred to PostgreSQL
**If is_public is false**: Permission issue - admin role not recognized
**If page_count is 0**: Page migration issue - pages not linked to category

### Step 2: Verify User Role

```sql
-- Check admin user
SELECT id, username, role, is_active
FROM users.users
WHERE username = 'admin';
```

**Expected Results**:
- `role = 'admin'`
- `is_active = true`

**If role is not 'admin'**: User role migration issue

### Step 3: Add Production Logging

Since `console.log()` is stripped, add temporary `console.error()` logging:

```typescript
// In WikiCategoryService.getCategoryById()
async getCategoryById(categoryId: string, userRole?: string): Promise<WikiCategory> {
  console.error('[PROD-DEBUG] getCategoryById START:', { categoryId, userRole });

  const result = await dbAdapter.query(...);

  console.error('[PROD-DEBUG] Query result:', {
    rowCount: result.rows.length,
    firstRow: result.rows[0],
  });

  if (result.rows.length === 0) {
    console.error('[PROD-DEBUG] No rows found - throwing error');
    throw new Error(`Category not found: "${categoryId}"`);
  }

  const row = result.rows[0];
  const isPublic = row.is_public === true || row.is_public === 1;
  const isAdmin = userRole === 'admin' || userRole === 'moderator';

  console.error('[PROD-DEBUG] Access check:', { isPublic, isAdmin, userRole });

  if (!isPublic && !isAdmin) {
    console.error('[PROD-DEBUG] Access denied - throwing error');
    throw new Error(`Category not found: "${categoryId}"`);
  }

  console.error('[PROD-DEBUG] Returning category:', row.name);
  return { ... };
}
```

Deploy this change and check production logs:
```bash
docker logs m4s0kwo4kc4oooocck4sswc4 2>&1 | grep PROD-DEBUG
```

### Step 4: Test Query Directly in Container

```bash
# Execute Node.js in production container
docker exec -it m4s0kwo4kc4oooocck4sswc4 node

# In Node.js REPL:
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT c.*, COUNT(p.id) as page_count
  FROM wiki.wiki_categories c
  LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
  WHERE c.id = $1
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
`, ['history'])
.then(res => console.log(res.rows))
.catch(err => console.error(err));
```

This bypasses the entire application stack and tests the raw query.

### Step 5: Compare SQLite vs PostgreSQL Data

```bash
# On localhost (SQLite)
cd /home/user/Projects/veritable-games-main/frontend
sqlite3 data/wiki.db

SELECT id, name, is_public FROM wiki_categories WHERE id = 'history';
SELECT COUNT(*) FROM wiki_pages WHERE category_id = 'history';

# On production (PostgreSQL)
docker exec -it veritable-games-postgres-new psql -U postgres -d veritable_games

SELECT id, name, is_public FROM wiki.wiki_categories WHERE id = 'history';
SELECT COUNT(*) FROM wiki.wiki_pages WHERE category_id = 'history';
```

Compare results to identify data discrepancies.

---

## 11. Most Likely Root Cause (Educated Guess)

Based on the analysis, **Theory 4 (PostgreSQL Schema or Data Differences)** is the most likely root cause:

**Hypothesis**: The "history" category exists in SQLite (localhost) but one of the following is true in PostgreSQL (production):

1. **Category doesn't exist**: Migration script skipped the "history" category
2. **is_public is false**: Category is marked as private, and user role is not recognized as admin
3. **is_public is NULL**: NULL handling differs between SQLite and PostgreSQL
4. **GROUP BY clause fails**: PostgreSQL returns 0 rows due to GROUP BY error (but error should be caught)

**Confidence Level**: 75%

**Why this explains the symptoms**:
- ✅ Works on localhost (SQLite has the category)
- ✅ Fails on production (PostgreSQL missing category or wrong is_public value)
- ✅ User is authenticated (not a session issue)
- ✅ No error thrown (category simply not found in query results)
- ✅ Error swallowed by try/catch (returns null instead of throwing)

**How to confirm**:
Run Step 1 diagnostic queries in production PostgreSQL database.

---

## 12. Secondary Likely Cause

**Theory 5 (User Role Mismatch)** is the secondary likely cause:

**Hypothesis**: User's `role` field in production database is not exactly `'admin'`, causing access control to fail.

**Possible values causing failure**:
- `role = 'Admin'` (capital A)
- `role = 'administrator'`
- `role = 'user'` (not admin)
- `role = NULL`

**Access control logic**:
```typescript
const isAdmin = userRole === 'admin' || userRole === 'moderator';
```

This is a **strict string equality check**. If role is `'Admin'` (capitalized), it won't match.

**How to confirm**:
Run Step 2 diagnostic query to check exact role value.

---

## 13. Conclusion

The wiki category page rendering issue is NOT an architectural problem with React Server Components, but rather a **data or configuration issue** masked by poor error handling and logging visibility.

**Key Findings**:

1. **Error Handling Anti-Pattern**: `getCategoryData()` swallows all errors, making "category not found" indistinguishable from "database error" or "permission denied"

2. **Logging Blackhole**: Production build strips `console.log()`, eliminating visibility into query execution and results

3. **Access Control Confusion**: Permission errors disguised as "not found" errors

4. **Most Likely Cause**: Database state difference - category missing, is_public value wrong, or role value incorrect in PostgreSQL

**Recommended Actions**:

1. **Immediate**: Run diagnostic queries (Step 1 and Step 2) to verify database state
2. **Short-term**: Add console.error() logging to production build (Step 3)
3. **Long-term**:
   - Replace error swallowing with proper error propagation
   - Add structured logging service
   - Use specific error classes for different failure modes
   - Add error boundary with detailed error messages

**Architecture is Sound**: The React Server Component architecture, Next.js 15 async params pattern, and database adapter layer are all correctly implemented. The issue lies in **data consistency** between environments, not code architecture.

---

## Appendix A: Full Render Flow Diagram

```
User Request: GET /wiki/category/history
              ↓
Middleware (middleware.ts)
  - Check session cookie exists ✅
  - Add security headers
  - Pass request to app
              ↓
CategoryPage Server Component (page.tsx)
  - Await params { id: "history" }
  - Call getCurrentUser()
    ↓
    Auth Service (auth/server.ts)
      - Get session cookie
      - Validate session in database
      - Return User { id, username, role: "admin" } ✅
    ↓
  - Call getCategoryData("history", "admin")
    ↓
    WikiService → WikiCategoryService
      - Query PostgreSQL:
        SELECT c.*, COUNT(p.id) as page_count
        FROM wiki_categories c
        LEFT JOIN wiki_pages p ON c.id = p.category_id
        WHERE c.id = 'history'
        GROUP BY [all columns]
      ↓
      DatabaseAdapter
        - Convert SQL to PostgreSQL syntax
        - Execute query via pg Pool
        - Return QueryResult { rows: [...], rowCount: N }
      ↓
      WikiCategoryService
        - Check result.rows.length === 0
          → CASE 1: Throw "Category not found" ❌
        - Check row.is_public and userRole
          → CASE 2: Throw "Category not found" if access denied ❌
        - Return WikiCategory object ✅
    ↓
  getCategoryData try/catch
    - CATCH: Return { category: null, pages: [], subcategories: [] }
  ↓
CategoryPage
  - if (!category) → Render "Category Not Found" UI ❌
  - else → Render WikiCategoryPageClient ✅
              ↓
Client Component Hydration
  - Receive initialPages from server
  - Initialize search state
  - Render search interface
```

**Production Flow Stops at**:
- EITHER: PostgreSQL returns 0 rows (category doesn't exist)
- OR: Access control throws error (permission denied)

**Both cases look identical to user**: "Category Not Found"

---

## Appendix B: Environment Comparison Matrix

| Aspect | Development (localhost:3000) | Production (192.168.1.15:3000) |
|--------|------------------------------|--------------------------------|
| NODE_ENV | development | production |
| Database | SQLite (file-based) | PostgreSQL (network) |
| Database Location | frontend/data/wiki.db | veritable-games-postgres-new:5432 |
| Console Logging | All preserved | console.log() STRIPPED |
| Build Type | Development server (Turbopack) | Production build (standalone) |
| Cookie Security | secure: false | secure: true (unless overridden) |
| Session Cookie | session_id | session_id or __Secure-session_id |
| Error Boundaries | Development UI | Production UI |
| Source Maps | Full | None (productionBrowserSourceMaps: false) |
| Code Minification | None | Full |
| React Strict Mode | Double render | Single render |

---

**Document Version**: 1.0
**Analysis Completed**: November 16, 2025
**Next Steps**: Execute diagnostic queries (Section 10, Steps 1-2)
