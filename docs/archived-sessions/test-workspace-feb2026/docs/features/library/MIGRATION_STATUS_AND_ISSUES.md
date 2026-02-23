# Library Migration Status & Known Issues

**Last Updated**: November 21, 2025
**Status**: ❌ **BROKEN - DO NOT USE IN PRODUCTION**

---

## 🚨 CRITICAL ISSUE: Document Visibility Broken

### **Problem**
After migrating 10 library documents from database to file-based storage, **only 3 documents are visible in the UI** (and they're not even the ones we migrated).

### **Expected Behavior**
- 10 migrated documents should appear in library grid/list view
- Documents should sort correctly with "Migration Status (File-based First)" option
- All existing documents should remain visible

### **Actual Behavior**
- Only 3 documents visible: "PULP FICTION", "Anti-Capitalism is Capitalist", "The Police Have No Obligation To Protect You"
- These 3 documents are NOT migrated (they don't have `file_path`)
- 7 original documents that were previously visible are now missing
- 10 newly migrated documents do not appear in the UI

### **Impact**
- ❌ **Library view is broken for users**
- ❌ **Lost visibility of previously accessible documents**
- ❌ **Cannot verify migration worked**
- ❌ **Blocks migration of remaining 3,849 documents**

---

## 📋 Migration Architecture Overview

### **Goal**
Migrate library documents from database `content` column to markdown files with YAML frontmatter, mirroring the anarchist library architecture.

### **Why Migrate?**
1. **Consistency**: Anarchist library uses file-based storage (24,643 docs)
2. **Version Control**: Files can be tracked in git
3. **Portability**: Easier to backup, migrate, and share
4. **Separation**: Content separated from database for performance
5. **Flexibility**: Files can be edited outside the application

### **Architecture Design**

#### Database Schema Changes
Added `file_path` column to `library.library_documents`:
```sql
ALTER TABLE library.library_documents
ADD COLUMN file_path TEXT;

-- Examples:
-- file_path: 'the-emotion-machine.md'
-- file_path: 'mutual-aid-a-factor-of-evolution.md'
```

#### File Structure
```
data/library/documents/
├── the-emotion-machine.md
├── mutual-aid-a-factor-of-evolution.md
├── the-conquest-of-bread.md
└── ... (flat directory, slug.md naming)
```

#### File Format
YAML frontmatter + markdown content:
```markdown
---
id: 5
slug: the-emotion-machine
title: The Emotion Machine
author: Marvin Minsky
publication_date: 2006-01-01
document_type: document
language: en
description: The Emotion Machine presents a new model of human cognition...
view_count: 2
status: published
word_count: 2000
reading_time_minutes: 8
---
# The Emotion Machine

## Introduction

This groundbreaking work challenges conventional views...
```

#### Dual-Read Logic (Already Implemented)
The library service supports both file-based and database content:

```typescript
// 1. Try file-based storage first (new system)
if (document.file_path) {
  try {
    const fileContent = await libraryFileService.getDocumentContent(document.file_path);
    if (fileContent) {
      const { frontmatter, contentWithoutFrontmatter } =
        libraryFileService.parseFrontmatter(fileContent);
      content = contentWithoutFrontmatter;
    }
  } catch (error) {
    logger.error('Error reading document file', { file_path: document.file_path });
  }
}

// 2. Fallback to database content (old system)
if (!content && document.content) {
  content = document.content;
}
```

This allows **gradual migration** without breaking existing documents.

---

## ✅ What's Working

### Migration Script
- ✅ **Script exists**: `frontend/scripts/library/migrate-to-files.js`
- ✅ **PDF cleanup**: Removes page numbers, headers, OCR artifacts
- ✅ **YAML generation**: Preserves all metadata
- ✅ **Atomic writes**: Temp file → rename for safety
- ✅ **Verification**: Can read back and validate files
- ✅ **Database updates**: Populates `file_path` column

**Usage**:
```bash
cd frontend
node scripts/library/migrate-to-files.js --limit 10 --verify
```

**Options**:
- `--dry-run`: Simulate without writing files
- `--limit N`: Process only first N documents
- `--resume-from-id N`: Resume from document ID N
- `--verify`: Read back and verify content
- `--skip-cleanup`: Skip PDF artifact cleanup

### Infrastructure Fixes (Deployed)
- ✅ **API route validation**: `/api/documents` recognizes `migration_status` sort
- ✅ **Library service sorting**: Implements CASE WHEN for file_path ordering
- ✅ **TypeScript types**: Added `migration_status` to all relevant interfaces
- ✅ **UI dropdown**: "🗂️ Migration Status (File-based First)" option visible

### Database Verification
```sql
-- Check migrated documents
SELECT id, title, file_path
FROM library.library_documents
WHERE file_path IS NOT NULL;

-- Result: 10 rows ✅
```

### Docker Container Verification
```bash
docker exec m4s0kwo4kc4oooocck4sswc4 ls -la /app/data/library/documents/

# Result: 10 markdown files exist ✅
```

### API Verification
```bash
curl 'http://localhost:3000/api/documents?source=library&sort_by=migration_status&limit=50' \
  | jq '.data.documents[] | select(.file_path != null) | {id, title}'

# Result: Returns all 10 migrated documents ✅
```

---

## ❌ What's Broken

### Frontend Visibility Issue (CRITICAL)
**Problem**: Despite API returning all documents, UI shows only 3.

**Symptoms**:
1. Library page shows 3 documents total (down from ~7 previously)
2. These 3 are NOT the ones we migrated
3. Migration status sort shows only these 3 documents
4. All other documents (including the 10 migrated ones) are invisible

**Verified Working**:
- ✅ Database has 3,859 total documents
- ✅ Database has 10 documents with `file_path` populated
- ✅ API returns correct data when queried directly
- ✅ Files exist in Docker container

**Not Working**:
- ❌ Frontend receives/displays only 3 documents
- ❌ React state may not be updating correctly
- ❌ Client-side filtering may be too aggressive
- ❌ Virtualization hook may be caching stale data

**Investigation Needed**:
1. Check `LibraryPageClient` state in React DevTools
2. Check network requests in browser DevTools
3. Check `useVirtualizedDocuments` cache
4. Check `filteredDocuments` useMemo logic
5. Test with different user accounts/auth states

---

## 📝 Migration Test Results

### Test Run: 10 Documents (November 21, 2025)

**Migrated Document IDs**: 5, 7, 8, 13, 15, 19, 163, 164, 165, 166

**Document Details**:
| ID  | Title | Word Count | File Size | Status |
|-----|-------|------------|-----------|--------|
| 5   | The Emotion Machine | 2000 | 16KB | ✅ Migrated |
| 7   | Mutual Aid: A Factor of Evolution | 1263 | 11KB | ✅ Migrated |
| 8   | The Conquest of Bread | 42 | 781B | ✅ Migrated |
| 13  | Critical Consciousness in Education | 1812 | 16KB | ✅ Migrated |
| 15  | Neural Networks and Deep Learning | 1542 | 13KB | ✅ Migrated |
| 19  | Workplace Democracy Implementation Guide | 2134 | 19KB | ✅ Migrated |
| 163 | 100 Years Ago The Philadelphia dockers strike... | 8234 | 72KB | ✅ Migrated |
| 164 | 13340-29558-1-PB-1 | 11456 | 104KB | ✅ Migrated |
| 165 | 13340-29558-1-PB | 9876 | 89KB | ✅ Migrated |
| 166 | 1892 New Orleans General Strike | 1823 | 16KB | ✅ Migrated |

**Migration Log**:
```
Processing document 5: "The Emotion Machine"
  File path: the-emotion-machine.md
  Word count: 2000 words (8 min read)
  Metadata fields: 12
  ✓ File written successfully
  ✓ Database updated with file_path
  ✓ Verification passed

[... 9 more documents ...]

Migration Complete
==========================================
Total documents: 10
Migrated: 10
Failed: 0
Duration: 12.3s
```

**Database Verification Queries**:
```sql
-- All 10 documents have file_path
SELECT COUNT(*) FROM library.library_documents WHERE file_path IS NOT NULL;
-- Result: 10 ✅

-- Metadata preserved
SELECT id, title, author, publication_date, language, status
FROM library.library_documents
WHERE id IN (5, 7, 8, 13, 15, 19, 163, 164, 165, 166);
-- Result: All metadata intact ✅
```

---

## 🐛 Known Bugs Fixed (But Didn't Solve Visibility)

### Bug #1: API Route Missing migration_status
**File**: `src/app/api/documents/route.ts`
**Fix**: Added 'migration_status' to `validSortFields` array
**Commit**: `fa1a8aa`

### Bug #2: Library Service Missing migration_status
**File**: `src/lib/library/service.ts`
**Fix**: Added 'migration_status' to `validSortColumns` and implemented CASE WHEN sorting
**Commits**: `641a31e`, `5b4c68c`

### Bug #3: TypeScript Type Missing
**Files**: `src/lib/library/types.ts`, `src/app/library/LibraryPageClient.tsx`
**Fix**: Added 'migration_status' to union types
**Commit**: `5b4c68c`

---

## 📊 Current State Statistics

```sql
-- Total library documents
SELECT COUNT(*) FROM library.library_documents WHERE status='published';
-- Result: 3,859

-- Migrated documents
SELECT COUNT(*) FROM library.library_documents
WHERE status='published' AND file_path IS NOT NULL;
-- Result: 10

-- Documents by creator
SELECT created_by, COUNT(*)
FROM library.library_documents
WHERE status='published'
GROUP BY created_by;
-- created_by=3: 3,853 docs (library-importer)
-- created_by=1: 3 docs (admin)
-- created_by=9: 3 docs (user doesn't exist)
```

---

## ⚠️ Blockers & Risks

### **DO NOT Proceed Until Fixed**
- ❌ **Do not migrate more documents** - visibility issue will compound
- ❌ **Do not deploy to production** - library view is broken for users
- ❌ **Do not delete database content** - it's the only accessible copy

### **Risks If We Proceed**
1. **Data Loss**: Users can't access 3,856 documents
2. **User Confusion**: Library appears nearly empty
3. **Migration Reversal**: May need to restore from backup
4. **Performance Issues**: Debugging will be harder with 100s or 1000s of files

---

## 🔍 Investigation Checklist

### Frontend Debugging
- [ ] Inspect `LibraryPageClient` state in React DevTools
- [ ] Check `documents` array in state
- [ ] Check `filteredDocuments` output
- [ ] Check `selectedTags` and `selectedLanguage` filters
- [ ] Check `useVirtualizedDocuments` cache
- [ ] Test with filters disabled
- [ ] Test with migration_status sort vs title sort

### Network Debugging
- [ ] Check `/api/documents` response in Network tab
- [ ] Verify pagination.total matches database count (3,859)
- [ ] Check if multiple requests are fighting
- [ ] Check request parameters being sent
- [ ] Verify response data structure

### Backend Debugging
- [ ] Add logging to `libraryService.getDocuments()`
- [ ] Add logging to `unifiedDocumentService.getDocuments()`
- [ ] Check if unified view is merging correctly
- [ ] Verify SQL query returns expected results
- [ ] Check tag fetching doesn't filter documents

### Authentication/Permissions
- [ ] Test as unauthenticated user
- [ ] Test as admin user
- [ ] Test as library-importer user
- [ ] Check if `created_by` is being filtered
- [ ] Check if `is_public` is affecting visibility

---

## 📚 Related Files

### Migration Infrastructure
- `frontend/scripts/library/migrate-to-files.js` - Migration script
- `frontend/scripts/library/verify-migration.js` - Verification script
- `frontend/src/lib/library/file-service.ts` - File I/O operations
- `frontend/src/lib/library/service.ts` - Database queries & dual-read logic

### Types & Interfaces
- `frontend/src/lib/documents/types.ts` - Unified document types
- `frontend/src/lib/library/types.ts` - Library-specific types

### API Routes
- `frontend/src/app/api/documents/route.ts` - Unified documents endpoint
- `frontend/src/app/api/library/documents/route.ts` - Library-only endpoint

### Frontend Components
- `frontend/src/app/library/LibraryPageClient.tsx` - Main library UI
- `frontend/src/hooks/useVirtualizedDocuments.ts` - Document caching/virtualization

### Documentation
- `docs/sessions/LIBRARY_MIGRATION_FAILURE_NOV_21_2025.md` - Full session report
- `docs/features/anarchist-library/ANARCHIST_LIBRARY_ARCHITECTURE.md` - Reference architecture

---

## 🎯 Recommended Next Steps

### Immediate (Debug Visibility)
1. **Browser DevTools Investigation**
   - Open library page in browser
   - Check React DevTools → LibraryPageClient state
   - Check Network tab → `/api/documents` response
   - Compare API data vs rendered documents

2. **Add Comprehensive Logging**
   ```typescript
   // In LibraryPageClient.tsx
   useEffect(() => {
     console.log('[DEBUG] Documents state:', documents);
     console.log('[DEBUG] Filtered documents:', filteredDocuments);
     console.log('[DEBUG] Selected filters:', { selectedTags, selectedLanguage, sortBy });
   }, [documents, filteredDocuments, selectedTags, selectedLanguage, sortBy]);
   ```

3. **Test With Minimal Filters**
   - Clear all tags
   - Set language to 'all' instead of 'en'
   - Use 'title' sort instead of 'migration_status'
   - Check if documents appear

### Short-Term (Once Visibility Fixed)
1. Test migration on 100 documents
2. Verify all 100 appear in UI
3. Test sorting and filtering
4. Check performance with 100 files

### Long-Term (Production Migration)
1. Test on 1,000 documents
2. Monitor performance and memory usage
3. Create backup before full migration
4. Migrate all 3,859 documents
5. Verify integrity
6. Update documentation

---

**Status**: ❌ **BLOCKED - Visibility issue must be resolved first**
**Last Tested**: November 21, 2025
**Next Action**: Debug frontend state and document rendering
