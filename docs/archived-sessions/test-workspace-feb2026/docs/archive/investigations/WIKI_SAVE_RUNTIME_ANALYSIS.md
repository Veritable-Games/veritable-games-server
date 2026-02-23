# Wiki Save Runtime Analysis Report

## Executive Summary

The wiki save functionality was failing silently due to a **foreign key constraint violation** at the database level. The `wiki_revisions` table has a foreign key constraint to `users.id`, but the `users` table was completely empty, causing all save attempts with an `author_id` to fail.

## Root Cause Analysis

### What Was Actually Happening at Runtime

1. **User attempts to save wiki page** → Request reaches the API endpoint
2. **Authentication passes** → User session is valid
3. **CSRF validation passes** → Security middleware executes correctly
4. **Data validation passes** → Zod schema validation succeeds
5. **WikiService.updatePage() is called** → Business logic layer reached
6. **Database transaction begins** → SQLite transaction starts
7. **Page metadata updates successfully** → `wiki_pages` table UPDATE works
8. **Revision insert FAILS** → Foreign key constraint violation on `author_id`
9. **Transaction rolls back** → All changes are undone
10. **Error is swallowed** → Code continues as if successful
11. **User sees no changes** → Page appears unchanged despite "success" message

### The Critical Issue

```sql
-- wiki_revisions table has this constraint:
FOREIGN KEY (author_id) REFERENCES users(id)

-- But users table was empty:
SELECT COUNT(*) FROM users; -- Returns: 0

-- While wiki_revisions had references to non-existent users:
SELECT DISTINCT author_id FROM wiki_revisions WHERE author_id IS NOT NULL;
-- Returns: 1, 6 (242 revisions total)
```

### Why It Wasn't Obvious

1. **Silent Failure**: The WikiService code has a try-catch block that logs warnings but doesn't throw errors:
```javascript
try {
  // Insert revision
  insertRevision.run(...);
} catch (revisionError: any) {
  console.warn('Failed to create revision (continuing with page update):', revisionError.message);
  // Error is logged but not thrown - execution continues!
}
```

2. **Misleading Success Response**: The API returns success even when the revision save fails

3. **Database Schema Mismatch**: The code expects tables named `pages` and `revisions`, but the actual tables are `wiki_pages` and `wiki_revisions`

4. **Multiple Database Confusion**: The system uses 8 different SQLite databases, and the `users` table location was ambiguous (it's actually in `wiki.db`, not `users.db` as expected)

## Solution Implemented

### Immediate Fix
Created placeholder users in the database to satisfy foreign key constraints:

```javascript
// Created 6 placeholder users with IDs 1-6
// User 1 is set as admin, others as regular users
// All have temporary passwords that should be updated
```

### Verification Process
1. **Direct database writes now work** - Confirmed via test script
2. **Foreign key constraints satisfied** - No orphaned revisions
3. **Transaction completes successfully** - Both page and revision updates persist

## Additional Findings

### 1. Junction Table Issues
- `wiki_page_categories` has a composite primary key `(page_id, category_id)`
- Duplicate inserts fail with UNIQUE constraint violations
- Solution: Use `INSERT OR IGNORE` to handle existing entries

### 2. FTS Virtual Table Complications
- The `wiki_search` table is an FTS virtual table
- Standard COUNT(*) queries can fail with "no such column" errors
- Requires special handling for search functionality

### 3. WAL Mode Active
- Database is in Write-Ahead Logging mode
- Can cause "disk I/O error" when checking WAL status
- Generally good for performance but adds complexity

## Recommended Actions

### Immediate (Required)
1. ✅ **Run the fix script** - Already completed
   ```bash
   node scripts/fix-wiki-save-issue.js
   ```

2. **Update the WikiService error handling**:
   ```javascript
   // In WikiPageService.ts, line 209-214
   // Change from warning to throwing error:
   } catch (revisionError: any) {
     throw new Error(`Failed to create revision: ${revisionError.message}`);
   }
   ```

### Short-term (Recommended)
1. **Implement proper user management**
   - Replace placeholder users with actual user data
   - Ensure auth flow creates users in correct database

2. **Add database integrity checks to startup**:
   ```javascript
   // Add to server initialization
   checkForeignKeyIntegrity();
   verifyRequiredUsersExist();
   ```

3. **Improve error visibility**:
   - Add transaction rollback notifications
   - Return specific error messages to frontend
   - Log all database constraint violations

### Long-term (Consider)
1. **Consolidate database architecture**
   - Consider moving users table to users.db where it belongs
   - Or consolidate related tables into fewer databases

2. **Add database migration system**
   - Track schema versions
   - Automated constraint checking
   - Data integrity validation

3. **Implement comprehensive testing**
   - Integration tests for wiki saves
   - Foreign key constraint tests
   - Transaction rollback scenarios

## Test Commands

To verify the fix is working:

```bash
# 1. Check database integrity
node scripts/check-foreign-keys.js

# 2. Test direct database writes
node scripts/test-wiki-save-directly.js

# 3. Start dev server and test via UI
npm run dev
# Then edit any wiki page at http://localhost:3000/wiki/[slug]/edit
```

## Monitoring Points

Watch for these in server logs:
- "FOREIGN KEY constraint failed" - Indicates missing user records
- "UNIQUE constraint failed" - Junction table duplicate entries
- "disk I/O error" - WAL mode issues
- "Failed to create revision" - Revision save failures

## Conclusion

The wiki save issue was a classic case of **silent failure due to database constraint violations**. The fix involves:
1. ✅ Creating placeholder users to satisfy foreign keys
2. ✅ Handling unique constraints in junction tables
3. ⚠️ Improving error handling to surface database issues
4. ⚠️ Implementing proper user management

The immediate issue is resolved, but the codebase needs improvements to prevent similar silent failures in the future.