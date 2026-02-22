# Known Issues & Pending Fixes

**Last Updated**: October 30, 2025

Minor issues that don't affect functionality but should be addressed for completeness.

## Table of Contents

- [Wiki API Completeness](#wiki-api-completeness)
- [Security Wrapper Consistency](#security-wrapper-consistency)
- [Documentation Completeness](#documentation-completeness)
- [Impact Assessment](#impact-assessment)

---

## Wiki API Completeness

### Issue #1: Missing GET Endpoint for Individual Category

**File**: `frontend/src/app/api/wiki/categories/[id]/route.ts`

**Issue**: Only implements PATCH and DELETE methods

**Missing**: GET method to fetch individual category details

**Current Workaround**: Client must use list endpoint and filter

```typescript
// Current workaround
const categories = await fetch('/api/wiki/categories').then(r => r.json());
const category = categories.find(c => c.id === targetId);
```

**Recommended Fix**:

```typescript
// Add to frontend/src/app/api/wiki/categories/[id]/route.ts
export const GET = withSecurity(async (request, context) => {
  try {
    const params = await context.params;
    const category = wikiCategoryService.getCategoryById(params.id);

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return errorResponse(error);
  }
});
```

**Priority**: Medium

**Impact**: Low - List endpoint + filter works fine for current use cases

**Estimated Effort**: 10 minutes

---

## Security Wrapper Consistency

### Issue #2: Deprecated Routes Missing withSecurity Wrapper

**Files**:
- `frontend/src/app/api/wiki/templates/[id]/route.ts` (GET method)
- `frontend/src/app/api/wiki/infoboxes/[id]/route.ts` (GET method)

**Issue**: GET methods don't use `withSecurity()` wrapper, while other methods in the same files do

**Current State**:

```typescript
// Missing withSecurity() on GET
export async function GET(req, context) {
  // ... implementation
}

// Other methods properly wrapped
export const PATCH = withSecurity(async (req, context) => {
  // ... implementation
});
```

**Recommended Fix**:

```typescript
// Wrap GET handlers for consistency
export const GET = withSecurity(async (req, context) => {
  try {
    const params = await context.params;
    // ... existing implementation
  } catch (error) {
    return errorResponse(error);
  }
});
```

**Priority**: Low (routes are deprecated, templates/infoboxes features not in production use)

**Impact**: Missing security headers (CSP, HSTS), but routes are not actively used

**Note**: These routes are for deprecated features (wiki templates and infoboxes) that were removed in favor of simpler markdown-based wiki pages. Consider removing these routes entirely.

**Estimated Effort**: 5 minutes per route (or 10 minutes to remove both routes)

---

## Documentation Completeness

### Issue #3: Wiki Schema Documentation Gap

**File**: `docs/architecture/WIKI_ARCHITECTURE_COMPLETE.md`

**Issue**: `category_id` column not explicitly listed in `wiki_pages` table schema documentation

**Current Documentation**:

```markdown
## wiki_pages table
- id INTEGER PRIMARY KEY
- title TEXT NOT NULL
- slug TEXT UNIQUE NOT NULL
- content TEXT
- author_id INTEGER
- created_at TEXT
- updated_at TEXT
- is_public INTEGER DEFAULT 1
- view_count INTEGER DEFAULT 0
```

**Missing**: `category_id INTEGER REFERENCES wiki_categories(id)`

**Actual Database Schema** (correct in database):

```sql
CREATE TABLE wiki_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  category_id INTEGER REFERENCES wiki_categories(id),  -- Missing from docs
  author_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  is_public INTEGER DEFAULT 1,
  view_count INTEGER DEFAULT 0
);
```

**Recommended Fix**: Add `category_id INTEGER REFERENCES wiki_categories(id)` to column list in documentation

**Priority**: Low (documentation-only issue)

**Impact**: None - Column exists and functions correctly, just missing from documentation

**Estimated Effort**: 2 minutes

---

## Impact Assessment

### Critical Issues: 0
No issues prevent development or affect production functionality.

### High Priority Issues: 0
No issues that should be fixed before next deployment.

### Medium Priority Issues: 1
- **Wiki API Completeness** (#1): Missing GET endpoint for individual category

### Low Priority Issues: 2
- **Security Wrapper Consistency** (#2): Deprecated routes missing security wrappers
- **Documentation Completeness** (#3): Schema documentation gap

---

## Resolution Timeline

### Immediate (Next Development Session)
None required - all issues are non-blocking.

### Short Term (Next Sprint)
- [ ] Issue #1: Add GET endpoint for wiki categories
- [ ] Issue #2: Either wrap deprecated routes or remove them entirely

### Long Term (Future Cleanup)
- [ ] Issue #3: Update wiki architecture documentation
- [ ] Consider removing deprecated wiki template/infobox routes entirely

---

## How These Were Identified

All issues were identified during **wiki documentation verification** in October 2025 as part of the comprehensive documentation consolidation effort. They represent minor inconsistencies found during code review but do not affect current functionality or user experience.

---

## Reporting New Issues

If you discover a new issue:

1. **Check if it's a critical bug**: If yes, fix immediately
2. **Check if it affects users**: If yes, prioritize higher
3. **Document here**: Add to appropriate priority section
4. **Create TODO**: Add to project task list if fix required
5. **Update status**: Mark as resolved when fixed

### Issue Template

```markdown
### Issue #N: Brief Description

**File**: Path to affected file(s)

**Issue**: Detailed description of the problem

**Current Workaround**: How users can work around this

**Recommended Fix**: Code or steps to resolve

**Priority**: Critical / High / Medium / Low

**Impact**: How this affects users or development

**Estimated Effort**: Time to fix
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main development guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and fixes
- [COMMON_PITFALLS.md](./COMMON_PITFALLS.md) - Common mistakes to avoid
- [docs/README.md](./README.md) - Complete documentation index

---

**Note**: None of these issues affect current functionality or user experience. They represent opportunities for improved API completeness and documentation accuracy.
