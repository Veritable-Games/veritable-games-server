# Gallery Audit Scripts - Quick Reference

## Overview

Two scripts are available for maintaining gallery database-disk synchronization:

| Script | Purpose | Changes DB? | Changes Disk? |
|--------|---------|-----------|--------------|
| `safe_gallery_audit.js` | Audit only - identify mismatches | ❌ No | ❌ No |
| `cleanup_missing_files_safe.js` | Remove orphaned DB records | ✅ Yes | ❌ No |

## Script 1: Safe Gallery Audit

**Purpose**: Read-only audit to identify file/database mismatches

**Usage**:
```bash
cd frontend
node safe_gallery_audit.js
```

**What it does**:
1. Reads all gallery image records from database
2. Checks each file exists on disk
3. Checks each file on disk has a DB record
4. Generates comprehensive report

**Output format**:
```
CONCEPT-ART
====================================================================================================

✓ cosmic-knights
   Directory: EXISTS
   DB (active): 2 | DB (soft-deleted): 0 | Disk: 2

⚠️ dodec
   Directory: EXISTS
   DB (active): 27 | DB (soft-deleted): 2 | Disk: 29
   ⚠️  ORPHANED ON DISK (2 files have no DB records):
      - image_1761476553368_4da2cabd074aea4a.png (5.44MB)
      - image_1761476603961_1b488b636def1b72.png (1.31MB)
```

**Understanding the report**:
- ✓ = Project is fully synced
- ⚠️ = Mismatches detected
- `❌ MISSING FROM DISK` = DB record but file doesn't exist (needs cleanup)
- `⚠️ ORPHANED ON DISK` = File exists but no DB record (investigate)

**About "Orphaned" Files**:
Most "orphaned" files are actually soft-deleted images that are expected:
- User deleted image → `is_deleted = 1` in DB
- File remains on disk for 30-day grace period
- File will be cleaned up by periodic cleanup script
- This is normal and expected behavior

## Script 2: Cleanup Missing Files

**Purpose**: Remove database records that reference files no longer on disk

**Usage**:
```bash
cd frontend
node cleanup_missing_files_safe.js
```

**What it does**:
1. Identifies DB records with missing files (file_path not found on disk)
2. Creates backup of current database
3. Deletes only the orphaned records
4. Reports count of deleted records

**Example output**:
```
Found 16 orphaned DB records (files missing from disk)
==================================================

Records to delete:
  - ID 562: concept-art/dodec
  - ID 563: concept-art/dodec
  ... (13 more)
  - ID 1131: concept-art/project-coalesce
  - ID 1132: concept-art/project-coalesce
  - ID 1154: concept-art/project-coalesce

Creating backup: content.backup-before-cleanup-1761509498591.db
✓ Backup created

Deleting orphaned records...
✓ Deleted 16 orphaned DB records

Final record count: 1148
✅ Cleanup complete
```

**When to run**:
- After investigating mismatches from audit script
- When you need to clean up records for deleted files
- Not for soft-deleted images (they belong there)

## Workflow: Complete Audit & Cleanup

### Step 1: Run Audit
```bash
cd frontend
node safe_gallery_audit.js
```

Review the output to understand:
- Are there missing files? (DB records for non-existent files)
- Are there orphaned files? (files with no DB records)
- How many files match soft-deleted records?

### Step 2: Review Missing Files
If the audit shows `❌ MISSING FROM DISK` entries:
- Note the project and image IDs
- Check if files were intentionally deleted
- These records should be cleaned up

### Step 3: Run Cleanup (if needed)
```bash
cd frontend
node cleanup_missing_files_safe.js
```

The script will:
- Find all missing files from Step 2
- Create a backup automatically
- Delete the orphaned DB records
- Report the final count

### Step 4: Verify
Run audit again to confirm:
```bash
cd frontend
node safe_gallery_audit.js
```

Expected result:
- No ❌ MISSING FROM DISK entries
- All projects show ✓ or just show soft-deleted files (expected)
- Database and disk are synced

## Understanding Soft-Deleted Images

The key insight: **Orphaned files on disk are USUALLY soft-deleted images**

### Soft-Delete Flow
```
User deletes image in gallery UI
         ↓
DELETE /api/projects/[slug]/references/[imageId]
         ↓
Image marked: is_deleted = 1 in database
         ↓
File remains on disk (for now)
         ↓
Gallery queries hide image (WHERE is_deleted = 0)
         ↓
User sees image as deleted (but can undo within grace period)
         ↓
After 30 days: cleanup script removes file from disk + DB
```

### Verification
If soft-deleted count matches orphaned file count, that's healthy:
```
✓ autumn (references)
  DB (active): 78 | DB (soft-deleted): 46 | Disk: 124
  Orphaned on disk: 46 files

46 soft-deleted records = 46 orphaned files ✓
This is NORMAL and EXPECTED
```

## Troubleshooting

### Issue: "MISSING FROM DISK" entries
**Cause**: File was deleted from disk but DB record still exists
**Action**: Run `cleanup_missing_files_safe.js` to remove orphaned records

### Issue: Orphaned files don't match soft-deleted count
**Cause**: Files exist on disk with no DB record (or soft-deleted record)
**Action**:
1. Investigate where files came from
2. Either add DB records or delete files manually
3. Run audit again to verify

### Issue: Disk space keeps growing
**Cause**: Soft-deleted files accumulate and are never cleaned up
**Action**: Set up periodic cleanup:
```bash
# Run cleanup script with aggressive 7-day policy
npm run gallery:cleanup:aggressive

# Or schedule nightly cleanup
0 2 * * * cd /home/user/Projects/web/veritable-games-main/frontend && npm run gallery:cleanup
```

### Issue: "Directory MISSING" error
**Cause**: DB records exist but the project directory doesn't exist
**Action**: Either create the directory or delete the DB records

## Performance Notes

- Audit script: ~1-5 seconds (reads 1,148 files + DB)
- Cleanup script: ~1-2 seconds (deletes only orphaned records)
- Both scripts are non-destructive initially, with audit being read-only

## Safety Features

1. **Read-only by default** - Audit script never modifies anything
2. **Automatic backups** - Cleanup creates timestamped backup before deleting
3. **Safe deletion** - Cleanup only removes records for files confirmed missing
4. **Human review** - Audit shows what will be deleted before cleanup runs

## Integration with App

Once the delete strategy UI components are integrated (from Session 2), the system will:

1. **User soft-delete**: Hide image, keep file for 30 days
2. **Admin hard delete**: Immediately remove file + DB record (irreversible)
3. **Nightly cleanup**: Remove old soft-deleted files after retention period
4. **Audit health**: Run audit monthly to verify sync

---

**Last Updated**: October 26, 2025
**Status**: ✅ Scripts tested and verified working
