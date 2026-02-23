# Documentation Archive

This directory contains investigative documents, analysis files, and past troubleshooting efforts. These are preserved for historical reference and to prevent repeating failed approaches.

**Status**: Most files here represent investigations that did NOT lead to solutions.

---

## Directory Structure

### `/analysis/`
**Investigative documentation and code analysis**
- `ANALYSIS_INDEX.md` - Index of analysis work
- `ANALYSIS_SUMMARY.md` - Summary of findings
- `ARCHITECTURE_ANALYSIS.md` - Architecture review
- `ARCHITECTURAL_COMPARISON_ANALYSIS.md` - Comparison of architectural approaches
- `ARCHITECTURE_BUG_SUMMARY.md` - Summary of bugs found during architectural review
- `README_ANALYSIS.md` - Analysis of README and documentation
- `QUICK_FINDINGS.md` - Quick reference findings

These represent deep dives into the codebase trying to understand specific problems.

### `/bugs/`
**Bug fix attempts and implementation guides**
- `BUG_FIX_CODE_LOCATIONS.md` - Where bugs were found in code
- `FIX_IMPLEMENTATION_GUIDE.md` - How fixes were attempted

**Status**: These fixes were attempted but did not resolve the issues they were meant to fix.

### `/visibility-filters/`
**Deep analysis of visibility filter system (wiki page filtering)**
- `FILTERING_PATTERN_COMPARISON.md` - Comparison of different filtering approaches
- `VISIBILITY_FILTER_ANALYSIS.md` - Detailed analysis of visibility filter logic
- `VISIBILITY_FILTER_CODE_COMPARISON.md` - Code comparisons of filter implementations
- `VISIBILITY_FILTER_COMPONENT_TREE.md` - Component hierarchy and filter flow
- `VISIBILITY_FILTER_INDEX.md` - Index of visibility filter documentation
- `VISIBILITY_FILTER_SUMMARY.md` - Summary of findings
- `VISIBILITY_FILTER_VISUAL_GUIDE.md` - Visual guide to filter system
- `VISUAL_COMPARISON.md` - Visual comparisons of behavior

**Purpose**: Extensive investigation into why wiki page filtering was not working as expected.

---

## Key Investigations

### Wiki Category Pages (November 2025)
**Issue**: Category pages show "doesn't exist" error despite categories existing in database

**Status**: ❌ UNRESOLVED
- See: `/docs/investigations/WIKI_CATEGORY_PAGES_INVESTIGATION_NOVEMBER_2025.md`
- Multiple fixes attempted (af569b3, 3b629bb, 7eaa39a, 19b4de4) - all failed
- API endpoints work, but web pages don't - indicates component/service layer issue
- Root cause never identified

**What was tried**:
1. Auth consolidation (27aeaba) - didn't work
2. PostgreSQL GROUP BY fix (af569b3) - didn't work
3. Next.js standalone startup (3b629bb) - didn't work
4. Make wiki public (7eaa39a) - exposed wiki, didn't fix pages
5. Simplify GROUP BY (19b4de4) - didn't work

**What we learned**: Fixing "likely" causes without understanding root cause wastes time

---

## Lessons Learned

### What NOT To Do

❌ Test API endpoints and assume the feature is fixed
❌ Fix educated guesses about root cause without confirmation
❌ Claim success on intermediate fixes without user testing
❌ Assume localhost behavior matches production
❌ Make architecture changes (like PUBLIC_PATHS) as quick fixes

### What TO Do

✅ Identify ROOT CAUSE before fixing
✅ Add debug logging to trace actual problem
✅ Test end-to-end user feature, not just components
✅ Get explicit user confirmation the feature works
✅ Document what actually worked (or didn't)

---

## Important Files to Review

If you're facing a similar issue:

1. **Start here**: `/docs/investigations/WIKI_CATEGORY_PAGES_INVESTIGATION_NOVEMBER_2025.md`
   - Documents the failed investigation thoroughly
   - Lists all attempted fixes
   - Explains why each one failed

2. **Then check**: The relevant investigation subdirectory
   - If it's a visibility filter issue → check `/visibility-filters/`
   - If it's a bug in code → check `/bugs/`
   - If it's general architecture → check `/analysis/`

3. **Key takeaway**: These files represent problems that REMAIN UNSOLVED
   - Don't repeat the same attempted fixes
   - Instead, focus on root cause analysis
   - Add debug logging to understand actual behavior

---

## Timeline

- **November 13, 2025**: Multiple Claude instances attempt 4 different fixes for wiki category pages - all fail
- **November 14, 2025**: Investigation consolidated and documented
- **Ongoing**: These files remain as reference for what NOT to do

---

## Future Work

When approaching problems documented in this archive:

1. Read the investigation thoroughly
2. Understand why previous fixes failed
3. Add debug logging to identify root cause
4. Test end-to-end, not just components
5. Get user confirmation before claiming success
