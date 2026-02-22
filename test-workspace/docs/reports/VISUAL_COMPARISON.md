================================================================================
                    WIKI ROUTE ARCHITECTURAL COMPARISON
                        (Visual Side-by-Side)
================================================================================

WORKING ROUTE                          BROKEN ROUTE
═════════════════════════════════════  ═════════════════════════════════════
/wiki/grand-voss-megastructures       /wiki/category/autumn

SERVICE ARCHITECTURE
─────────────────────────────────────  ─────────────────────────────────────

import {                               import {
  wikiPageService                        WikiService
} from '@/lib/wiki/services'           } from '@/lib/wiki/service'

↓ Direct import (singleton)            ↓ Deprecated wrapper import


FUNCTION CALL PATTERN
─────────────────────────────────────  ─────────────────────────────────────

async function getWikiPageData(       async function getCategoryData(
  slug: string                         categoryId: string
) {                                    ) {
  const page = await                     const wikiService =
    wikiPageService                        new WikiService()
      .getPageBySlug(...)              ↑ Creates NEW instance

  return { page };                       const [category, pages] =
}                                          await Promise.all([
                                           wikiService
↓ 0 layers of indirection                  .getCategoryById(categoryId),
  (direct call)                          wikiService
                                           .getAllPages(categoryId)
                                        ])
                                      }
                                      
                                      ↓ 3+ layers of indirection
                                        (wrapper → factory → service)


DATA FETCHING FLOW
─────────────────────────────────────  ─────────────────────────────────────

┌────────────────────────────────┐    ┌────────────────────────────────┐
│ Route Handler [slug]/page.tsx  │    │ Route Handler category/[id]    │
└──────────────┬─────────────────┘    └──────────────┬─────────────────┘
               │                                     │
               ▼                                     ▼
        ┌─────────────────┐                 ┌──────────────────┐
        │ parseWikiSlug   │                 │ new WikiService()│ ← Anti-pattern!
        │ (parse options) │                 └────────┬─────────┘
        └────────┬────────┘                          │
                 │                                   ▼
                 ▼                          ┌──────────────────────┐
        ┌───────────────────┐               │ WikiServiceFactory   │
        │ wikiPageService   │               │ .getInstance()       │
        │ (singleton)       │               └────────┬─────────────┘
        └────────┬──────────┘                        │
                 │                                   ▼
                 │ .getPageBySlug()        ┌──────────────────────┐
                 │                         │ wikiCategoryService  │
                 ▼                         │ (singleton)          │
        ┌───────────────────┐              └────────┬─────────────┘
        │ dbAdapter.query() │                       │
        │ { schema: 'wiki' }│                       │ .getCategoryById()
        └────────┬──────────┘                       │
                 │                                   ▼
                 ▼                          ┌───────────────────┐
        ✓ Returns page data                │ dbAdapter.query() │
          (or throws)                      │ { schema: 'wiki' }│
                                           └────────┬──────────┘
                                                    │
                                                    ▼
                                            ❌ Returns 0 rows
                                               (throws error)


DATABASE QUERY
─────────────────────────────────────  ─────────────────────────────────────

SELECT                                 SELECT
  p.*,                                   c.*,
  r.content,                             COUNT(p.id) as page_count
  r.content_format,                    FROM wiki_categories c
  r.size_bytes,                        LEFT JOIN wiki_pages p
  c.id as category_id,                   ON c.id = p.category_id
  c.name as category_name,             WHERE c.id = $1
  COALESCE(SUM(pv.view_count), 0)      GROUP BY c.id, c.parent_id,
    as total_views                       c.name, c.description,
FROM wiki_pages p                        c.color, c.icon, ...
LEFT JOIN wiki_revisions r
  ON p.id = r.page_id AND
  r.id = (SELECT MAX(id) FROM
    wiki_revisions WHERE
    page_id = p.id)
LEFT JOIN wiki_categories c
  ON p.category_id = c.id
LEFT JOIN wiki_page_views pv
  ON p.id = pv.page_id
WHERE p.slug = $1 AND
  p.namespace = $2
GROUP BY p.id, r.content, ...

Complexity: HIGH                       Complexity: LOW
  4 JOINs + 1 subquery                  1 JOIN
  SUM aggregate                         COUNT aggregate

✓ WORKS                                ✓ Syntax correct
  Page exists in database              ❌ No rows (category missing)


ERROR HANDLING
─────────────────────────────────────  ─────────────────────────────────────

try {                                  try {
  const page =                           const [category, pages] =
    await wikiPageService                 await Promise.all([
      .getPageBySlug(...)                   wikiService
                                             .getCategoryById(...)
  if (!page) return null;              } catch (error) {
  return { page, allTags }               console.error(...)
} catch (error) {                        return { category: null, ... }
  console.error(...)                   }
  return null
}

In component:                          In component:
  if (!data) notFound()                  if (!category) {
                                          return <CustomErrorPage />
                                        }


RESULT
─────────────────────────────────────  ─────────────────────────────────────

✓ Renders wiki page                    ❌ Shows error:
✓ All content loads                       "This category doesn't exist"
✓ Navigation works                     ❌ No category found page
✓ Comments available                   ❌ URL: /wiki/category/autumn
✓ Tags, edits, etc. visible               returns 404-like response


================================================================================
                              ROOT CAUSE ANALYSIS
================================================================================

ISSUE #1: MISSING DATA (BLOCKING)
┌──────────────────────────────────────────────────────────────────────────┐
│ ❌ THE CATEGORY 'autumn' DOES NOT EXIST IN wiki_categories TABLE          │
│                                                                            │
│ Query:  SELECT * FROM wiki_categories WHERE id = 'autumn'                │
│ Result: 0 rows (empty result set)                                         │
│ Error:  Category not found: "autumn"                                     │
│                                                                            │
│ Why this happens:                                                          │
│   • Pages are created dynamically (via API)                              │
│   • Categories must be pre-created                                        │
│   • Categories 'autumn', 'cosmic-knights', etc. were never initialized   │
│   • No auto-creation mechanism for categories                            │
│   • No fallback if category doesn't exist                                │
│                                                                            │
│ How to fix:                                                               │
│   INSERT INTO wiki_categories (id, name, ...) VALUES ('autumn', ...)    │
└──────────────────────────────────────────────────────────────────────────┘

ISSUE #2: SERVICE ANTI-PATTERN (CODE QUALITY)
┌──────────────────────────────────────────────────────────────────────────┐
│ ❌ USES new WikiService() INSTEAD OF SINGLETON IMPORT                     │
│                                                                            │
│ Current (Wrong):                                                          │
│   const wikiService = new WikiService()                                  │
│   const category = await wikiService.getCategoryById(id)                 │
│                                                                            │
│ Should Be (Right):                                                        │
│   import { wikiCategoryService } from '@/lib/wiki/services'             │
│   const category = await wikiCategoryService.getCategoryById(id)         │
│                                                                            │
│ Problems:                                                                 │
│   • Creates new instance on each request (memory waste)                   │
│   • Adds 2+ unnecessary indirection layers                                │
│   • Inconsistent with working individual page pattern                    │
│   • Harder to test (can't mock singleton)                                │
│   • Harder to maintain (verbose)                                          │
│                                                                            │
│ How to fix:                                                               │
│   Change 4 lines in /wiki/category/[id]/page.tsx                        │
└──────────────────────────────────────────────────────────────────────────┘


================================================================================
                            PROOF OF ANALYSIS
================================================================================

PROOF #1: Both Routes Use Correct Schema Parameter
┌──────────────────────────────────────────────────────────────────────────┐
│ Individual Page:                                                          │
│   dbAdapter.query(..., { schema: 'wiki' })                              │
│                                                                            │
│ Category Page:                                                            │
│   dbAdapter.query(..., { schema: 'wiki' })                              │
│                                                                            │
│ Verdict: ✓ Both correct                                                   │
└──────────────────────────────────────────────────────────────────────────┘

PROOF #2: Individual Page Works Despite Complex Query
┌──────────────────────────────────────────────────────────────────────────┐
│ If database connection was broken:                                        │
│   - Individual page would also fail                                       │
│   - It would throw different error (connection error)                     │
│                                                                            │
│ If schema parameter was wrong:                                            │
│   - Individual page would fail (schema not found)                         │
│   - It would throw different error (schema error)                         │
│                                                                            │
│ Individual page works ✓ → Database/schema/adapter all correct            │
└──────────────────────────────────────────────────────────────────────────┘

PROOF #3: Category Query Syntax Is Correct
┌──────────────────────────────────────────────────────────────────────────┐
│ If query syntax was wrong:                                                │
│   - PostgreSQL would throw syntax error                                   │
│   - Error would mention "SQL syntax" or "unexpected token"               │
│                                                                            │
│ Actual error:                                                             │
│   - Category not found: "autumn"                                         │
│   - This means query executed but returned 0 rows                        │
│                                                                            │
│ Verdict: ✓ Query is syntactically correct                                │
│          ❌ Just no data matching the WHERE clause                       │
└──────────────────────────────────────────────────────────────────────────┘

PROOF #4: Service Pattern Difference is Clear
┌──────────────────────────────────────────────────────────────────────────┐
│ Individual page imports directly:                                         │
│   import { wikiPageService } from '@/lib/wiki/services'                 │
│   [file shows this at line 8]                                            │
│                                                                            │
│ Category page creates wrapper:                                            │
│   import { WikiService } from '@/lib/wiki/service'                       │
│   const wikiService = new WikiService()                                  │
│   [file shows this at lines 1 and 17]                                    │
│                                                                            │
│ Verdict: ✓ Definitively different patterns                               │
│          ❌ Category pattern is inferior                                 │
└──────────────────────────────────────────────────────────────────────────┘


================================================================================
                         CONCLUSION
================================================================================

Two distinct issues causing category route failure:

1. PRIMARY ISSUE (BLOCKING):
   Categories don't exist in database
   - Problem is DATA, not CODE
   - Query is correct but returns 0 rows
   - Fix: INSERT category rows

2. SECONDARY ISSUE (CODE QUALITY):
   Service architecture uses anti-pattern
   - Problem is CODE STYLE, not FUNCTIONALITY
   - Creates new instances instead of using singletons
   - Fix: Import services directly (4 line change)

The architectural difference is clear:
- Individual page: Superior (singleton, direct, 0 indirection)
- Category page: Inferior (wrapper, indirect, 3+ indirection)

Both issues are easily fixable.

================================================================================
