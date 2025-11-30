# Documentation Naming Audit - I Made a Mess
**Created:** November 30, 2025
**Problem:** Inconsistent, confusing documentation naming across the server

---

## The Problem

I've been creating documentation files with:
- **Inconsistent date formats** (`NOV_21_2025` vs `NOVEMBER_15_2025` vs `NOV10`)
- **Duplicate/overlapping names** (multiple "SUMMARY" files for same topic)
- **Unclear versioning** (`_v2`, `FINAL_`, `COMPLETE_`)
- **Random capitalization** (`SESSION_SUMMARY` vs `session_summary`)
- **No clear "latest" indicator**

---

## Worst Offenders

### Example 1: NSD Sourcing (6 files for ONE topic!)
```
/home/user/projects/veritable-games/resources/logs/nsd-cleanup/phase3/
├── consolidated_nsd_report.md              ← Which one is current?
├── FINAL_SOURCING_SUMMARY_300_MILESTONE.md ← This says "FINAL"
├── NSD_SOURCING_DETAILED_REPORT.md         ← This says "DETAILED"
├── nsd_sourcing_summary.md                 ← lowercase version?
├── SOURCING_STATUS_UPDATE.md               ← Is this newer?
└── SOURCING_SUMMARY.md                     ← Different from above?
```

**Problem:** No way to know which is authoritative or most recent without opening each file!

### Example 2: Date Format Chaos
```
✅ Good (ISO):          2025-11-27
❌ Inconsistent mix:
   - SESSION_NOVEMBER_27_2025_DEPLOYMENT_INVESTIGATION.md  (full month name)
   - CLEANUP_SUMMARY_NOV_21_2025.md                        (abbreviated)
   - LAPTOP_SSH_RECOVERY_ATTEMPT_NOVEMBER_15_2025.md       (full again)
   - VAR_DRIVE_FAILURE_INCIDENT_NOV27_2025.md              (no underscores)
   - NOVEMBER_14_2025_SESSION_SUMMARY.md                   (date first)
   - SESSION_COMPLETION_SUMMARY_NOV10.md                   (no year, no day separator)
```

### Example 3: "SUMMARY" Overload (164+ files!)
Just grep for "SUMMARY" finds 164 files. Examples:
- `SESSION_SUMMARY.md` (9 different files)
- `CLEANUP_SUMMARY.md` (7 different locations)
- `IMPLEMENTATION_SUMMARY.md` (appears everywhere)
- `FINAL_SESSION_SUMMARY_NOV_20_2025.md` vs `SESSION_SUMMARY.md` (same directory!)

### Example 4: Unclear Versioning
```
PERFORMANCE_AUDIT_REPORT.md
PERFORMANCE_AUDIT_REPORT_v2.md          ← Is v2 newer?
SECURITY_AUDIT_REPORT.md                ← In 3 different directories!
SECURITY_AUDIT_REPORT_v2.md
```

### Example 5: Confusing Prefixes
```
FINAL_SOURCING_SUMMARY_300_MILESTONE.md
FINAL_SESSION_SUMMARY_NOV_20_2025.md
FINAL_ARCHITECTURAL_SUMMARY.md

← Are these actually final? Or did I create more after?
```

---

## Root Cause Analysis

**Why this happened:**

1. **No naming convention established** at start
2. **Context-switching between sessions** - forgot what I named things last time
3. **"Just one more report" syndrome** - kept adding files without cleaning up old ones
4. **Date format inconsistency** - sometimes abbreviated, sometimes full
5. **Multiple "latest" markers** - FINAL, COMPLETE, COMPREHENSIVE, v2, etc.

**Impact:**

- 🔴 **Can't find authoritative version** without checking timestamps
- 🔴 **Wasting disk space** on redundant reports
- 🔴 **Confusing for humans** - which file to read?
- 🟡 **Search pollution** - too many results for same topic

---

## Proposed Naming Standard

### Format
```
[TOPIC]_[YYYY-MM-DD]_[TYPE].md

Examples:
✅ NSD_SOURCING_2025-11-28_STATUS.md
✅ DEPLOYMENT_2025-11-27_INVESTIGATION.md
✅ PDF_CONVERSION_2025-11-29_REPORT.md
```

### Rules

**1. Topic (required):**
- Use project/feature name
- Snake_case or kebab-case (pick one!)
- Descriptive but concise

**2. Date (when temporal):**
- Always ISO format: `YYYY-MM-DD`
- Only if document is time-specific
- Omit for living documents that get updated

**3. Type suffix (required):**
- `STATUS` - Current state snapshot
- `REPORT` - Analysis/findings (completed work)
- `GUIDE` - How-to instructions
- `INDEX` - Navigation/master list
- `PLAN` - Future work blueprint
- `AUDIT` - Systematic review

**4. Version handling:**
- ❌ NO `_v2`, `_FINAL`, `_COMPLETE` suffixes
- ✅ Use dates or archive old versions
- ✅ Keep ONE current version per topic

**5. Location:**
- `/home/user/docs/[category]/` - server-level docs
- `/home/user/projects/[project]/docs/` - project-specific
- `/home/user/projects/[project]/resources/logs/` - execution logs
- Archive old versions to `archive/` subdirectory

---

## What Should Be Archived

### Criteria for archiving:
1. **Superseded by newer version** (same topic, older date)
2. **Completion reports** (work is done, historical value only)
3. **Session summaries** (unless part of ongoing work)
4. **Duplicate content** (consolidate first)

### Keep as "living documents":
1. **Guides** (e.g., `CLAUDE.md`, setup guides)
2. **Architecture docs** (unless obsolete)
3. **Master indexes** (SESSION_MASTER_INDEX.md)
4. **Current status** (latest STATUS files)

---

## Cleanup Strategy

### Phase 1: Audit Current State
```bash
# Find all SUMMARY files
find /home/user -name "*SUMMARY*.md" | wc -l
# Result: 164 files

# Find all REPORT files
find /home/user -name "*REPORT*.md" | wc -l
# Result: 91 files

# Find all SESSION files
find /home/user -name "*SESSION*.md" | wc -l
# Result: 36 files
```

### Phase 2: Identify Duplicates
For each topic area:
1. List all related files
2. Check timestamps/file sizes
3. Compare content (are they actually different?)
4. Identify "current" version
5. Archive rest

### Phase 3: Rename to Standard
```bash
# Example renaming:
mv "FINAL_SOURCING_SUMMARY_300_MILESTONE.md" \
   "NSD_SOURCING_2025-11-28_REPORT.md"

mv "SESSION_NOVEMBER_27_2025_DEPLOYMENT_INVESTIGATION.md" \
   "DEPLOYMENT_2025-11-27_INVESTIGATION.md"

mv "CLEANUP_SUMMARY_NOV_21_2025.md" \
   "SERVER_CLEANUP_2025-11-21_REPORT.md"
```

### Phase 4: Archive Old Versions
```bash
mkdir -p /home/user/docs/archive/2025-11/
mv [old dated reports] /home/user/docs/archive/2025-11/
```

### Phase 5: Create Master Index
```markdown
# Documentation Index
Last updated: 2025-11-30

## Current Documents
- [Server Setup](server/SETUP_GUIDE.md)
- [Deployment Status](deployment/DEPLOYMENT_2025-11-30_STATUS.md)
- [PDF Conversion](veritable-games/PDF_CONVERSION_2025-11-29_REPORT.md)

## Archives
- [November 2025](archive/2025-11/)
- [October 2025](archive/2025-10/)
```

---

## Recommended Actions

### Immediate (Next Session)
1. **Stop creating new files** with old naming pattern
2. **Use new standard** for any new docs created today
3. **Create cleanup plan** for existing files

### Short-term (This Week)
1. **Audit NSD sourcing docs** - consolidate to 1-2 files
2. **Audit session summaries** - archive completed sessions
3. **Rename high-traffic docs** to standard format

### Long-term (Next Month)
1. **Complete renaming** of all documentation
2. **Archive 2025** documents to year-month folders
3. **Enforce standard** via documentation checklist

---

## Example: How to Handle NSD Sourcing

**Current mess (6 files):**
```
consolidated_nsd_report.md              (47K, Nov 28)
FINAL_SOURCING_SUMMARY_300_MILESTONE.md (16K, Nov 28)
NSD_SOURCING_DETAILED_REPORT.md         (19K, Nov 28)
nsd_sourcing_summary.md                 (1.4K, Nov 28)
SOURCING_STATUS_UPDATE.md               (9.8K, Nov 27)
SOURCING_SUMMARY.md                     (7.3K, Nov 27)
```

**Proposed cleanup:**
```
# Keep ONE current version:
NSD_SOURCING_2025-11-28_REPORT.md  (consolidate best content from all 6)

# Archive the rest:
archive/2025-11/nsd-sourcing/
├── consolidated_nsd_report.md
├── FINAL_SOURCING_SUMMARY_300_MILESTONE.md
├── NSD_SOURCING_DETAILED_REPORT.md
├── nsd_sourcing_summary.md
├── SOURCING_STATUS_UPDATE.md
└── SOURCING_SUMMARY.md
```

---

## Prevention: Documentation Checklist

**Before creating a new .md file, ask:**

1. ☑ Does a file for this topic already exist?
   - If yes: Update it instead of creating new
2. ☑ Is this a dated snapshot or living document?
   - Snapshot: Include date in name
   - Living: Use topic name only
3. ☑ What type is this? (STATUS, REPORT, GUIDE, etc.)
   - Include type in filename
4. ☑ Am I using ISO date format? (YYYY-MM-DD)
   - Not "NOV10" or "NOVEMBER_15_2025"
5. ☑ Is the filename unique and descriptive?
   - Not generic like "SUMMARY.md"

---

## Summary

**Current state:** ~164 SUMMARY files, 91 REPORT files, inconsistent naming everywhere

**Impact:** Can't find current version, redundant files, confusing organization

**Solution:**
1. Adopt standard naming: `[TOPIC]_[YYYY-MM-DD]_[TYPE].md`
2. Archive superseded versions
3. Consolidate duplicates
4. Create master index

**Estimated effort:**
- Audit: 2-3 hours
- Renaming: 3-4 hours
- Archiving: 1-2 hours
- Index creation: 1 hour
- **Total: ~7-10 hours**

**This is embarrassing but fixable!** 😅
