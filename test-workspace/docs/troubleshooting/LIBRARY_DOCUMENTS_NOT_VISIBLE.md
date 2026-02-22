# Troubleshooting: Library Documents Not Visible

**Issue**: Library documents exist in database and API returns them, but they don't appear in the UI
**Last Occurred**: November 21, 2025
**Status**: ❌ **UNRESOLVED**

---

## 🚨 Symptoms

- Library page shows only 3 documents (or fewer than expected)
- API `/api/documents` returns correct count (e.g., 3,859)
- Database queries show correct document count
- Network tab shows API returning data correctly
- But UI doesn't render the documents

---

## ✅ Quick Diagnostic Checks

### 1. Check Database Count
```bash
docker exec veritable-games-postgres psql -U postgres -d veritable_games -c "
  SELECT COUNT(*) FROM library.library_documents WHERE status='published';
"
```

**Expected**: 3,859 (or your total count)
**If different**: Database sync issue

### 2. Check API Response
```bash
curl -s 'http://localhost:3000/api/documents?source=library&limit=10' \
  | jq '.data.pagination.total'
```

**Expected**: 3,859 (matches database)
**If different**: API filtering issue

### 3. Check Browser Network Tab
1. Open library page
2. Open DevTools → Network tab
3. Find request to `/api/documents`
4. Check response: `data.pagination.total`

**Expected**: 3,859
**If different**: Request parameters filtering results

### 4. Check React State
1. Install React DevTools browser extension
2. Open library page
3. Find `LibraryPageClient` component
4. Check `documents` array length

**Expected**: Should match API response
**If different**: Frontend state issue

---

## 🔍 Common Causes

### 1. Client-Side Tag Filtering
**Symptoms**: API returns many docs, UI shows few

**Check**:
```typescript
// In LibraryPageClient state:
selectedTags: []  // Should be empty for no filtering
```

**Fix**:
- Click "Clear Filters" button
- Or manually set `selectedTags` to empty array

### 2. Language Filter Too Restrictive
**Symptoms**: Only English docs visible

**Check**:
```typescript
// In LibraryPageClient state:
selectedLanguage: 'en'  // Or 'all'
```

**Fix**:
- Change language dropdown to "All Languages"
- Or set to specific language

### 3. Virtualization Cache Stale
**Symptoms**: After adding docs, old count persists

**Check**: `useVirtualizedDocuments` hook may have cached old total

**Fix**:
```typescript
// In LibraryPageClient, trigger cache reset:
clearCache();
resetWithNewFilters(newTotal);
```

### 4. Frontend State Not Updating
**Symptoms**: API correct, but `documents` array doesn't update

**Potential causes**:
- React useEffect dependencies missing
- State update race condition
- Async/await issue

**Fix**: Add logging to trace state updates:
```typescript
useEffect(() => {
  console.log('[DEBUG] Documents updated:', documents.length);
}, [documents]);
```

---

## 🔧 Step-by-Step Resolution

### Step 1: Verify API Works
```bash
# Get total count
curl -s 'http://localhost:3000/api/documents?source=library&limit=1' \
  | jq '.data.pagination.total'

# Get first 10 documents
curl -s 'http://localhost:3000/api/documents?source=library&limit=10' \
  | jq '.data.documents[] | {id, title}'
```

**If API returns correct data**: Frontend issue
**If API returns wrong data**: Backend issue

### Step 2: Check Frontend Filters
1. Open library page
2. Open React DevTools
3. Find `LibraryPageClient`
4. Check state:
   - `selectedTags` should be `[]`
   - `selectedLanguage` should be `'all'` or `'en'`
   - `sortBy` can be any valid value
   - `documents` array length should match API total

### Step 3: Check Network Requests
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Find `/api/documents` request
4. Check:
   - Request URL parameters
   - Response data structure
   - Response `data.pagination.total`

### Step 4: Add Debug Logging
```typescript
// In LibraryPageClient.tsx after useVirtualizedDocuments:
console.log('[DEBUG] Total count:', totalCount);
console.log('[DEBUG] Loaded count:', loadedCount);
console.log('[DEBUG] Documents:', allDocuments.length);
console.log('[DEBUG] Filtered:', filteredDocuments.length);
```

### Step 5: Test Different Sort/Filter Combinations
- Try sorting by "Title (A-Z)"
- Try language "All Languages"
- Clear all tag filters
- Refresh page and check again

---

## 📋 Known Related Issues

### Issue #1: Migration Visibility Failure (Nov 21, 2025)
**Context**: After migrating 10 docs to files, only 3 docs visible in UI
**Root Cause**: Unknown (under investigation)
**Documentation**: `docs/sessions/LIBRARY_MIGRATION_FAILURE_NOV_21_2025.md`

**Status**: ❌ Unresolved

**What we know**:
- ✅ Database has 3,859 documents
- ✅ API returns all 3,859 when queried
- ✅ Files exist in Docker container
- ❌ UI shows only 3 documents
- ❌ React state may not be updating

**Next steps**: Debug React state and client-side filtering

---

## 🎯 Quick Fixes to Try

### Fix #1: Clear Browser Cache
```bash
# Hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Fix #2: Reset Frontend State
```typescript
// In browser console on library page:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Fix #3: Check Language Filter Default
```typescript
// In LibraryPageClient.tsx, line ~52:
const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

// Try changing to:
const [selectedLanguage, setSelectedLanguage] = useState<string>('');
// Or:
const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
```

### Fix #4: Bypass Filtering Temporarily
```typescript
// In LibraryPageClient.tsx, comment out filtering:
const filteredDocuments = useMemo(() => {
  let filtered = allDocuments;

  // TEMPORARILY DISABLED FOR DEBUGGING
  // if (selectedTags.length > 0) {
  //   filtered = filtered.filter(doc => doc.tags?.some(tag => selectedTags.includes(tag.name)));
  // }

  return filtered;
}, [allDocuments]); // Removed selectedTags dependency
```

---

## 📞 When to Escalate

If after trying all fixes above, documents still don't appear:

1. **Check for JavaScript errors**: Console tab for exceptions
2. **Test with different browser**: Rule out browser-specific issue
3. **Test with different user**: Rule out account-specific issue
4. **Review recent commits**: Something may have broken rendering logic

**Critical files to review**:
- `src/app/library/LibraryPageClient.tsx`
- `src/hooks/useVirtualizedDocuments.ts`
- `src/lib/documents/service.ts`
- `src/lib/library/service.ts`

---

## 📚 Related Documentation

- [Library Migration Status](../features/library/MIGRATION_STATUS_AND_ISSUES.md)
- [Session Report: Nov 21, 2025](../sessions/LIBRARY_MIGRATION_FAILURE_NOV_21_2025.md)
- [Unified Document Service](../api/unified-documents.md)
- [LibraryPageClient Architecture](../architecture/library-page-client.md)

---

**Last Updated**: November 21, 2025
**Status**: ❌ **Issue Not Resolved**
**Next Action**: Debug React state and document rendering logic
