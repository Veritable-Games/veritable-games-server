# Gallery Delete UI Patterns - Implementation Guide

**Purpose**: Provide clear, safe delete workflows that prevent user confusion

---

## Current Problem

User clicks "Delete" → Image hidden from UI → User thinks it's deleted → Image lingers in DB for months

**Solution**: Clear UI patterns that distinguish between temporary and permanent deletion

---

## Pattern 1: Two-Stage Delete (Recommended)

### User Flow
```
1. User clicks delete button
   ↓
2. Confirmation dialog appears
   "Hide this image? You can restore it later."
   [Cancel] [Hide]
   ↓
3. User confirms
   ↓
4. Image disappears from gallery
   Notification appears: "Image deleted"
   with "Undo" button (60-second timeout)
   ↓
5. Auto-cleanup (nightly) removes old soft-deleted
```

### Component Code

**Delete Button with Dropdown**
```tsx
export function ImageCard({ image, onDelete }: Props) {
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent' | null>(null);

  return (
    <div className="image-card">
      <img src={image.url} />

      <div className="actions">
        <button onClick={() => setDeleteMode('soft')}>
          Delete
        </button>

        {deleteMode === 'soft' && (
          <SoftDeleteDialog
            image={image}
            onConfirm={() => handleSoftDelete(image.id)}
            onCancel={() => setDeleteMode(null)}
          />
        )}
      </div>
    </div>
  );
}
```

**Soft Delete Dialog**
```tsx
function SoftDeleteDialog({ image, onConfirm, onCancel }: Props) {
  return (
    <dialog open>
      <h2>Hide Image?</h2>
      <p>
        "{image.filename}" will be hidden from the gallery.
      </p>
      <p className="info">
        💡 You can restore it later from the deleted items view.
      </p>

      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} className="secondary">
          Hide Image
        </button>
      </div>
    </dialog>
  );
}
```

**Undo Notification (After Soft Delete)**
```tsx
function useUndoNotification() {
  const showUndo = (imageId, onUndo) => {
    const notification = (
      <div className="notification success">
        <span>Image hidden</span>
        <button onClick={onUndo}>Undo</button>
        <button onClick={() => notification.close()}>Dismiss</button>
      </div>
    );

    document.body.appendChild(notification);

    // Auto-dismiss after 60 seconds
    setTimeout(() => {
      notification.remove();
    }, 60000);

    return notification;
  };

  return { showUndo };
}
```

### API Calls

```typescript
// Soft delete (normal delete button)
async function handleSoftDelete(imageId: number) {
  const response = await fetch(
    `/api/projects/${slug}/references/${imageId}`,
    { method: 'DELETE' }
  );

  // Image is now hidden (is_deleted = 1)
  // Files still exist on disk
  // User can restore within 60 seconds
}

// Undo (restore soft-deleted)
async function handleUndo(imageId: number) {
  const response = await fetch(
    `/api/projects/${slug}/references/${imageId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ restore: true })
    }
  );

  // Image restored (is_deleted = 0)
}
```

---

## Pattern 2: Permanent Delete (Advanced Users)

### When to Show

Add permanent delete option:
1. In dropdown menu (advanced)
2. In admin panel only
3. For images already soft-deleted
4. With explicit warning

### Component Code

**Admin Delete Menu**
```tsx
function ImageCardAdmin({ image }: Props) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="image-card">
      <img src={image.url} />

      <div className="menu">
        <button onClick={() => setShowMenu(!showMenu)}>⋮</button>

        {showMenu && (
          <div className="dropdown">
            <button onClick={() => handleSoftDelete(image.id)}>
              Hide from Gallery
            </button>

            {image.is_deleted && (
              <button
                onClick={() => handlePermanentDelete(image.id)}
                className="danger"
              >
                ⚠️ Permanently Delete
              </button>
            )}

            <button onClick={() => handleUndo(image.id)}>
              ↶ Restore
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Permanent Delete Warning Dialog**
```tsx
function PermanentDeleteDialog({ image, onConfirm, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <dialog open>
      <h2>⚠️ Permanently Delete?</h2>

      <div className="warning-box">
        <strong>This cannot be undone!</strong>
        <ul>
          <li>File will be deleted from disk</li>
          <li>Database record will be removed</li>
          <li>Cannot be restored (unless backup exists)</li>
        </ul>
      </div>

      <div className="form-group">
        <label>Why are you deleting this image?</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Select reason...</option>
          <option value="duplicate">Duplicate</option>
          <option value="wrong">Wrong file</option>
          <option value="spam">Spam/Abuse</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="confirmation">
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I understand this is permanent and cannot be undone
        </label>
      </div>

      <div className="actions">
        <button onClick={onCancel}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={!confirmed || !reason}
          className="danger"
        >
          Permanently Delete
        </button>
      </div>
    </dialog>
  );
}
```

### API Call

```typescript
async function handlePermanentDelete(imageId: number) {
  const response = await fetch(
    `/api/projects/${slug}/references/${imageId}/permanent?confirm=true`,
    { method: 'DELETE' }
  );

  // Image completely gone
  // Files removed from disk
  // Database record deleted
}
```

---

## Pattern 3: Deleted Items View (For Admins)

### Show Hidden Images

```tsx
function GalleryAdmin({ slug }: Props) {
  const [showDeleted, setShowDeleted] = useState(false);

  return (
    <div className="gallery-admin">
      <div className="toolbar">
        <button onClick={() => setShowDeleted(!showDeleted)}>
          {showDeleted ? 'Hide' : 'Show'} Deleted Images
        </button>
      </div>

      {showDeleted && (
        <div className="deleted-section">
          <h3>🗑️ Deleted Images (Can Restore)</h3>
          <div className="image-grid">
            {deletedImages.map(img => (
              <DeletedImageCard
                key={img.id}
                image={img}
                onRestore={handleRestore}
                onPermanentDelete={handlePermanentDelete}
              />
            ))}
          </div>
        </div>
      )}

      <div className="active-section">
        <h3>Gallery</h3>
        <div className="image-grid">
          {visibleImages.map(img => (
            <ImageCard key={img.id} image={img} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Deleted Image Card**
```tsx
function DeletedImageCard({ image, onRestore, onPermanentDelete }: Props) {
  return (
    <div className="image-card deleted">
      <div className="overlay">
        <span className="status">DELETED</span>
        <span className="date">
          {formatDate(image.deleted_at)}
        </span>
      </div>

      <img src={image.url} style={{ opacity: 0.5 }} />

      <div className="actions">
        <button onClick={() => onRestore(image.id)}>
          ↶ Restore
        </button>
        <button
          onClick={() => onPermanentDelete(image.id)}
          className="danger"
        >
          🗑️ Delete Forever
        </button>
      </div>

      <small>
        Deleted {formatRelativeTime(image.deleted_at)} ago
        {image.deleted_by && <> by {image.deleted_by}</>}
      </small>
    </div>
  );
}
```

---

## CSS Styling

### Basic Styles

```css
/* Delete button - clear, not scary */
button.delete {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

button.delete:hover {
  background: #fee2e2;
  color: #7f1d1d;
  border-color: #fca5a5;
}

/* Danger button - red for permanent delete */
button.danger {
  background: #fee2e2;
  color: #7f1d1d;
  border: 1px solid #fca5a5;
}

button.danger:hover {
  background: #fecaca;
  color: #991b1b;
}

/* Warning box */
.warning-box {
  background: #fef2f2;
  border-left: 4px solid #dc2626;
  padding: 16px;
  margin: 16px 0;
  border-radius: 4px;
}

/* Notification with undo */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  border-left: 4px solid #16a34a;
  padding: 16px;
  border-radius: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
}

.notification button {
  padding: 4px 12px;
  font-size: 0.875rem;
}

/* Deleted image overlay */
.image-card.deleted {
  opacity: 0.6;
  position: relative;
}

.image-card.deleted .overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: white;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}
```

---

## State Management (Zustand)

```typescript
interface GalleryStore {
  images: ReferenceImage[];
  deletedImages: ReferenceImage[];
  showDeleted: boolean;

  // Actions
  softDeleteImage: (id: number) => Promise<void>;
  undoDelete: (id: number) => Promise<void>;
  permanentlyDeleteImage: (id: number) => Promise<void>;
  restoreImage: (id: number) => Promise<void>;
  toggleShowDeleted: () => void;
}

export const useGalleryStore = create<GalleryStore>((set) => ({
  images: [],
  deletedImages: [],
  showDeleted: false,

  softDeleteImage: async (id) => {
    await fetch(`/api/projects/${slug}/references/${id}`, {
      method: 'DELETE'
    });
    set((state) => ({
      images: state.images.filter(img => img.id !== id),
      deletedImages: [...state.deletedImages, state.images.find(img => img.id === id)]
    }));
  },

  undoDelete: async (id) => {
    await fetch(`/api/projects/${slug}/references/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ restore: true })
    });
    set((state) => ({
      deletedImages: state.deletedImages.filter(img => img.id !== id),
      images: [...state.images, state.deletedImages.find(img => img.id === id)]
    }));
  },

  permanentlyDeleteImage: async (id) => {
    await fetch(`/api/projects/${slug}/references/${id}/permanent?confirm=true`, {
      method: 'DELETE'
    });
    set((state) => ({
      deletedImages: state.deletedImages.filter(img => img.id !== id)
    }));
  },

  toggleShowDeleted: () => {
    set((state) => ({ showDeleted: !state.showDeleted }));
  },
}));
```

---

## User Education

### In-App Help Text

```tsx
// Show next to delete button
<Tooltip>
  Hide this image from the gallery.
  You can restore it later from the deleted items view.
  It will be automatically removed after 30 days.
</Tooltip>

// Show next to permanent delete
<Tooltip danger>
  Permanently remove this image. This cannot be undone!
  The file will be deleted from disk and the database record removed.
</Tooltip>
```

### In Documentation

Add to help/FAQ:

> **Q: What's the difference between "Delete" and "Permanently Delete"?**
>
> **Delete** hides the image from the gallery but keeps it in the database for 30 days.
> You can restore it anytime during this period. After 30 days, it's automatically removed.
>
> **Permanently Delete** immediately removes the image from disk and database.
> This cannot be undone!

---

## Implementation Priority

### Week 1: Soft Delete Improvements
- [ ] Add undo notification after soft-delete
- [ ] Set undo timeout to 60 seconds
- [ ] Update delete button text to "Hide"
- [ ] Add help tooltip

### Week 2: Permanent Delete
- [ ] Implement `/permanent` endpoint
- [ ] Add permanent delete dialog (admin only)
- [ ] Add multi-step confirmation
- [ ] Add deletion reason logging

### Week 3: Deleted Items View
- [ ] Add "Show Deleted Images" toggle (admin)
- [ ] Style deleted images differently
- [ ] Add restore buttons
- [ ] Add batch restore/delete

### Week 4: Auto-Cleanup
- [ ] Setup nightly cleanup cron job
- [ ] Run cleanup script at 2 AM
- [ ] Log cleanup results
- [ ] Monitor disk usage

---

## Testing Checklist

- [ ] Soft delete hides image from UI
- [ ] Undo restores image within 60 seconds
- [ ] Undo button appears in notification
- [ ] Notification auto-dismisses after 60 seconds
- [ ] Admin can see deleted items
- [ ] Permanent delete requires confirmation
- [ ] Permanent delete removes file from disk
- [ ] Permanent delete removes DB record
- [ ] Cleanup script runs nightly
- [ ] Cleanup script frees disk space
- [ ] Help text is clear and visible
- [ ] Dialog warnings are prominent

---

## References

- `docs/features/GALLERY_DELETE_STRATEGY.md` - Delete strategy details
- `src/app/api/projects/[slug]/references/[imageId]/permanent/route.ts` - Permanent delete endpoint
- `scripts/migrations/cleanup-old-deleted-images.js` - Cleanup script

---

**Last Updated**: October 26, 2025
**Status**: Ready for implementation
