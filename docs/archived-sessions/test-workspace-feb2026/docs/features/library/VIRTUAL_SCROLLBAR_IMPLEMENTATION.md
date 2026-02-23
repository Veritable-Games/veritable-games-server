# Virtual Scrollbar Implementation - Complete Plan & Progress

**Created**: November 20, 2025
**Status**: ⏳ In Progress - Backend Complete, Frontend Refactoring Pending
**Goal**: Implement true virtualized scrollbar for 24,743 document library

---

## 🎯 Problem Statement

### Current Behavior (Infinite Append Mode)
- Documents accumulated as user scrolls (200 → 400 → 600...)
- Scrollbar **grows** as content loads
- Thumb position **shifts** constantly
- Cannot jump to arbitrary positions (e.g., document #15,000)
- Memory grows indefinitely

### Desired Behavior (Virtual Window Mode)
- Scrollbar represents **full 24,743 documents from start**
- Thumb position is **stable** throughout
- Can **jump to any document index** instantly
- Documents load **on-demand** based on viewport position
- Fixed memory footprint (~2000 doc cache with LRU eviction)

---

## ✅ COMPLETED WORK

### Phase 1: API Enhancements ✅

#### 1. Document Count Endpoint ✅
**File**: `frontend/src/app/api/documents/count/route.ts` (NEW)

```typescript
GET /api/documents/count?source=all&language=en&tags=...

Response:
{
  success: true,
  data: {
    total: 24743
  }
}
```

**Purpose**: Get filtered document totals without fetching documents

#### 2. Offset Parameter Support ✅
**File**: `frontend/src/app/api/documents/route.ts` (MODIFIED)

```typescript
// Before: Only page-based
GET /api/documents?page=2&limit=200

// After: Supports both page and offset
GET /api/documents?offset=1000&limit=200
GET /api/documents?page=2&limit=200  // Still works
```

**Changes**:
- Added `offset` parameter parsing
- Auto-calculates page from offset when needed
- Backward compatible with existing page-based calls

#### 3. Service Layer Count Methods ✅
**File**: `frontend/src/lib/documents/service.ts` (MODIFIED)

**Added Methods**:
```typescript
async getDocumentCount(params): Promise<number>
  ├─ queryLibraryCount(params): Promise<number>
  └─ queryAnarchistCount(params): Promise<number>
```

**Purpose**: Count documents matching filters without fetching data

---

### Phase 2: Frontend Infrastructure ✅

#### 1. Virtualized Documents Hook ✅
**File**: `frontend/src/hooks/useVirtualizedDocuments.ts` (NEW - 250 lines)

**API**:
```typescript
const {
  // Document access
  getDocument,           // (index) => Document | undefined
  totalCount,            // Total documents (24743)
  loadedCount,           // Currently cached count

  // Range fetching
  fetchRangeIfNeeded,    // (start, end) => Promise<void>
  isLoadingRange,        // Boolean loading state

  // Cache management
  clearCache,            // Clear all cached documents
  resetWithNewFilters,   // Reset for new filter query
  isIndexLoaded,         // Check if index is in cache
} = useVirtualizedDocuments({
  initialDocuments,
  initialTotal,
  searchQuery,
  selectedTags,
  selectedLanguage,
});
```

**Key Features**:
- **Map-based cache**: `Map<index, Document>` instead of array
- **Smart range detection**: Finds missing sub-ranges
- **LRU eviction**: Keeps max 2000 documents in memory
- **Deduplication**: Prevents redundant fetches
- **Filter handling**: Resets cache on filter changes

#### 2. Skeleton Loaders ✅
**File**: `frontend/src/components/library/DocumentCardSkeleton.tsx` (NEW)

**Components**:
- `DocumentCardSkeleton`: For grid view unfetched slots
- `DocumentListRowSkeleton`: For list view unfetched rows

**Purpose**: Show loading placeholders while documents fetch

---

## ⏳ REMAINING WORK

### Phase 3: Virtuoso Component Refactoring

#### 1. Update VirtuosoGridView Component
**File**: `frontend/src/app/library/LibraryPageClient.tsx` (lines 950-1006)

**Current**:
```typescript
<Virtuoso
  data={pairedDocuments}  // Array of loaded docs
  itemContent={(index, pair) => <DocumentCard doc={pair[0]} />}
  endReached={loadMoreDocuments}  // Infinite scroll trigger
/>
```

**Proposed**:
```typescript
const {
  getDocument,
  totalCount,
  fetchRangeIfNeeded,
  isIndexLoaded
} = useVirtualizedDocuments({...});

// Calculate grid row count (2 docs per row)
const gridRowCount = Math.ceil(totalCount / 2);

<Virtuoso
  totalCount={gridRowCount}  // 🎯 Fixed count from start

  itemContent={(rowIndex) => {
    const docIndex1 = rowIndex * 2;
    const docIndex2 = rowIndex * 2 + 1;

    const doc1 = getDocument(docIndex1);
    const doc2 = getDocument(docIndex2);

    return (
      <div className="grid grid-cols-2 gap-3">
        {doc1 ? <DocumentCard doc={doc1} /> : <DocumentCardSkeleton />}
        {doc2 ? <DocumentCard doc={doc2} /> : <DocumentCardSkeleton />}
      </div>
    );
  }}

  // 🎯 Range-based fetching instead of infinite scroll
  rangeChanged={(range) => {
    const docStart = range.startIndex * 2;
    const docEnd = (range.endIndex + 1) * 2;
    fetchRangeIfNeeded(docStart - 100, docEnd + 100);  // +overscan
  }}

  ref={virtuosoRef}  // For jump-to functionality
  overscan={200}
/>
```

**Key Changes**:
- `totalCount={gridRowCount}` instead of `data={array}`
- Skeleton loaders for unfetched documents
- `rangeChanged` instead of `endReached`
- Direct document access via `getDocument(index)`

#### 2. Update VirtuosoListView Component
**File**: `frontend/src/app/library/LibraryPageClient.tsx` (lines 1014+)

**Similar Changes**:
```typescript
<Virtuoso
  totalCount={totalCount}  // Full 24,743 count

  itemContent={(index) => {
    const doc = getDocument(index);
    return doc ? (
      <ListRow doc={doc} />
    ) : (
      <DocumentListRowSkeleton />
    );
  }}

  rangeChanged={(range) => {
    fetchRangeIfNeeded(range.startIndex - 50, range.endIndex + 50);
  }}

  ref={virtuosoRef}
/>
```

#### 3. Update LibraryPageClient Main Component
**File**: `frontend/src/app/library/LibraryPageClient.tsx` (lines 39-282)

**State Changes**:
```typescript
// ❌ OLD: Array accumulation
const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

// ✅ NEW: Hook-based cache
const {
  getDocument,
  totalCount,
  fetchRangeIfNeeded,
  resetWithNewFilters,
  clearCache
} = useVirtualizedDocuments({
  initialDocuments,
  initialTotal: stats?.total || 0,
  searchQuery,
  selectedTags,
  selectedLanguage
});
```

**Filter Handler Changes**:
```typescript
// Language filter change
useEffect(() => {
  // ❌ OLD: setDocuments([]), setCurrentPage(0), then fetch

  // ✅ NEW: Fetch new count, reset cache
  fetch(`/api/documents/count?${params}`)
    .then(res => res.json())
    .then(data => resetWithNewFilters(data.data.total));
}, [selectedLanguage, searchQuery, selectedTags]);
```

---

### Phase 4: Jump-to-Index UI

#### Create JumpToDocument Component
**File**: `frontend/src/components/library/JumpToDocument.tsx` (NEW)

```typescript
export function JumpToDocument({
  totalCount,
  virtuosoRef
}: {
  totalCount: number;
  virtuosoRef: React.RefObject<VirtuosoHandle>;
}) {
  const [jumpIndex, setJumpIndex] = useState('');

  const handleJump = () => {
    const index = parseInt(jumpIndex);
    if (index >= 0 && index < totalCount) {
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'start',
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={totalCount - 1}
        value={jumpIndex}
        onChange={(e) => setJumpIndex(e.target.value)}
        placeholder="Jump to document #"
        className="w-40 rounded border border-gray-600 bg-gray-800 px-3 py-1 text-white"
      />
      <button
        onClick={handleJump}
        className="rounded bg-blue-600 px-4 py-1 text-white hover:bg-blue-700"
      >
        Go
      </button>
      <span className="text-sm text-gray-400">
        of {totalCount.toLocaleString()}
      </span>
    </div>
  );
}
```

**Integration**: Add to toolbar in LibraryPageClient

---

### Phase 5: Scroll Position Indicator

#### Create ScrollPositionIndicator Component
**File**: `frontend/src/components/library/ScrollPositionIndicator.tsx` (NEW)

```typescript
export function ScrollPositionIndicator({
  visibleRange,
  totalCount
}: {
  visibleRange: { start: number; end: number };
  totalCount: number;
}) {
  const progress = Math.round((visibleRange.end / totalCount) * 100);

  return (
    <div className="fixed bottom-4 right-4 rounded bg-gray-800 px-4 py-2 shadow-lg">
      <div className="text-sm text-white">
        Viewing: {visibleRange.start.toLocaleString()} - {visibleRange.end.toLocaleString()}
        <span className="ml-2 text-gray-400">
          of {totalCount.toLocaleString()} ({progress}%)
        </span>
      </div>
    </div>
  );
}
```

**Update Virtuoso**:
```typescript
const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

<Virtuoso
  rangeChanged={(range) => {
    setVisibleRange({ start: range.startIndex, end: range.endIndex });
    fetchRangeIfNeeded(...);
  }}
/>

<ScrollPositionIndicator visibleRange={visibleRange} totalCount={totalCount} />
```

---

## 📊 ARCHITECTURE COMPARISON

### Before (Current)

```
User scrolls
  ↓
Virtuoso.endReached triggered
  ↓
loadMoreDocuments() called
  ↓
Fetch page N+1 (200 docs)
  ↓
setDocuments(prev => [...prev, ...newDocs])  // APPEND
  ↓
Virtuoso recalculates scroll height
  ↓
Scrollbar thumb position SHIFTS ⚠️
```

**Scrollbar Behavior**: Represents loaded documents (200, 400, 600...)

### After (Proposed)

```
Virtuoso renders with totalCount=24743
  ↓
User scrolls OR jumps to index
  ↓
rangeChanged({ startIndex, endIndex }) called
  ↓
fetchRangeIfNeeded(start, end)
  ↓
Check cache for missing ranges
  ↓
Fetch ONLY missing ranges
  ↓
Update Map cache at specific indices
  ↓
Virtuoso re-renders affected rows
  ↓
Scrollbar position STABLE ✅
```

**Scrollbar Behavior**: Always represents full 24,743 documents

---

## 🎨 UI MOCKUP: Enhanced Navigation

```
┌────────────────────────────────────────────────────────────┐
│ Library (24,743 documents)                    [Grid] [List] │
├────────────────────────────────────────────────────────────┤
│ Search: [________]  Tags: [Politics, History]              │
│ Language: [English ▼]                                       │
│                                                             │
│ Jump to: [____5000____] [Go]  Viewing: 5,000-5,200         │
│                                                             │
│ ┌──────────────┐ ┌──────────────┐                         │
│ │  Document    │ │  Document    │  ◄── Loaded from cache  │
│ │  #5000       │ │  #5001       │                         │
│ │              │ │              │                         │
│ └──────────────┘ └──────────────┘                         │
│ ┌──────────────┐ ┌──────────────┐                         │
│ │ ░░░░░░░░░░░  │ │ ░░░░░░░░░░░  │  ◄── Skeleton loaders  │
│ │ ░░░░░░░░░░░  │ │ ░░░░░░░░░░░  │      (being fetched)   │
│ └──────────────┘ └──────────────┘                         │
│                                                             │
│ Scrollbar: ████░░░░░░░░░░░░░░░ ◄── Fixed at 24,743       │
│            ↑                      from start               │
│         ~20% (5,000/24,743)                                │
└────────────────────────────────────────────────────────────┘
```

---

## 🧪 TEST PLAN

### 1. Jump to Arbitrary Index
```
Test: Jump to document #15,000
Expected:
  ✓ Scrollbar moves to ~60% position
  ✓ Skeleton loaders appear
  ✓ Documents 14,900-15,100 fetch (with overscan)
  ✓ Skeletons replaced with DocumentCards
  ✓ Smooth scroll animation
```

### 2. Filter Change Stability
```
Test: Change language from English to Spanish
Expected:
  ✓ Fetch new count (e.g., 5,432 Spanish docs)
  ✓ Cache cleared
  ✓ totalCount updated to 5,432
  ✓ Scrollbar thumb size adjusts
  ✓ Scroll position resets to top
  ✓ First 200 documents fetch
  ✓ NO scrollbar repositioning during scroll
```

### 3. Memory Management
```
Test: Scroll through 10,000 documents
Expected:
  ✓ Cache grows to ~2,000 documents
  ✓ LRU eviction kicks in
  ✓ Documents far from viewport evicted
  ✓ Memory footprint stays at ~2,000 docs
  ✓ Re-fetches evicted documents if scrolled back
```

### 4. Search + Filter Combination
```
Test: Search "anarchism" + tag "history" + language "English"
Expected:
  ✓ Fetch count with all filters (e.g., 342 results)
  ✓ totalCount updated to 342
  ✓ Scrollbar represents 342 items
  ✓ Can scroll entire result set
  ✓ Jump-to respects filtered set
```

### 5. Edge Cases
```
Test: Jump to last document (24,742)
Expected:
  ✓ Scrolls to bottom
  ✓ Fetches last range (24,600-24,742)
  ✓ Shows "Viewing 24,742 of 24,743"

Test: Clear all filters
Expected:
  ✓ totalCount resets to 24,743
  ✓ Cache cleared
  ✓ Scrollbar adjusts to full size

Test: Network failure during range fetch
Expected:
  ✓ Skeleton loaders remain visible
  ✓ Retry logic (TBD: add to hook)
  ✓ Error toast notification
```

---

## 🚀 IMPLEMENTATION STEPS (Remaining)

### Step 1: Refactor VirtuosoGridView ⏳
1. Import `useVirtualizedDocuments` and `DocumentCardSkeleton`
2. Replace `data={pairedDocuments}` with `totalCount={gridRowCount}`
3. Update `itemContent` to use `getDocument(index)`
4. Replace `endReached` with `rangeChanged`
5. Add `ref` for jump functionality
6. Test: Verify grid renders with skeleton loaders

### Step 2: Refactor VirtuosoListView ⏳
1. Similar changes as grid view
2. Use `DocumentListRowSkeleton` instead
3. Test: Verify list view renders correctly

### Step 3: Update LibraryPageClient ⏳
1. Remove old state (`documents`, `currentPage`, `hasMore`)
2. Add `useVirtualizedDocuments` hook
3. Update filter handlers to use `resetWithNewFilters`
4. Pass `getDocument` and `totalCount` to Virtuoso components
5. Remove old `loadMoreDocuments` function
6. Test: Verify filters work correctly

### Step 4: Add JumpToDocument Component ⏳
1. Create component
2. Add to toolbar
3. Wire up to `virtuosoRef`
4. Test: Jump to various indices

### Step 5: Add ScrollPositionIndicator ⏳
1. Create component
2. Track visible range from `rangeChanged`
3. Display floating indicator
4. Test: Verify updates as user scrolls

### Step 6: Comprehensive Testing ⏳
1. Run all test cases from test plan
2. Check memory usage in DevTools
3. Verify network requests (should be range-based)
4. Test on production with 24,743 real documents
5. Performance profiling

---

## 📈 EXPECTED BENEFITS

### Performance
- **Before**: Memory grows indefinitely (24,743 docs = ~50MB+)
- **After**: Fixed ~2,000 doc cache (~4MB)
- **Improvement**: 92% memory reduction

### User Experience
- ✅ Stable scrollbar throughout session
- ✅ Jump to any document instantly
- ✅ No jarring scroll position changes
- ✅ Clear position indicator ("5,000 of 24,743")
- ✅ Predictable navigation

### Developer Experience
- ✅ Cleaner state management (hook-based)
- ✅ Easier to reason about (Map vs array accumulation)
- ✅ Better separation of concerns
- ✅ Reusable hook for other collections

---

## 🔧 ROLLBACK PLAN

**If issues arise**, the implementation is backward compatible:

1. Keep old `loadMoreDocuments` function
2. Toggle via feature flag: `USE_VIRTUALIZED_SCROLL`
3. Revert to `data={documents}` mode if needed
4. All API changes are additive (no breaking changes)

---

## 📚 REFERENCES

- [React Virtuoso Docs](https://virtuoso.dev/)
- [Virtual Scrolling Guide](https://github.com/bvaughn/react-window)
- [Current Implementation](../../../app/library/LibraryPageClient.tsx)
- [Exploration Report](../../COMPREHENSIVE_LIBRARY_IMPLEMENTATION_REPORT.md)

---

**Last Updated**: November 20, 2025
**Status**: API complete, frontend refactoring in progress
