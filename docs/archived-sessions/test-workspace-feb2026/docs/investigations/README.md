# Active Investigations

This directory contains ongoing and unresolved investigations into issues in the Veritable Games codebase.

---

## Current Open Issues

### 1. Wiki Category Pages Not Loading

**File**: `WIKI_CATEGORY_PAGES_INVESTIGATION_NOVEMBER_2025.md`
**Status**: ❌ **UNRESOLVED**
**Severity**: HIGH - Core feature broken
**Last Updated**: November 14, 2025

**Problem**:
- Category pages show "This category doesn't exist" error
- API endpoints work correctly
- Database has correct data
- Same code works on localhost with SQLite

**Attempted Fixes** (All Failed):
- ❌ 27aeaba: Auth consolidation
- ❌ af569b3: PostgreSQL GROUP BY fix
- ❌ 3b629bb: Next.js standalone startup
- ❌ 7eaa39a: Make wiki public (side effect: exposed wiki publicly)
- ❌ 19b4de4: Simplify GROUP BY

**Blocks**:
- Users cannot browse wiki categories
- Category pages remain non-functional
- Root cause unidentified

**Next Steps**:
1. Add debug logging to `WikiPageService.getAllPages()`
2. Trace actual PostgreSQL queries being executed
3. Compare behavior between localhost (SQLite) and production (PostgreSQL)
4. Check if page filters (`status`, `is_public`) are rejecting all pages

---

## Investigation Template

When adding a new investigation:

```markdown
### N. [Issue Title]

**File**: `ISSUE_NAME_YYYY_MM_DD.md`
**Status**: BLOCKED / UNRESOLVED / UNDER INVESTIGATION
**Severity**: CRITICAL / HIGH / MEDIUM / LOW
**Last Updated**: YYYY-MM-DD

**Problem**:
- [Description of user-facing issue]
- [Impact on functionality]

**Attempted Fixes**:
- ❌ [Commit hash]: [Fix description] (Why it failed)

**Blocks**:
- [What can't be done because of this issue]

**Next Steps**:
1. [Step 1]
2. [Step 2]
```

---

## Key Principles

When investigating:

1. **Identify root cause FIRST** - Don't guess at fixes
2. **Test user-facing feature** - Not just APIs or components
3. **Add debug logging** - Trace actual behavior
4. **Compare environments** - localhost vs production
5. **Get explicit confirmation** - User must test and approve

---

## Related Documentation

- See `/docs/archive/` for past failed investigations
- See `/docs/TROUBLESHOOTING.md` for known issues and workarounds
- See `CLAUDE.md` for critical warnings about claiming success
