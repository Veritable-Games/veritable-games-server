# Forums React Components - Complete Analysis

## Overview

The forums system contains **21 component files** organized across multiple categories. It implements React 19 patterns with optimistic UI updates, SSE real-time events, and a sophisticated moderation system.

---

## Component Hierarchy & Architecture

### Level 1: Page Components (Server Components)
- `/app/forums/page.tsx` - Main forums landing page
- `/app/forums/browse/page.tsx` - Forum browsing interface
- `/app/forums/category/[slug]/page.tsx` - Category view
- `/app/forums/topic/[id]/page.tsx` - Topic detail view
- `/app/forums/create/page.tsx` - Topic creation form
- `/app/forums/search/page.tsx` - Forum search results

### Level 2: Client Components

#### A. Page-Level Wrapper Components (Client)
- **ForumsPageClient.tsx** - Main forums page client wrapper
  - Type: Client component (`'use client'`)
  - Manages: Mode state (editing, reordering, selecting)
  - Children: ForumCategoryList, TopicList, ForumSearch, NewTopicButton
  - Props: initialCategories, initialSections, stats, isAdmin

#### B. Feature Components (Core Business Logic)

**1. Category Management**
- **ForumCategoryList.tsx** (1,280 lines)
  - Type: Client component with memo optimization
  - Manages: Category CRUD, reordering, batch operations
  - Advanced Features:
    - Multi-step editing (name → description)
    - Drag-and-drop reordering with fixed arrows
    - Batch visibility toggle (Ctrl+Tab)
    - Batch delete (Delete key)
    - Section management (create, edit, delete, reorder)
    - Icon selection with registry
    - Keyboard shortcuts (Ctrl+click select, Shift+click edit, Alt+click reorder)
  - State Management:
    - `categories` - List of forum categories
    - `selectedCategories` - Set of selected category IDs
    - `editingCategoryId` - Currently editing category ID
    - `editStep` - Two-step edit process (name/description)
    - `reorderingCategoryId` - Category being reordered
    - `sections` - Forum sections (grouping categories)
  - API Integration: `fetchJSON()` wrapper for CSRF handling
  - Performance: `useMemo` for grouped categories

**2. Topic Display**
- **TopicRow.tsx** (354 lines)
  - Type: Client component
  - Displays: Single topic row in a list
  - Features:
    - Status badges (pinned, solved, locked)
    - Time formatting (relative/absolute)
    - Reply count, view count, last activity
    - Author information with links
  - Contains two exported components:
    - `TopicRow()` - Single topic display
    - `TopicList()` - Multiple topics with header

- **TopicView.tsx** (336 lines)
  - Type: Client component
  - Displays: Full topic detail view with optimistic moderation
  - Wraps: OptimisticTopicWrapper for real-time updates
  - Features:
    - Topic edit inline form
    - Author information fetching
    - Edit mode toggle
    - Topic deletion
    - Optimistic status badges
    - Moderation dropdown (admin only)
  - State Management:
    - `isEditing` - Whether in edit mode
    - `editTitle` / `editContent` - Edit form state
    - `topicAuthor` - Fetched author data
  - Integration: OptimisticTopicWrapper → OptimisticStatusBadges → OptimisticModerationDropdown

**3. Reply System**
- **ReplyList.tsx** (748 lines)
  - Type: Client component with memo optimization
  - Displays: Nested replies with recursive rendering
  - Complex Features:
    - Nested reply support (up to 5 levels deep)
    - Solution marking (can be marked/unmarked)
    - Inline editing with optimistic updates
    - Soft delete + hard delete (two-stage)
    - Reply-to-reply (nested replies)
    - Indentation based on nesting level
  - Optimistic UI Implementation:
    - `useOptimistic()` for reply list (React 19)
    - `useOptimistic()` for individual reply content
    - `useOptimistic()` for solution status
  - Contains two components:
    - `ReplyView()` - Single reply with memo optimization
    - `ReplyList()` - Container for all replies

**Key Pattern in ReplyView:**
```typescript
// Optimistic content updates
const [optimisticContent, setOptimisticContent] = useOptimistic(
  reply.content,
  (currentContent, newContent: string) => newContent
);

// Optimistic solution marking
const [optimisticIsSolution, setOptimisticIsSolution] = useState(reply.is_solution);

// On save: update optimistic state first, then fetch
setOptimisticContent(newContent);
const response = await fetch(`/api/forums/replies/${reply.id}`, {...});
if (response.ok) router.refresh(); // Sync with server
```

#### C. Optimistic UI Components (React 19 Patterns)

**1. OptimisticTopicWrapper.tsx** (164 lines)
- Type: Client component (wrapper pattern)
- Purpose: Provides optimistic moderation actions for topics
- Implementation:
  - Wraps `useOptimisticModeration()` hook
  - Uses render-props pattern for children
  - Exposes: `topic`, `actions`, `isPending`
- Callback Signature:
```typescript
children: (props: {
  topic: OptimisticTopic;
  actions: OptimisticActions;
  isPending: boolean;
}) => ReactNode
```

**2. OptimisticStatusBadges.tsx** (168 lines)
- Type: Client component
- Purpose: Display topic status with optimistic updates
- Features:
  - Two variants: `OptimisticStatusBadges` (full) and `CompactStatusBadges` (icons only)
  - Size variants: sm, md, lg
  - Status types: locked, pinned, solved, archived
  - Pulse animation during pending state
  - ARIA labels for accessibility
- Usage:
```typescript
<OptimisticStatusBadges
  topic={optimisticTopic}
  isPending={isPending}
  size="sm"
  showIcons={true}
/>
```

**3. OptimisticModerationDropdown.tsx** (179 lines)
- Type: Client component
- Purpose: Dropdown menu for moderation actions
- Features:
  - Three main actions: Lock/Unlock, Pin/Unpin, Mark Solved/Unsolved
  - Click-outside detection
  - Loading state during submission
  - Instant action with server sync
- Pattern:
```typescript
const handleAction = async (actionFn: () => Promise<void>) => {
  setShowDropdown(false);
  await actionFn(); // optimisticTopic state updates instantly
};
```

#### D. Form Components

**1. TopicEditForm.tsx** (102 lines)
- Type: Client component
- Purpose: Inline edit form for topic title/content
- Fields: Title (text), Content (HybridMarkdownEditor)
- No built-in state - props controlled
- Props: title, content, error, loading, onChange callbacks

**2. TopicFooter.tsx** (63 lines)
- Type: Client component
- Purpose: Footer with reply button and delete action
- Conditions:
  - Shows "Login to reply" if not authenticated
  - Shows reply button if logged in AND topic not locked
  - Shows delete button if author OR admin

#### E. Utility Components

**1. ForumSearch.tsx** (69 lines)
- Type: Client component
- Purpose: Search input with navigation
- Uses: `useTransition()` for non-blocking navigation
- Behavior: Navigates to `/forums/search?q=...` on submit

**2. ForumHeaderActions.tsx**
- Type: Client component
- Purpose: Header actions (menu/settings)

**3. NewTopicButton.tsx** (52 lines)
- Type: Client component
- Purpose: CTA button to create new topic
- Behavior:
  - Shows alert if not logged in
  - Navigates to `/forums/create` or `/forums/create?category={id}`

**4. TagDisplay.tsx** (202 lines)
- Type: Client component
- Purpose: Display forum tags with styling
- Exports:
  - `TagDisplay()` - Show tags with optional links
  - `PopularTags()` - Fetch and display popular tags
  - `TrendingTags()` - Fetch and display trending tags
- Features:
  - Size variants: sm, md, lg
  - Color-coded by tag.color
  - Max tag limit with "+N more" indicator
  - Usage count display option

**5. UserLink.tsx** (251 lines)
- Type: Client component
- Purpose: User profile link with optional avatar
- Exports:
  - `UserLink()` - Text link or avatar+text link
  - `UserAvatar()` - Standalone avatar with gradient fallback
- Features:
  - Avatar upload support with position/scale
  - Gradient fallback based on user ID hash
  - Hover effects
  - Custom avatar event listener for updates

**6. LoginWidget.tsx**
- Type: Client component
- Purpose: Login UI for logged-out users

**7. TagSelector.tsx**
- Type: Client component
- Purpose: Tag selection UI for topic creation/editing

#### F. Search Components

**1. ForumSearch.tsx** (mentioned above)

**2. ForumSearchClient.tsx**
- Type: Client component
- Purpose: Client-side search results filtering

**3. ForumSearchServer.tsx**
- Type: Server component
- Purpose: Server-side search result fetching

#### G. List Components

**1. ForumCategoriesGrid.tsx**
- Type: Client component
- Purpose: Grid layout for forum categories

---

## State Management Patterns

### 1. Server State + Optimistic Updates
```typescript
// In useOptimisticModeration hook
const [serverTopic, setServerTopic] = useState(initialTopic);
const [optimisticTopic, updateOptimisticTopic] = useOptimistic(
  serverTopic,
  (current, action) => applyModerationAction(current, action)
);

// When action succeeds:
setServerTopic(result.data.topic); // Sync optimistic to server state
```

### 2. Controlled Component Pattern
```typescript
// TopicView.tsx
const [editTitle, setEditTitle] = useState(initialTopic.title);
const [editContent, setEditContent] = useState(initialTopic.content);

// Pass to controlled child components
<TopicEditForm
  title={editTitle}
  content={editContent}
  onTitleChange={setEditTitle}
  onContentChange={setEditContent}
/>
```

### 3. Reducer Pattern (Complex State)
```typescript
// ForumCategoryList.tsx - Multi-step editing
const [editStep, setEditStep] = useState<'name' | 'description'>('name');
if (editStep === 'name') {
  // Show name input
} else {
  // Show description input
}
```

### 4. Optimistic Reply State
```typescript
// ReplyList.tsx - React 19 useOptimistic for replies
const [optimisticReplies, addOptimisticReply] = useOptimistic(
  replies,
  (current, newReply) => [...current, newReply]
);

// When submitting new reply:
addOptimisticReply(tempReply); // Show immediately
await fetch('/api/forums/replies', {...});
router.refresh(); // Sync with server
```

---

## Optimistic UI Implementation Details

### Pattern 1: Topic Moderation (Full Optimistic)
**Location:** OptimisticTopicWrapper + useOptimisticModeration hook

**Flow:**
1. User clicks "Lock Topic" button
2. OptimisticModerationDropdown calls `actions.toggleLock()`
3. useOptimisticModeration:
   - Immediately updates `optimisticTopic.is_locked = true`
   - Makes API call to `/api/forums/topics/{id}/lock`
   - On success: Updates `serverTopic` with confirmed state
   - On error: Rollback happens automatically (reverts to serverTopic)
4. OptimisticStatusBadges shows "Locked" badge immediately
5. Loading spinner appears during `isPending` state

**Code Flow:**
```typescript
// In useOptimisticModeration
startTransition(() => {
  updateOptimisticTopic({ type: 'lock' }); // Immediate UI update
});

// Then async API call
const response = await fetch(apiEndpoint, {...});
if (response.ok) {
  setServerTopic(result.data.topic); // Confirm state
  onSuccess?.('lock topic');
}
```

### Pattern 2: Reply Editing (Optimistic + Refresh)
**Location:** ReplyView component

**Flow:**
1. User clicks "Edit" on reply
2. User modifies content in HybridMarkdownEditor
3. User clicks "Save"
4. ReplyView:
   - Immediately updates `optimisticContent` with new text
   - Closes edit mode (`setIsEditing(false)`)
   - Makes API call to `/api/forums/replies/{id}`
   - On success: Calls `router.refresh()` to sync server state
   - On error: Reverts optimistic state and re-opens edit form

**Code Flow:**
```typescript
const [optimisticContent, setOptimisticContent] = useOptimistic(reply.content);

const handleSaveEdit = async () => {
  const newContent = editContent.trim();
  setOptimisticContent(newContent); // Immediate update
  setIsEditing(false);
  
  const response = await fetch(`/api/forums/replies/${reply.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content: newContent }),
  });
  
  if (response.ok) {
    router.refresh(); // Sync with server
  } else {
    setOptimisticContent(previousContent); // Rollback
    setIsEditing(true);
  }
};
```

### Pattern 3: Solution Marking (Optimistic + SSE)
**Location:** ReplyView component

**Flow:**
1. Topic author clicks "Mark as Solution"
2. ReplyView:
   - Immediately updates `optimisticIsSolution = true`
   - Makes API call to `/api/forums/replies/{id}/solution`
   - On success: Calls `router.refresh()` to sync
   - On error: Reverts optimistic state
3. Solution banner appears immediately (before server confirmation)
4. SSE events broadcast to all users viewing the topic
5. Other users see solution marked in real-time

### Pattern 4: New Reply List (Optimistic)
**Location:** ReplyList component

**Flow:**
1. User submits new reply
2. ReplyList:
   - Creates temporary reply object with `Date.now()` as ID
   - Immediately adds to `optimisticReplies` via `addOptimisticReply()`
   - Clears input field
   - Makes API call to `/api/forums/replies`
3. Reply appears in list immediately
4. On success: `router.refresh()` replaces temp reply with server ID
5. On error: `router.refresh()` removes optimistic reply

---

## Real-Time Updates (SSE Integration)

### useForumEvents Hook Pattern
**Location:** `/src/hooks/useForumEvents.ts`

**Features:**
- Server-Sent Events (SSE) connection to `/api/forums/events`
- Automatic reconnection on disconnect
- Event filtering by category or topic ID
- Type-safe event callbacks

**Integration with useOptimisticModeration:**
```typescript
// In useOptimisticModeration hook
useForumEvents({
  topicId: initialTopic.id,
  enabled: autoRefresh,
  
  onTopicLocked: (data) => {
    setServerTopic(prev => ({
      ...prev,
      is_locked: data.is_locked,
      status: data.status,
    }));
  },
  
  onTopicPinned: (data) => {
    // Similar update
  },
  // ... other status changes
});
```

**Real-time Broadcast:**
- Admin locks a topic
- All connected clients receive SSE event immediately
- `useOptimisticModeration` updates `serverTopic`
- `useOptimistic()` automatically syncs optimistic state with new server state
- All users see updated status instantly

---

## Server vs Client Component Distribution

### Server Components (SSR)
- `/app/forums/**/*.tsx` - Page routes (fetch data, pass to client)
- Category/Topic detail pages - Fetch and render server-rendered data

### Client Components
- **All components in `/components/forums/`** - Interactive features
- Reason: Need `useState`, `useCallback`, event handlers, optimistic updates

### Hybrid Approach
```typescript
// Page (Server)
export default async function TopicPage({ params }) {
  const params = await params;
  const topic = await fetchTopic(params.id); // Server-side fetch
  
  return <TopicView topic={topic} />; // Pass to client
}

// TopicView (Client)
'use client';
export function TopicView({ topic: initialTopic }) {
  // Wrap with optimistic moderation
  <OptimisticTopicWrapper initialTopic={initialTopic}>
    // Use optimistic state
  </OptimisticTopicWrapper>
}
```

---

## Component Dependencies & Data Flow

### Category Management Flow
```
ForumsPageClient (page wrapper)
  ├─ ForumSearch (search input)
  ├─ NewTopicButton (create button)
  └─ ForumCategoryList (category manager)
      ├─ [Category Row]
      │   ├─ Edit mode (inline edit form)
      │   ├─ Normal mode (link + info)
      │   └─ Reorder mode (↕ MOVING indicator)
      └─ [Section Row]
          └─ [Create Category in Section]
```

### Topic Detail Flow
```
TopicPage (Server)
  ├─ TopicView (Client)
  │   ├─ OptimisticTopicWrapper
  │   │   ├─ OptimisticStatusBadges
  │   │   ├─ OptimisticModerationDropdown
  │   │   └─ TopicEditForm (when editing)
  │   └─ TopicFooter (reply button + delete)
  └─ ReplyList
      ├─ ReplyView (for each reply)
      │   ├─ Avatar + Author info
      │   ├─ Reply content (or edit form)
      │   ├─ Solution badge (if marked)
      │   ├─ Reply actions (edit, delete, mark solution)
      │   └─ Nested ReplyView (children)
      └─ New Reply Form (reply-editor)
```

---

## Keyboard Shortcuts (ForumCategoryList)

| Action | Shortcut | Mode |
|--------|----------|------|
| Select | Ctrl+Click | Category selection |
| Edit | Shift+Click | Edit mode |
| Reorder | Alt+Click | Reordering |
| Toggle Visibility | Tab | Multi-select |
| Delete | Delete | Multi-select |
| Confirm Name | Enter | Edit (name step) |
| Save Description | Ctrl+Enter | Edit (description step) |
| Move Up | ↑ | Reordering |
| Move Down | ↓ | Reordering |
| Save Reorder | Enter | Reordering |
| Cancel Any | Escape | Any mode |

---

## Performance Optimizations

### 1. Memoization
```typescript
// ReplyView - memo with custom comparison
const ReplyView = memo(ReplyViewComponent, (prevProps, nextProps) => {
  return (
    prevProps.reply.id === nextProps.reply.id &&
    prevProps.reply.updated_at === nextProps.reply.updated_at &&
    // ... other comparisons
  );
});

// ForumCategoryList - useMemo for grouped categories
const groupedCategories = useMemo(() => {
  return categories.reduce((acc, cat) => {
    const section = cat.section || 'misc';
    if (!acc[section]) acc[section] = [];
    acc[section].push(cat);
    return acc;
  }, {});
}, [categories]);
```

### 2. useCallback for Event Handlers
```typescript
// Prevent unnecessary re-renders of child components
const handleCategoryClick = useCallback(
  (category: ForumCategory, event: React.MouseEvent) => {
    // Handle click logic
  },
  [isAdmin, saving, editingCategoryId, reorderingCategoryId]
);
```

### 3. Lazy Loading
- TagDisplay: Fetch popular/trending tags on-demand
- UserLink: Fetch user data on hover (optional)

### 4. Virtualization (Not currently used)
- Large lists of replies could use react-window
- Categories are typically < 50, so not needed yet

---

## Type System

### Core Types
```typescript
// In @/lib/forums/types.ts
interface ForumCategory {
  id: number | string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  section?: string;
  is_public: boolean;
  topic_count: number;
  post_count: number;
  last_activity_at?: string;
}

interface ForumTopic {
  id: number;
  category_id: number;
  title: string;
  content: string;
  user_id: number;
  username: string;
  status: number; // Bit flags (locked, pinned, solved, archived)
  is_locked: boolean;
  is_pinned: boolean;
  is_solved: boolean;
  is_archived: boolean;
  reply_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

interface ForumReply {
  id: number;
  topic_id: number;
  user_id: number;
  username: string;
  content: string;
  parent_id?: number;
  is_deleted: boolean;
  is_solution: boolean;
  reply_depth: number;
  children?: ForumReply[];
  created_at: string;
  updated_at: string;
}
```

### Component Props
```typescript
// OptimisticTopic (from useOptimisticModeration)
interface OptimisticTopic {
  id: number;
  category_id: number;
  status: number;
  is_locked?: boolean;
  is_pinned?: boolean;
  is_solved?: boolean;
  is_archived?: boolean;
  [key: string]: any;
}

// TopicData (in TopicRow)
interface TopicData {
  id: number;
  title: string;
  username?: string;
  user_id?: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  is_solved?: boolean;
  status?: number;
  last_reply_at?: string;
  last_reply_username?: string;
  last_reply_user_id?: number;
}
```

---

## API Integration Points

### Endpoints Used by Components

| Component | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| ForumCategoryList | `/api/forums/categories` | GET/POST/PATCH/DELETE | CRUD operations |
| ForumCategoryList | `/api/forums/sections` | GET/POST/PATCH/DELETE | Section management |
| TopicView | `/api/forums/topics/{id}` | GET/PATCH/DELETE | Topic operations |
| TopicView | `/api/forums/topics/{id}/lock` | POST | Lock/unlock |
| TopicView | `/api/forums/topics/{id}/pin` | POST | Pin/unpin |
| TopicView | `/api/forums/topics/{id}/solved` | POST | Mark solved |
| ReplyList | `/api/forums/replies` | GET/POST | Create replies |
| ReplyList | `/api/forums/replies/{id}` | PATCH/DELETE | Edit/delete replies |
| ReplyList | `/api/forums/replies/{id}/solution` | POST/DELETE | Mark solution |
| useForumEvents | `/api/forums/events` | EventSource (SSE) | Real-time events |
| ForumSearch | `/forums/search?q=...` | Navigation | Search results |
| UserLink | `/api/users/{id}` | GET | Fetch user data |
| TagDisplay | `/api/forums/tags` | GET | Fetch popular/trending tags |

---

## Error Handling

### Pattern 1: Fetch Error Response
```typescript
const response = await fetch(url);
if (!response.ok) {
  const data = await response.json();
  throw new Error(data.error || 'Failed to update');
}
```

### Pattern 2: Optimistic Rollback
```typescript
setOptimisticState(newValue); // Immediate update

try {
  const response = await fetch(url, {...});
  if (!response.ok) {
    throw new Error('Failed');
  }
  setServerState(result.data); // Confirm
} catch (error) {
  setOptimisticState(previousValue); // Rollback
  throw error;
}
```

### Pattern 3: useOptimisticModeration Callbacks
```typescript
useOptimisticModeration({
  initialTopic,
  onSuccess: (action) => showToast(`${action} successful`),
  onError: (error) => showToast(`Error: ${error.message}`),
});
```

---

## Summary

### Key Strengths
1. **React 19 Optimistic UI** - Instant feedback with automatic rollback
2. **SSE Real-time Events** - See changes from other users/mods immediately
3. **Complex State Management** - Multi-step editing, reordering, selection
4. **Accessibility** - ARIA labels, keyboard navigation, semantic HTML
5. **Performance** - Memoization, useCallback, lazy loading
6. **Type Safety** - Full TypeScript with domain types
7. **Modular Architecture** - Clear separation of concerns

### Component Count: 21 Files
- Page routes: 6
- Client components: 15
- Hooks: 2 (useOptimisticModeration, useForumEvents)

### Lines of Code (Approximate)
- ForumCategoryList.tsx: 1,280 (largest, complex state management)
- ReplyList.tsx: 748 (optimistic updates + nested rendering)
- useOptimisticModeration: 354 (hook logic)
- OptimisticTopicWrapper/Badges/Dropdown: 511 combined
- All other components: ~1,500

**Total: ~5,000+ lines of forum-specific code (components + hooks)**

