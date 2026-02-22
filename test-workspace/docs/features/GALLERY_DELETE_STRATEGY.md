# Gallery Delete Strategy: Soft vs Hard Delete

**Date**: October 26, 2025
**Status**: ✅ Complete implementation provided

---

## The Problem You Experienced

You deleted images months ago, but they remained in the database as **soft-deleted**:
- Files stayed on disk (wasting storage)
- Database records lingered (cluttering data)
- No easy way to truly delete them
- Users expected "delete" to mean "gone forever"

**Root Cause**: The delete operation only marked images as `is_deleted = 1`, never actually removed them.

---

## Two Delete Types Explained

### 1. Soft Delete (Current Default)

**What Happens**:
```
User clicks "Delete Image"
           ↓
is_deleted = 1, deleted_at = NOW(), deleted_by = user_id
           ↓
Image hidden from UI (WHERE is_deleted = 0)
           ↓
File still on disk (/public/uploads/...)
           ↓
Database record still exists
```

**Pros**:
✅ Reversible (can restore with `is_deleted = 0`)
✅ Audit trail (who deleted, when)
✅ Safe for accidental deletes
✅ Preserves referential integrity
✅ Can recover if needed

**Cons**:
❌ Wastes disk space
❌ Clutters database
❌ Confusing to users ("delete" didn't actually delete)
❌ Lingers indefinitely without cleanup
❌ Hard to distinguish from permanent delete

### 2. Hard Delete (Now Available)

**What Happens**:
```
User clicks "Permanently Delete" (with confirmation)
           ↓
DELETE FROM project_reference_images (CASCADE delete tags)
           ↓
rm file from /public/uploads/...
           ↓
Image completely gone
           ↓
Space reclaimed on disk
           ↓
Database record removed
```

**Pros**:
✅ Truly removes image
✅ Frees disk space
✅ Cleans database
✅ What users expect from "delete"
✅ Can't accidentally restore

**Cons**:
❌ Irreversible (unless backup exists)
❌ Loses audit information
❌ Riskier operation
❌ Requires explicit confirmation

---

## Current Architecture (Problem)

### The Hidden Method

**Location**: `src/lib/projects/gallery-service.ts` line 600

```typescript
async permanentlyDeleteImage(imageId: ReferenceImageId): Promise<Result<void>> {
  // Deletes database record completely
  // Removes tags
  // But NO file deletion from disk!
}
```

**Issue**: This method exists but:
- ❌ Is NOT exposed via API
- ❌ Is NOT used anywhere in the codebase
- ❌ Doesn't delete files from disk
- ❌ Users can't access it

### The API Gap

**Current DELETE endpoint** (`/api/projects/[slug]/references/[imageId]`):
```typescript
export async function DELETE(...) {
  return projectGalleryService.deleteImage(imageId, userId);
  // ↓ Only soft-deletes, no file cleanup
}
```

**New PERMANENT DELETE endpoint** (`/api/projects/[slug]/references/[imageId]/permanent`):
```typescript
export async function DELETE(...) {
  // 1. Requires ?confirm=true parameter (safety)
  // 2. Gets image path before deletion
  // 3. Calls permanentlyDeleteImage() (database)
  // 4. Deletes file from /public/uploads/ (disk cleanup)
  // 5. Logs everything
}
```

---

## New Solutions Provided

### 1. Hard Delete API Endpoint

**File**: `/frontend/src/app/api/projects/[slug]/references/[imageId]/permanent/route.ts`

**Usage**:
```bash
# With confirmation (required)
DELETE /api/projects/[slug]/references/123?confirm=true

# Returns:
{
  "success": true,
  "message": "Image permanently deleted",
  "details": {
    "imageId": 123,
    "filename": "image_123456.jpg",
    "fileSize": 2048000,
    "deletedAt": "2025-10-26T...",
    "deletedBy": "user-id"
  }
}
```

**Features**:
- ✅ Requires explicit `?confirm=true` confirmation
- ✅ Admin-only (security)
- ✅ Deletes from database AND disk
- ✅ Handles missing files gracefully
- ✅ Comprehensive error logging
- ✅ Returns detailed confirmation

### 2. Cleanup Script for Old Images

**File**: `/frontend/scripts/migrations/cleanup-old-deleted-images.js`

**Purpose**: Automatically clean up soft-deleted images older than N days

**Usage**:
```bash
# Preview (dry-run) - default 30 days
node scripts/migrations/cleanup-old-deleted-images.js --dry-run

# Preview 7-day threshold
node scripts/migrations/cleanup-old-deleted-images.js --dry-run --days 7

# Execute cleanup (30 days)
node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30

# Aggressive cleanup (7 days)
node scripts/migrations/cleanup-old-deleted-images.js --execute --days 7
```

**Features**:
- ✅ Deletes old soft-deleted images permanently
- ✅ Removes files from disk
- ✅ Removes database records
- ✅ Automatic backup before cleanup
- ✅ Detailed logging
- ✅ Calculates disk space freed
- ✅ Dry-run mode for safety

**Example Output**:
```
📊 Found 45 soft-deleted images older than 30 days

🔄 Cleaning up images...
  ✅ Deleted file: image_123456.jpg
  ✅ Deleted file: image_234567.jpg
  ... (43 more files)

✅ Cleanup complete
  Files deleted: 45
  Files missing: 0
  Disk space freed: 156.78 MB
```

---

## Recommended Delete Flow

### Option 1: Two-Step Delete (Recommended)

```
User clicks "Delete Image"
         ↓
Dialog: "Delete this image? (Can be recovered)"
         ↓
Is_deleted = 1 [SOFT DELETE]
Image hidden from UI
         ↓
Show: "Image deleted. Undo?" (for 1 hour)
         ↓
User clicks "Undo"? → is_deleted = 0 (restore)
User ignores? → After timeout:
  Run cleanup script nightly → HARD DELETE
```

**Pros**:
- ✅ User feels like they deleted it (hidden from UI)
- ✅ Safe recovery window
- ✅ Automatic cleanup prevents clutter
- ✅ Transparent process

**Implementation**:
1. Soft-delete on user action (current behavior)
2. Show "Undo" notification for 60 seconds
3. Run cleanup script nightly: `cleanup-old-deleted-images.js --execute --days 1`

### Option 2: Single Permanent Delete

```
User clicks "Delete Image"
         ↓
Dialog: "Delete this image PERMANENTLY? (Cannot undo)"
         ↓
Confirm checkbox + password confirm
         ↓
HARD DELETE (calls /permanent endpoint)
         ↓
Image gone forever
```

**Pros**:
- ✅ Clear intent
- ✅ No lingering data
- ✅ No cleanup needed

**Cons**:
- ❌ No recovery option
- ❌ More risky

### Option 3: Three-Level Delete (Most Flexible)

```
User right-clicks image:
  ├─ "Hide (Soft Delete)" → Hidden for 30 days
  ├─ "Trash (Move to Trash)" → is_deleted = 1
  └─ "Permanently Delete" → Hard delete immediately
         ↓
Trash folder shows deleted images
         ↓
User can restore or permanently remove
```

**Pros**:
- ✅ Maximum clarity
- ✅ Recoverable soft-deletes
- ✅ Option for permanent deletion
- ✅ Trash folder metaphor is familiar

**Cons**:
- ❌ More complex UI
- ❌ More code to maintain

---

## Implementation Checklist

### Phase 1: Backend (Done)
- ✅ Created permanent delete API endpoint
- ✅ Created cleanup script for old soft-deleted images
- ✅ File deletion from disk
- ✅ Proper error handling
- ✅ Comprehensive logging

### Phase 2: Frontend (Recommended)

**1. Update Delete Button**
```typescript
// Instead of single "Delete" button:

// Option A: Two separate buttons
<button onClick={handleSoftDelete}>Delete (Recoverable)</button>
<button onClick={handlePermanentDelete}>Permanently Delete...</button>

// Option B: Dropdown menu
<select onChange={handleDeleteOption}>
  <option value="">Delete Image...</option>
  <option value="soft">Hide from Gallery</option>
  <option value="permanent">Delete Permanently</option>
</select>
```

**2. Add Confirmation Dialog**
```typescript
// For soft-delete:
confirmDialog('Hide this image? You can restore it later.')

// For permanent delete:
confirmDialog(
  'Permanently delete this image? This cannot be undone.',
  {
    confirmText: 'Delete Forever',
    isDangerous: true,
    requirePassword: true, // Extra safety
  }
)
```

**3. Show Undo Notification**
```typescript
// After soft-delete:
showNotification({
  type: 'info',
  message: 'Image deleted.',
  action: 'Undo',
  timeout: 60000, // 1 minute
  onAction: () => {
    // Call PATCH /api/.../[imageId] to set is_deleted = 0
  }
})
```

**4. Add Deleted Items View**
```typescript
// For admins only:
<button onClick={() => showDeletedImages(!showDeleted)}>
  {showDeleted ? 'Hide' : 'Show'} Deleted Images
</button>

// When enabled, show soft-deleted images with restore option
```

### Phase 3: Maintenance (Recommended)

**Add Nightly Cleanup**

Create a scheduled job to clean up old soft-deleted images:

```bash
# In your server startup script or cron job:
0 2 * * * cd /path/to/frontend && node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30
```

Or add to package.json:
```json
{
  "scripts": {
    "cleanup:deleted": "node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30",
    "cleanup:deleted:dry-run": "node scripts/migrations/cleanup-old-deleted-images.js --dry-run --days 30"
  }
}
```

---

## Database Schema Evolution

### Current State
```
project_reference_images
├─ is_deleted (INTEGER) - 0 = visible, 1 = hidden
├─ deleted_at (DATETIME) - When soft-deleted
└─ deleted_by (TEXT) - Who soft-deleted
```

### Recommended Addition
```
├─ permanent_deleted_at (DATETIME) - When hard-deleted
├─ permanent_deleted_by (TEXT) - Who hard-deleted
└─ deletion_reason (TEXT) - Why deleted (optional)
```

This allows:
- Distinguishing soft vs hard deletes
- Better audit trails
- Understanding deletion patterns

**Migration**:
```sql
ALTER TABLE project_reference_images
ADD COLUMN permanent_deleted_at DATETIME;

ALTER TABLE project_reference_images
ADD COLUMN permanent_deleted_by TEXT;

ALTER TABLE project_reference_images
ADD COLUMN deletion_reason TEXT;
```

---

## Security Considerations

### Preventing Accidental Deletion

1. **Confirmation Required**
   - Soft-delete: Simple confirmation dialog
   - Hard-delete: Multiple confirmations + reason

2. **Admin-Only**
   - Both soft and hard deletes require admin role
   - API validates role before operation

3. **Explicit Confirmation Parameter**
   - Hard-delete endpoint requires `?confirm=true`
   - Prevents accidental API calls

4. **Logging**
   - All deletions logged with user ID and timestamp
   - Can audit who deleted what and when

5. **Backup**
   - Cleanup script creates automatic backup
   - Can restore from `content.backup-cleanup-*.db`

---

## Monitoring & Cleanup

### View Soft-Deleted Images

```bash
# Check how many are hidden:
npm run cleanup:deleted:dry-run

# Run regularly to monitor:
npm run cleanup:deleted:dry-run --days 7   # Images older than 1 week
npm run cleanup:deleted:dry-run --days 30  # Images older than 1 month
```

### Automatic Cleanup Schedule

**Recommended**: Run cleanup every night at 2 AM

**For Docker/Linux**:
```bash
# In crontab:
0 2 * * * cd /app/frontend && node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30
```

**For Node/PM2**:
```javascript
// In your server startup:
schedule('0 2 * * *', async () => {
  execSync('node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30');
});
```

---

## Testing the Implementation

### Test Soft-Delete
```bash
# 1. Get an image ID
curl http://localhost:3000/api/projects/autumn/references

# 2. Soft-delete it
curl -X DELETE http://localhost:3000/api/projects/autumn/references/123

# 3. Verify it's hidden (should not appear in list)
curl http://localhost:3000/api/projects/autumn/references
```

### Test Permanent Delete
```bash
# 1. Get an image ID
curl http://localhost:3000/api/projects/autumn/references

# 2. Attempt without confirmation (should fail)
curl -X DELETE http://localhost:3000/api/projects/autumn/references/456

# 3. Permanently delete with confirmation
curl -X DELETE "http://localhost:3000/api/projects/autumn/references/456?confirm=true"

# 4. Verify it's completely gone (no database record)
curl http://localhost:3000/api/projects/autumn/references/456  # Should return 404
```

### Test Cleanup Script
```bash
# 1. Preview what will be deleted
npm run cleanup:deleted:dry-run --days 30

# 2. Check space usage before
du -sh public/uploads/

# 3. Execute cleanup
npm run cleanup:deleted --days 30

# 4. Check space usage after
du -sh public/uploads/
```

---

## Summary Table

| Operation | Method | Reversible | Disk Impact | DB Impact | Speed | Use Case |
|-----------|--------|-----------|---|---|---|---|
| **Soft Delete** | POST DELETE | ✅ Yes | File stays | is_deleted=1 | Fast | User deletes image |
| **Restore** | PATCH | N/A | N/A | is_deleted=0 | Fast | Undo deletion |
| **Hard Delete (API)** | DELETE /permanent | ❌ No | File removed | Record deleted | Fast | Admin cleanup |
| **Hard Delete (Script)** | cleanup script | ❌ No | Files removed | Records deleted | Slow | Nightly batch cleanup |

---

## Files Created/Modified

### New Endpoints
- `src/app/api/projects/[slug]/references/[imageId]/permanent/route.ts` (95 lines)

### New Scripts
- `scripts/migrations/cleanup-old-deleted-images.js` (320 lines)

### Documentation
- This file: `docs/features/GALLERY_DELETE_STRATEGY.md`

---

## Going Forward

1. **Implement two-step delete** (soft delete + undo)
2. **Add cleanup script** to nightly cron
3. **Update UI** to show deletion type
4. **Monitor soft-deletes** with weekly reports
5. **Consider adding trash folder** for power users

---

## Questions?

Refer to:
- `docs/features/GALLERY_REVEAL_ANALYSIS.md` - How we discovered the hidden images
- `docs/features/PROJECT_REFERENCES_ARCHITECTURE.md` - Complete gallery architecture
- `frontend/scripts/migrations/README-REVEAL-OPERATION.md` - Reveal operation details

---

**Last Updated**: October 26, 2025
**Status**: ✅ Complete solution provided
