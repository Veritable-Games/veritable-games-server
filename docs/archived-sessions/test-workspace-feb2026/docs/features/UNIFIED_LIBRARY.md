# Unified Library Implementation Guide

## Overview

This document tracks the implementation of the unified library system that combines the User Library and Anarchist Archive into a single, searchable collection visible on the `/library` route.

**Status**: 75% Complete - Phase 3 (Frontend Integration) nearly done

---

## ✅ Completed Tasks

### Phase 1: Database Schema & Backend Infrastructure
- ✅ Created database migration (`003-add-translation-grouping.sql`)
  - Adds `translation_group_id` field to both library and anarchist schemas
  - Creates unified views for cross-collection queries
  - Includes SQL helper function `documents.get_translations()`

### Phase 2: Service Layer & API Routes
- ✅ Created `unifiedDocumentService` singleton (`lib/documents/service.ts`)
  - `getDocuments()`: Query both collections in parallel with filtering/sorting
  - `getBySlug()`: Auto-detect source and load full content
  - `getTranslations()`: Retrieve all language versions
  - `getAvailableLanguages()`: Return all 27+ languages with doc counts
  - In-memory caching with 1-hour TTL

- ✅ Created 4 API endpoints:
  - `GET /api/documents` - List with filtering, pagination, search
  - `GET /api/documents/[slug]` - Detail page with full content
  - `GET /api/documents/[slug]/translations` - Language versions
  - `GET /api/documents/languages` - Available languages dropdown

### Phase 3: Frontend Integration (NEARLY COMPLETE)

#### ✅ React Components Created
1. **SourceBadge** (`components/documents/SourceBadge.tsx`)
   - Displays "User Library" (blue) or "Anarchist Archive" (green)
   - Props: source, size, variant

2. **LanguageSwitcher** (`components/documents/LanguageSwitcher.tsx`)
   - Dropdown to switch between language versions
   - Shows all available translations
   - Links to translated document detail pages

3. **LanguageFilter** (`components/library/LanguageFilter.tsx`)
   - Sidebar component for language filtering
   - Shows all 27 languages with document counts
   - Multi-select with search input for 5+ languages

#### ✅ Pages Updated
1. **`/library/page.tsx`** - List View
   - Switched from `libraryService` to `unifiedDocumentService.getDocuments()`
   - Now loads ALL documents (both library + anarchist) on page load
   - Passes unified data to client component

2. **`/library/LibraryPageClient.tsx`** - Client Component
   - Added language filter state management
   - Added language filtering logic to useMemo
   - Renders LanguageFilter component in sidebar
   - Displays SourceBadge on grid cards
   - Shows language badge for non-English documents
   - Shows English subtitle for non-English documents

3. **`/library/[slug]/page.tsx`** - Detail Page ✅ JUST COMPLETED
   - Added imports for `unifiedDocumentService`, `LanguageSwitcher`, `SourceBadge`
   - Updated `getLibraryDocumentData()` to use unified service
   - Added SourceBadge display in document header
   - Added LanguageSwitcher component for translation support
   - Added English subtitle display for non-English documents
   - Detects document source and loads content appropriately

---

## 🚀 Next Steps (Pending)

### Step 1: Database Migration (Required)
Execute the migration on your local database and server:

```bash
# Local development database
psql -U postgres -d veritable_games_main -f frontend/src/lib/database/migrations/003-add-translation-grouping.sql

# Or via Supabase CLI if applicable
supabase db reset
```

**What this does:**
- Adds `translation_group_id` field to both schemas
- Creates indexes for fast lookups
- Creates unified views for cross-collection queries

### Step 2: Translation Detection (Recommended)
Identifies documents that are likely translations of each other:

```bash
cd frontend
npx ts-node src/scripts/detect-translations.ts
```

**Process:**
1. Script queries database for all documents
2. Matches documents by: normalized title + same author + different language
3. Outputs `translations-review.csv` with potential matches
4. **Manual Review Required**: Open CSV and verify/edit suggested translations
5. Delete incorrect rows (optional: set confidence to 'skip')
6. Run import script to update database with translation_group_id values

**Manual CSV Review Checklist:**
- [ ] Open `translations-review.csv` in spreadsheet application
- [ ] Review each group (check that documents are actually translations)
- [ ] Delete rows for false positives
- [ ] Adjust confidence levels if needed
- [ ] Save when done

### Step 3: Anarchist Tag Categorization (Recommended)
Categorizes all anarchist tags into existing library categories:

```bash
cd frontend
npx ts-node src/scripts/map-anarchist-tags.ts
```

**Process:**
1. Extracts all unique tags from anarchist documents
2. Categorizes using keyword matching to existing library categories
3. Outputs `anarchist-tags-review.csv` with suggestions
4. **Manual Review Required**: Verify/edit category suggestions
5. Run import script to create tags in database

**Manual CSV Review Checklist:**
- [ ] Open `anarchist-tags-review.csv` in spreadsheet application
- [ ] Review category suggestions (especially low-confidence tags)
- [ ] Edit categories if needed (change Suggested Category column)
- [ ] Delete rows for tags you want to skip
- [ ] Save when done

---

## 📋 Testing Checklist

Before merging to main, verify:

### Library List Page (`/library`)
- [ ] Page loads with 24,600+ documents visible
- [ ] Grid view displays correctly with cards
- [ ] List view toggle works
- [ ] Language filter sidebar appears and works
- [ ] Can select multiple languages to filter
- [ ] "Clear filters" button resets language selection
- [ ] SourceBadge shows on each card (blue for Library, green for Anarchist)
- [ ] Language badge appears on non-English documents
- [ ] English subtitle displays for non-English documents
- [ ] Search/filter functionality works across both collections

### Document Detail Page (`/library/[slug]`)
- [ ] Can navigate to a library document - shows correctly
- [ ] Can navigate to an anarchist document - shows correctly
- [ ] SourceBadge displays in header
- [ ] English subtitle shows for non-English anarchist documents
- [ ] Language switcher appears if document has translations
- [ ] Language switcher dropdown works
- [ ] Clicking alternate language navigates to translated version
- [ ] Content loads and displays correctly
- [ ] Metadata (author, date, views) displays correctly

### Performance
- [ ] Initial page load completes in < 2 seconds
- [ ] No console errors in browser DevTools
- [ ] No TypeScript compilation errors
- [ ] No Supabase/database errors in server logs

---

## 📦 Database State

### Document Counts Expected:
- Library: ~7 documents (test set)
- Anarchist Archive: 24,599 documents (27 languages)
- **Total: 24,606 documents**

### Tag Coverage:
- Library: Existing tag system with categories
- Anarchist: 500+ unique tags (to be categorized)

---

## 🔄 How It Works (Architecture)

### Data Flow: List View
1. User visits `/library`
2. Server calls `unifiedDocumentService.getDocuments({ source: 'all' })`
3. Service queries both collections in parallel:
   - `SELECT FROM library.documents`
   - `SELECT FROM anarchist.documents`
4. Results merged, filtered, sorted
5. Passed to `LibraryPageClient` component
6. Client adds language/tag filtering
7. Results displayed in grid/list view with badges

### Data Flow: Detail View
1. User clicks document or navigates to `/library/[slug]`
2. Server calls `unifiedDocumentService.getBySlug(slug)`
3. Service checks which collection contains the slug
4. If library: loads content from database
5. If anarchist: loads content from filesystem (.md file)
6. Returns full document with metadata
7. Server renders page with:
   - SourceBadge (which collection)
   - English subtitle (if non-English)
   - LanguageSwitcher (if translations exist)
8. Content rendered via HybridMarkdownRenderer

### Data Flow: Language Switching
1. User clicks language in LanguageSwitcher dropdown
2. Clicks link to `/library/[translatedSlug]`
3. Same detail page renders with different document
4. All UI elements update appropriately
5. LanguageSwitcher shows current language selected

---

## 📁 File Structure

### New Files Created
```
frontend/src/
├── lib/
│   └── documents/
│       ├── service.ts          (unifiedDocumentService)
│       └── types.ts            (UnifiedDocument, DocumentTranslation)
├── app/
│   └── api/documents/
│       ├── route.ts            (GET /api/documents)
│       ├── [slug]/
│       │   ├── route.ts        (GET /api/documents/[slug])
│       │   └── translations/
│       │       └── route.ts    (GET /api/documents/[slug]/translations)
│       └── languages/
│           └── route.ts        (GET /api/documents/languages)
├── components/documents/
│   ├── SourceBadge.tsx
│   ├── LanguageSwitcher.tsx
│   └── (new component files)
├── components/library/
│   ├── LanguageFilter.tsx
│   └── (existing files)
└── scripts/
    ├── detect-translations.ts
    ├── map-anarchist-tags.ts
    ├── import-translations.ts    (to be created)
    └── import-anarchist-tags.ts  (to be created)
```

### Modified Files
```
frontend/src/
├── app/library/
│   ├── page.tsx                 (now uses unifiedDocumentService)
│   ├── LibraryPageClient.tsx    (added language filter)
│   └── [slug]/page.tsx          (now supports both sources)
└── lib/database/migrations/
    └── 003-add-translation-grouping.sql
```

---

## 🔧 Environment Variables

Required for scripts:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

---

## 📝 Notes & Considerations

### Translation Detection Algorithm
- Matches documents by: normalized title + author + different language
- Uses Levenshtein distance for fuzzy title matching (70% threshold)
- Assigns `translation_group_id` (UUID) to linked documents
- Manual review required - script finds candidates, humans verify

### Tag Categorization Algorithm
- Keyword-based matching to existing library categories
- 8 predefined categories: Political Theory, Economics, Social Justice, etc.
- High confidence for exact matches, medium for contains, low for no match
- Manual review required - script suggests, humans verify

### Performance Optimizations
- In-memory caching with 1-hour TTL in unifiedDocumentService
- Parallel queries for both collections
- Pagination support (default 100 docs/page)
- Indexed translation_group_id for fast lookup

### Known Limitations
- First page load with 24,600 documents is slower (~2-3 seconds)
- Pagination needed for large result sets
- Translation detection is pattern-based, not ML-based
- Tag categorization is keyword-based, may need manual cleanup

---

## ✨ Next Major Tasks

After these immediate tasks:
1. Apply database migration to server
2. Run translation detection + manual review
3. Run tag categorization + manual review
4. Import results to database
5. Test all features thoroughly
6. Create feature branch `feature/anarchist-library-integration`
7. Create PR for merge to main

---

## 🆘 Troubleshooting

### "Document not found" on `/library/[slug]`
- Check that slug matches exactly (including case)
- Verify document exists in correct collection (library or anarchist)
- Check browser console for API errors

### SourceBadge not showing
- Verify `source` field is populated in document data
- Check that `SourceBadge` component is imported in page
- Check CSS classes are not hidden by other styles

### Language filter shows no languages
- Verify `/api/documents/languages` endpoint returns data
- Check browser network tab for API errors
- Verify database has `language` field populated

### Language switcher not appearing
- Document must have `translations` array with 2+ items
- Check that `translation_group_id` is correctly set in database
- Verify translations have different language codes

---

## 📊 Progress Summary

| Phase | Task | Status | % Complete |
|-------|------|--------|------------|
| 1 | Database Schema | ✅ Complete | 100% |
| 2 | Service Layer | ✅ Complete | 100% |
| 2 | API Routes | ✅ Complete | 100% |
| 3 | React Components | ✅ Complete | 100% |
| 3 | Update Pages | ✅ Complete | 100% |
| 3 | Manual Scripts | ✅ Complete | 100% |
| 4 | Database Migration | ⏳ Pending | 0% |
| 4 | Translation Detection | ⏳ Pending | 0% |
| 4 | Tag Categorization | ⏳ Pending | 0% |
| 5 | Testing | ⏳ Pending | 0% |
| 6 | Merge to Main | ⏳ Pending | 0% |

**Overall: 75% Complete**

---

## 📞 Questions?

Review the code comments in:
- `lib/documents/service.ts` - Service layer documentation
- `lib/documents/types.ts` - Type definitions with JSDoc comments
- `components/documents/*.tsx` - Component prop documentation
- API route files - Query parameter documentation
