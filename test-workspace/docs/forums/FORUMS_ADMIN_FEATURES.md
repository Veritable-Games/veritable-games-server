# Forums Admin Management Features - Comprehensive Analysis

**Date**: October 26, 2025
**Codebase**: Veritable Games (veritable-games-main)
**Analysis Scope**: Very thorough - Full component, API route, and permission system analysis

---

## Executive Summary

The forums system has a comprehensive admin management interface accessible from the main forums page. Admins (users with `role === 'admin'`) have access to:

1. **Category Management** - Create, edit, delete, reorder, toggle visibility
2. **Section Management** - Create, edit, delete, reorder sections
3. **Topic Moderation** - Lock, pin, mark as solved
4. **Keyboard Shortcuts** - Advanced management via keyboard (Ctrl+Click, Shift+Click, Alt+Click, Tab, Delete)

All admin features are protected by role-based access control and require either `admin` or `moderator` roles.

---

## 1. MAIN FORUMS PAGE STRUCTURE

### File Location
- **Server Component**: `/frontend/src/app/forums/page.tsx`
- **Client Component**: `/frontend/src/components/forums/ForumsPageClient.tsx`
- **Category List Component**: `/frontend/src/components/forums/ForumCategoryList.tsx`

### Admin Detection Flow

```typescript
// In /frontend/src/app/forums/page.tsx
const user = await getCurrentUser(); // Server-side user check
const isAdmin = user?.role === 'admin' || user?.role === 'moderator';

// Passed to client component
<ForumsPageClient
  initialCategories={categories}
  initialSections={sections}
  stats={stats}
  isAdmin={isAdmin}  // Admin flag passed
/>
```

### Main Page UI Elements

**For Admins Only** (displayed based on `isAdmin` prop):

1. **Category List Header Help Text**
   - `Ctrl+click to select · Shift+click to edit · Alt+click to reorder · Esc to cancel`
   - Changes dynamically based on current mode

2. **Selection Counter**
   - Shows when categories are selected: `{selectedCount} selected`
   - Help text: `Tab to change visibility · Delete to remove · Esc to cancel`

3. **Mode Indicators**
   - Edit mode: `Step 1: Edit name → Enter to confirm • Step 2: Edit description → Ctrl+Enter to save • Esc to cancel`
   - Reorder mode: `Reordering (use ← ↑ → ↓, Enter to save, Esc to cancel)`

---

## 2. CATEGORY MANAGEMENT FEATURES

### A. Category Creation

**UI Location**: Bottom of each section (admin only)

```jsx
{/* Create category button */}
{isAdmin && creatingSectionId !== section.id && (
  <div className="px-4 py-2 bg-gray-800/10 border-t border-gray-700">
    <button
      onClick={() => setCreatingSectionId(section.id)}
      className="w-full py-1.5 text-sm text-blue-400 hover:text-blue-300"
    >
      + Add Category
    </button>
  </div>
)}
```

**Creation Flow**:
1. Admin clicks "+ Add Category" button
2. Two-step form:
   - **Step 1**: Enter category name (Enter to continue)
   - **Step 2**: Enter category description (Enter to create, Esc to go back)

**API Endpoint**: `POST /api/forums/categories`

**Payload**:
```javascript
{
  name: "Category Name",
  slug: "category-name",  // Auto-generated from name
  icon: "🎮",             // Optional emoji icon
  description: "Description text",  // Optional
  section: "section-id",   // Section this category belongs to
  is_public: true         // Public visibility
}
```

**Permission Check**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  throw new ValidationError('Only administrators and moderators can create categories');
}
```

---

### B. Category Editing

**UI Trigger**: Shift+click on a category row

**Edit States**:
- **Name Step** (orange border on left): Edit the category name
  - Enter confirms name → moves to description step
  - Esc cancels
  
- **Description Step**: Edit the category description
  - Ctrl+Enter saves changes
  - Back button returns to name step
  - Esc cancels

**Visual Indicators**:
- Editing category has orange left border: `bg-orange-900/20 border-l-4 border-orange-500`
- Category row changes to orange to show edit mode

**API Endpoint**: `PATCH /api/forums/categories/{slug}`

**Payload**:
```javascript
{
  name: "New Name",
  description: "New description",
  icon: "📚"  // Optional
}
```

**Permission Check**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  throw new ValidationError('Only administrators and moderators can update categories');
}
```

---

### C. Category Visibility Toggle (Batch)

**UI Trigger**: 
1. Ctrl+click (or Cmd+click) multiple categories to select them
2. Press Tab or call batch visibility toggle

**Visual Indicator**:
- Selected categories have blue left border: `bg-blue-900/20 border-l-4 border-blue-500`
- Selected count shown: `{selectedCount} selected`

**Operation**:
- Toggles `is_public` flag for all selected categories
- Admins see hidden categories (visibility icon 👁️‍🗨️ with slash)
- Users see hidden categories as 404

**API Endpoint**: `PATCH /api/forums/categories/{slug}`

**Payload**:
```javascript
{
  is_public: false  // or true
}
```

**Code Pattern** (Optimistic Update):
```typescript
// Optimistic: Update local state immediately
setCategories((prev) =>
  prev.map((c) =>
    categoryIds.includes(c.id as number) ? { ...c, is_public: !c.is_public } : c
  )
);

// Then: Make API calls
const promises = categoriesToUpdate.map((category) => {
  return fetchJSON(`/api/forums/categories/${category.slug}`, {
    method: 'PATCH',
    body: { is_public: !category.is_public }
  });
});
```

---

### D. Category Deletion (Batch)

**UI Trigger**: 
1. Ctrl+click to select categories
2. Press Delete key

**Confirmation**: 
```javascript
`Delete ${selectedCount} categories?

${categoryNames}

Topics will be moved to Off-Topic.`
```

**Protection**:
- System categories (`forum-rules`, `off-topic`) are protected
- Topics are moved to Off-Topic category before deletion
- Confirmation required before deletion

**API Endpoint**: `DELETE /api/forums/categories/{slug}`

**Query Parameters**:
```
?moveToSlug=off-topic
```

**Permission Check**:
```typescript
if (user.role !== 'admin') {
  throw new ValidationError('Only administrators can delete categories');
}
```

**Note**: Only admins can delete (not moderators)

---

### E. Category Reordering

**UI Trigger**: Alt+click on a category to enter reorder mode

**Reorder Mode**:
- Category text changes to purple: `text-purple-300`
- Shows `↕ MOVING ↔` indicator
- Use arrow keys (↑ ↓) to move up/down
- Enter key saves reorder
- Esc key cancels

**Visual Indicators**:
- Reordering category has purple left border: `bg-purple-900/20 border-l-4 border-purple-500`
- Cannot edit, select, or reorder other categories while in reorder mode

**API Endpoint**: `POST /api/forums/categories/batch-update`

**Payload**:
```javascript
{
  updates: [
    { id: 1, sort_order: 0 },
    { id: 2, sort_order: 1 },
    { id: 3, sort_order: 2 }
  ]
}
```

**Permission Check**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  throw new ValidationError('Only administrators and moderators can reorder categories');
}
```

---

## 3. SECTION MANAGEMENT FEATURES

**Sections** are top-level groupings of categories (e.g., "Game Projects", "Community Discussion")

### A. Section Creation

**UI Location**: Bottom of page, "+ Create New Section" button (admin only)

**Creation Flow**:
1. Admin clicks button → input field appears
2. Enter section name → Enter to create
3. Esc to cancel

**API Endpoint**: `POST /api/forums/sections`

**Payload**:
```javascript
{
  id: "section-slug",        // Generated from name
  display_name: "Section Name"
}
```

**Permission Check**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  throw new ValidationError('Only administrators and moderators can create sections');
}
```

---

### B. Section Editing

**UI Location**: Edit button (pencil icon) next to section name (admin only)

**Edit Mode**:
- Section name becomes inline editable field
- Blue border indicates edit mode
- Enter to save
- Esc to cancel

**API Endpoint**: `PATCH /api/forums/sections/{id}`

**Payload**:
```javascript
{
  display_name: "New Section Name"
}
```

---

### C. Section Reordering

**UI Location**: Fixed-position arrow buttons (↑ ↓) on left side of each section

**Controls**:
- Up arrow (↑): Move section up
- Down arrow (↓): Move section down
- Disabled when at top/bottom
- Disabled while editing

**Visual State**:
- Hover: Text changes to white
- Disabled: Gray text, not-allowed cursor

**API Endpoint**: `POST /api/forums/sections/batch-reorder`

**Payload**:
```javascript
{
  updates: [
    { id: "general", sort_order: 0 },
    { id: "projects", sort_order: 1 },
    { id: "announcements", sort_order: 2 }
  ]
}
```

---

### D. Section Deletion

**UI Location**: Delete button (trash icon) next to section name (admin only)

**Confirmation**:
```javascript
`Delete section "${section.display_name}"?`

// If section has categories:
`Delete section "${section.display_name}" and all ${categoryCount} categories within it?

This will permanently delete all categories and their topics.`
```

**Behavior**:
- Deletes section and all its categories
- Topics in deleted categories are moved to Off-Topic

**API Endpoint**: `DELETE /api/forums/sections/{id}`

**Permission Check**:
```typescript
if (user.role !== 'admin' && user.role !== 'moderator') {
  throw new ValidationError('Only administrators and moderators can delete sections');
}
```

---

## 4. TOPIC MODERATION FEATURES

**Location**: Topic view page (visible in moderation dropdown for moderators/admins)

### A. Moderation Controls

**UI Component**: `OptimisticModerationDropdown` (red button with wrench icon)

**Trigger**: Red button labeled "Moderate" with dropdown menu

**Available Actions** (for moderators/admins):

#### 1. Lock/Unlock Topic
- **Icon**: 🔒 (Lock) / 🔓 (Unlock)
- **Effect**: Prevents new replies
- **API Endpoint**: `POST /api/forums/topics/{id}/lock`
- **Payload**: `{ locked: boolean }`
- **Permission**: Moderator or Admin only
- **Visual Badge**: Red "🔒 Locked" badge on topic

#### 2. Pin/Unpin Topic
- **Icon**: 📌 (Pin)
- **Effect**: Moves topic to top of category
- **API Endpoint**: `POST /api/forums/topics/{id}/pin`
- **Payload**: `{ pinned: boolean }`
- **Permission**: Moderator or Admin only
- **Visual Badge**: Blue "📌 Pinned" badge on topic

#### 3. Mark Solved/Unsolved
- **Icon**: ✓ (Checkmark)
- **Effect**: Marks topic as having a solution
- **API Endpoint**: `POST /api/forums/topics/{id}/solved`
- **Payload**: `{ solved: boolean }`
- **Permission**: Topic author or Moderator/Admin
- **Visual Badge**: Green "✓ Solved" badge on topic
- **Special**: When unmarked as solved, clears any marked solution replies

---

### B. Status Badges

**Component**: `OptimisticStatusBadges`

**Displays**:
- 🔒 Locked - Red badge
- 📌 Pinned - Blue badge
- ✓ Solved - Green badge
- 📦 Archived - Gray badge (if applicable)

**Features**:
- Optimistic updates (instant visual feedback)
- Pulse animation during pending state
- Real-time updates via SSE events

---

## 5. KEYBOARD SHORTCUTS (Admin Only)

### Category Management Shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| **Ctrl+Click** | Select/deselect category | Can select multiple |
| **Shift+Click** | Enter edit mode | Only one at a time |
| **Alt+Click** | Enter reorder mode | Only one at a time |
| **Tab** (selected) | Toggle visibility | With selected categories |
| **Delete** (selected) | Delete categories | With selected categories, requires confirm |
| **Enter** (editing name) | Confirm name → description | Two-step edit flow |
| **Ctrl+Enter** (editing desc) | Save changes | Completes edit |
| **Escape** | Exit any mode | Works in all modes |
| **Arrow Keys** (reordering) | Move up/down | In reorder mode |
| **Enter** (reordering) | Save reorder | Finalizes changes |

---

## 6. PERMISSION MODEL

### Role-Based Access Control

```typescript
// Admin/Moderator distinction:

// ADMIN can:
✓ Create categories
✓ Edit categories
✓ Delete categories
✓ Toggle category visibility
✓ Reorder categories
✓ Create sections
✓ Edit sections
✓ Delete sections
✓ Reorder sections
✓ Lock topics
✓ Pin topics
✓ Mark topics as solved
✓ See hidden categories

// MODERATOR can:
✓ Create categories
✓ Edit categories
✗ Delete categories (admin-only)
✓ Toggle category visibility
✓ Reorder categories
✓ Create sections
✓ Edit sections
✓ Delete sections
✓ Reorder sections
✓ Lock topics
✓ Pin topics
✓ Mark topics as solved
✓ See hidden categories

// REGULAR USER can:
✗ No admin features visible
✗ Cannot see hidden categories
✓ Can mark own topics as solved
```

### Permission Check Pattern

```typescript
// API Route Pattern
export const POST = withSecurity(async (request) => {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthenticationError();
  }
  
  if (user.role !== 'admin' && user.role !== 'moderator') {
    throw new ValidationError('Only administrators and moderators can...');
  }
  
  // Perform action
});

// For delete-only operations:
if (user.role !== 'admin') {
  throw new ValidationError('Only administrators can delete categories');
}
```

---

## 7. API ROUTES SUMMARY

### Category APIs

| Route | Method | Purpose | Permission | Features |
|-------|--------|---------|-----------|----------|
| `/api/forums/categories` | GET | List all categories | Any user | Role-based filtering |
| `/api/forums/categories` | POST | Create category | Admin/Mod | Icon, description support |
| `/api/forums/categories/{slug}` | GET | Get single category | Any user | 404 if hidden (non-admin) |
| `/api/forums/categories/{slug}` | PATCH | Update category | Admin/Mod | Name, desc, icon, visibility |
| `/api/forums/categories/{slug}` | DELETE | Delete category | Admin only | Moves topics to off-topic |
| `/api/forums/categories/batch-update` | POST | Reorder categories | Admin/Mod | Atomic batch update |

### Section APIs

| Route | Method | Purpose | Permission | Features |
|-------|--------|---------|-----------|----------|
| `/api/forums/sections` | GET | List sections | Any user | Returns all sections |
| `/api/forums/sections` | POST | Create section | Admin/Mod | Auto slug generation |
| `/api/forums/sections/{id}` | PATCH | Update section name | Admin/Mod | Display name update only |
| `/api/forums/sections/{id}` | DELETE | Delete section | Admin/Mod | Deletes categories within |
| `/api/forums/sections/batch-reorder` | POST | Reorder sections | Admin/Mod | Atomic batch update |

### Topic Moderation APIs

| Route | Method | Purpose | Permission | Status Flag |
|-------|--------|---------|-----------|------------|
| `/api/forums/topics/{id}/lock` | POST | Toggle lock | Mod/Admin | LOCKED |
| `/api/forums/topics/{id}/pin` | POST | Toggle pin | Mod/Admin | PINNED |
| `/api/forums/topics/{id}/solved` | POST | Toggle solved | Author/Mod/Admin | SOLVED |

---

## 8. STATE MANAGEMENT

### Client State in ForumCategoryList

```typescript
// Selection state
const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());

// Editing state
const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
const [editStep, setEditStep] = useState<'name' | 'description'>('name');
const [editName, setEditName] = useState('');
const [editIcon, setEditIcon] = useState('');
const [editDescription, setEditDescription] = useState('');

// Reordering state
const [reorderingCategoryId, setReorderingCategoryId] = useState<number | null>(null);
const [reorderedCategories, setReorderedCategories] = useState<ForumCategory[]>([]);

// Section management state
const [sections, setSections] = useState<ForumSection[]>(initialSections);
const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
const [isCreatingSection, setIsCreatingSection] = useState(false);

// UI state
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### Mode State

```typescript
interface ModeState {
  selectedCount: number;
  isEditing: boolean;
  isReordering: boolean;
  isCreating: boolean;
}
```

---

## 9. VISUAL STYLING

### Color Coding for States

| State | Background | Border | Text Color |
|-------|-----------|--------|-----------|
| Editing | `bg-orange-900/20` | `border-l-4 border-orange-500` | Orange text |
| Selected | `bg-blue-900/20` | `border-l-4 border-blue-500` | Blue text |
| Reordering | `bg-purple-900/20` | `border-l-4 border-purple-500` | Purple text |
| Hidden (Admin) | Normal | Normal | Eye-slash icon in red |
| Normal (Hover) | `hover:bg-gray-800/30` | - | - |

### Badge Styling

```typescript
// Status badges
| Status | Background | Text | Icon |
|--------|-----------|------|------|
| Locked | `bg-red-500/20` | `text-red-400` | 🔒 |
| Pinned | `bg-blue-500/20` | `text-blue-400` | 📌 |
| Solved | `bg-green-500/20` | `text-green-400` | ✓ |
| Archived | `bg-gray-500/20` | `text-gray-400` | 📦 |
```

---

## 10. ERROR HANDLING

### Error Response Pattern

All API routes use `errorResponse()` utility:

```typescript
catch (error) {
  console.error('[API] Error:', error);
  return errorResponse(error);
}
```

**Error Types**:
- `AuthenticationError` - Not logged in
- `ValidationError` - Invalid input
- `PermissionError` - Insufficient permissions
- `NotFoundError` - Resource not found

**Client-Side Error Handling**:

```typescript
try {
  const data = await fetchJSON('/api/...');
  if (data.success) {
    // Handle success
  }
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to...');
  setTimeout(() => handleRefresh(), 1000); // Auto-retry
}
```

---

## 11. OPTIMISTIC UI UPDATES

### Pattern Used

1. **Update local state immediately** (optimistic)
2. **Make API call** in background
3. **Handle errors by refreshing** from server

**Example** (batch visibility toggle):

```typescript
// Step 1: Optimistic update
setCategories((prev) =>
  prev.map((c) =>
    categoryIds.includes(c.id) ? { ...c, is_public: !c.is_public } : c
  )
);

// Step 2: Make API calls
const promises = categoriesToUpdate.map((category) => {
  return fetchJSON(`/api/forums/categories/${category.slug}`, {
    method: 'PATCH',
    body: { is_public: !category.is_public }
  });
});

const results = await Promise.all(promises);

// Step 3: Update with actual responses
const updatedCategories = results
  .filter(r => r.success && r.data?.category)
  .map(r => r.data.category);

// Step 4: On error, auto-refresh
if (error) {
  setTimeout(() => handleRefresh(), 1000);
}
```

---

## 12. REAL-TIME UPDATES

### Topic Moderation Events (SSE)

Topic moderation actions broadcast events:

```typescript
// In ForumModerationService or API routes
ForumServiceUtils.invalidateCaches(); // Clear caches
forumEventBroadcaster.broadcast({
  type: 'topic-locked',
  data: { topicId, locked: true }
});
```

**Event Types**:
- `topic-locked` / `topic-unlocked`
- `topic-pinned` / `topic-unpinned`
- `topic-solved` / `topic-unsolved`
- `topic-deleted`
- `topic-archived`

**Client Listener**:

```typescript
useForumEvents((event) => {
  if (event.type === 'topic-locked') {
    updateTopicStatus(event.data.topicId, { is_locked: true });
  }
});
```

---

## 13. KEY UI COMPONENTS

### Component Hierarchy

```
ForumsPageClient
├── ForumCategoryList (memo)
│   ├── ForumCategoriesBySection (maps sections)
│   │   ├── Section Header (edit/delete buttons)
│   │   ├── Category Rows
│   │   │   ├── Category Display (link)
│   │   │   ├── Edit Form (inline)
│   │   │   └── Reorder Indicator (purple)
│   │   └── Add Category Button
│   ├── Fixed Section Arrow Buttons (↑ ↓)
│   └── Create New Section Button
└── TopicList (recent topics)
```

### Component Props

```typescript
interface ForumCategoryListProps {
  initialCategories: ForumCategory[];
  initialSections: ForumSection[];
  isAdmin: boolean;
  onModeChange?: (mode: ModeState) => void;
}

interface OptimisticModerationDropdownProps {
  topic: { is_locked?: boolean; is_pinned?: boolean; is_solved?: boolean };
  actions: OptimisticActions;
  isPending: boolean;
}

interface OptimisticStatusBadgesProps {
  topic: { is_locked?: boolean; is_pinned?: boolean; is_solved?: boolean };
  isPending?: boolean;
  showIcons?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

---

## 14. DATA TYPES

### ForumCategory

```typescript
interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  section?: string;
  sort_order?: number;
  is_public: boolean;      // Hidden if false
  topic_count?: number;
  post_count?: number;
  last_activity_at?: string;
  created_at?: string;
  updated_at?: string;
}
```

### ForumSection

```typescript
interface ForumSection {
  id: string;              // e.g., "general", "projects"
  display_name: string;    // e.g., "General Discussion"
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}
```

### ForumTopic

```typescript
interface ForumTopic {
  id: number;
  title: string;
  content: string;
  category_id: number;
  user_id: number;
  is_locked?: boolean;     // Bit flag
  is_pinned?: boolean;     // Bit flag
  is_solved?: boolean;     // Bit flag
  is_archived?: boolean;   // Bit flag
  status: number;          // Combined bit flags
  created_at: string;
  updated_at: string;
}
```

---

## 15. IMPLEMENTATION PATTERNS

### Category CRUD Pattern

```typescript
// Create
await fetchJSON('/api/forums/categories', {
  method: 'POST',
  body: { name, slug, description, icon, section, is_public }
});

// Read (from initial load)
const categories = initialCategories;

// Update
await fetchJSON(`/api/forums/categories/${category.slug}`, {
  method: 'PATCH',
  body: { name, description, icon, is_public }
});

// Delete
await fetchJSON(`/api/forums/categories/${category.slug}`, {
  method: 'DELETE'
});

// Reorder (batch)
await fetchJSON('/api/forums/categories/batch-update', {
  method: 'POST',
  body: { updates: [{ id, sort_order }] }
});
```

### Topic Moderation Pattern

```typescript
// Lock topic
await fetchJSON(`/api/forums/topics/${topicId}/lock`, {
  method: 'POST',
  body: { locked: true }
});

// Pin topic
await fetchJSON(`/api/forums/topics/${topicId}/pin`, {
  method: 'POST',
  body: { pinned: true }
});

// Mark solved
await fetchJSON(`/api/forums/topics/${topicId}/solved`, {
  method: 'POST',
  body: { solved: true }
});
```

---

## 16. SUMMARY TABLE: ADMIN FEATURES

| Feature | Location | Trigger | API | Permission |
|---------|----------|---------|-----|-----------|
| **Create Category** | Bottom of section | Button click | POST /categories | Admin/Mod |
| **Edit Category** | Category row | Shift+click | PATCH /categories/{slug} | Admin/Mod |
| **Delete Category** | Category row | Ctrl+click, Delete | DELETE /categories/{slug} | Admin only |
| **Toggle Visibility** | Multiple rows | Ctrl+click, Tab | PATCH /categories/{slug} | Admin/Mod |
| **Reorder Categories** | Category row | Alt+click | POST /categories/batch-update | Admin/Mod |
| **Create Section** | Bottom | Button click | POST /sections | Admin/Mod |
| **Edit Section** | Section header | Edit button | PATCH /sections/{id} | Admin/Mod |
| **Delete Section** | Section header | Delete button | DELETE /sections/{id} | Admin/Mod |
| **Reorder Section** | Section | Arrow buttons | POST /sections/batch-reorder | Admin/Mod |
| **Lock Topic** | Topic view | Dropdown | POST /topics/{id}/lock | Mod/Admin |
| **Pin Topic** | Topic view | Dropdown | POST /topics/{id}/pin | Mod/Admin |
| **Mark Solved** | Topic view | Dropdown | POST /topics/{id}/solved | Author/Mod/Admin |

---

## 17. KEY FILES REFERENCE

### Frontend Components
- `/frontend/src/app/forums/page.tsx` - Server component, admin detection
- `/frontend/src/components/forums/ForumsPageClient.tsx` - Main client component
- `/frontend/src/components/forums/ForumCategoryList.tsx` - Category management UI (1,289 lines)
- `/frontend/src/components/forums/OptimisticModerationDropdown.tsx` - Moderation dropdown
- `/frontend/src/components/forums/OptimisticStatusBadges.tsx` - Status badges
- `/frontend/src/components/forums/TopicView.tsx` - Topic view with moderation

### API Routes
- `/frontend/src/app/api/forums/categories/route.ts` - Create/list categories
- `/frontend/src/app/api/forums/categories/[slug]/route.ts` - Get/update/delete category
- `/frontend/src/app/api/forums/categories/batch-update/route.ts` - Batch reorder
- `/frontend/src/app/api/forums/sections/route.ts` - Create/list sections
- `/frontend/src/app/api/forums/sections/[id]/route.ts` - Update/delete section
- `/frontend/src/app/api/forums/sections/batch-reorder/route.ts` - Batch reorder sections
- `/frontend/src/app/api/forums/topics/[id]/lock/route.ts` - Lock/unlock
- `/frontend/src/app/api/forums/topics/[id]/pin/route.ts` - Pin/unpin
- `/frontend/src/app/api/forums/topics/[id]/solved/route.ts` - Mark solved

### Services
- `/frontend/src/lib/forums/services/ForumService.ts` - Core category/topic operations
- `/frontend/src/lib/forums/services/ForumModerationService.ts` - Moderation operations
- `/frontend/src/lib/forums/services/ForumCategoryService.ts` - Category management
- `/frontend/src/lib/forums/services/ForumSectionService.ts` - Section management

---

## 18. TESTING CHECKLIST

To verify admin features work correctly:

**Category Management**:
- [ ] Admin can create new category (appears in list)
- [ ] Admin can edit category name and description
- [ ] Admin can toggle category visibility (hidden from non-admins)
- [ ] Admin can delete category (topics move to off-topic)
- [ ] Admin can reorder categories (persists)
- [ ] Moderator cannot delete categories
- [ ] Non-admin cannot see delete option

**Section Management**:
- [ ] Admin can create new section
- [ ] Admin can rename section
- [ ] Admin can reorder sections (arrow buttons work)
- [ ] Admin can delete section with categories
- [ ] Confirmation shows category count before deletion

**Topic Moderation**:
- [ ] Moderator can see "Moderate" dropdown
- [ ] Can lock topic (prevents new replies)
- [ ] Can pin topic (appears at top)
- [ ] Can mark as solved (topic author can also)
- [ ] Status badges appear correctly
- [ ] Status persists after page refresh

**Keyboard Shortcuts**:
- [ ] Ctrl+Click selects/deselects categories
- [ ] Shift+Click enters edit mode
- [ ] Alt+Click enters reorder mode
- [ ] Tab toggles visibility (with selection)
- [ ] Delete deletes (with selection)
- [ ] Escape cancels any mode

**Permissions**:
- [ ] Non-admin sees no admin controls
- [ ] Moderator cannot delete
- [ ] Hidden categories return 404 for non-admins
- [ ] Only see own + admin-only categories as admin

---

## 19. PERFORMANCE CHARACTERISTICS

### Data Fetching
- **Categories**: Fetched on page load (server-side), cached in component
- **Sections**: Fetched on page load (server-side), cached in component
- **Refresh**: Auto-refresh on success (500ms delay), manual refresh available

### Optimizations
- Memoized category lists (prevent re-renders)
- Optimistic updates (instant UI feedback)
- Batch operations (single API call for multiple categories)
- Server-side filtering (role-based visibility)

### Caching
- Client-side component state (re-fetched on navigation)
- Server-side LRU cache for frequently accessed categories
- Cache invalidation on create/update/delete operations

---

## 20. KNOWN LIMITATIONS & CONSTRAINTS

1. **No Cross-Section Moves**: Categories cannot be moved between sections (must recreate)
2. **No Bulk Edit**: Only visibility can be toggled in batch (name/desc require individual edits)
3. **No Drag-Drop**: Reordering uses keyboard shortcuts only
4. **No Undo**: Changes are permanent (use backup if needed)
5. **Icon Selector**: Limited to predefined emoji set (24 options)
6. **Topic Ownership**: Only author or moderators can mark as solved

---

## Conclusion

The forums admin interface provides comprehensive management capabilities through:

1. **Intuitive UI** - Inline editing, visual modes, contextual help
2. **Keyboard Efficiency** - Advanced users can manage via keyboard shortcuts
3. **Optimistic Updates** - Instant feedback without server delays
4. **Safe Operations** - Confirmations for destructive actions
5. **Role-Based Security** - Admin and moderator levels with distinct permissions
6. **Real-Time Feedback** - Status badges with visual indicators

The implementation follows Next.js 15 patterns with Server Components for initial data fetching, Client Components for interactivity, and RESTful API routes with proper authentication and authorization checks.

