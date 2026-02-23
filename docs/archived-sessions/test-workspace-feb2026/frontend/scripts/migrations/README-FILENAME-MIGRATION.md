# Gallery Filename Normalization Migration

**Date**: October 26, 2025 **Purpose**: Normalize gallery filename prefixes and
preserve original metadata dates

## Overview

This migration addresses two key issues:

1. **Filename Prefix**: Changes `ref_*` → `image_*` for neutrality across
   gallery types
2. **Metadata Preservation**: Extracts and preserves original file dates (EXIF +
   filesystem)

## What Changed

### Filename Format

**Before**:

```
ref_1729876543210_a1b2c3d4e5f6g7h8.jpg
```

**After**:

```
image_1729876543210_a1b2c3d4e5f6g7h8.jpg
```

### Database Updates

- `filename_storage`: Updated to use `image_` prefix
- `file_path`: Updated path to match new filename
- `created_at`: Set to earliest available date from:
  - EXIF DateTimeOriginal (camera capture date)
  - EXIF DateTime / CreateDate
  - File birthtime (creation date)
  - File mtime (modification date)

### Missing Files

- Files not found on disk → Marked as deleted (`is_deleted=1`)
- Database records preserved for audit trail

## Usage

### Dry Run (Preview Changes)

```bash
cd frontend
node scripts/migrations/normalize-gallery-filenames.js --dry-run
```

**Output**:

- Console log with detailed progress
- JSON log file: `migration-log-[timestamp].json`
- No changes applied

### Execute Migration

```bash
cd frontend
node scripts/migrations/normalize-gallery-filenames.js --execute
```

**Output**:

- Database backup: `content.backup-[timestamp].db`
- File renames on disk
- Database updates
- JSON log file with all changes

### Help

```bash
node scripts/migrations/normalize-gallery-filenames.js --help
```

## Safety Features

1. **Automatic Backup**: Database backed up before any changes
2. **Dry Run Mode**: Preview changes without modifying anything
3. **Transaction Safety**: Each image updated atomically
4. **Detailed Logging**: JSON log of all operations
5. **Error Handling**: Errors logged, migration continues
6. **Idempotent**: Safe to run multiple times (skips already-migrated images)

## Rollback Instructions

If migration needs to be rolled back:

### 1. Restore Database

```bash
cd frontend/data
cp content.backup-[timestamp].db content.db
```

### 2. Revert File Renames

Use log file to generate revert commands:

```bash
node scripts/migrations/generate-rollback-commands.js migration-log-[timestamp].json
```

Or manually:

```bash
cd frontend/public/uploads/references/[project-slug]
rename 's/^image_/ref_/' *.{jpg,png,gif,webp,avif}
```

## Log File Format

```json
{
  "timestamp": "2025-10-26T12:00:00.000Z",
  "mode": "execute",
  "backupPath": "/path/to/content.backup-1729876543210.db",
  "summary": {
    "total": 150,
    "renamed": 145,
    "deleted": 3,
    "errors": 0,
    "skipped": 2
  },
  "results": {
    "renamed": [
      {
        "id": 1,
        "projectSlug": "autumn-project",
        "galleryType": "references",
        "oldFilename": "ref_1729876543210_a1b2c3d4e5f6g7h8.jpg",
        "newFilename": "image_1729876543210_a1b2c3d4e5f6g7h8.jpg",
        "oldPath": "/uploads/references/autumn-project/ref_1729876543210_a1b2c3d4e5f6g7h8.jpg",
        "newPath": "/uploads/references/autumn-project/image_1729876543210_a1b2c3d4e5f6g7h8.jpg",
        "oldCreatedAt": "2025-10-20 14:30:00",
        "newCreatedAt": "2019-08-15 10:22:33",
        "action": "renamed",
        "dates": {
          "exif": "2019-08-15T10:22:33.000Z",
          "fileCreated": "2025-10-20T14:30:00.000Z",
          "fileModified": "2020-03-12T08:15:00.000Z",
          "earliest": "2019-08-15T10:22:33.000Z"
        }
      }
    ],
    "deleted": [...],
    "errors": [...],
    "skipped": [...]
  }
}
```

## Code Changes

After running the migration, update upload code:

### 1. file-upload-validator.ts

```typescript
// Change line ~142:
return `image_${timestamp}_${shortHash}${extension}`; // was: ref_
```

### 2. Upload Routes

Both `references/route.ts` and `concept-art/route.ts` need metadata extraction:

```typescript
// Extract file date from browser upload
const fileLastModified = new Date(file.lastModified || Date.now());

// Extract EXIF dates (in validateImageUpload)
const dates = await extractDates(buffer, fileLastModified);

// Use earliest date for created_at
const createdAt = dates.earliestDate || new Date();
```

## Verification

After migration, verify:

1. **UI Display**: All images show correctly in gallery
2. **Albums**: Album membership intact
3. **Tags**: Tag assignments preserved
4. **Dates**: Original dates reflected in database
5. **New Uploads**: Use `image_` prefix

### Verification Queries

```sql
-- Check prefix distribution
SELECT
  gallery_type,
  CASE
    WHEN filename_storage LIKE 'ref_%' THEN 'ref_'
    WHEN filename_storage LIKE 'image_%' THEN 'image_'
    ELSE 'other'
  END as prefix,
  COUNT(*) as count
FROM project_reference_images
WHERE is_deleted = 0
GROUP BY gallery_type, prefix;

-- Check date changes
SELECT COUNT(*) as updated_dates
FROM project_reference_images
WHERE created_at != updated_at
  AND is_deleted = 0;

-- Check for missing files (should be marked deleted)
SELECT COUNT(*)
FROM project_reference_images
WHERE is_deleted = 1
  AND deleted_at IS NOT NULL;
```

## Dependencies

- `exif-parser`: npm package for EXIF metadata extraction
- `sharp`: Already installed, provides EXIF buffer access
- `better-sqlite3`: Already installed, database access

## Related Files

- Migration script:
  `/frontend/scripts/migrations/normalize-gallery-filenames.js`
- Upload validator: `/frontend/src/lib/security/file-upload-validator.ts`
- References route: `/frontend/src/app/api/projects/[slug]/references/route.ts`
- Concept-art route:
  `/frontend/src/app/api/projects/[slug]/concept-art/route.ts`

## Support

If issues arise:

1. Check log file for details
2. Restore database backup if needed
3. Review error messages in console output
4. Manually verify file system state matches database

---

**Migration Author**: System **Migration Date**: October 26, 2025 **Approved
By**: User
