# Library Document Migration Session - November 21, 2025

**Status**: ❌ **CRITICAL FAILURE**
**Duration**: ~8 hours
**Outcome**: Migration infrastructure implemented but **VISIBILITY BROKEN**

---

## 🚨 CRITICAL FAILURE SUMMARY

### **Goal**
Migrate library documents from database storage to file-based markdown storage (mirroring anarchist library architecture).

### **What Happened**
- ✅ Migrated 10 documents successfully to markdown files with YAML frontmatter
- ✅ Files exist in production Docker container (`/app/data/library/documents/`)
- ✅ Database updated with `file_path` column
- ✅ Fixed 3 critical sorting bugs in API infrastructure
- ❌ **USER REPORTS: Only 3 documents visible in UI (not 10)**
- ❌ **LOST 7 ORIGINAL DOCUMENTS** that were previously visible

### **Current State** (BROKEN)
```
Expected: 10 migrated documents visible with migration_status sort
Actual:   3 documents visible (IDs: 2462, 10398, 10973)
Missing:  7 documents (IDs: 5, 7, 8, 13, 15, 19, 163, 164, 165, 166)
```

**These 3 visible documents were NOT even part of the original migration!**

---

## 📋 Session Timeline

### Phase 1: Migration Script Execution (Successful)
**Time**: ~2 hours
**Commits**: Not committed yet (local testing only)

Ran migration script on 10 test documents:
```bash
cd /home/user/projects/veritable-games/site/frontend
node scripts/library/migrate-to-files.js --limit 10 --verify
```

**Results**:
- ✅ 10 markdown files created in `data/library/documents/`
- ✅ YAML frontmatter generated with metadata
- ✅ PDF artifact cleanup applied
- ✅ Database `file_path` column populated
- ✅ Verification passed (all files readable)

**Migrated Documents** (IDs):
- 5: The Emotion Machine
- 7: Mutual Aid: A Factor of Evolution
- 8: The Conquest of Bread
- 13: Critical Consciousness in Education
- 15: Neural Networks and Deep Learning
- 19: Workplace Democracy Implementation Guide
- 163: 100 Years Ago The Philadelphia dockers strike...
- 164: 13340-29558-1-PB-1
- 165: 13340-29558-1-PB
- 166: 1892 New Orleans General Strike

### Phase 2: Forensic Investigation (Found Multiple Bugs)
**Time**: ~3 hours
**Tools**: Docker exec, PostgreSQL queries, API testing, code analysis

**Findings**:
1. ✅ Production database confirmed: 10 docs have `file_path` populated
2. ✅ Docker container confirmed: All 10 `.md` files exist at `/app/data/library/documents/`
3. ✅ Raw SQL query returns all 10 documents correctly
4. ❌ API returns only 4 migrated documents (163, 164, 165, 166)
5. ❌ User reports only 3 documents visible in UI (2462, 10398, 10973)

**Database Verification**:
```sql
SELECT id, title, file_path
FROM library.library_documents
WHERE id IN (5, 7, 8, 13, 15, 19, 163, 164, 165, 166)
ORDER BY id;

-- Result: All 10 rows with file_path populated ✅
```

**Docker Container Verification**:
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 ls -lh /app/data/library/documents/

# Result: 10 markdown files present ✅
# - the-emotion-machine.md (16KB)
# - mutual-aid-a-factor-of-evolution.md (11KB)
# - the-conquest-of-bread.md (781B)
# - critical-consciousness-in-education.md (16KB)
# - neural-networks-and-deep-learning.md (13KB)
# - workplace-democracy-implementation-guide.md (19KB)
# - 100-years-ago-the-philadelphia-dockers-strike... (72KB)
# - 13340-29558-1-pb-1.md (104KB)
# - 13340-29558-1-pb.md (89KB)
# - 1892-new-orleans-general-strike.md (16KB)
```

### Phase 3: Bug Identification
**Time**: ~2 hours

#### Bug #1: API Route Missing 'migration_status' Validation
**File**: `src/app/api/documents/route.ts`
**Line**: 52-60

```typescript
// BEFORE (WRONG):
const validSortFields = [
  'title',
  'author',
  'publication_date',
  'created_at',
  'view_count',
  'relevance',
];

// AFTER (FIXED):
const validSortFields = [
  'title',
  'author',
  'publication_date',
  'created_at',
  'view_count',
  'relevance',
  'migration_status', // ← Added
];
```

**Impact**: API rejected `sort_by=migration_status` and defaulted to `title` sorting.

#### Bug #2: Library Service Missing 'migration_status' Support
**File**: `src/lib/library/service.ts`
**Line**: 87-95

```typescript
// BEFORE (WRONG):
const validSortColumns = [
  'title',
  'author',
  'publication_date',
  'created_at',
  'updated_at',
  'view_count',
];

// AFTER (FIXED):
const validSortColumns = [
  'title',
  'author',
  'publication_date',
  'created_at',
  'updated_at',
  'view_count',
  'migration_status', // ← Added
];
```

**Impact**: Library service couldn't sort by migration status, used title sorting instead.

#### Bug #3: Missing SQL ORDER BY Logic for migration_status
**File**: `src/lib/library/service.ts`
**Line**: 182-208

Added CASE WHEN logic to sort by file_path presence:

```typescript
// Build ORDER BY clause
let orderByClause;
if (safeSortBy === 'migration_status') {
  // Sort by file_path presence: migrated (has file_path) first, then by title
  orderByClause = `
    CASE WHEN d.file_path IS NOT NULL THEN 0 ELSE 1 END ${safeSortOrder},
    d.title ASC
  `;
} else {
  orderByClause = `d.${safeSortBy} ${safeSortOrder}`;
}
```

#### Bug #4: Missing TypeScript Types
**File**: `src/lib/library/types.ts`
**Line**: 121

```typescript
// BEFORE:
sort_by?: 'title' | 'date' | 'author' | 'views' | 'downloads';

// AFTER:
sort_by?: 'title' | 'date' | 'author' | 'views' | 'downloads' | 'migration_status';
```

**File**: `src/app/library/LibraryPageClient.tsx`
**Line**: 53-64

```typescript
// BEFORE:
const [sortBy, setSortBy] = useState<
  | 'title'
  | 'date'
  | 'author'
  | 'type'
  | 'category'
  | 'source-type'
  | 'tags'
  | 'publication_date'
  | 'page_count'
>('title');

// AFTER:
const [sortBy, setSortBy] = useState<
  | 'title'
  | 'date'
  | 'author'
  | 'type'
  | 'category'
  | 'source-type'
  | 'tags'
  | 'publication_date'
  | 'page_count'
  | 'migration_status' // ← Added
>('title');
```

### Phase 4: Fixes Deployed (But Didn't Solve Visibility Issue)
**Time**: ~1 hour
**Commits**: 3 commits deployed to production

**Commit 1**: `fa1a8aa` - Fix migration_status sorting bug in API route
**Commit 2**: `641a31e` - Fix library service migration_status sorting (failed deploy - type error)
**Commit 3**: `5b4c68c` - Add migration_status to LibrarySearchParams type (successful deploy)

**Deployment Timeline**:
- fa1a8aa deployed: 6:38 AM
- 641a31e deploy failed: Type error in library service
- 5b4c68c deployed: 7:15 AM

**Test Results After Deployment**:
```bash
curl -s 'http://localhost:3000/api/documents?source=library&sort_by=migration_status&limit=50' \
  | jq '.data.documents[] | select(.file_path != null) | .id'

# Expected: [5, 7, 8, 13, 15, 19, 163, 164, 165, 166]
# Actual (via API): [5, 7, 8, 13, 15, 19, 163, 164, 165, 166] ✅
# Actual (via UI): Only 3 documents visible ❌
```

---

## 🔍 Root Cause Analysis (Incomplete)

### What We Know
1. ✅ Database has 10 documents with `file_path` populated
2. ✅ Docker container has all 10 markdown files
3. ✅ Direct SQL queries return all 10 documents correctly
4. ✅ API returns all 10 documents when tested via curl
5. ❌ **UI only shows 3 documents (not even the 10 we migrated!)**

### What We Don't Know (Investigation Needed)
- ❓ Why does the UI show only 3 documents?
- ❓ Why are these 3 documents (2462, 10398, 10973) NOT the ones we migrated?
- ❓ Where did the original 7 visible documents go?
- ❓ Is there client-side filtering we missed?
- ❓ Is there a state management issue in React?
- ❓ Is the unified view merging logic broken?

### Hypotheses to Investigate
1. **Frontend State Issue**: React state not updating with new API data
2. **Client-Side Filtering**: TagFilterSidebar or LanguageFilter excluding documents
3. **Virtualization Bug**: useVirtualizedDocuments hook caching old results
4. **Unified View Bug**: Document service merging library + anarchist incorrectly
5. **Cache Issue**: Browser or server-side cache showing stale data

---

## 📊 Data Patterns Observed

### Document Distribution by created_by
```sql
SELECT created_by, COUNT(*)
FROM library.library_documents
WHERE status='published'
GROUP BY created_by;

-- Results:
-- created_by=3 (library-importer): 3,853 docs
-- created_by=1 (admin): 3 docs
-- created_by=9 (doesn't exist): 3 docs
```

### Migration Status Distribution
```sql
SELECT
  CASE WHEN file_path IS NOT NULL THEN 'migrated' ELSE 'not_migrated' END as status,
  COUNT(*)
FROM library.library_documents
WHERE status='published'
GROUP BY status;

-- Results:
-- migrated: 10 docs
-- not_migrated: 3,849 docs
```

### The 3 Visible Documents
```
ID 2462:  "PULP FICTION -- by Quentin Tarantino & Roger Avary"
  - file_path: NULL (NOT migrated)
  - created_by: 3
  - tags: 12 tags
  - category_id: NULL

ID 10398: "Anti-Capitalism is Capitalist"
  - file_path: NULL (NOT migrated)
  - created_by: 3
  - tags: 14 tags
  - category_id: 7

ID 10973: "The Police Have No Obligation To Protect You"
  - file_path: NULL (NOT migrated)
  - created_by: 3
  - tags: 13 tags
  - category_id: NULL
```

**Pattern**: All 3 visible docs are:
- NOT migrated (file_path = NULL)
- Created by user 3 (library-importer)
- Have 12-14 tags
- Two have NULL category_id, one has category_id=7

---

## 💾 Files Changed

### Migration Script (Not Committed)
- `frontend/scripts/library/migrate-to-files.js`
- Status: Tested locally, works correctly, but not committed to git

### Code Fixes (Committed & Deployed)
1. `src/app/api/documents/route.ts` - Added migration_status validation
2. `src/lib/library/service.ts` - Added migration_status sorting support
3. `src/lib/library/types.ts` - Added migration_status to type definition
4. `src/app/library/LibraryPageClient.tsx` - Added migration_status to useState type

### Documentation (This File)
- `docs/sessions/LIBRARY_MIGRATION_FAILURE_NOV_21_2025.md` - This file

---

## 🔧 Next Steps Required

### Immediate Investigation Needed
1. **Check frontend state**: Inspect React DevTools in browser
   - Is LibraryPageClient receiving all documents?
   - Is useVirtualizedDocuments filtering them?
   - Is filteredDocuments memo excluding them?

2. **Check network requests**: Browser DevTools Network tab
   - What does `/api/documents` actually return to the browser?
   - Are there multiple requests fighting each other?
   - Is there a CORS or authentication issue?

3. **Check client-side filters**:
   - selectedTags: Should be empty array
   - selectedLanguage: Should be 'en' (all docs are 'en')
   - Any other hidden filters?

4. **Test with different user accounts**:
   - Does admin see different documents?
   - Does unauthenticated user see different results?

### Long-Term Fixes
1. **Simplify unified view**: May need to separate library/anarchist views entirely
2. **Add comprehensive logging**: Frontend + backend request/response logging
3. **Create integration tests**: Test document visibility end-to-end
4. **Document expected behavior**: Clear specs for what should be visible when

---

## 📚 Related Documentation

- **Migration Script**: `frontend/scripts/library/migrate-to-files.js`
- **Unified Document Types**: `src/lib/documents/types.ts`
- **Library Service**: `src/lib/library/service.ts`
- **Anarchist Library Architecture**: `docs/features/anarchist-library/ANARCHIST_LIBRARY_ARCHITECTURE.md`
- **Database Schema**: `docs/database/DATABASE.md`

---

## 🎯 Lessons Learned

1. **Multiple validation points**: Sorting required updates in 3 places (API route, library service, TypeScript types)
2. **Test at every layer**: API tests passed but UI still broken - need E2E tests
3. **Don't trust what you built**: Just because API returns data doesn't mean UI receives it
4. **Document as you go**: Waiting until the end means losing critical debugging context

---

## ⚠️ WARNING FOR FUTURE DEVELOPERS

**DO NOT run the migration script on more documents until the visibility issue is resolved.**

Current state:
- 10 documents migrated to files
- Only 3 documents visible (and they're the wrong ones!)
- Running migration on 100 or 3,859 documents will make the problem worse

**If you need to work on library features, investigate the visibility issue FIRST.**

---

**Session End**: November 21, 2025 - 7:30 AM
**Status**: ❌ **UNRESOLVED - VISIBILITY BUG REMAINS**
**Next Action**: Debug frontend state and document rendering
