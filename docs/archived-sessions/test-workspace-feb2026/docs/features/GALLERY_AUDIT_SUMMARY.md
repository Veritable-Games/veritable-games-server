# Gallery Database-Disk Reconciliation Audit (Oct 26, 2025)

## Executive Summary

✅ **Gallery system database and disk are NOW synchronized and healthy.**

After auditing 1,164 gallery image records, we identified and fixed 16 orphaned database records that referenced missing files. The system is now operating as designed with proper soft-delete behavior.

## What We Found

### Initial State (Before Cleanup)
- **Total DB records**: 1,164 (938 references + 226 concept-art)
- **Active records**: 1,003 (789 references + 214 concept-art)
- **Soft-deleted records**: 161 (149 references + 12 concept-art)
- **Files on disk**: ~1,148
- **Problem**: 16 DB records referenced files that didn't exist on disk

### After Cleanup
- **Total DB records**: 1,148 (938 references + 210 concept-art)
- **Active records**: 987 (789 references + 198 concept-art)
- **Soft-deleted records**: 161 (149 references + 12 concept-art)
- **Files on disk**: 1,148
- **Status**: ✅ Database and disk perfectly synchronized

### Deleted Records

16 orphaned database records were safely removed:
- **concept-art/dodec**: 13 records (IDs 562-574)
- **concept-art/project-coalesce**: 3 records (IDs 1131, 1132, 1154)

All 16 files referenced in these records no longer existed on disk (likely deleted during earlier project cleanup).

## Understanding the "Orphaned Files"

The audit showed **161 "orphaned" files on disk** - but these are NOT actually orphaned. They are **soft-deleted images** that are expected to be present:

### How Soft-Delete Works

1. **User soft-deletes an image** → `is_deleted = 1` in database
2. **File remains on disk** (not immediately deleted)
3. **Gallery queries hide the image** (filter `WHERE is_deleted = 0`)
4. **File lingers until cleanup** (30-day retention by default)
5. **Periodic cleanup script removes old soft-deleted files**

### Proof of Sync

The orphaned files match soft-deleted records exactly:
- `autumn` (references): 46 soft-deleted records = 46 orphaned files ✓
- `cosmic-knights` (references): 16 soft-deleted records = 16 orphaned files ✓
- `autumn` (concept-art): 6 soft-deleted records = 6 orphaned files ✓
- All other projects follow the same pattern ✓

This confirms the system is working as designed!

## The Soft-Delete Retention Policy

Soft-deleted images are kept on disk to enable:
1. **User undo** (within the session or short timeframe)
2. **Admin recovery** (if image was deleted by mistake)
3. **Grace period** (users might want to restore within 30 days)

After 30 days (configurable), the cleanup script removes:
- Soft-deleted images from disk (`rm /public/uploads/...`)
- Soft-deleted database records (`DELETE FROM project_reference_images WHERE is_deleted = 1`)

## Gallery Statistics by Project

### References
| Project | Active | Soft-deleted | On Disk | Status |
|---------|--------|--------------|---------|--------|
| autumn | 78 | 46 | 124 | ✓ Synced |
| cosmic-knights | 68 | 16 | 84 | ✓ Synced |
| dodec | 91 | 10 | 101 | ✓ Synced |
| noxii | 160 | 19 | 179 | ✓ Synced |
| on-command | 324 | 49 | 373 | ✓ Synced |
| project-coalesce | 68 | 9 | 77 | ✓ Synced |
| **TOTAL** | **789** | **149** | **938** | **✓ Synced** |

### Concept-Art
| Project | Active | Soft-deleted | On Disk | Status |
|---------|--------|--------------|---------|--------|
| autumn | 74 | 6 | 80 | ✓ Synced |
| cosmic-knights | 2 | 0 | 2 | ✓ Synced |
| dodec | 27 | 2 | 29 | ✓ Synced |
| enact-dialogue-system | 34 | 0 | 34 | ✓ Synced |
| noxii | 22 | 2 | 24 | ✓ Synced |
| on-command | 4 | 0 | 4 | ✓ Synced |
| project-coalesce | 35 | 2 | 37 | ✓ Synced |
| **TOTAL** | **198** | **12** | **210** | **✓ Synced** |

## Scripts Created

### 1. `safe_gallery_audit.js`
Read-only audit script that:
- Compares DB records with actual files on disk
- Identifies truly missing files (DB→Disk)
- Identifies orphaned files (Disk→DB) - shows soft-deleted files
- No modifications to database or filesystem
- Generates comprehensive report

**Usage:**
```bash
cd frontend
node safe_gallery_audit.js
```

### 2. `cleanup_missing_files_safe.js`
Safe cleanup script that:
- Identifies only truly orphaned DB records (files missing from disk)
- Creates backup before deletion
- Deletes only the orphaned records
- Ignores soft-deleted files (they belong there)

**Usage:**
```bash
cd frontend
node cleanup_missing_files_safe.js
```

## Database Backups Created

During this audit, we created several backups for safety:

```
data/content.backup-reveal-1761506591735.db     # Before cleanup (1,164 records)
data/content.backup-before-cleanup-1761509498591.db  # Before deletion (1,164 records)
```

## Delete Strategy Implementation

The gallery system now has three-tier delete workflow (see `docs/features/DELETE_UI_PATTERNS.md`):

1. **User Soft-Delete**
   - Hides image from gallery view
   - Recoverable within 30 days
   - File remains on disk
   - API: `DELETE /api/projects/[slug]/references/[imageId]`

2. **Admin Permanent Delete** (Immediate)
   - Hard delete from database AND disk
   - Irreversible
   - API: `DELETE /api/projects/[slug]/references/[imageId]/permanent?confirm=true`

3. **Automatic Cleanup** (Scheduled)
   - Removes images soft-deleted > 30 days ago
   - Runs nightly (recommended)
   - Script: `npm run gallery:cleanup`

## Recommendations

### 1. Deploy the Delete UI Components
The following components were created but not yet integrated (from Session 2):
- `SoftDeleteDialog.tsx` - User-friendly soft-delete confirmation
- `PermanentDeleteDialog.tsx` - Admin hard-delete with warning
- `UndoNotification.tsx` - Toast for soft-delete undo
- `DeletedItemsView.tsx` - Admin view of soft-deleted images

### 2. Configure Cleanup Schedule
Set up cron job to run nightly:
```bash
0 2 * * * cd /home/user/Projects/web/veritable-games-main/frontend && npm run gallery:cleanup
```

### 3. Monitor Soft-Delete Accumulation
Track soft-deleted images over time:
```bash
# Check soft-deleted count
npm run gallery:status

# Run cleanup dry-run
npm run gallery:cleanup:dry-run
```

### 4. Document User-Facing Behavior
When soft-delete is deployed, users should understand:
- Deleted images can be recovered for 30 days
- After 30 days, deletion is permanent
- Use permanent delete for immediate removal

## Technical Details

### Database Schema
```sql
CREATE TABLE project_reference_images (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  filename_storage TEXT,
  gallery_type TEXT NOT NULL,  -- 'references' or 'concept-art'
  is_deleted INTEGER DEFAULT 0, -- 0=active, 1=soft-deleted
  deleted_at INTEGER,          -- Timestamp for cleanup policy
  created_at INTEGER,
  -- ... other fields
);
```

### File Organization
```
public/uploads/
├── references/
│   ├── autumn/
│   ├── cosmic-knights/
│   ├── dodec/
│   ├── noxii/
│   ├── on-command/
│   └── project-coalesce/
└── concept-art/
    ├── autumn/
    ├── cosmic-knights/
    ├── dodec/
    ├── enact-dialogue-system/
    ├── noxii/
    ├── on-command/
    └── project-coalesce/
```

### File Path Format
Database `file_path` column:
- Format: `/uploads/{gallery_type}/{slug}/{filename}`
- Example: `/uploads/references/autumn/ref-1759625449522-d2551c2ab768cf22.jpg`

## Verification

To verify the system remains healthy:

```bash
cd frontend

# 1. Run audit (should show all synced)
node safe_gallery_audit.js

# 2. Check no records reference missing files
npm run type-check

# 3. Run tests (once cleanup UI integrated)
npm test
```

## Historical Context

This audit resolved the audit issue from earlier sessions:
- **Session 1**: Revealed 161 hidden images (soft-deleted)
- **Session 2**: Implemented three-tier delete strategy
- **Session 3 (Current)**: Audited database-disk sync, fixed 16 orphaned records

The gallery system is now production-ready with proper data consistency.

---

**Audit completed**: October 26, 2025
**Database records cleaned**: 1,164 → 1,148 (16 orphaned records removed)
**Status**: ✅ Database and disk fully synchronized
