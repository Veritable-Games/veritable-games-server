# Orphaned Wiki Pages Analysis

**Date**: 2025-10-13
**Issue**: 52 wiki pages cannot be deleted by anyone, including administrators
**Status**: 🔴 **BUG IDENTIFIED**

## Problem Summary

Wiki pages with `created_by: NULL` cannot be deleted through the UI because the delete button is hidden by overly restrictive permission logic that requires an exact user ID match.

## Root Cause

### Location
`/src/app/wiki/[slug]/page.tsx` - Lines 340-351

### Problematic Code
```typescript
{user &&
  page &&
  canDeleteWiki() &&
  user.id === page.created_by && (  // ← THIS IS THE PROBLEM
    <button
      onClick={() => setShowDeleteModal(true)}
      title="Delete this page (only available to page creator)"
    >
      Delete Page
    </button>
  )}
```

### The Bug
The condition `user.id === page.created_by` fails when `created_by` is `null`:
- `user.id` = 1 (number)
- `page.created_by` = null
- `1 === null` → **false** ❌

Even administrators with `canDeleteWiki()` permission cannot delete these pages.

## Affected Pages

### Statistics
- **Total orphaned pages**: 52
- **Total wiki pages**: 188
- **Percentage affected**: 27.7%

### Sample of Orphaned Pages

| Slug | ID | Title | Created | Category |
|------|----|----|---------|----------|
| simple-infobox-test | 359 | Simple Infobox Test | 2025-09-22 | uncategorized |
| noxii-control-scheme | 262 | Control Scheme | 2025-08-24 | (game content) |
| noxii-status-effects | 261 | Status Effects | 2025-08-24 | (game content) |
| tag-management-tutorial | 224 | Tag Management Tutorial | 2025-08-15 | development |
| anarchists-external-network | 212 | Anarchists (External Network) | 2025-08-15 | (game content) |
| guards-authority-figures | 213 | Guards/Authority Figures | 2025-08-15 | (game content) |
| modular-components-system | 215 | Modular Components System | 2025-08-15 | (game content) |
| vertical-cities-management-system | 216 | Vertical Cities Management System | 2025-08-15 | (game content) |
| acp-junta-territories | 217 | ACP Contested Territories | 2025-08-15 | (game content) |
| proximity-mines | 218 | Proximity Mines | 2025-08-15 | (game content) |

### Full List Export

Run this command to export all orphaned pages:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/wiki.db', { readonly: true });
const pages = db.prepare('SELECT slug, id, title FROM wiki_pages WHERE created_by IS NULL ORDER BY slug').all();
pages.forEach(p => console.log(p.slug));
db.close();
"
```

## Permission System Analysis

### Current Permission Logic

The `canDeleteWiki()` function in `AuthContext.tsx`:
```typescript
const canDeleteWiki = useCallback((): boolean => {
  return hasPermission('wiki:delete') || user?.role === 'admin' || false;
}, [hasPermission, user]);
```

**Returns `true` if**:
1. User has explicit `wiki:delete` permission, OR
2. User role is `admin`

**Problem**: Despite having the permission, admins are blocked by the UI logic that requires `user.id === page.created_by`.

## Why Pages Have NULL created_by

Likely causes:
1. **Bulk Import**: Pages created via data import scripts without user attribution
2. **Migration**: Pages migrated from old systems (e.g., main.db migration)
3. **API Creation**: Pages created via API without proper `authorId` parameter
4. **Legacy Data**: Pages created before user tracking was implemented

**Evidence**: Many pages created on the same date (2025-08-15) suggest bulk import.

## Proposed Solution

### Option 1: Admin Override (RECOMMENDED)

Allow admins to delete ANY page, while regular users can only delete their own:

```typescript
{user &&
  page &&
  canDeleteWiki() &&
  (user.role === 'admin' || user.id === page.created_by) && (
    <button
      onClick={() => setShowDeleteModal(true)}
      title={
        user.role === 'admin'
          ? 'Delete this page (admin privilege)'
          : 'Delete this page (only available to page creator)'
      }
    >
      Delete Page
    </button>
  )}
```

**Pros**:
- Simple one-line fix
- Maintains security for regular users
- Empowers admins to clean up orphaned content
- Follows principle of least privilege

**Cons**:
- None significant

### Option 2: Treat Orphaned Pages as Deletable by Anyone with Permission

```typescript
{user &&
  page &&
  canDeleteWiki() &&
  (page.created_by === null || user.id === page.created_by) && (
    <button>Delete Page</button>
  )}
```

**Pros**:
- Any user with `wiki:delete` permission can clean up orphaned pages

**Cons**:
- Less secure - allows moderators to delete pages they didn't create
- Could be misused

### Option 3: Add "Claim Ownership" Feature

Allow admins to claim orphaned pages before deleting:

```typescript
// Add claim ownership button for admins on orphaned pages
{user &&
  page &&
  user.role === 'admin' &&
  page.created_by === null && (
    <button onClick={handleClaimPage}>
      Claim Ownership
    </button>
  )}
```

**Pros**:
- Provides audit trail
- Assigns accountability before deletion

**Cons**:
- More complex implementation
- Extra step required

## Recommended Fix: Option 1 (Admin Override)

### Changes Required

**File**: `/src/app/wiki/[slug]/page.tsx`

**Before**:
```typescript
user.id === page.created_by
```

**After**:
```typescript
(user.role === 'admin' || user.id === page.created_by)
```

**Full Context**:
```typescript
{user &&
  page &&
  canDeleteWiki() &&
  (user.role === 'admin' || user.id === page.created_by) && (
    <button
      onClick={() => setShowDeleteModal(true)}
      className="hover:text-red-400 transition-colors text-sm text-gray-300"
      title={
        user.role === 'admin'
          ? 'Delete this page (admin privilege)'
          : 'Delete this page (page creator only)'
      }
    >
      Delete Page
    </button>
  )}
```

## Testing Plan

### Test Cases

1. **Admin deletes orphaned page**
   - Login as admin
   - Navigate to `/wiki/simple-infobox-test`
   - Verify Delete button is visible
   - Click Delete and confirm
   - Verify page is deleted

2. **Admin deletes page with creator**
   - Login as admin
   - Navigate to page created by another user
   - Verify Delete button is visible
   - Delete should succeed

3. **Regular user tries to delete orphaned page**
   - Login as regular user (non-admin)
   - Navigate to `/wiki/simple-infobox-test`
   - Verify Delete button is NOT visible (unless they have `wiki:delete` permission)

4. **Regular user deletes own page**
   - Login as regular user
   - Navigate to page they created
   - Verify Delete button is visible
   - Delete should succeed

5. **Regular user tries to delete other user's page**
   - Login as regular user
   - Navigate to page created by another user
   - Verify Delete button is NOT visible

### SQL Test Query

Check if fix would allow admin to delete orphaned pages:
```sql
-- Pages that would become deletable by admins after fix
SELECT COUNT(*) as deletable_by_admin
FROM wiki_pages
WHERE created_by IS NULL;

-- Expected result: 52
```

## Migration/Cleanup Strategy

After implementing the fix:

### Option A: Leave as-is
- Keep pages with `created_by: NULL`
- Admins can delete them as needed
- No immediate action required

### Option B: Bulk Attribution
- Assign orphaned pages to a system user or admin
- Provides ownership for all pages
- Run migration script:

```sql
UPDATE wiki_pages
SET created_by = 1  -- Admin user ID
WHERE created_by IS NULL;
```

### Option C: Selective Cleanup
- Review orphaned pages manually
- Delete obsolete/test pages
- Assign important pages to appropriate owners

**Recommendation**: **Option A** - No immediate action needed. Admins can manage orphaned pages on a case-by-case basis.

## Security Considerations

### Current State
- ❌ Orphaned pages cannot be deleted by anyone (security through obscurity)
- ❌ Admins cannot clean up test/obsolete pages
- ❌ No accountability for orphaned content

### After Fix
- ✅ Admins have full control (expected behavior)
- ✅ Regular users still restricted to own content
- ✅ Follows principle of admin supremacy
- ✅ No new security vulnerabilities introduced

### Audit Trail
The existing audit system should log admin deletions:
- Who deleted the page (admin user ID)
- When it was deleted
- Page metadata preserved in logs

## Related Issues

### Potential Similar Issues

Check these features for similar patterns:
1. **Wiki page editing**: Does it allow admins to edit ANY page?
2. **Wiki page protection**: Can orphaned pages be protected?
3. **Other content types**: Do projects, news, library documents have similar issues?

### Future Prevention

Recommendations:
1. **Validate `created_by` in API**: Never allow NULL for new pages
2. **Migration scripts**: Always set `created_by` during imports
3. **Bulk operations**: Require system user ID for automated page creation
4. **Schema constraint**: Consider making `created_by` NOT NULL (after cleanup)

## Implementation Priority

**Priority**: 🟡 **Medium**

**Rationale**:
- Not blocking critical functionality
- 52 affected pages can be managed via database if urgent
- Simple fix with low risk
- Should be included in next maintenance release

**Estimated Effort**: 30 minutes (code change + testing)

---

**Next Steps**:
1. Implement Option 1 (Admin Override) fix
2. Test with the 5 test cases listed above
3. Consider bulk attribution for orphaned pages (optional)
4. Add regression test for orphaned page deletion
5. Update documentation about admin privileges

**Script to test permissions**:
```bash
# List all orphaned pages
npm run wiki:list-orphaned

# Assign all orphaned pages to admin user
npm run wiki:claim-orphaned --user-id=1

# Delete specific orphaned page
npm run wiki:delete --slug=simple-infobox-test --force
```

(Note: These scripts don't exist yet - proposals for future implementation)
