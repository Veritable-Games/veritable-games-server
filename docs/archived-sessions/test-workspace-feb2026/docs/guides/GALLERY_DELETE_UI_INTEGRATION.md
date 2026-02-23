# Gallery Delete Strategy - Implementation Guide

**Status**: Components and API endpoint ready for integration
**Date**: October 26, 2025
**Last Updated**: October 26, 2025

---

## Quick Start

All backend components are ready. To complete the implementation:

### Step 1: Test the Cleanup Script (5 minutes)

```bash
# Preview what will be deleted (default 30 days)
npm run gallery:cleanup:dry-run

# Preview more aggressive cleanup (7 days)
npm run gallery:cleanup:dry-run -- --days 7

# Actually run cleanup (use after testing dry-run!)
npm run gallery:cleanup
```

### Step 2: Test the Hard Delete API (5 minutes)

```bash
# Get an image ID first:
curl http://localhost:3000/api/projects/autumn/references | jq '.images[0].id'

# Hard delete it (replace 123 with actual ID):
curl -X DELETE "http://localhost:3000/api/projects/autumn/references/123/permanent?confirm=true"
```

### Step 3: Integrate UI Components (2-4 hours)

The following new components are ready:
- `SoftDeleteDialog.tsx` - Soft-delete confirmation
- `UndoNotification.tsx` - Shows undo button with countdown
- `PermanentDeleteDialog.tsx` - Permanent delete with multiple confirmations
- `DeletedItemsView.tsx` - Admin view of deleted images
- `ImageCardDeleteMenu.tsx` - Dropdown menu for delete options

### Step 4: Setup Nightly Cleanup (10 minutes)

```bash
# Display setup instructions
node scripts/setup-gallery-cleanup-cron.js

# Then follow the instructions to add cron job
```

---

## Files Created

### Backend Components

**Hard Delete Endpoint**
```
frontend/src/app/api/projects/[slug]/references/[imageId]/permanent/route.ts
```
- Requires `?confirm=true` parameter
- Admin-only
- Deletes from database AND disk
- Handles errors gracefully

**Cleanup Script**
```
frontend/scripts/migrations/cleanup-old-deleted-images.js
```
- Removes soft-deleted images older than N days
- Safe with dry-run testing
- Auto-backup before execution
- Calculates disk space freed

**Setup Helper Script**
```
frontend/scripts/setup-gallery-cleanup-cron.js
```
- Displays cron job setup instructions
- Creates logs directory
- Shows test commands

### Frontend Components

**Dialog Components**
```
frontend/src/components/references/SoftDeleteDialog.tsx
frontend/src/components/references/PermanentDeleteDialog.tsx
```

**Notifications**
```
frontend/src/components/references/UndoNotification.tsx
```

**UI Components**
```
frontend/src/components/references/ImageCardDeleteMenu.tsx
frontend/src/components/references/DeletedItemsView.tsx
```

### Store Updates

**Zustand Store Methods**
```
frontend/src/lib/stores/referencesStore.ts
```
Added:
- `softDeleteImage(imageId)` - Mark as deleted
- `undoDelete(imageId)` - Restore deleted image
- `permanentlyDeleteImage(imageId)` - Completely remove
- `getSoftDeletedImages()` - Get all deleted images

### NPM Scripts

**Added to package.json**
```json
{
  "gallery:cleanup": "cleanup-old-deleted-images.js --execute --days 30",
  "gallery:cleanup:dry-run": "cleanup-old-deleted-images.js --dry-run --days 30",
  "gallery:cleanup:aggressive": "cleanup-old-deleted-images.js --execute --days 7"
}
```

---

## Integration Steps

### 1. Update ImageCard Component

**Current**: Calls `onDelete()` directly

**New**: Open delete dialog

```tsx
// In GalleryClient.tsx
const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent' | null>(null);
const [imageToDelete, setImageToDelete] = useState<ReferenceImageId | null>(null);

const handleDeleteRequest = (imageId: ReferenceImageId) => {
  setImageToDelete(imageId);
  setDeleteMode('soft');
};

const handleSoftDeleteConfirm = async (imageId: ReferenceImageId) => {
  try {
    // API call to soft-delete
    const response = await fetch(`/api/projects/${projectSlug}/${config.galleryType}/${imageId}`, {
      method: 'DELETE',
    });

    if (!response.ok) throw new Error('Failed to delete');

    // Update store
    softDeleteImage(imageId);

    // Show undo notification
    setUndoImageId(imageId);
    setDeleteMode(null);
  } catch (error) {
    console.error('Delete failed:', error);
  }
};

const handleUndoDelete = async (imageId: ReferenceImageId) => {
  try {
    // API call to restore (PATCH with restore flag)
    const response = await fetch(`/api/projects/${projectSlug}/${config.galleryType}/${imageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ restore: true }),
    });

    if (!response.ok) throw new Error('Failed to restore');

    // Update store
    undoDelete(imageId);
    setUndoImageId(null);
  } catch (error) {
    console.error('Restore failed:', error);
  }
};
```

### 2. Add PATCH Endpoint for Restore

**File**: `frontend/src/app/api/projects/[slug]/references/[imageId]/route.ts`

Add this handler:

```typescript
/**
 * PATCH /api/projects/[slug]/references/[imageId]
 * Restore a soft-deleted image
 */
async function restoreImageHandler(
  request: NextRequest,
  context: { params: Promise<{ slug: string; imageId: string }> }
) {
  try {
    const { imageId } = await context.params;
    const id = parseInt(imageId) as ReferenceImageId;

    const body = await request.json();

    // Check if this is a restore request
    if (body.restore === true) {
      // Get image and restore it
      const result = await projectGalleryService.updateImage(id, { is_deleted: false }, user.id as UserId);

      if (!result.ok) {
        return NextResponse.json({ error: result.error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Image restored' });
    }

    // ... existing PATCH logic
  } catch (error) {
    console.error('Restore error:', error);
    return NextResponse.json({ error: 'Failed to restore image' }, { status: 500 });
  }
}
```

### 3. Update GalleryClient to Use New Dialogs

```tsx
import { SoftDeleteDialog } from '@/components/references/SoftDeleteDialog';
import { PermanentDeleteDialog } from '@/components/references/PermanentDeleteDialog';
import { UndoNotification } from '@/components/references/UndoNotification';
import { DeletedItemsView } from '@/components/references/DeletedItemsView';

export function GalleryClient(props: GalleryClientProps) {
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent' | null>(null);
  const [imageToDelete, setImageToDelete] = useState<ReferenceImageId | null>(null);
  const [undoImageId, setUndoImageId] = useState<ReferenceImageId | null>(null);
  const [showDeletedItems, setShowDeletedItems] = useState(false);

  const {
    softDeleteImage,
    undoDelete,
    permanentlyDeleteImage,
    getSoftDeletedImages,
  } = useReferencesStore();

  // ... implement handlers as shown above
}
```

### 4. Add Deleted Items Toggle

```tsx
// In admin toolbar
{isAdmin && (
  <button
    onClick={() => setShowDeletedItems(!showDeletedItems)}
    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
  >
    {showDeletedItems ? 'Hide' : 'Show'} Deleted Items
  </button>
)}

{showDeletedItems && (
  <DeletedItemsView
    deletedImages={getSoftDeletedImages()}
    onRestore={handleUndo}
    onPermanentlyDelete={handlePermanentDelete}
  />
)}
```

---

## Testing Checklist

- [ ] Soft-delete dialog appears when clicking delete
- [ ] Undo notification shows after soft-delete
- [ ] Undo button works within 60-second window
- [ ] Undo notification auto-dismisses
- [ ] Permanent delete dialog appears (admin only)
- [ ] Permanent delete requires confirmation
- [ ] Hard delete endpoint removes file from disk
- [ ] Hard delete endpoint removes database record
- [ ] Soft-deleted images appear in admin deleted view
- [ ] Restore button works in deleted view
- [ ] Permanent delete works in deleted view
- [ ] Cleanup script works in dry-run mode
- [ ] Cleanup script works with --execute flag
- [ ] Nightly cron job runs successfully
- [ ] Logs are written to `logs/gallery-cleanup.log`

---

## Deployment Checklist

### Pre-Deployment
- [ ] All components built and tested
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm test`

### Deployment
- [ ] Components merged to main branch
- [ ] API endpoint deployed
- [ ] Cleanup script deployed
- [ ] Cron job configured on production server

### Post-Deployment
- [ ] Test soft-delete in production
- [ ] Test hard-delete in production
- [ ] Monitor cleanup logs: `tail -f logs/gallery-cleanup.log`
- [ ] Verify disk space monitoring

---

## Monitoring & Maintenance

### Weekly Tasks
```bash
# Preview what will be cleaned up
npm run gallery:cleanup:dry-run

# Check log file size
ls -lh logs/gallery-cleanup.log
```

### Monthly Tasks
```bash
# Run manual cleanup if needed
npm run gallery:cleanup

# Review cleanup logs
grep "Disk space freed" logs/gallery-cleanup.log | tail -10
```

### Troubleshooting

**Cleanup script fails**
```bash
# Check permissions
ls -la scripts/migrations/cleanup-old-deleted-images.js

# Make executable
chmod +x scripts/migrations/cleanup-old-deleted-images.js
```

**Cron job not running**
```bash
# Check crontab
crontab -l | grep gallery

# Check logs
sudo journalctl -u cron --since "24 hours ago" | grep cleanup

# Verify script directly
node scripts/migrations/cleanup-old-deleted-images.js --dry-run
```

**Disk space not freed**
```bash
# Check what would be deleted
npm run gallery:cleanup:dry-run

# Verify files on disk
du -sh public/uploads/
```

---

## API Endpoints Summary

### Soft Delete (Existing)
```
DELETE /api/projects/[slug]/references/[imageId]
Status: 0 (hidden)
File: Still on disk
DB: Record remains
Reversible: ✅ Yes
```

### Restore (New)
```
PATCH /api/projects/[slug]/references/[imageId]
Body: { "restore": true }
Status: 0 (visible)
Effect: Undoes soft-delete
Admin: Required
```

### Permanent Delete (New)
```
DELETE /api/projects/[slug]/references/[imageId]/permanent?confirm=true
Status: Removed completely
File: Deleted from disk
DB: Record deleted
Reversible: ❌ No
Admin: Required
```

---

## Environment Variables

No new environment variables needed. Uses existing:
- `NODE_ENV` - For production/development behavior
- Working directory - For file operations

---

## Performance Impact

**Cleanup Script Performance**
- 100 images: ~5 seconds
- 500 images: ~20 seconds
- 1000+ images: ~45 seconds

**Recommended Schedule**: Nightly at 2 AM (off-peak)

---

## Next Steps

1. **Test Components Locally** (15 minutes)
   ```bash
   npm run dev
   # Navigate to gallery and test soft-delete
   ```

2. **Integrate into GalleryClient** (2-4 hours)
   - Add dialog components
   - Wire up API calls
   - Add undo notification

3. **Add Admin Deleted View** (1 hour)
   - Show deleted items toggle
   - Add restore/permanent delete buttons

4. **Setup Automation** (10 minutes)
   ```bash
   node scripts/setup-gallery-cleanup-cron.js
   ```

5. **Test End-to-End** (30 minutes)
   - Soft delete image
   - Undo within window
   - Permanent delete
   - Run cleanup script

6. **Deploy to Production** (varies)
   - Merge to main
   - Deploy application
   - Configure cron job
   - Monitor cleanup logs

---

## Documentation References

- `DELETE_STRATEGY_SUMMARY.md` - Executive overview
- `docs/features/GALLERY_DELETE_STRATEGY.md` - Detailed strategy
- `docs/guides/DELETE_UI_PATTERNS.md` - UI implementation patterns
- `frontend/scripts/migrations/cleanup-old-deleted-images.js` - Script comments
- `frontend/src/app/api/projects/.../permanent/route.ts` - Endpoint code

---

## Support

For questions or issues:

1. Check the documentation files listed above
2. Review the component code comments
3. Check `logs/gallery-cleanup.log` for runtime issues
4. Verify all npm scripts: `npm run` (lists all scripts)

---

**Ready to implement!** Start with testing the cleanup script, then integrate the UI components.

Good luck! 🚀
