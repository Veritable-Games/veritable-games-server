# Forums Admin Features - Quick Reference

**Quick links**:
- **Full Guide**: See `FORUMS_ADMIN_FEATURES.md` (1,026 lines)
- **See Also**: `FORUMS_DOCUMENTATION_INDEX.md` for service documentation

---

## Admin Detection

```typescript
// Server-side (page.tsx)
const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
```

---

## Keyboard Shortcuts

| Key Combo | What | Where |
|-----------|------|-------|
| Ctrl+Click | Select category | Category list |
| Shift+Click | Edit category | Category list |
| Alt+Click | Reorder category | Category list |
| Tab | Toggle visibility | With selected |
| Delete | Delete | With selected |
| Enter | Confirm/Create | Forms |
| Ctrl+Enter | Save edit | Description field |
| Esc | Cancel | Any mode |
| Arrow Keys | Move up/down | Reorder mode |

---

## Admin UI Elements on Forums Page

### Category List Header
- Help text changes based on mode
- Shows selection count
- Visual indicators (orange=edit, blue=select, purple=reorder)

### Bottom of Each Section
- "+ Add Category" button (for creating new categories)

### Section Headers (Admin Only)
- Edit button (pencil icon) - Rename section
- Delete button (trash icon) - Delete section
- Fixed arrow buttons (↑ ↓) - Reorder sections

### Bottom of Page
- "+ Create New Section" button

---

## API Endpoints (Admin/Moderator)

### Categories
- `POST /api/forums/categories` - Create
- `PATCH /api/forums/categories/{slug}` - Update
- `DELETE /api/forums/categories/{slug}` - Delete (admin only)
- `POST /api/forums/categories/batch-update` - Reorder

### Sections
- `POST /api/forums/sections` - Create
- `PATCH /api/forums/sections/{id}` - Update
- `DELETE /api/forums/sections/{id}` - Delete
- `POST /api/forums/sections/batch-reorder` - Reorder

### Topics (Moderator only)
- `POST /api/forums/topics/{id}/lock` - Lock/unlock
- `POST /api/forums/topics/{id}/pin` - Pin/unpin
- `POST /api/forums/topics/{id}/solved` - Mark solved

---

## Permission Rules

```
ADMIN: Can create, edit, delete, reorder everything + see hidden categories
MODERATOR: Can create, edit, reorder everything EXCEPT delete + see hidden categories
USER: Cannot see any admin controls, cannot see hidden categories
```

**Key Difference**: Only ADMIN can DELETE categories/sections. Moderators can do everything else.

---

## File Locations

### Main Components
```
src/components/forums/
├── ForumsPageClient.tsx          (Main page - passes isAdmin prop)
├── ForumCategoryList.tsx         (Category management - 1,289 lines)
├── OptimisticModerationDropdown  (Topic moderation controls)
└── OptimisticStatusBadges        (Status badges)
```

### API Routes
```
src/app/api/forums/
├── categories/                   (Category endpoints)
│   ├── route.ts                  (POST/GET)
│   ├── [slug]/route.ts          (GET/PATCH/DELETE)
│   └── batch-update/route.ts    (POST batch reorder)
├── sections/                     (Section endpoints)
│   ├── route.ts                  (POST/GET)
│   ├── [id]/route.ts            (PATCH/DELETE)
│   └── batch-reorder/route.ts   (POST batch reorder)
└── topics/[id]/                  (Topic moderation)
    ├── lock/route.ts            (POST lock/unlock)
    ├── pin/route.ts             (POST pin/unpin)
    └── solved/route.ts          (POST mark solved)
```

### Services
```
src/lib/forums/services/
├── ForumCategoryService.ts       (Category operations)
├── ForumSectionService.ts        (Section operations)
└── ForumModerationService.ts     (Topic moderation)
```

---

## Category Creation Workflow

1. Click "+ Add Category" (appears at bottom of section)
2. Enter category name → Press Enter
3. Enter category description → Press Enter to create
4. New category appears in section

**Optional**: Add emoji icon during creation

---

## Category Editing Workflow

1. Shift+Click on category
2. Orange border indicates edit mode
3. Edit name → Press Enter
4. Edit description → Press Ctrl+Enter to save
5. Press Esc to cancel at any time

---

## Category Visibility Toggling

1. Ctrl+Click to select multiple categories (blue border)
2. Press Tab to toggle visibility
3. Hidden categories show eye-slash icon (red)
4. Hidden categories return 404 for non-admins

---

## Category Reordering Workflow

1. Alt+Click on category to enter reorder mode (purple border)
2. Use arrow keys (↑ ↓) to move
3. Press Enter to save
4. Press Esc to cancel

Cannot edit/select/reorder other categories while reordering.

---

## Category Deletion Workflow

1. Ctrl+Click to select categories (blue border)
2. Press Delete key
3. Confirm deletion
4. Topics moved to Off-Topic automatically

**Note**: Only ADMIN can delete (not moderator)

---

## Section Reordering

1. Look for fixed arrow buttons (↑ ↓) to the left of section headers
2. Click up/down arrows to move sections
3. Changes save immediately

---

## Topic Moderation (From Topic View)

1. Click red "Moderate" button with wrench icon
2. Choose from:
   - **Lock Topic** - Prevent new replies
   - **Pin Topic** - Move to top of category
   - **Mark Solved** - Mark topic as resolved
3. Status badges appear instantly (optimistic update)

---

## Status Badges (Topics)

- **🔒 Locked** - Red badge, topic cannot get new replies
- **📌 Pinned** - Blue badge, appears at top of category
- **✓ Solved** - Green badge, topic has a solution

Only topic author or moderators can mark as solved.

---

## Error Recovery

All operations auto-refresh on error after 1 second.
Check error message if operation fails.

---

## Hidden Categories

Admin-only feature: Toggle `is_public` to hide categories from non-admins.

- Admins see hidden categories with eye-slash icon (red)
- Non-admins see 404 for hidden categories
- Hidden categories don't appear in category lists for users

---

## State Management Notes

ForumCategoryList maintains:
- `selectedCategories` - Set of selected IDs
- `editingCategoryId` - Currently editing category
- `reorderingCategoryId` - Currently reordering category
- `sections` - All sections
- `categories` - All categories (memoized, filtered by visibility)

Mode is reflected in help text at top of category list.

---

## Visual Indicators

| Color | Meaning | Action |
|-------|---------|--------|
| **Blue** | Selected | Ctrl+Click to deselect |
| **Orange** | Editing | Shift+Click to cancel |
| **Purple** | Reordering | Alt+Click to cancel |
| **Red** | Hidden (admin only) | Tab to toggle visibility |

---

## Performance Notes

- Categories fetched server-side, cached in component
- Batch operations (single API call for multiple)
- Optimistic updates (instant UI feedback)
- Auto-refresh on error (1s delay)
- Memoized lists prevent unnecessary re-renders

---

## Testing Quick Checks

Admin Features:
- [ ] Can see all admin controls
- [ ] Can create category (appears immediately)
- [ ] Can edit category (name/description)
- [ ] Can toggle visibility (hidden shows eye-slash)
- [ ] Can delete category (with confirmation)
- [ ] Can reorder categories
- [ ] Can create/edit/delete/reorder sections
- [ ] Can lock/pin/solve topics

Moderator Features:
- [ ] Can see moderation controls
- [ ] Cannot see delete button for categories
- [ ] Cannot call DELETE endpoint (403 error)

User Features:
- [ ] Cannot see any admin controls
- [ ] Cannot see hidden categories
- [ ] Cannot see Delete buttons

---

## Common Tasks

**Hide a category from users**:
1. Ctrl+Click category (select)
2. Press Tab to toggle visibility
3. Eye-slash icon appears (red)

**Move category to different position**:
1. Alt+Click category (enter reorder mode)
2. Use arrow keys to move
3. Press Enter to save

**Delete category and preserve topics**:
1. Ctrl+Click category
2. Press Delete
3. Confirm deletion
4. Topics automatically move to Off-Topic

**Create new forum section**:
1. Click "+ Create New Section" at bottom
2. Enter section name
3. Press Enter
4. New section appears with categories

---

## Limitations

- Cannot move categories between sections (must recreate)
- Cannot bulk edit names/descriptions (only visibility)
- No drag-drop reordering (keyboard only)
- No undo (changes permanent)
- Icon limited to 24 predefined emoji

---

## Need More Details?

See **FORUMS_ADMIN_FEATURES.md** for:
- Complete API documentation
- Code examples
- Permission model details
- State management patterns
- Error handling
- Optimistic update patterns
- Real-time event system

