# Session Changes - December 4, 2025

## Overview

This session addressed multiple improvements across the wiki, library, news, and authentication systems. All changes have been committed and deployed.

---

## 1. Wiki System Fixes

### 1.1 Journals Namespace Exclusion from Categories

**Problem**: Journal entries (namespace `journals`) were bleeding into the "Uncategorized" wiki category, showing 85 incorrectly counted pages.

**Root Cause**: The wiki category count queries didn't filter by namespace, so journals with `category_id = 'uncategorized'` were counted alongside regular wiki pages.

**Solution**: Added `AND p.namespace != 'journals'` filter to all category count queries in `WikiCategoryService.ts`.

**Files Modified**:
- `frontend/src/lib/wiki/services/WikiCategoryService.ts`

**Queries Updated**:
- `getAllCategories()` - page count subquery
- `getSubcategories()` - LEFT JOIN condition
- `getRootCategories()` - LEFT JOIN condition
- `getCategoryById()` - LEFT JOIN condition

### 1.2 Wiki Statistics Bar Hidden

**Change**: Temporarily hidden the wiki statistics bar on the main wiki page.

**File Modified**:
- `frontend/src/app/wiki/page.tsx` (lines 105-130 commented out)

**Note**: Statistics include total pages, views, active editors, and recent edits. Hidden with comment "TEMPORARILY HIDDEN" for easy restoration.

---

## 2. Library System Changes

### 2.1 All Documents Set to Hidden

**Purpose**: Enable manual curation of the library - slowly revealing documents over time.

**Action**: Database update to set all 2,575 library documents to `is_public = false`.

**Command Executed**:
```sql
UPDATE library.library_documents SET is_public = false WHERE is_public = true;
-- Result: UPDATE 2575
```

**How to Reveal Documents**:
- Use the library's built-in visibility toggle (Tab key with documents selected in admin view)
- Or run SQL: `UPDATE library.library_documents SET is_public = true WHERE slug = 'document-slug'`

### 2.2 Tag Visibility Filtering

**Problem**: Tags were visible to all users even when no public documents existed with those tags.

**Solution**: Updated tag API to filter tags based on user role and document visibility.

**Files Modified**:
- `frontend/src/app/api/library/tags/route.ts` - Added visibility filtering logic
- `frontend/src/app/library/page.tsx` - Pass user role to tag API
- `frontend/src/app/library/LibraryPageClient.tsx` - Pass user role in client-side tag refresh

**Behavior**:
| User Role | Tags Visible |
|-----------|--------------|
| Admin/Moderator | All 884 tags |
| Standard User/Guest | Only tags with public documents (currently 0) |

**Implementation**:
```typescript
// Tag API now accepts optional userRole query parameter
// Server-side: /api/library/tags?userRole=admin
// Client-side: Falls back to session-based role detection

// Query filters tags by document visibility for non-privileged users:
WHERE ld.is_public = true  // Only for non-admin/moderator
```

---

## 3. News System Improvements

### 3.1 Mobile Layout Optimization

**Problem**: News cards had layout issues on mobile - tags wrapped, author/read-more took space, dates were too long.

**Solution**: Complete redesign of news card mobile layout.

**File Modified**:
- `frontend/src/components/news/NewsArticlesList.tsx`

**Changes**:
| Element | Desktop | Mobile |
|---------|---------|--------|
| Card | Clickable article | Entire card is Link (clickable) |
| Date | Full format (October 13, 2025) | Short format (Oct 13) |
| Author | Shown with separator | Hidden |
| Tags | All shown, wrap | Max 4 shown, +N overflow, no wrap |
| Read more | Shown | Hidden (card is clickable) |
| Text sizes | Normal | Smaller for better fit |

### 3.2 Article Icon Selector

**Problem**: No way to select icons when creating news articles. Icons were determined by first tag.

**Solution**: Added visual icon picker to Create Article page.

**File Modified**:
- `frontend/src/app/news/create/page.tsx`

**Available Icons** (10 total):
- Announcement, Update, Features, Development, Security
- Performance, Community, Documentation, Welcome, Platform

**Behavior**:
- Selected icon becomes the primary tag (determines card icon)
- Additional tags can be added separately
- Icon buttons show labels on desktop, icons only on mobile

---

## 4. Authentication Fix

### 4.1 Registration Form Zod Errors

**Problem**: Uncaught Zod validation errors appearing in browser console when opening registration form.

**Error Example**:
```
Uncaught (in promise) ZodError: [
  { "path": ["username"], "message": "Username must be at least 3 characters" },
  { "path": ["invitation_token"], "message": "Invitation token is required" },
  ...
]
```

**Root Causes**:
1. `invitation_token` field missing from form default values (but required by schema)
2. Validation mode `onBlur` triggered validation too early

**Solution**:
- Added `invitation_token: ''` to form default values
- Changed validation mode from `onBlur` to `onSubmit`

**File Modified**:
- `frontend/src/lib/forms/hooks.ts` (`useRegisterForm` function)

---

## Commits

| Commit | Description |
|--------|-------------|
| `15bbda4` | Improve mobile layouts, library curation, and wiki fixes |
| `39453da` | Fix uncaught Zod validation errors in registration form |

---

## Database Changes (Production)

```sql
-- Library documents hidden for curation
UPDATE library.library_documents SET is_public = false WHERE is_public = true;
-- Affected: 2,575 rows
```

---

## Deployment

All changes auto-deployed via Coolify after `git push origin main`.

---

## Testing Checklist

- [ ] Wiki categories no longer show journal content in counts
- [ ] Wiki statistics bar is hidden
- [ ] Library shows no documents to non-admin users
- [ ] Library tag sidebar is empty for non-admin users
- [ ] Admins see all documents and tags in library
- [ ] News cards display properly on mobile (320px width)
- [ ] News article creation has working icon selector
- [ ] Registration form no longer throws console errors
- [ ] Registration form validates on submit, not on blur

---

## Related Documentation

- [Library System Architecture](../features/anarchist-library/ANARCHIST_LIBRARY_ARCHITECTURE.md)
- [Wiki Documentation](../wiki/README.md)
- [Form Validation Schemas](../../frontend/src/lib/forms/schemas.ts)
