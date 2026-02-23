# Gallery Delete Implementation - Quick Reference Card

## Commands to Know

```bash
# Test cleanup script (preview)
npm run gallery:cleanup:dry-run

# Run cleanup (30 days)
npm run gallery:cleanup

# Aggressive cleanup (7 days)
npm run gallery:cleanup:aggressive

# Setup cron job
node scripts/setup-gallery-cleanup-cron.js

# Check for TypeScript errors
npm run type-check

# Build project
npm run build

# Run tests
npm test
```

## Files You Created

### UI Components (Ready to Use)
```
src/components/references/SoftDeleteDialog.tsx
src/components/references/UndoNotification.tsx
src/components/references/PermanentDeleteDialog.tsx
src/components/references/DeletedItemsView.tsx
src/components/references/ImageCardDeleteMenu.tsx
```

### Modified Files
```
src/lib/stores/referencesStore.ts        (+ delete methods)
frontend/package.json                     (+ npm scripts)
```

### Helper Scripts
```
scripts/setup-gallery-cleanup-cron.js
scripts/migrations/cleanup-old-deleted-images.js (already committed)
```

### Documentation
```
IMPLEMENTATION_GUIDE.md                   (START HERE!)
DELETE_STRATEGY_SUMMARY.md
docs/features/GALLERY_DELETE_STRATEGY.md
docs/guides/DELETE_UI_PATTERNS.md
```

## Store Methods to Use

```typescript
// In your components
const {
  softDeleteImage,
  undoDelete,
  permanentlyDeleteImage,
  getSoftDeletedImages,
} = useReferencesStore();

// Examples
softDeleteImage(imageId);              // Hide image
undoDelete(imageId);                   // Restore image
permanentlyDeleteImage(imageId);       // Remove completely
const deleted = getSoftDeletedImages(); // Get all deleted
```

## API Endpoints

```
# Soft Delete (existing)
DELETE /api/projects/[slug]/references/[imageId]

# Restore (to add)
PATCH /api/projects/[slug]/references/[imageId]
Body: { "restore": true }

# Permanent Delete (new)
DELETE /api/projects/[slug]/references/[imageId]/permanent?confirm=true
```

## Component Props

```typescript
// SoftDeleteDialog
<SoftDeleteDialog
  imageId={id}
  imageName="filename.jpg"
  onConfirm={handleDelete}
  onCancel={handleCancel}
/>

// UndoNotification
<UndoNotification
  message="Image deleted"
  onUndo={handleUndo}
  onDismiss={handleDismiss}
  duration={60000}
/>

// PermanentDeleteDialog
<PermanentDeleteDialog
  imageId={id}
  imageName="filename.jpg"
  fileSize={1024000}
  onConfirm={handleDelete}
  onCancel={handleCancel}
/>

// DeletedItemsView
<DeletedItemsView
  deletedImages={getSoftDeletedImages()}
  onRestore={handleRestore}
  onPermanentlyDelete={handleDelete}
/>

// ImageCardDeleteMenu
<ImageCardDeleteMenu
  imageId={id}
  imageName="filename.jpg"
  isAdmin={true}
  isDeleted={false}
  onSoftDelete={handleSoftDelete}
  onPermanentDelete={handlePermanentDelete}
  onRestore={handleRestore}
/>
```

## Integration Workflow

```
1. Read IMPLEMENTATION_GUIDE.md (5 min)
2. Test cleanup script (5 min)
   └─ npm run gallery:cleanup:dry-run
3. Test hard delete API (5 min)
   └─ curl -X DELETE "http://localhost:3000/api/..."
4. Integrate components (2-4 hours)
   ├─ Update GalleryClient
   ├─ Add PATCH endpoint
   ├─ Wire up dialogs
   ├─ Add undo notification
   └─ Add deleted items view
5. Setup nightly cleanup (10 min)
   └─ node scripts/setup-gallery-cleanup-cron.js
6. Test end-to-end (30 min)
   ├─ Soft-delete workflow
   ├─ Undo functionality
   ├─ Permanent delete
   └─ Cleanup script
```

## Key Points to Remember

- ✅ Backend is **already committed** (hard delete API + cleanup script)
- ✅ UI components are **ready to use** (no git commit yet)
- ✅ Store methods are **implemented** (Zustand)
- ✅ NPM scripts are **added** (npm run gallery:cleanup)
- ⏳ Integration is **your next task** (~2-4 hours)
- ⏳ Testing & deployment **follow integration**

## Soft-Delete Workflow

```
User clicks delete
        ↓
SoftDeleteDialog confirms
        ↓
softDeleteImage() store method
        ↓
DELETE API call
        ↓
Image hidden from UI (is_deleted=1)
        ↓
UndoNotification shows (60 seconds)
        ↓
User clicks undo? → undoDelete() → restore image
User ignores? → nightly cleanup removes permanently
```

## Hard-Delete Workflow

```
Admin clicks "Permanently Delete"
        ↓
PermanentDeleteDialog with warnings
        ↓
Multiple confirmations required
        ↓
Reason dropdown (required)
        ↓
DELETE /api/.../permanent?confirm=true
        ↓
Image removed from disk & database immediately
        ↓
Space freed immediately (not waiting for cleanup)
```

## Cleanup Workflow

```
2:00 AM nightly cron job triggers
        ↓
cleanup-old-deleted-images.js runs
        ↓
Finds images: is_deleted=1 AND deleted_at < 30 days ago
        ↓
Removes files from /public/uploads/
        ↓
Deletes database records
        ↓
Logs results to logs/gallery-cleanup.log
        ↓
Space freed, database cleaned
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| TypeScript errors | `npm run type-check` |
| Build fails | `npm run build` (check errors) |
| Cleanup script errors | `npm run gallery:cleanup:dry-run` first |
| Cron not running | Check: `crontab -l \| grep gallery` |
| Components not rendering | Check: `npm run dev` (hot reload) |
| Store methods undefined | Verify store file updated correctly |

## NPM Scripts Reference

```json
{
  "gallery:cleanup": "node scripts/migrations/cleanup-old-deleted-images.js --execute --days 30",
  "gallery:cleanup:dry-run": "node scripts/migrations/cleanup-old-deleted-images.js --dry-run --days 30",
  "gallery:cleanup:aggressive": "node scripts/migrations/cleanup-old-deleted-images.js --execute --days 7"
}
```

## Testing Checklist

**Before Integration:**
- [ ] Read IMPLEMENTATION_GUIDE.md
- [ ] Run TypeScript check: `npm run type-check`

**During Integration:**
- [ ] Test soft-delete dialog
- [ ] Test undo notification
- [ ] Test permanent delete dialog
- [ ] Test API endpoints

**After Integration:**
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] No TypeScript errors: `npm run type-check`

**Before Deployment:**
- [ ] Test cleanup script
- [ ] Setup cron job
- [ ] Monitor cleanup logs

## Next Actions

1. **READ**: IMPLEMENTATION_GUIDE.md (start there!)
2. **TEST**: npm run gallery:cleanup:dry-run
3. **INTEGRATE**: Update GalleryClient component
4. **VERIFY**: npm run type-check && npm run build
5. **SETUP**: node scripts/setup-gallery-cleanup-cron.js
6. **DEPLOY**: Follow your normal deployment process

---

**Total Implementation Time**: 2-4 hours
**Status**: Ready for integration (no git commits yet as requested)
**Support**: See IMPLEMENTATION_GUIDE.md for detailed instructions
