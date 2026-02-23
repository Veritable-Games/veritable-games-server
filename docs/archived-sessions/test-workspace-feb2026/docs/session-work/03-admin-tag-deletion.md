# Admin Tag Deletion Feature

**Session Date**: November 24, 2025
**Status**: ✅ Completed

---

## Overview

Implemented bulk tag deletion functionality for admin and moderator users, allowing them to select multiple tags and delete them via keyboard shortcut with confirmation modal.

---

## Feature Requirements

### User Story

**As an admin**, I want to:
1. Select multiple tags in the sidebar
2. Press the Delete key to delete them
3. See a confirmation modal before deletion
4. Delete all selected tags at once

### Access Control

**Allowed Roles**:
- `admin`
- `moderator`

**Restricted Users**:
- Regular users cannot see or use deletion features
- Delete key listener only active for admins

---

## Implementation

### Frontend Component

**File**: `frontend/src/components/library/TagFilterSidebar.tsx`

#### State Management

```typescript
// Tag deletion state (admin only)
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

// Check if user is admin
const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
```

#### Delete Key Listener

```typescript
// Delete key listener (admin only)
useEffect(() => {
  if (!isAdmin) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Delete' && selectedTags.length > 0) {
      setShowDeleteModal(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isAdmin, selectedTags]);
```

**Behavior**:
- Only activates if user is admin/moderator
- Only triggers if at least one tag is selected
- Global keyboard listener (works anywhere on page)
- Cleanup on unmount to prevent memory leaks

#### Deletion Handler

```typescript
const handleDeleteTags = async () => {
  if (!isAdmin || selectedTags.length === 0 || isDeleting) return;

  setIsDeleting(true);
  try {
    const failedDeletions: string[] = [];

    // Delete each selected tag
    for (const tagName of selectedTags) {
      const tag = tags.find(t => t.name === tagName);
      if (!tag) continue;

      const response = await fetchJSON(`/api/library/tags/${tag.id}`, {
        method: 'DELETE',
      });

      if (!response.success) {
        failedDeletions.push(tagName);
      }
    }

    // Show results
    if (failedDeletions.length > 0) {
      alert(
        `Failed to delete ${failedDeletions.length} tag(s): ${failedDeletions.join(', ')}`
      );
    }

    // Refresh tags list
    setShowDeleteModal(false);
    onRefreshTags?.();
    onClearFilters(); // Clear selection
  } catch (error) {
    console.error('Failed to delete tags:', error);
    alert('Failed to delete tags');
  } finally {
    setIsDeleting(false);
  }
};
```

**Features**:
- Loops through each selected tag
- Calls DELETE API for each tag
- Tracks failures and reports them
- Refreshes tag list on success
- Clears selection after deletion
- Always resets loading state

#### Confirmation Modal

```tsx
{isAdmin && showDeleteModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Delete Selected Tags?
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Are you sure you want to delete {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}?
        This will remove the tag{selectedTags.length !== 1 ? 's' : ''} from all documents.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => setShowDeleteModal(false)}
          disabled={isDeleting}
          className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleDeleteTags}
          disabled={isDeleting}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700
                   disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
)}
```

**Features**:
- Modal overlay (dark background)
- Centered card design
- Dynamic text (singular/plural handling)
- Warning message about document impact
- Cancel and Delete buttons
- Disabled state during deletion
- Loading text ("Deleting...")

---

### Backend API

**File**: `frontend/src/app/api/library/tags/[id]/route.ts`

#### DELETE Endpoint

```typescript
async function deleteTag(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const params = await context.params;
    const tagId = parseInt(params.id);

    if (isNaN(tagId)) {
      return NextResponse.json({ success: false, error: 'Invalid tag ID' }, { status: 400 });
    }

    // Delete the tag (CASCADE will handle document associations)
    const result = await dbAdapter.query(
      `DELETE FROM shared.tags WHERE id = $1 RETURNING id`,
      [tagId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete tag' }, { status: 500 });
  }
}

export const DELETE = withSecurity(deleteTag, {
  enableCSRF: true, // DELETE request needs CSRF protection
});
```

**Security Features**:
1. **Authentication Check**: Requires valid user session
2. **Role Authorization**: Only admin/moderator can delete
3. **Input Validation**: Validates tag ID is a number
4. **CSRF Protection**: `withSecurity` wrapper enables CSRF validation
5. **Existence Check**: Verifies tag exists before deletion
6. **Error Handling**: Catches and logs errors

**Database Operations**:
```sql
DELETE FROM shared.tags WHERE id = $1 RETURNING id
```

**CASCADE Behavior**:
- Foreign key constraints with `ON DELETE CASCADE`
- Automatically removes from `library.library_document_tags`
- Automatically removes from `anarchist.document_tags`
- No orphaned associations left behind

---

## Database Schema

### Foreign Key Constraints

**library.library_document_tags**:
```sql
FOREIGN KEY (tag_id) REFERENCES shared.tags(id) ON DELETE CASCADE
```

**anarchist.document_tags**:
```sql
FOREIGN KEY (tag_id) REFERENCES shared.tags(id) ON DELETE CASCADE
```

**Impact**:
- Deleting a tag from `shared.tags` automatically removes all document associations
- No manual cleanup required
- Maintains referential integrity

---

## User Workflow

### Step-by-Step Usage

1. **Select Tags**:
   - Click tag pills in sidebar to select (blue highlight)
   - Can select multiple tags
   - Selection count shown: "X filters active"

2. **Initiate Deletion**:
   - Press `Delete` key on keyboard
   - Confirmation modal appears

3. **Confirm Deletion**:
   - Read warning message
   - Click "Delete" button (or "Cancel" to abort)
   - Button shows "Deleting..." during operation

4. **Results**:
   - Success: Modal closes, tags list refreshes, selection cleared
   - Partial failure: Alert shows which tags failed to delete
   - Complete failure: Alert shows error message

### Visual Feedback

**Selected Tags**:
```css
bg-blue-900/40 text-blue-300  /* Selected state */
bg-gray-800/40 text-gray-400  /* Normal state */
```

**Modal States**:
- Normal: "Delete" button (red)
- Loading: "Deleting..." button (red, disabled)
- Error: Alert dialog with failure details

---

## Error Handling

### Frontend Errors

**Network Failure**:
```javascript
catch (error) {
  console.error('Failed to delete tags:', error);
  alert('Failed to delete tags');
}
```

**Partial Failures**:
```javascript
if (failedDeletions.length > 0) {
  alert(
    `Failed to delete ${failedDeletions.length} tag(s): ${failedDeletions.join(', ')}`
  );
}
```

### Backend Errors

**401 Unauthorized**:
```json
{ "success": false, "error": "Authentication required" }
```

**403 Forbidden**:
```json
{ "success": false, "error": "Admin access required" }
```

**400 Bad Request**:
```json
{ "success": false, "error": "Invalid tag ID" }
```

**404 Not Found**:
```json
{ "success": false, "error": "Tag not found" }
```

**500 Internal Server Error**:
```json
{ "success": false, "error": "Failed to delete tag" }
```

---

## Testing Scenarios

### Successful Deletion

**Setup**:
1. Login as admin
2. Select 1-3 tags
3. Press Delete key
4. Click "Delete" in modal

**Expected**:
- Modal closes
- Tags disappear from list
- Selection cleared
- Tag count updates

### Authorization Tests

**Non-admin user**:
- Delete key should not trigger modal
- Direct API call returns 403 Forbidden

**Unauthenticated**:
- Direct API call returns 401 Unauthorized

### Edge Cases

**Delete non-existent tag**:
- API returns 404 Not Found
- Error message shown to user

**Delete with documents**:
- Tag deleted from `shared.tags`
- All document associations removed via CASCADE
- Documents remain intact

**Network failure**:
- Error message shown
- Tag list not refreshed
- Selection preserved

---

## Performance Considerations

### Bulk Deletion

**Current**: Sequential API calls
```javascript
for (const tagName of selectedTags) {
  const response = await fetchJSON(`/api/library/tags/${tag.id}`, {
    method: 'DELETE',
  });
}
```

**Implications**:
- 10 tags = 10 HTTP requests
- May be slow for large selections
- But: Provides granular error reporting

**Future Optimization** (if needed):
```javascript
// Batch deletion endpoint
POST /api/library/tags/batch-delete
{ tagIds: [1, 2, 3, ...] }
```

### Database CASCADE

**Current**: Database handles CASCADE automatically
- Fast: Single DELETE per tag
- Reliable: Database ensures consistency
- No N+1 query issues

---

## Security Considerations

### CSRF Protection

**Enabled**:
```typescript
export const DELETE = withSecurity(deleteTag, {
  enableCSRF: true,
});
```

**Mechanism**:
- Requires CSRF token in request headers
- Token generated on page load
- Prevents cross-site deletion attacks

### Role-Based Access Control

**Frontend**:
```typescript
const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
if (!isAdmin) return; // Don't show delete features
```

**Backend**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

**Defense in Depth**: Both frontend and backend check authorization

---

## Commits

**Primary Commit**: `b430817` - Add admin tag deletion functionality and remove redundant author tags

**Related Commits**:
- Initial implementation of DELETE endpoint
- Integration with TagFilterSidebar
- Modal styling and UX

---

## Future Enhancements

### Potential Improvements

1. **Undo Functionality**:
   - Store deleted tags temporarily
   - Allow restoration within session
   - "Undo" button after deletion

2. **Batch API Endpoint**:
   - Delete multiple tags in single request
   - Faster for large selections
   - Transactional (all or nothing)

3. **Confirmation Prompt Enhancement**:
   - Show document count per tag
   - List affected documents
   - More informative warning

4. **Audit Log**:
   - Record tag deletions
   - Track which admin deleted what
   - Timestamp and reason

5. **Tag Merge Instead of Delete**:
   - Offer to merge similar tags
   - Preserve document associations
   - More flexible than deletion

---

## Known Limitations

1. **Sequential Deletion**:
   - Slow for many tags (10+ selections)
   - Could benefit from batch endpoint

2. **No Undo**:
   - Deletion is permanent
   - No built-in restoration mechanism

3. **Limited Feedback**:
   - Simple alert for failures
   - Could show detailed error reasons

4. **No Audit Trail**:
   - No record of who deleted what
   - No deletion history
