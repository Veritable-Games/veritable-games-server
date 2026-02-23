# TypeScript Improvements Guide

## Current Status (Post-Initial Cleanup)

**TypeScript Errors**: ~487 remaining (down from 600+)
**Build Status**: ✅ Production builds successful (warnings, not blocking errors)
**Critical Issues**: ✅ Resolved - database type safety and namespace issues fixed

## Major Improvements Completed

### 1. Database Types Infrastructure

- **Created** `src/lib/types/database.ts` with comprehensive row interfaces
- **Fixed** critical property access errors (`Property 'id' does not exist on type '{}'`)
- **Resolved** Database namespace conflicts (`Cannot use namespace 'Database' as a type`)

### 2. Critical Fixes Applied

- **Library Tags Route** - Fixed property access on query results
- **Library Documents Route** - Added proper error typing and query result types
- **Moderation Bulk Route** - Resolved Database type conflicts
- **Error Handling** - Added proper `DatabaseError` typing for catch blocks

### 3. Type Safety Patterns Established

```typescript
// ✅ Proper database query typing
const user = db.prepare('SELECT * FROM users WHERE id = ?')
  .get(userId) as UserRow | undefined;

// ✅ Proper error handling
catch (e) {
  const error = e as DatabaseError;
  logger.error('Database operation failed', error.message);
}
```

## Remaining Error Categories

### High Priority (Should be fixed next)

1. **Database Query Results** (~200 errors)

   - Missing type annotations on `.get()` and `.all()` calls
   - Pattern: `as SpecificRow | undefined` or `as SpecificRow[]`

2. **Parameter Type Issues** (~100 errors)

   - Implicit `any` types on function parameters
   - Pattern: Add explicit type annotations

3. **Property Access Errors** (~80 errors)
   - Accessing properties on `unknown` or `{}` types
   - Pattern: Proper type guards or type assertions

### Medium Priority

4. **Import Resolution** (~50 errors)

   - Missing import statements
   - Incorrect path aliases

5. **Type Assignment Mismatches** (~30 errors)
   - Incompatible type assignments
   - Pattern: Adjust types or add type assertions

### Low Priority

6. **Component Prop Types** (~27 errors)
   - Missing or incorrect component property types
   - Pattern: Define proper interfaces for props

## Systematic Resolution Strategy

### Phase 1: Database Query Types (2-3 hours)

```typescript
// Before
const result = db.prepare('SELECT * FROM users').all();

// After
const result = db.prepare('SELECT * FROM users').all() as UserRow[];
```

### Phase 2: Function Parameter Types (1-2 hours)

```typescript
// Before
function processUser(id) { ... }

// After
function processUser(id: number): UserRow | undefined { ... }
```

### Phase 3: Import and Path Resolution (1 hour)

```typescript
// Add missing imports
import type { UserRow } from '@/lib/types/database';
```

## Available Database Types

The following types are available in `@/lib/types/database`:

- **Base Types**: `BaseRow`, `UnknownRow`, `DatabaseError`
- **User Types**: `UserRow`
- **Forum Types**: `ForumTopicRow`, `ForumReplyRow`, `ForumCategoryRow`
- **Wiki Types**: `WikiPageRow`, `WikiRevisionRow`, `WikiCategoryRow`
- **Library Types**: `LibraryDocumentRow`, `LibraryTagRow`, `LibraryTagUsageRow`
- **System Types**: `SystemLogRow`, `SystemBackupRow`, `ActivityLogRow`, `MetricRow`
- **Utility Types**: `CountResult`, `ExistsResult`, `QueryResult<T>`, `QueryResults<T>`

## Quick Fix Commands

### Fix Database Query Results

```bash
# Find files needing database type fixes
grep -r "\.get(" src/app/api --include="*.ts" | grep -v "as "

# Find files needing array result fixes
grep -r "\.all(" src/app/api --include="*.ts" | grep -v "as "
```

### Fix Implicit Any Parameters

```bash
# Find implicit any parameters
npm run type-check 2>&1 | grep "implicitly has an 'any' type"
```

### Fix Property Access Errors

```bash
# Find property access errors
npm run type-check 2>&1 | grep "Property.*does not exist on type"
```

## Future Enhancements

1. **Consider drizzle-orm** for full type safety at the database level
2. **Generate types from schema** using tools like `sqlite-to-ts`
3. **Implement runtime validation** with zod schemas
4. **Add database query builders** for complex queries

## Implementation Timeline

- **Week 1**: Fix database query result types (80% error reduction)
- **Week 2**: Fix parameter types and property access
- **Week 3**: Resolve imports and component types
- **Week 4**: Cleanup and optimization

## Success Metrics

- **Target**: Reduce from ~487 to <50 TypeScript errors
- **Build**: Maintain successful production builds
- **Performance**: No runtime impact from type additions
- **Developer Experience**: Better IDE support and error catching
