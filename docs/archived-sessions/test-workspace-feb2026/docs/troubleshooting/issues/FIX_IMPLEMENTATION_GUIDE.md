# Fix Implementation Guide: Category Route

## Executive Summary

The wiki category route (`/wiki/category/[id]`) fails due to two issues:

1. **Data Issue** (BLOCKING): Categories don't exist in the `wiki_categories` table
2. **Architecture Issue** (Code Quality): Service uses anti-pattern with `new WikiService()` instead of singleton import

This guide provides the exact changes needed to fix both issues WITHOUT implementing them.

---

## Issue 1: Missing Category Data

### Problem
The query:
```typescript
await wikiService.getCategoryById('autumn')
```

Executes this SQL:
```sql
SELECT c.*
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = 'autumn'
GROUP BY ...
```

**Result**: 0 rows → Throws `Category not found: "autumn"`

### Root Cause
The `wiki_categories` table has no rows for:
- 'autumn'
- 'cosmic-knights'
- 'dodec'
- 'noxii'
- 'on-command'
- 'systems'
- 'tutorials'

### Evidence
Compare these two scenarios:

**Scenario A: Individual page lookup (works)**
```
Request: GET /wiki/grand-voss-megastructures
Query: SELECT ... FROM wiki_pages WHERE slug = 'grand-voss-megastructures'
Result: ✓ Page exists in database → Renders successfully
```

**Scenario B: Category lookup (fails)**
```
Request: GET /wiki/category/autumn
Query: SELECT ... FROM wiki_categories WHERE id = 'autumn'
Result: ❌ Category doesn't exist → Error thrown
```

### Fix: Create Categories

**Where**: Execute against production PostgreSQL database

**What**: Insert category rows
```sql
INSERT INTO wiki_categories (id, name, parent_id, description, color, icon, sort_order, created_at)
VALUES
  ('autumn', 'Autumn', NULL, 'Autumn Season Content', '#D2691E', NULL, 1, NOW()),
  ('cosmic-knights', 'Cosmic Knights', NULL, 'Cosmic Knights Project', '#1E90FF', NULL, 2, NOW()),
  ('dodec', 'Dodec', NULL, 'Dodec Project', '#228B22', NULL, 3, NOW()),
  ('noxii', 'Noxii', NULL, 'Noxii Project', '#FF6347', NULL, 4, NOW()),
  ('on-command', 'On Command', NULL, 'On Command Content', '#4169E1', NULL, 5, NOW()),
  ('systems', 'Systems', NULL, 'System Documentation', '#8B4513', NULL, 6, NOW()),
  ('tutorials', 'Tutorials', NULL, 'Tutorial Content', '#DAA520', NULL, 7, NOW());
```

**How to verify it worked**:
```sql
SELECT id, name, color FROM wiki_categories ORDER BY sort_order;
-- Should return 7 rows (or more if other categories exist)
```

**After this fix**: `/wiki/category/autumn` should no longer show "Category Not Found"

---

## Issue 2: Service Architecture Anti-Pattern

### Problem Location
File: `/frontend/src/app/wiki/category/[id]/page.tsx`

**Lines 16-23** (Current/Broken):
```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();  // ❌ ANTI-PATTERN

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),
      wikiService.getAllPages(categoryId),
    ]);
```

### Why This Is Bad

1. **Creates new instance**: `new WikiService()` creates a new factory every time
2. **Adds indirection**: 3-4 layers instead of 1
3. **Inconsistent**: Individual page route (line 8) uses superior pattern
4. **Hard to test**: Can't mock singleton services
5. **Poor performance**: Unnecessary object instantiation

### Call Chain Comparison

**Current (Broken) Call Chain**:
```
getCategoryData()
  → new WikiService()
    → WikiService.getCategoryById()
      → new WikiServiceFactory()
        → wikiCategoryService.getCategoryById()
          → dbAdapter.query()
```
**Layers of indirection**: 3

**Should Be (Working) Call Chain**:
```
getCategoryData()
  → wikiCategoryService.getCategoryById()
    → dbAdapter.query()
```
**Layers of indirection**: 0

### Reference: How Individual Page Does It

File: `/frontend/src/app/wiki/[slug]/page.tsx`

**Line 8**:
```typescript
import { wikiPageService, wikiTagService } from '@/lib/wiki/services';
```

**Lines 47-56**:
```typescript
async function getWikiPageData(slug: string) {
  try {
    const { slug: actualSlug, namespace } = parseWikiSlug(slug);

    // Direct call to service (0 indirection)
    const page = await wikiPageService.getPageBySlug(actualSlug, namespace);
```

**This is the correct pattern.**

### Fix: Refactor Service Access

**Step 1: Update the import** (replace lines 1-8 at top of file)

**From**:
```typescript
import { WikiService } from '@/lib/wiki/service';
import { WikiCategoryPageClient } from '@/components/wiki/WikiCategoryPageClient';
import { JournalsPageClient } from '../journals/JournalsPageClient';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import Link from 'next/link';
import { UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';
```

**To**:
```typescript
import { wikiPageService, wikiCategoryService } from '@/lib/wiki/services';  // ← Direct import of services
import { WikiCategoryPageClient } from '@/components/wiki/WikiCategoryPageClient';
import { JournalsPageClient } from '../journals/JournalsPageClient';
import { getCurrentUser } from '@/lib/auth/server';
import { dbAdapter } from '@/lib/database/adapter';
import Link from 'next/link';
import { UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';
```

**Changes**:
- Remove: `import { WikiService } from '@/lib/wiki/service';`
- Add: `import { wikiPageService, wikiCategoryService } from '@/lib/wiki/services';`

---

**Step 2: Update getCategoryData function** (replace lines 16-40)

**From**:
```typescript
async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();

  try {
    const [category, pages] = await Promise.all([
      wikiService.getCategoryById(categoryId),
      wikiService.getAllPages(categoryId),
    ]);

    // Get subcategories separately
    let subcategories: any[] = [];
    try {
      const subCats = await wikiService.getSubcategories(categoryId);
      subcategories = Array.isArray(subCats) ? subCats : [];
    } catch (e) {
      console.error('Error loading subcategories:', e);
      subcategories = [];
    }

    return { category, pages, subcategories };
  } catch (error) {
    console.error('Error loading category data:', error);
    return { category: null, pages: [], subcategories: [] };
  }
}
```

**To**:
```typescript
async function getCategoryData(categoryId: string) {
  try {
    const [category, pages] = await Promise.all([
      wikiCategoryService.getCategoryById(categoryId),
      wikiPageService.getAllPages(categoryId),
    ]);

    // Get subcategories separately
    let subcategories: any[] = [];
    try {
      const subCats = await wikiCategoryService.getSubcategories(categoryId);
      subcategories = Array.isArray(subCats) ? subCats : [];
    } catch (e) {
      console.error('Error loading subcategories:', e);
      subcategories = [];
    }

    return { category, pages, subcategories };
  } catch (error) {
    console.error('Error loading category data:', error);
    return { category: null, pages: [], subcategories: [] };
  }
}
```

**Changes**:
1. Remove line: `const wikiService = new WikiService();`
2. Change: `wikiService.getCategoryById(categoryId)` → `wikiCategoryService.getCategoryById(categoryId)`
3. Change: `wikiService.getAllPages(categoryId)` → `wikiPageService.getAllPages(categoryId)`
4. Change: `wikiService.getSubcategories(categoryId)` → `wikiCategoryService.getSubcategories(categoryId)`

### Verification After Fix

**Before**:
- Call chain: 3+ layers of indirection
- Service instances: New instance created each request
- Pattern: Wrapper pattern (anti-pattern)

**After**:
- Call chain: 0 layers of indirection
- Service instances: Singleton from imports
- Pattern: Direct service access (best practice)

---

## Complete File Diff

### File: `/frontend/src/app/wiki/category/[id]/page.tsx`

```diff
-import { WikiService } from '@/lib/wiki/service';
+import { wikiPageService, wikiCategoryService } from '@/lib/wiki/services';
 import { WikiCategoryPageClient } from '@/components/wiki/WikiCategoryPageClient';
 import { JournalsPageClient } from '../journals/JournalsPageClient';
 import { getCurrentUser } from '@/lib/auth/server';
 import { dbAdapter } from '@/lib/database/adapter';
 import Link from 'next/link';
 import { UnifiedSearchHeader } from '@/components/ui/SearchResultTable';
 import ClientWikiHeader from '@/components/wiki/ClientWikiHeader';

 async function getCategoryData(categoryId: string) {
-  const wikiService = new WikiService();
-
   try {
     const [category, pages] = await Promise.all([
-      wikiService.getCategoryById(categoryId),
-      wikiService.getAllPages(categoryId),
+      wikiCategoryService.getCategoryById(categoryId),
+      wikiPageService.getAllPages(categoryId),
     ]);

     // Get subcategories separately
     let subcategories: any[] = [];
     try {
-      const subCats = await wikiService.getSubcategories(categoryId);
+      const subCats = await wikiCategoryService.getSubcategories(categoryId);
       subcategories = Array.isArray(subCats) ? subCats : [];
     } catch (e) {
```

**Number of lines changed**: 6 lines
**Files affected**: 1 file
**Risk level**: Low (no logic changes, only service access pattern)

---

## Implementation Sequence

### Phase 1: DATA (CRITICAL - Must do first)
1. Connect to production PostgreSQL database
2. Execute the category INSERT statements
3. Verify categories exist with SELECT query
4. Test: Visit `/wiki/category/autumn` → Should no longer show "Category Not Found"

### Phase 2: CODE (IMPORTANT - Do after data works)
1. Edit `/frontend/src/app/wiki/category/[id]/page.tsx`
2. Update import statement (remove WikiService, add wikiCategoryService)
3. Remove `new WikiService()` line from getCategoryData()
4. Replace all `wikiService.*` calls with direct service imports
5. Run `npm run type-check` to verify TypeScript
6. Test: Navigate category pages → Should work without new instance creation

### Phase 3: CLEANUP (OPTIONAL - Nice to have)
1. Consider deprecating `/frontend/src/lib/wiki/service.ts` (old wrapper)
2. Review other code using `new WikiService()` pattern
3. Document service architecture in `/frontend/src/lib/wiki/services/`
4. Add migration file for future deployments

---

## Testing After Fixes

### Manual Testing

**Test 1: Category exists in database**
```bash
# On production server
docker exec m4s0kwo4kc4oooocck4sswc4 psql -U postgres -d veritable_games -c \
  "SELECT id, name FROM wiki_categories WHERE id IN ('autumn', 'cosmic-knights');"
```
Expected output: 2 rows

**Test 2: Category page loads**
```
Browser: Visit http://localhost:3000/wiki/category/autumn
Expected: Renders category page with autumn content
NOT Expected: "Category Not Found" error
```

**Test 3: Service calls are direct**
```typescript
// In browser console or server logs
// Should see direct calls to dbAdapter, not nested factory calls
```

### Automated Testing (Optional)

If you have test suite, add:
```typescript
describe('Wiki Category Route', () => {
  it('should load category that exists in database', async () => {
    const result = await wikiCategoryService.getCategoryById('autumn');
    expect(result).toBeDefined();
    expect(result.name).toBe('Autumn');
  });

  it('should use direct service import not wrapper', () => {
    // Verify getCategoryData uses wikiCategoryService directly
    // Not new WikiService() pattern
  });
});
```

---

## Risk Assessment

### Issue 1: Data Creation
**Risk**: Low
- Pure INSERT operation
- No destructive changes
- Can be rolled back with DELETE
- No application logic affected

### Issue 2: Service Refactoring
**Risk**: Low
- Only changes how services are accessed
- No logic changes
- Direct imports are simpler and safer
- TypeScript will catch any issues
- Matches pattern already used in individual page route

### Combined Risk
**Risk**: Very Low
- Changes are isolated to category page handling
- No breaking changes to API or database schema
- Other routes unaffected
- Can be tested in development before production

---

## Why These Fixes Work

### Fix 1: Creating Categories
**Current State**:
- Query: `SELECT * FROM wiki_categories WHERE id = 'autumn'`
- Result: 0 rows
- Exception: Category not found

**After Fix**:
- Query: `SELECT * FROM wiki_categories WHERE id = 'autumn'`
- Result: 1 row (autumn category)
- Response: Category data renders successfully

---

### Fix 2: Service Refactoring
**Current State**:
```
Request → new WikiService() → WikiServiceFactory → wikiCategoryService → dbAdapter
          ↑ New instance per request
```

**After Fix**:
```
Request → wikiCategoryService (singleton) → dbAdapter
          ↑ Singleton, reused across requests
```

**Benefits**:
1. Simpler code (1 line removed)
2. Fewer objects created (better memory usage)
3. Faster execution (no factory initialization)
4. Consistent with individual page route
5. Easier to test and maintain

---

## Optional: Long-term Improvements

### Migration File (Future)
Create `/frontend/src/lib/wiki/migrations/20251114-init-categories.ts`:
```typescript
export async function up(db: any) {
  // Create default categories
  await db.query(
    `INSERT INTO wiki_categories (id, name, parent_id, description, color, icon, sort_order)
     VALUES
       ('autumn', 'Autumn', NULL, 'Autumn Season Content', '#D2691E', NULL, 1),
       ('cosmic-knights', 'Cosmic Knights', NULL, 'Cosmic Knights Project', '#1E90FF', NULL, 2),
       ...
     ON CONFLICT (id) DO NOTHING`
  );
}

export async function down(db: any) {
  // Optional: Delete categories on rollback
}
```

### Documentation
Update `/frontend/src/lib/wiki/services/README.md`:
```markdown
## Service Architecture

### CORRECT Pattern (Use This)
```typescript
import { wikiCategoryService } from '@/lib/wiki/services';
await wikiCategoryService.getCategoryById('autumn');
```

### WRONG Pattern (Don't Use This)
```typescript
import { WikiService } from '@/lib/wiki/service';
const wikiService = new WikiService();
await wikiService.getCategoryById('autumn');
```
```

---

## Summary

| Item | Details |
|------|---------|
| **Root Cause 1** | Categories missing from database |
| **Root Cause 2** | Service anti-pattern with `new WikiService()` |
| **Fix 1 Complexity** | INSERT SQL statement (easy) |
| **Fix 2 Complexity** | Change 4 lines in 1 file (easy) |
| **Time to Implement** | ~5 minutes total |
| **Testing Required** | Manual browser test (1 minute) |
| **Risk Level** | Very Low |
| **Rollback Path** | Delete inserted categories (Fix 1) or revert code (Fix 2) |
| **Benefits** | Category routes work, better code quality |

---

## Do NOT Implement Yet

This guide provides:
- ✓ Root cause analysis
- ✓ Exact SQL statements to run
- ✓ Exact code changes needed
- ✓ File paths and line numbers
- ✓ Before/after code diffs
- ✓ Testing procedures

It does NOT implement the fixes. That's for you to do based on this analysis.
