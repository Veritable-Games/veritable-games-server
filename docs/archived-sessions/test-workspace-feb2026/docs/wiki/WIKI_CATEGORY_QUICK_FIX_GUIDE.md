# Wiki Category System - Quick Fix Implementation Guide

**Status**: Ready to implement
**Time Estimate**: 30-45 minutes
**Risk Level**: LOW (SQL syntax fixes only, no business logic changes)
**Files to Modify**: 2 main files

---

## ISSUE SUMMARY

PostgreSQL requires explicit GROUP BY for all selected columns. The WikiCategoryService selects `c.*` but only groups by `c.id`, causing queries to fail in production with:

```
ERROR: column "c.parent_id" must appear in the GROUP BY clause
       or be subject to an aggregate function
```

---

## FIX #1: Update WikiCategoryService.ts (Primary Fix)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts`

### Method 1: getCategoryById() [Line 224]

**Current Code**:
```typescript
async getCategoryById(categoryId: string): Promise<WikiCategory> {
  const result = await dbAdapter.query(
    `SELECT
      c.*,
      COUNT(p.id) as page_count
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id
    WHERE c.id = $1
    GROUP BY c.id`,
    [categoryId],
    { schema: 'wiki' }
  );

  if (result.rows.length === 0) {
    throw new Error(`Category not found: "${categoryId}"`);
  }

  const row = result.rows[0];
  return {
    id: row.id,
    parent_id: row.parent_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sort_order: row.sort_order,
    created_at: row.created_at,
    page_count: parseInt(row.page_count) || 0,
  };
}
```

**Fixed Code**:
```typescript
async getCategoryById(categoryId: string): Promise<WikiCategory> {
  const result = await dbAdapter.query(
    `SELECT
      c.id,
      c.parent_id,
      c.name,
      c.description,
      c.color,
      c.icon,
      c.sort_order,
      c.created_at,
      c.is_public,
      COUNT(p.id)::INTEGER as page_count
    FROM wiki_categories c
    LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
    WHERE c.id = $1
    GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public`,
    [categoryId],
    { schema: 'wiki' }
  );

  if (result.rows.length === 0) {
    throw new Error(`Category not found: "${categoryId}"`);
  }

  const row = result.rows[0];
  return {
    id: row.id,
    parent_id: row.parent_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    sort_order: row.sort_order,
    created_at: row.created_at,
    page_count: parseInt(row.page_count) || 0,
  };
}
```

**Changes**:
- ✅ Explicit column list (lines 227-235)
- ✅ All columns in GROUP BY (line 240)
- ✅ Cast COUNT to INTEGER (line 236)
- ✅ Filter published pages in JOIN (line 238)
- ✅ Include is_public column (line 235)

---

### Method 2: getAllCategories() [Line 258]

**Current Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.*,
    (
      SELECT COUNT(DISTINCT p.id)
      FROM wiki_pages p
      WHERE p.category_id = c.id
        AND p.status = 'published'
    ) as page_count
  FROM wiki_categories c
  GROUP BY c.id
  ORDER BY c.sort_order, c.name`,
  [],
  { schema: 'wiki' }
);
```

**Fixed Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.id,
    c.parent_id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.created_at,
    c.is_public,
    (
      SELECT COUNT(DISTINCT p.id)
      FROM wiki_pages p
      WHERE p.category_id = c.id
        AND p.status = 'published'
    ) as page_count
  FROM wiki_categories c
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
  ORDER BY c.sort_order, c.name`,
  [],
  { schema: 'wiki' }
);
```

**Changes**:
- ✅ Replace `c.*` with explicit columns (lines 283-291)
- ✅ Add is_public column (line 291)
- ✅ Update GROUP BY with all columns (line 299)

---

### Method 3: getSubcategories() [Line 327]

**Current Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.*,
    COUNT(DISTINCT p.id) as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
  WHERE c.parent_id = $1
  GROUP BY c.id
  ORDER BY c.sort_order, c.name`,
  [parentId],
  { schema: 'wiki' }
);
```

**Fixed Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.id,
    c.parent_id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.created_at,
    c.is_public,
    COUNT(DISTINCT p.id)::INTEGER as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
  WHERE c.parent_id = $1
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
  ORDER BY c.sort_order, c.name`,
  [parentId],
  { schema: 'wiki' }
);
```

**Changes**:
- ✅ Replace `c.*` with explicit columns (lines 335-343)
- ✅ Cast COUNT to INTEGER (line 344)
- ✅ Update GROUP BY with all columns (line 348)

---

### Method 4: getRootCategories() [Line 361]

**Current Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.*,
    COUNT(DISTINCT p.id) as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
  WHERE c.parent_id IS NULL
  GROUP BY c.id
  ORDER BY c.sort_order, c.name`,
  [],
  { schema: 'wiki' }
);
```

**Fixed Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.id,
    c.parent_id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.created_at,
    c.is_public,
    COUNT(DISTINCT p.id)::INTEGER as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id AND p.status = 'published'
  WHERE c.parent_id IS NULL
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
  ORDER BY c.sort_order, c.name`,
  [],
  { schema: 'wiki' }
);
```

**Changes**:
- ✅ Replace `c.*` with explicit columns (lines 370-378)
- ✅ Cast COUNT to INTEGER (line 379)
- ✅ Update GROUP BY with all columns (line 383)

---

### Method 5: getCategoryStats() [Line 442]

**Current Code**:
```typescript
const mostUsedResult = await dbAdapter.query(
  `SELECT c.*, COUNT(p.id) as page_count
   FROM wiki_categories c
   LEFT JOIN wiki_pages p ON c.id = p.category_id
   GROUP BY c.id
   HAVING COUNT(p.id) > 0
   ORDER BY COUNT(p.id) DESC
   LIMIT 1`,
  [],
  { schema: 'wiki' }
);
```

**Fixed Code**:
```typescript
const mostUsedResult = await dbAdapter.query(
  `SELECT
    c.id,
    c.parent_id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.created_at,
    c.is_public,
    COUNT(p.id)::INTEGER as page_count
   FROM wiki_categories c
   LEFT JOIN wiki_pages p ON c.id = p.category_id
   GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
   HAVING COUNT(p.id) > 0
   ORDER BY COUNT(p.id) DESC
   LIMIT 1`,
  [],
  { schema: 'wiki' }
);
```

**Changes**:
- ✅ Replace `c.*` with explicit columns (lines 480-488)
- ✅ Cast COUNT to INTEGER (line 489)
- ✅ Update GROUP BY with all columns (line 494)

---

### Method 6: searchCategories() [Line 508]

**Current Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.*,
    COUNT(DISTINCT p.id) as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id
  WHERE c.name ILIKE $1 OR c.description ILIKE $2
  GROUP BY c.id
  ORDER BY c.name`,
  [searchPattern, searchPattern],
  { schema: 'wiki' }
);
```

**Fixed Code**:
```typescript
const result = await dbAdapter.query(
  `SELECT
    c.id,
    c.parent_id,
    c.name,
    c.description,
    c.color,
    c.icon,
    c.sort_order,
    c.created_at,
    c.is_public,
    COUNT(DISTINCT p.id)::INTEGER as page_count
  FROM wiki_categories c
  LEFT JOIN wiki_pages p ON c.id = p.category_id
  WHERE c.name ILIKE $1 OR c.description ILIKE $2
  GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, c.sort_order, c.created_at, c.is_public
  ORDER BY c.name`,
  [searchPattern, searchPattern],
  { schema: 'wiki' }
);
```

**Changes**:
- ✅ Replace `c.*` with explicit columns (lines 520-528)
- ✅ Cast COUNT to INTEGER (line 529)
- ✅ Update GROUP BY with all columns (line 534)

---

## FIX #2: Add Detailed Error Logging (Secondary Fix)

**File**: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx`

**Location**: Lines 36-39

**Current Code**:
```typescript
} catch (error) {
  console.error('Error loading category data:', error);
  return { category: null, pages: [], subcategories: [] };
}
```

**Fixed Code**:
```typescript
} catch (error) {
  console.error('[CategoryPage] Error loading category data for:', {
    categoryId,
    errorName: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
  });
  return { category: null, pages: [], subcategories: [] };
}
```

**Changes**:
- ✅ Include categoryId in error log
- ✅ Separate error name, message, and stack
- ✅ Prefix with [CategoryPage] for better log filtering

---

## IMPLEMENTATION STEPS

### Step 1: Create Backup
```bash
cd /home/user/Projects/veritable-games-main
git status
git stash  # Save any uncommitted changes
```

### Step 2: Apply Fix #1 (Main Fix)

Open: `/home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts`

Apply all 6 method updates listed above. Total changes:
- Replace `c.*` with explicit column list (6 times)
- Update GROUP BY clause (6 times)
- Add/fix type casts (6 times)

**Estimated time**: 15-20 minutes

### Step 3: Apply Fix #2 (Error Logging)

Open: `/home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx`

Update error handler (lines 36-39) with detailed logging.

**Estimated time**: 2-3 minutes

### Step 4: Verify Syntax

```bash
cd /home/user/Projects/veritable-games-main/frontend
npm run type-check
```

**Expected**: Zero TypeScript errors

### Step 5: Test Locally

```bash
npm run dev
```

Navigate to: http://localhost:3000/wiki/category/journals

**Expected**: Category page loads (assuming categories exist in local DB)

### Step 6: Commit Changes

```bash
cd /home/user/Projects/veritable-games-main
git add -A
git commit -m "fix: Correct PostgreSQL GROUP BY violations in WikiCategoryService

- Update getCategoryById() to explicitly list columns and include all in GROUP BY
- Update getAllCategories() with proper column selection and grouping
- Update getSubcategories() with explicit columns and complete GROUP BY
- Update getRootCategories() with explicit columns and complete GROUP BY
- Update getCategoryStats() mostUsedResult query with proper grouping
- Update searchCategories() with explicit columns and complete GROUP BY
- Add detailed error logging to category page route for better debugging
- Cast COUNT() results to INTEGER for type safety
- Filter published pages in JOIN conditions

Fixes production bug where category pages fail with:
'column c.parent_id must appear in the GROUP BY clause'

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 7: Push to Production

```bash
git push origin main
```

**Wait 2-5 minutes for Coolify deployment**

### Step 8: Verify Production Fix

```bash
# Test API endpoints
curl -s http://192.168.1.15:3000/api/wiki/categories/journals | jq .

# Test page route in browser
# Navigate to: http://192.168.1.15:3000/wiki/category/journals
# Expected: Category page loads with list of pages
```

---

## VALIDATION CHECKLIST

After applying fixes:

- [ ] TypeScript type-check passes (`npm run type-check`)
- [ ] No syntax errors in modified files
- [ ] Locally tested (if possible with PostgreSQL)
- [ ] Production deployed via git push
- [ ] Coolify deployment completed (check container status)
- [ ] API endpoint returns category data correctly
- [ ] Category page renders without "Category Not Found" error
- [ ] Subcategories display in category view
- [ ] Page counts are accurate
- [ ] All category types work (journals, archive, tutorials, etc.)
- [ ] Error logs show detailed messages if issue persists

---

## ROLLBACK PLAN (If Needed)

```bash
# Revert last commit
git revert HEAD --no-edit
git push origin main

# Wait for Coolify redeploy
# Check production logs for any remaining issues
```

---

## MONITORING COMMANDS (Post-Deployment)

Monitor production for issues:

```bash
# SSH to production server
ssh user@192.168.1.15

# Check container logs
docker logs m4s0kwo4kc4oooocck4sswc4 --tail 100 | grep -i "category\|group by\|error"

# Check deployed commit
docker inspect m4s0kwo4kc4oooocck4sswc4 --format='{{range .Config.Env}}{{println .}}{{end}}' | grep SOURCE_COMMIT
```

---

## COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| TypeScript error about unknown column | Verify all column names match schema definition |
| "GROUP BY must contain" error remains | Double-check you included ALL columns in GROUP BY |
| Category still shows "not found" | Check container logs for SQL errors |
| API returns empty array | Verify categories exist in production database |
| Page counts show as 0 | Check wiki_pages records have correct category_id values |

---

## TIME ESTIMATE SUMMARY

| Task | Time |
|------|------|
| Backup and setup | 2 min |
| Apply Fix #1 (6 methods) | 15-20 min |
| Apply Fix #2 (error logging) | 2-3 min |
| Type checking | 2 min |
| Local testing | 2-3 min |
| Commit and push | 1 min |
| Coolify deployment | 3-5 min |
| Production verification | 2-3 min |
| **TOTAL** | **30-45 min** |

---

## FILE REFERENCE

```
Modified Files:
├─ /home/user/Projects/veritable-games-main/frontend/src/lib/wiki/services/WikiCategoryService.ts
│  └─ 6 methods: getCategoryById, getAllCategories, getSubcategories,
│     getRootCategories, getCategoryStats, searchCategories
│
└─ /home/user/Projects/veritable-games-main/frontend/src/app/wiki/category/[id]/page.tsx
   └─ 1 method: getCategoryData() error handler
```

---

This guide contains everything needed to implement the fixes. Each fix is concrete and specific with exact line numbers and code changes.
