# Quick Findings: Wiki Route Comparison

## The Problem in One Sentence
The category route fails because categories don't exist in the database, AND it uses poor service architecture that adds unnecessary indirection.

---

## Side-by-Side Code Comparison

### Individual Page (WORKS ✓)
```typescript
// File: /wiki/[slug]/page.tsx

import { wikiPageService } from '@/lib/wiki/services';  // ← Singleton import

async function getWikiPageData(slug: string) {
  const { slug: actualSlug, namespace } = parseWikiSlug(slug);
  const page = await wikiPageService.getPageBySlug(actualSlug, namespace);

  if (!page) return null;
  return { page, allTags };
}

const data = await getWikiPageData(slug);
if (!data) notFound();  // ← Uses Next.js notFound()
```

**Service Call Chain**: `getWikiPageData()` → `wikiPageService.getPageBySlug()` → `dbAdapter.query()` ✓

---

### Category Page (BROKEN ❌)
```typescript
// File: /wiki/category/[id]/page.tsx

import { WikiService } from '@/lib/wiki/service';  // ← Deprecated wrapper

async function getCategoryData(categoryId: string) {
  const wikiService = new WikiService();  // ← Creates NEW instance!

  const [category, pages] = await Promise.all([
    wikiService.getCategoryById(categoryId),
    wikiService.getAllPages(categoryId),
  ]);

  return { category, pages };
}

const { category } = await getCategoryData(id);
if (!category) {
  return <CustomErrorPage />;  // ← Custom error page
}
```

**Service Call Chain**: `getCategoryData()` → `new WikiService()` → `WikiServiceFactory.getInstance()` → `wikiCategoryService.getCategoryById()` → `dbAdapter.query()` ❌

---

## The Architectural Difference

```
Individual Page Architecture:
┌─────────────────────────────────────┐
│ Route Handler: /wiki/[slug]/page.tsx│
└──────────────┬──────────────────────┘
               │
               ▼
        ┌─────────────┐
        │ wikiPageService (singleton)
        │ [imported]  │
        └──────┬──────┘
               │
               ▼
        ┌──────────────┐
        │ dbAdapter.query()
        └──────────────┘

LAYERS: 1 (direct import → query)
INDIRECTION: 0
SERVICE PATTERN: Singleton ✓


Category Page Architecture:
┌──────────────────────────────────────┐
│ Route Handler: /wiki/category/[id]   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌───────────────────┐
        │ new WikiService() │ ← Creates new instance!
        └─────────┬─────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │ WikiServiceFactory   │
        │ .getInstance()       │
        └─────────┬────────────┘
                  │
                  ▼
        ┌─────────────────────────┐
        │ wikiCategoryService     │
        │ .getCategoryById()       │
        └─────────┬───────────────┘
                  │
                  ▼
        ┌──────────────┐
        │ dbAdapter.query()
        └──────────────┘

LAYERS: 3+ (wrapper → factory → service → query)
INDIRECTION: 2+ (unnecessary)
SERVICE PATTERN: Anti-pattern ❌
```

---

## Query Comparison

### Individual Page Query (Working)
```sql
SELECT p.*, r.content, c.id as category_id, c.name as category_name
FROM wiki_pages p
LEFT JOIN wiki_revisions r ON p.id = r.page_id ...
LEFT JOIN wiki_categories c ON p.category_id = c.id
LEFT JOIN wiki_page_views pv ON p.id = pv.page_id
WHERE p.slug = $1 AND p.namespace = $2
GROUP BY p.id, r.content, r.content_format, r.size_bytes, c.id, c.name
```
**Complexity**: 4 JOINs + subquery
**Status**: ✓ Executes successfully
**Error**: Throws if no page found, caught by try/catch

---

### Category Query (Broken)
```sql
SELECT c.*, COUNT(p.id) as page_count
FROM wiki_categories c
LEFT JOIN wiki_pages p ON c.id = p.category_id
WHERE c.id = $1
GROUP BY c.id, c.parent_id, c.name, c.description, c.color, c.icon, sort_order, created_at
```
**Complexity**: 1 JOIN
**Status**: ✓ Query is correct (but no data!)
**Error**: Throws if no category found, caught by try/catch
**Root Cause**: Category 'autumn' doesn't exist in `wiki_categories` table ❌

---

## Data Layer Issue

### What Needs to Exist

For `/wiki/category/autumn` to work:

```sql
-- In wiki_categories table
INSERT INTO wiki_categories
  (id, name, parent_id, description, color, icon, sort_order)
VALUES
  ('autumn', 'Autumn', NULL, 'Autumn category', '#D2691E', NULL, 0);
```

**Current State**: Category 'autumn' row doesn't exist
**Query Result**: 0 rows returned
**Exception Thrown**: `Category not found: "autumn"`
**Rendered UI**: "This category doesn't exist" error page

---

## Why Individual Pages Work But Categories Don't

| Factor | Individual Pages | Categories |
|--------|------------------|-----------|
| **Data Creation** | Automatic (via API) | Manual (must create in DB) |
| **Fallback** | 'uncategorized' category | No fallback |
| **Pre-existence** | Not required | REQUIRED |
| **Service Architecture** | Superior (singleton) | Inferior (wrapper) |
| **Auto-categorization** | Yes (WikiPageService) | N/A |

---

## The Root Causes (Ranked by Impact)

### 🔴 **Cause 1: Missing Database Data (BLOCKING)**
- Categories 'autumn', 'cosmic-knights', etc. don't exist in `wiki_categories`
- Query executes correctly but returns 0 rows
- Exception thrown: `Category not found: "autumn"`
- Impact: **Makes category routes completely non-functional**

### 🟡 **Cause 2: Service Architecture Anti-Pattern**
- Uses `new WikiService()` instead of singleton import
- Adds 2+ layers of unnecessary indirection
- Inconsistent with working individual page pattern
- Impact: **Harder to maintain, debug, and test**

### 🟢 **Cause 3: No Initialization Mechanism**
- No migration or seed script to create categories
- Hard-coded redirects exist for 'library', 'journals' only
- Other categories never initialized
- Impact: **Can't add new categories without manual SQL**

---

## Query Execution Proof

Both routes correctly specify `{ schema: 'wiki' }`:

**Individual Page** (line 526):
```typescript
const result = await dbAdapter.query(
  `SELECT ... FROM wiki_pages ...`,
  [slug, namespace],
  { schema: 'wiki' }  ← Correct!
);
```

**Category Page** (line 234):
```typescript
const result = await dbAdapter.query(
  `SELECT ... FROM wiki_categories ...`,
  [categoryId],
  { schema: 'wiki' }  ← Correct!
);
```

**Both are correct schema-wise. The difference is the data doesn't exist.**

---

## Error Handling Comparison

```
Individual Page:
  getWikiPageData() {
    try {
      const page = await wikiPageService.getPageBySlug(...);
      if (!page) return null;
    } catch (error) {
      return null;
    }
  }

  In component:
    if (!data) notFound();  ← Uses Next.js 404

Category Page:
  getCategoryData() {
    try {
      const [category, pages] = await Promise.all([
        wikiService.getCategoryById(...),
        ...
      ]);
    } catch (error) {
      return { category: null, pages: [] };
    }
  }

  In component:
    if (!category) {
      return <CustomErrorPage />;  ← Custom error page
```

Both catch the error appropriately. The problem is the error is being thrown because data doesn't exist.

---

## Fix Required (In Order)

### Step 1: CRITICAL - Initialize Categories (Data Layer)
```sql
-- Run this SQL to create missing categories
INSERT INTO wiki_categories (id, name, parent_id, description, color, icon, sort_order) VALUES
('autumn', 'Autumn', NULL, 'Autumn Season Content', '#D2691E', NULL, 1),
('cosmic-knights', 'Cosmic Knights', NULL, 'Cosmic Knights Project', '#1E90FF', NULL, 2),
('dodec', 'Dodec', NULL, 'Dodec Project', '#228B22', NULL, 3),
('noxii', 'Noxii', NULL, 'Noxii Project', '#FF6347', NULL, 4),
('on-command', 'On Command', NULL, 'On Command Content', '#4169E1', NULL, 5),
('systems', 'Systems', NULL, 'System Documentation', '#8B4513', NULL, 6),
('tutorials', 'Tutorials', NULL, 'Tutorial Content', '#DAA520', NULL, 7);
```

### Step 2: IMPORTANT - Fix Service Architecture
Replace in `/wiki/category/[id]/page.tsx`:
```typescript
// OLD (anti-pattern):
const wikiService = new WikiService();
const category = await wikiService.getCategoryById(id);

// NEW (best practice):
import { wikiCategoryService } from '@/lib/wiki/services';
const category = await wikiCategoryService.getCategoryById(id);
```

### Step 3: NICE-TO-HAVE - Create Initialization Migration
Add a migration or seed script to auto-create categories on startup.

---

## Summary

| Aspect | Individual Page | Category Page | Winner |
|--------|-----------------|---------------|--------|
| Service Architecture | Singleton import | `new WikiService()` | Individual ✓ |
| Indirection | 0 layers | 2+ layers | Individual ✓ |
| Database Query | Complex 4-JOIN | Simple 1-JOIN | Both ✓ |
| Schema Parameter | Specified | Specified | Both ✓ |
| Error Handling | try/catch | try/catch | Both ✓ |
| **Data Exists** | Yes | **NO** | **Individual ✓** |
| **Root Cause** | N/A | Missing DB rows | **Data Issue** |

**Conclusion**: Category route failure is a **data layer issue** (categories don't exist) combined with a **service architecture anti-pattern** (new instance creation).
