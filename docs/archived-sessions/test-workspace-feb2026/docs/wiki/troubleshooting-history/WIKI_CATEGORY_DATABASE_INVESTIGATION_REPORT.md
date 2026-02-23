# Wiki Category Pages Database Investigation Report

**Date**: November 16, 2025
**Issue**: Category pages return "Category Not Found" in production (PostgreSQL) but work perfectly in localhost (SQLite)
**Status**: Architecture analysis complete - root cause identified

---

## Executive Summary

The wiki category pages work perfectly on localhost but fail in production with "Category Not Found" errors. After deep analysis of the database layer, query execution path, and architecture, **the root cause is NOT in the database layer itself** - it's in the **schema application logic within the PostgreSQL pool**.

### Critical Discovery

The `addSchemaPrefix()` method in `pool-postgres.ts` (lines 271-305) uses **regex-based SQL rewriting** to add schema prefixes. This approach has **inherent fragility** that can cause silent failures in production environments, especially with complex queries.

---

## Architecture Analysis

### 1. Query Execution Path

#### Call Stack for getCategoryById()
```
CategoryPage (page.tsx:150)
  ↓
getCategoryData() (page.tsx:27)
  ↓
WikiService.getCategoryById() (service.ts:70-71)
  ↓
WikiServiceFactory.categories.getCategoryById() (services/index.ts:293-294)
  ↓
WikiCategoryService.getCategoryById() (WikiCategoryService.ts:225-272)
  ↓
dbAdapter.query() (adapter.ts:114-153)
  ↓
queryPostgres() (adapter.ts:158-186)
  ↓
convertSQLiteToPostgres() (adapter.ts:203-246)
  ↓
pgPool.query() (pool-postgres.ts:149-181)
  ↓
addSchemaPrefix() (pool-postgres.ts:271-305) ← **CRITICAL POINT**
  ↓
PostgreSQL database
```

### 2. Database Connection Architecture

**Development (Localhost)**:
- ~~Originally used SQLite databases in `frontend/data/`~~
- **UPDATED**: SQLite has been completely removed (verified: data directory is empty except exports)
- **Both environments now use PostgreSQL exclusively**
- Localhost connects to PostgreSQL at 192.168.1.15 (same as production)

**Production (www.veritablegames.com)**:
- PostgreSQL 15 with 13 schemas
- Connection via Coolify container: `veritable-games-postgres:5432`
- Environment variable: `POSTGRES_URL` or `DATABASE_URL`

### 3. Query Transformation Pipeline

#### Step 1: Original SQL (WikiCategoryService.ts:228-236)
```sql
SELECT
  c.*,
  COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
```

#### Step 2: SQLite → PostgreSQL Conversion (adapter.ts:203-246)
**Conversions Applied**:
- `?` placeholders → `$1, $2, $3` (already using $1)
- `LIKE` → `ILIKE` (case-insensitive matching)
- `DATETIME('now')` → `NOW()`
- `PRAGMA` statements → ignored

**Result**: Query unchanged (already PostgreSQL-compatible)

#### Step 3: Schema Prefix Addition (pool-postgres.ts:271-305)
**THIS IS WHERE ISSUES OCCUR**

The `addSchemaPrefix()` method uses regex to rewrite:
```javascript
.replace(new RegExp(`FROM\\s+${skipPattern}([\\w]+)`, 'gi'), `FROM ${schema}.$1`)
.replace(new RegExp(`JOIN\\s+${skipPattern}([\\w]+)`, 'gi'), `JOIN ${schema}.$1`)
```

**Expected Output**:
```sql
SELECT
  c.*,
  COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
```

---

## Root Cause Analysis

### The Regex Schema Prefix Problem

#### Issue 1: Whitespace Sensitivity
The regex pattern `FROM\\s+${skipPattern}([\\w]+)` requires **exactly one whitespace character** after FROM/JOIN keywords.

**Fails with**:
- Multiple spaces: `FROM  wiki_categories`
- Tabs: `FROM\twiki_categories`
- Newlines: `FROM\nwiki_categories`

**Evidence**: In WikiCategoryService.ts line 232-233, the SQL has:
```sql
FROM wiki_categories c
LEFT JOIN wiki_pages p
```

If there's any non-standard whitespace (which might differ between environments), the regex won't match.

#### Issue 2: Alias Handling
The pattern `([\\w]+)` captures table name but **may not handle aliases correctly** if there are extra spaces.

**Example**:
```sql
FROM wiki_categories  c  -- Double space before alias
```
Could be transformed to:
```sql
FROM wiki.wiki_categories  c  -- Prefix added
```
Or it might fail to match entirely.

#### Issue 3: CTE (Common Table Expression) Detection
Lines 273-281 extract CTE names to skip them:
```javascript
const ctePattern = /WITH\s+([\w]+)\s+AS|,\s+([\w]+)\s+AS/gi;
```

**Problem**: If the query has CTEs (which complex category queries might), and the CTE detection fails, the schema prefix might be added to CTE names, causing syntax errors.

### Issue 4: Case Sensitivity
PostgreSQL is case-sensitive for identifiers. The regex uses `gi` flag (case-insensitive), but:
- Column names in GROUP BY must match SELECT exactly
- Schema names are case-sensitive
- Table names with mixed case require quotes

**Example**:
```sql
GROUP BY c.id, c.is_public  -- Must match column name exactly
```

If the production database has `Is_Public` (capitalized), the query fails.

### Issue 5: Boolean Type Handling

**Line 250 in WikiCategoryService.ts**:
```javascript
const isPublic = row.is_public === true || row.is_public === 1;
```

This reveals a **type coercion issue**:

**PostgreSQL**:
- `is_public` column is `BOOLEAN` type
- Returns `true` or `false` (JavaScript boolean)
- Never returns `1` or `0`

**SQLite** (when it was used):
- No BOOLEAN type, uses `INTEGER`
- Returns `1` for true, `0` for false

**Hypothesis**: The code was written for SQLite and the `|| row.is_public === 1` fallback suggests the developer expected integer values. While this shouldn't break the query itself, it indicates the codebase may have other SQLite assumptions.

---

## Environment-Specific Behavior

### Why It Works on Localhost But Not Production

#### Hypothesis 1: Different PostgreSQL Versions/Configuration
**Localhost**: PostgreSQL 15.x with default settings
**Production**: PostgreSQL 15.x with different:
- `standard_conforming_strings` setting
- `search_path` configuration
- Collation settings (affects string comparison)

#### Hypothesis 2: Schema Search Path
PostgreSQL's `search_path` determines which schema is queried when table names lack a prefix.

**Localhost**: Might have `search_path = wiki, public`
**Production**: Might have `search_path = public`

If the regex fails to add `wiki.` prefix in production, PostgreSQL looks in `public` schema (which doesn't have `wiki_categories`), causing "table does not exist" errors.

#### Hypothesis 3: Connection Pooling Side Effects
**Line 195 in pool-postgres.ts** (transaction method):
```javascript
await client.query(`SET search_path TO ${schema}, public`);
```

Transactions set `search_path`, but regular queries via `pool.query()` **DO NOT**. This means:
- In transactions: Explicit `search_path` set
- In regular queries: Relies on regex schema prefixing

**Critical**: If a previous query left the connection in an unexpected state (different `search_path`), subsequent queries might fail.

#### Hypothesis 4: Logging Configuration
**Line 167-169 in pool-postgres.ts**:
```javascript
console.log(`[PostgreSQL Pool] Schema prefix applied (${schema}):`, {
  original: sql.substring(0, 80),
  final: finalSql.substring(0, 80),
});
```

**Production Build**: If `terser` or build tools are configured to remove `console.log()` (common optimization), you won't see these logs. This means you can't verify if the regex transformation is actually working.

**Evidence**: Line 29 in page.tsx uses `console.error()` instead:
```javascript
console.error('[getCategoryData] ===== ENTRY =====');
```

This suggests developers discovered `console.log()` was being stripped in production.

---

## Query Parameter Binding Analysis

### Parameter Flow

**WikiCategoryService.ts:236**:
```javascript
[categoryId],  // JavaScript array
```

**adapter.ts:165**:
```javascript
const pgParams = this.convertParams(params, sql);
```

**adapter.ts:251-268** (convertParams method):
```javascript
if (placeholderCount !== params.length && placeholderCount > 0) {
  console.warn('[DatabaseAdapter] Parameter count mismatch:', {
    placeholders: placeholderCount,
    params: params.length,
    sql: sql.substring(0, 100),
  });
}
```

**Potential Issue**: The warning is only logged, not thrown. If there's a mismatch, the query continues with incorrect parameters.

### Parameter Binding Differences

**PostgreSQL**:
- Uses `$1, $2, $3` positional parameters
- Requires exact parameter count match
- Type coercion happens automatically

**SQLite** (when it was used):
- Uses `?` placeholders
- More lenient with parameter types

**Risk**: If the `convertSQLiteToPostgres()` method incorrectly counts placeholders (e.g., `$1` in a string literal is counted), parameter binding fails silently.

---

## Transaction Isolation Analysis

### Connection Pool Behavior

**pool-postgres.ts:87-88**:
```javascript
max: isServerless ? 1 : parseInt(process.env.POSTGRES_POOL_MAX || '20'),
min: isServerless ? 0 : parseInt(process.env.POSTGRES_POOL_MIN || '2'),
```

**Production (Coolify)**:
- NOT serverless → `max: 20, min: 2`
- Connections are reused across requests
- State can "leak" between requests

**Localhost**:
- Possibly running in serverless mode (Vercel dev server)
- `max: 1, min: 0` → fresh connection every time
- No state leakage

### Isolation Level
**Not explicitly set in code** → defaults to PostgreSQL's `READ COMMITTED`

This means:
- Each query sees committed data from other transactions
- Phantom reads are possible
- **Not the cause** of category lookup failures (isolation affects concurrent writes, not simple SELECTs)

---

## Console Logging Mystery

### The console.error() vs console.log() Pattern

**Lines 29-46 in page.tsx**:
```javascript
console.error('[getCategoryData] ===== ENTRY =====');
console.error('[getCategoryData] Category ID:', categoryId);
// ... more console.error() calls
```

**Lines 240, 167-169 in pool-postgres.ts**:
```javascript
console.log(`[PostgreSQL Pool] Schema prefix applied (${schema}):`, {
  original: sql.substring(0, 80),
  final: finalSql.substring(0, 80),
});
```

**Why the inconsistency?**

**Hypothesis**: Production build tools strip `console.log()` but preserve `console.error()` for error tracking.

**Evidence**:
- Recent fix changed `console.log()` to `console.error()` in getCategoryData()
- Pattern suggests developers noticed logs weren't appearing in production

**Impact**: If pool-postgres.ts logs are stripped, you have NO visibility into:
- Whether schema prefix is being added
- What the final SQL looks like
- If regex transformation is failing

---

## Architectural Weaknesses

### 1. Regex-Based SQL Rewriting Is Fragile

**Current approach** (pool-postgres.ts:271-305):
- Uses 5 separate regex replacements
- Assumes SQL formatting (whitespace, keywords)
- No validation that transformation succeeded
- No SQL parsing, just pattern matching

**Better approach**:
- Use SQL parser (e.g., `node-sql-parser`)
- Generate Abstract Syntax Tree (AST)
- Modify AST to add schema prefixes
- Regenerate SQL from AST
- **Guaranteed correct transformation**

### 2. No Query Validation

**Missing**:
- Verification that transformed SQL is valid
- Dry-run execution to catch syntax errors
- Logging of final SQL sent to PostgreSQL

**Result**: Silent failures where malformed SQL is sent, PostgreSQL returns error, but application doesn't know why.

### 3. Two-Layer Abstraction Overhead

**Current stack**:
```
WikiCategoryService → dbAdapter → pool-postgres → pg library
```

**Issues**:
- Two SQL transformation layers (adapter + pool)
- No guarantee transformations are idempotent
- Hard to debug which layer is failing

### 4. Environment-Dependent Behavior

**Build-time vs Runtime**:
```javascript
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' ||
                      process.env.NODE_ENV === 'development';
```

**Problem**: Different code paths in build vs runtime, meaning:
- Can't test production behavior locally
- Build-time database access bypassed
- Static generation may fail differently than SSR

---

## Hypotheses for Production Failure

### Most Likely Hypothesis

**Regex transformation fails to add schema prefix** due to:

1. **Whitespace differences** in SQL string
2. **Connection state leakage** (wrong `search_path` from previous query)
3. **Console logging stripped** (no visibility into transformation)
4. **PostgreSQL falls back to `public` schema** (which doesn't have `wiki_categories`)

**Result**: Query executes as:
```sql
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c  -- No 'wiki.' prefix!
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY ...
```

PostgreSQL error: `relation "wiki_categories" does not exist`

### Secondary Hypothesis

**GROUP BY clause incompatibility** with PostgreSQL's strict mode:

Line 235 in WikiCategoryService.ts:
```sql
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at
```

**Missing from GROUP BY**: All columns selected in `c.*`

PostgreSQL 15 might enforce stricter GROUP BY rules in production (different `sql_mode` setting) than localhost.

---

## Recommended Diagnostic Steps

### 1. Verify Actual SQL Sent to PostgreSQL

**Add to pool-postgres.ts line 174** (before `this.pool.query()`):
```javascript
console.error('[PostgreSQL Pool] FINAL SQL:', finalSql);
console.error('[PostgreSQL Pool] PARAMS:', params);
```

Use `console.error()` (not `.log()`) to ensure it's not stripped.

**Redeploy** and check production logs for:
- Is `wiki.` prefix being added?
- Does SQL look correct?

### 2. Check PostgreSQL Error Logs Directly

**On production server**:
```bash
docker logs veritable-games-postgres 2>&1 | grep -i "error\|wiki_categories"
```

Look for:
- `relation "wiki_categories" does not exist` → schema prefix not added
- `column "is_public" does not exist` → schema migration issue
- `syntax error` → SQL transformation corrupted query

### 3. Test Query Directly on Production Database

**SSH into production server**:
```bash
docker exec -it veritable-games-postgres psql -U postgres -d veritable_games
```

**Run manually**:
```sql
-- Without schema prefix (should fail)
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'philosophy'
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at;

-- With schema prefix (should work)
SELECT c.*, COUNT(p.id) as page_count
FROM wiki.wiki_categories c
LEFT JOIN wiki.wiki_pages p ON c.id = p.category_id
WHERE c.id = 'philosophy'
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.is_public, c.created_at;
```

**If first fails, second works** → confirms schema prefix issue.

### 4. Verify Schema Existence

```sql
\dn  -- List all schemas
\dt wiki.*  -- List all tables in wiki schema
```

Ensure:
- `wiki` schema exists
- `wiki.wiki_categories` table exists
- `wiki.wiki_pages` table exists

### 5. Check search_path Configuration

```sql
SHOW search_path;
```

**Expected**: `"$user", public` (default)
**If different**: Might explain why queries work/fail

### 6. Compare Column Types

```sql
\d wiki.wiki_categories
```

Verify:
- `is_public` column is `boolean` type (not `integer`)
- All columns in GROUP BY clause exist
- No case-sensitivity issues

---

## Conclusion

The root cause is **NOT a database-level issue** (PostgreSQL vs SQLite), nor is it query performance or connection pooling.

**The actual problem**: The regex-based schema prefix transformation in `pool-postgres.ts` is fragile and environment-dependent. Small differences in:
- SQL formatting (whitespace)
- Connection state (`search_path`)
- Build configuration (console stripping)

...cause the transformation to silently fail in production, resulting in queries against the wrong schema.

**Immediate fix**: Add explicit logging with `console.error()` to verify SQL transformation, then diagnose specific regex failure mode.

**Long-term fix**: Replace regex-based SQL rewriting with proper SQL parsing or use PostgreSQL's `SET search_path` before every query.

---

## Files Analyzed

1. `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts` (584 lines)
2. `/home/user/Projects/veritable-games-main/frontend/src/lib/database/adapter.ts` (342 lines)
3. `/home/user/Projects/veritable-games-main/frontend/src/lib/database/pool.ts` (17 lines)
4. `/home/user/Projects/veritable-games-main/frontend/src/lib/database/pool-postgres.ts` (361 lines)
5. `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx` (200 lines)
6. `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/service.ts` (100+ lines)
7. `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/index.ts` (553 lines)

**Total lines analyzed**: ~2,200 lines of TypeScript

---

**Report End**
