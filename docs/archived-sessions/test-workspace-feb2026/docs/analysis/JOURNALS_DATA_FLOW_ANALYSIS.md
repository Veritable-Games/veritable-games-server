# Complete Data Flow Analysis: Journals Disappearing in Production

**Date**: 2026-02-13
**Status**: ROOT CAUSE IDENTIFIED
**Severity**: CRITICAL - 0 journals showing in production

---

## Executive Summary

**ROOT CAUSE**: The fix commit `a9bef9fcfd` added `WHERE (p.is_deleted = FALSE OR p.is_deleted IS NULL)` to filter deleted journals from the server query. However, **ALL your journals have `is_deleted = TRUE`**, causing them to be excluded from the query results.

**Impact**: Production shows 0 journals after user hard refresh.

---

## Complete Data Flow Trace

### 1. Server-Side Query (`/frontend/src/app/wiki/category/[id]/page.tsx`)

**Function**: `getJournalsData(userId, userRole)`
**Location**: Lines 58-142

#### Query Construction:

For **regular users** (non-admin/developer):
```sql
SELECT
  p.id,
  p.slug,
  p.title,
  p.namespace,
  p.created_at,
  p.updated_at,
  p.is_deleted,
  p.deleted_by,
  p.deleted_at,
  p.is_archived,
  p.archived_by,
  p.archived_at,
  p.journal_category_id,
  r.content,
  COALESCE(b.id, 0) as is_bookmarked
FROM wiki_pages p
LEFT JOIN wiki_revisions r ON p.id = r.page_id
  AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
LEFT JOIN wiki_page_bookmarks b ON p.id = b.page_id AND b.user_id = ?
WHERE p.namespace = 'journals'
  AND p.created_by = ?
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)  -- ⚠️ THIS IS THE PROBLEM
ORDER BY p.updated_at DESC
```

**Parameters**: `[userId, userId]`

#### Problem Statement:

**BEFORE commit a9bef9fcfd** (working):
```sql
WHERE p.namespace = 'journals'
  AND p.created_by = ?
-- No is_deleted filter - all journals returned
```

**AFTER commit a9bef9fcfd** (broken):
```sql
WHERE p.namespace = 'journals'
  AND p.created_by = ?
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)  -- Excludes deleted journals
```

**The Critical Issue**:
- The UI is designed to show deleted journals with strike-through styling (see `JournalsSidebar.tsx` lines 694-759)
- Deleted journals should display in the sidebar with visual indicators and "Recover" action
- The store's `getJournalsByCategory()` function (lines 506-537) has sorting logic that places deleted journals at the bottom
- **BUT** the server query now excludes them entirely before they reach the client

---

### 2. Data Transformation (`page.tsx` lines 121-137)

```typescript
return result.rows.map((j: any) => ({
  id: j.id,
  slug: j.slug,
  title: j.title,
  namespace: j.namespace,
  created_at: j.created_at,
  updated_at: j.updated_at,
  content: j.content || '',
  isBookmarked: j.is_bookmarked > 0,
  is_deleted: j.is_deleted || false,       // ⚠️ Keeps deletion state
  deleted_by: j.deleted_by || null,
  deleted_at: j.deleted_at || null,
  is_archived: j.is_archived || false,      // ⚠️ Keeps archive state
  archived_by: j.archived_by || null,
  archived_at: j.archived_at || null,
  journal_category_id: j.journal_category_id || null,
}));
```

**This transformation is correct** - it preserves deletion/archive metadata. But if the query returns 0 rows, this never runs.

---

### 3. Server Component Pass to Client (`page.tsx` line 167)

```typescript
// Special handling for journals category - use Zim-like interface
if (id === 'journals') {
  const user = await getCurrentUser();
  const maintenanceModeEnabled = await isMaintenanceModeEnabled();

  if (maintenanceModeEnabled && !user) {
    // Maintenance mode ON + no user → redirect to login
    const { redirect } = await import('next/navigation');
    redirect('/auth/login?redirect=/wiki/category/journals');
  }

  // TypeScript guard: user might be null if maintenance mode is OFF
  const journals = user ? await getJournalsData(user.id, user.role) : [];

  return <JournalsPageClient journals={journals} />;  // ⚠️ Passes empty array if query returns 0 rows
}
```

**If query returns 0 rows**: `journals = []` gets passed to client.

---

### 4. Client Wrapper (`JournalsPageClient.tsx`)

**Receives**: `journals` prop from server (line 30)
**Initial State**: Line 42 logs show `[JOURNALS DEBUG] Initial journals count: 0`

```typescript
export function JournalsPageClient({ journals }: JournalsPageClientProps) {
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get('selected');
  const [currentJournal, setCurrentJournal] = useState<JournalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<JournalCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      console.log('[JOURNALS DEBUG] Starting categories fetch...');
      console.log('[JOURNALS DEBUG] Initial journals count:', journals.length);  // Shows 0
      // ...
    };
    fetchCategories();
  }, []);

  return (
    <JournalsLayout
      journals={journals}           // ⚠️ Empty array passed here
      categories={categories}
      currentPage={currentPage}
      isLoading={isLoading || !categoriesLoaded}
    />
  );
}
```

**No client-side filtering** - just passes through what it receives from server.

---

### 5. Layout Component (`JournalsLayout.tsx`)

**Receives**: `journals` prop (line 25-30)
**Store Initialization**: Lines 43-47

```typescript
export function JournalsLayout({
  journals,        // ⚠️ Empty array from server
  categories,
  currentPage,
  isLoading,
}: JournalsLayoutProps) {
  const { setSidebarWidth, sidebarWidth, setJournals, setCategories, reset } = useJournalsStore();

  // Initialize journals ONCE on mount (journals come from server props)
  useEffect(() => {
    setJournals(journals);  // ⚠️ Sets store to empty array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Update categories when they load (categories are fetched client-side)
  useEffect(() => {
    if (categories.length > 0) {
      setCategories(categories);
    }
  }, [categories, setCategories]);

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="flex h-full">
          <Panel>
            <JournalsSidebar
              journals={journals}       // ⚠️ Empty array passed to sidebar
              categories={categories}
              currentSlug={currentPage?.slug}
            />
          </Panel>
          {/* ... */}
        </PanelGroup>
      </div>
    </div>
  );
}
```

**Critical**: Store gets initialized with empty array on mount.

---

### 6. Store State (`journalsStore.ts`)

**State**: Lines 59-93
**Initialization**: Lines 151-175

```typescript
export const useJournalsStore = create<JournalsState>((set, get) => ({
  ...initialState,

  // Journal actions
  setJournals: journals => set({ journals }),  // ⚠️ Sets journals to empty array

  // Helpers (use get() for reading state)
  getJournalsByCategory: categoryId => {
    const state = get();
    const uncategorizedId = state.categories.find(c => c.name === 'Uncategorized')?.id;

    const filtered = state.journals.filter(j => {  // ⚠️ Filters empty array = empty array
      const journalCategoryId = j.journal_category_id || uncategorizedId;
      return journalCategoryId === categoryId;
    });

    // Sort: active first, archived middle, deleted last (each group sorted by updated_at desc)
    return filtered.sort((a, b) => {
      // Determine priority: 0 = active, 1 = archived, 2 = deleted
      const getPriority = (j: any) => {
        if (j.is_deleted) return 2;        // ⚠️ Deleted journals go to bottom
        if (j.is_archived) return 1;       // Archived in middle
        return 0;                          // Active journals on top
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      // Sort by priority first
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Within same priority, sort by updated_at (most recent first)
      const aTime = new Date(a.updated_at).getTime();
      const bTime = new Date(b.updated_at).getTime();
      return bTime - aTime;
    });
  },
  // ...
}));
```

**Store sorting logic is correct** - it handles deleted journals by placing them at the bottom. But if the store is initialized with an empty array, sorting has no effect.

---

### 7. Sidebar Rendering (`JournalsSidebar.tsx`)

**Store Usage**: Lines 32-63
**Display Logic**: Lines 530-557, 694-760

```typescript
export function JournalsSidebar({ journals, categories, currentSlug }: JournalsSidebarProps) {
  const {
    journals: storeJournals,  // ⚠️ Empty array from store
    // ...
  } = useJournalsStore();

  // Get categories from store (will update after initial load)
  const storeCategories = useJournalsStore(state => state.categories);
  const displayCategories = storeCategories.length > 0 ? storeCategories : categories;

  // When searching, show flat list of results
  const isSearchMode = searchQuery && searchResults;
  const displayedJournals = searchResults?.pages || storeJournals;  // ⚠️ storeJournals = []

  // Debug logging for render decision
  useEffect(() => {
    console.log('[SIDEBAR DEBUG] Render state:', {
      storeCategoriesCount: storeCategories.length,
      propsCategoriesCount: categories.length,
      displayCategoriesCount: displayCategories.length,
      journalsCount: storeJournals.length,              // ⚠️ Shows 0
      displayedJournalsCount: displayedJournals.length, // ⚠️ Shows 0
      isSearchMode,
      willShowNoJournalsMessage: displayCategories.length === 0,
    });
  }, [/* ... */]);

  return (
    <div className="flex h-full flex-col border-r border-gray-800 bg-gray-900">
      {/* ... */}
      <div className="flex-1 overflow-y-auto p-2">
        {isSearchMode ? (
          // Search results - flat list
          displayedJournals.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No journals found</div>
          ) : (
            // Render journals...
          )
        ) : displayCategories.length === 0 ? (
          // No categories - check if journals exist
          storeJournals.length > 0 ? (  // ⚠️ This is FALSE (0 > 0)
            // Fallback: Show flat list when categories unavailable
            <div className="space-y-1">
              {/* ... */}
            </div>
          ) : (
            // Only show empty state if BOTH categories AND journals are empty
            <div className="py-8 text-center text-sm text-gray-500">
              No journals yet. Create your first journal!  // ⚠️ THIS IS DISPLAYED
            </div>
          )
        ) : (
          // Categories with journals
          <div className="space-y-1">
            {displayCategories.map(category => (
              <JournalCategorySection
                key={category.id}
                category={category}
                journals={getJournalsByCategory(category.id)}  // ⚠️ Returns empty array
                currentSlug={currentSlug}
                // ...
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Rendering Decision Tree**:
1. `isSearchMode = false` (not searching)
2. `displayCategories.length === 0` → TRUE (categories not loaded yet)
3. `storeJournals.length > 0` → FALSE (0 journals in store)
4. → Shows "No journals yet. Create your first journal!"

**Once categories load**:
1. `isSearchMode = false`
2. `displayCategories.length > 0` → TRUE
3. Renders categories with `getJournalsByCategory(categoryId)`
4. Each category shows "No journals in this category" (see `JournalCategorySection.tsx` line 232-233)

---

## Critical Questions Answered

### Q1: Could my WHERE clause be TOO restrictive?
**YES** - `AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)` excludes all journals with `is_deleted = TRUE`.

### Q2: Are there other filters I didn't see?
**NO** - No additional filters. The problem is entirely in the server-side query.

### Q3: Is the query even running?
**YES** - The query runs, but returns 0 rows because all journals have `is_deleted = TRUE`.

### Q4: Could the result be getting filtered out before reaching the UI?
**NO** - The empty result from the database is passed through unchanged. No client-side filtering happens.

### Q5: Did I break the query parameter binding?
**NO** - Parameter binding is correct: `[userId, userId]` for non-privileged users.

---

## The Fix

You have **TWO OPTIONS**:

### Option 1: Remove the `is_deleted` Filter (Recommended)

The UI is designed to show deleted journals (with strike-through). Remove the filter:

```typescript
// For regular users:
WHERE p.namespace = 'journals'
  AND p.created_by = ?
  -- Remove: AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
ORDER BY p.updated_at DESC
```

The store's `getJournalsByCategory()` function already sorts deleted journals to the bottom (line 516-536).

### Option 2: Update All Journals to `is_deleted = FALSE` (Not Recommended)

If you truly want deleted journals hidden from the query, you need to:
1. Update the database: `UPDATE wiki.wiki_pages SET is_deleted = FALSE WHERE namespace = 'journals'`
2. Keep the query filter as-is

**However**, this breaks the delete/recover feature. The sidebar has UI for recovering deleted journals (line 449-491).

---

## Recommendation

**REVERT commit a9bef9fcfd** - The `is_deleted` filter should NOT be in the initial query. The UI expects deleted journals to be available in the store for displaying with strike-through styling.

The proper place to filter deleted journals (if desired) is in the **sidebar rendering logic**, not the server query. This allows:
- Undo/redo to work correctly
- Recover functionality to work
- Proper visual feedback for deleted items

---

## Additional Findings

### User Role Detection
- Regular users: `userRole !== 'admin' && userRole !== 'developer'`
- Regular users only see their own journals: `AND p.created_by = ?`
- Admin/developer users see ALL journals (no `created_by` filter)

### Deletion vs Archive
- `is_deleted`: Soft delete, shown with strike-through, can be recovered
- `is_archived`: Archived state, affects sorting priority
- Both fields are tracked separately in the database

### Categories Fetching
- Categories are fetched client-side via `/api/journals/categories` (line 45 in `JournalsPageClient.tsx`)
- If categories fetch fails, sidebar falls back to flat list (line 696-754)
- "Uncategorized" is a special category that cannot be renamed/deleted (line 52 in `JournalCategorySection.tsx`)

---

## File References

1. **Server Query**: `/frontend/src/app/wiki/category/[id]/page.tsx` (lines 58-142)
2. **Client Wrapper**: `/frontend/src/app/wiki/category/journals/JournalsPageClient.tsx` (lines 30-160)
3. **Layout**: `/frontend/src/components/journals/JournalsLayout.tsx` (lines 25-147)
4. **Store**: `/frontend/src/stores/journalsStore.ts` (lines 506-537)
5. **Sidebar**: `/frontend/src/components/journals/JournalsSidebar.tsx` (lines 530-760)
6. **Category Section**: `/frontend/src/components/journals/JournalCategorySection.tsx` (lines 230-249)

---

## Commit History

- **a9bef9fcfd**: "fix(journals): filter deleted journals from server-side query" → **THIS IS THE PROBLEM**
- **4cd166bc9d**: "feat: implement journal archive and UI improvements"
- **829bb668e3**: "fix: center strikethrough line on deleted journal text"
- **d67392615f**: "feat: sort deleted journals to bottom of each category"

The features added in commits 4cd166bc9d and d67392615f (archive, sorting deleted journals) require deleted journals to be present in the query result. Commit a9bef9fcfd contradicts this by filtering them out.
