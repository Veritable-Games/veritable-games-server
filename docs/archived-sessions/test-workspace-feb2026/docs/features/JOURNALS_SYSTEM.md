# Journals System Documentation

> **⚠️ DEPRECATION NOTICE**
> This document is from October-November 2025 and contains **outdated information**.
> The journals system underwent major refactoring in February 2026.
>
> **For current documentation, see:**
>
> - [Journals Architecture 2026](./JOURNALS_ARCHITECTURE_2026.md) - Complete system architecture
> - [Schema Evolution](../database/JOURNALS_SCHEMA_EVOLUTION.md) - Migration history
> - [API Reference](../api/JOURNALS_API_REFERENCE.md) - All endpoints
>
> **Key Changes Since This Doc:**
>
> - Journals separated from `wiki_pages` into dedicated `journals` table (Feb 15, 2026)
> - Bookmarks removed (wiki feature only)
> - Archive feature removed (not used)
> - Full-text search added (Feb 16, 2026)
> - Zustand store split into 7 focused stores (Feb 16, 2026)
> - Authorization centralized (Feb 16, 2026)
>
> **Keeping this doc for historical reference only.**

---

## Overview

The Journals feature is a Zim-like (desktop wiki) personal journaling system integrated into the wiki module. Users can create, organize, and edit journal entries with auto-save functionality, conflict detection, and hierarchical navigation—all within a single page interface.

**Key Design Principle**: Everything happens on `/wiki/category/journals` - no navigation away from the journals page.

## Architecture

### Component Hierarchy

```
CategoryPage (/wiki/category/[id]/page.tsx)
└── JournalsPageClient (client wrapper)
    └── JournalsLayout (main container)
        ├── JournalsSidebar (left pane - 25%)
        │   ├── TreeNode (recursive, collapsible tree)
        │   └── JournalCreateModal (inline creation)
        └── Panel (right pane - 75%, react-resizable-panels)
            └── JournalsEditor (rich text with Tiptap)
```

### Data Flow Diagram

```
Load Journal
   ↓
GET /api/journals/[slug]
   ├─ Fetch wiki_pages + latest wiki_revisions
   ├─ Include revision_timestamp ✅ (CRITICAL)
   └─ Return: { content, revision_timestamp, ... }
   ↓
JournalsPageClient (useSearchParams)
   ├─ Read ?selected=slug from URL
   └─ Fetch journal if not in initial server data
   ↓
JournalsLayout
   ├─ Pass revision_timestamp to JournalsEditor
   └─ Show loading spinner while fetching
   ↓
JournalsEditor
   ├─ Initialize Tiptap editor
   └─ Sync to Zustand store:
      ├─ lastSavedTimestamp (initial revision_timestamp)
      └─ currentContent
   ↓
useAutoSave Hook (triggered every 2 seconds)
   ├─ Read lastSavedTimestamp from store
   └─ PATCH /api/journals/[slug]/autosave
      ├─ Send: { content, lastKnownTimestamp }
      ├─ Server checks: is lastKnownTimestamp == database timestamp?
      │  └─ If no: conflict detected (409 response)
      │  └─ If yes: create new revision
      └─ Update store with new timestamp
```

## Key Components

### 1. JournalsPageClient (`src/app/wiki/category/journals/JournalsPageClient.tsx`)

**Responsibilities**:

- Read URL query parameter `?selected=slug`
- Manage journal selection state
- Fetch journal content on demand via `/api/journals/[slug]`
- Pass data to layout

**Key State**:

```typescript
const selectedSlug = searchParams.get("selected"); // From URL
const [currentJournal, setCurrentJournal] = useState<JournalData | null>(null);
const [isLoading, setIsLoading] = useState(false);
```

**Data Type**:

```typescript
interface JournalData {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  created_at: string;
  updated_at: string;
  content: string;
  isBookmarked: boolean;
  revision_timestamp?: string | null; // ✅ CRITICAL FOR CONFLICT DETECTION
}
```

### 2. JournalsLayout (`src/components/journals/JournalsLayout.tsx`)

**Responsibilities**:

- Create split-pane layout using `react-resizable-panels`
- Manage left/right panel sizes (default: 25/75 split)
- Show loading state while fetching journal
- Display "no selection" message when appropriate

**Key Features**:

- Resizable panels (drag to adjust split)
- Loading spinner during async journal fetch
- ConflictWarning component for displaying conflict errors

### 3. JournalsSidebar (`src/components/journals/JournalsSidebar.tsx`)

**Responsibilities**:

- Search through journals (case-insensitive, fuzzy matching)
- Display hierarchical tree of journals
- Handle journal creation via modal
- Navigate to selected journal **without page reload**

**Key Methods**:

```typescript
// Use router.replace() to update URL without navigation
const handleSelectNode = (node: JournalNode) => {
  setSelectedJournal(node.id);
  const params = new URLSearchParams(searchParams.toString());
  params.set("selected", node.slug);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
};
```

**Why `router.replace()` instead of `router.push()`**:

- `push()` navigates to new page (breaks Zim experience)
- `replace()` updates URL in place (stays on journals page)
- Both methods update browser history

### 4. JournalsEditor (`src/components/journals/JournalsEditor.tsx`)

**Responsibilities**:

- Initialize Tiptap rich text editor
- Sync content to Zustand store
- Initialize conflict detection baseline (timestamp)
- Provide formatting toolbar (Bold, Italic, Headers, Lists, etc.)
- Toggle between Edit and Preview modes

**Critical Fix** (SSR Hydration):

```typescript
const editor = useEditor({
  immediatelyRender: false, // ✅ Required for React 19 compatibility
  extensions: [StarterKit],
  content: initialContent,
  onUpdate: ({ editor }) => {
    setCurrentContent(editor.getHTML()); // Triggers auto-save
  },
});
```

**Timestamp Initialization** (Conflict Detection Baseline):

```typescript
useEffect(() => {
  // Always reset when switching journals
  setCurrentContent(initialContent || "");
  setLastSavedTimestamp(initialTimestamp); // ✅ CRITICAL
}, [slug, initialContent, initialTimestamp]);
```

### 5. useAutoSave Hook (`src/hooks/useAutoSave.ts`)

**Responsibilities**:

- Debounce saves by 2 seconds (prevents API spam)
- Send content to autosave endpoint
- Handle conflict detection responses
- Update store with new timestamps
- Manage save state (isSaving, saveError)

**Conflict Detection Flow**:

```typescript
const response = await fetch(`/api/journals/${slug}/autosave`, {
  method: "PATCH",
  body: JSON.stringify({
    content,
    lastKnownTimestamp: lastSavedTimestamp, // ✅ MUST NOT BE NULL
  }),
});

// 409 = Conflict (another session edited)
// 200 = Success (update lastSavedTimestamp)
```

## API Routes

### GET /api/journals/[slug]

**Purpose**: Fetch a single journal for selection/viewing

**Query**: Gets latest revision with timestamp

```sql
SELECT p.id, p.slug, p.title, p.namespace, p.created_at, p.updated_at,
       r.content, r.revision_timestamp,  -- ✅ CRITICAL
       COALESCE(b.id, 0) as is_bookmarked
FROM wiki_pages p
LEFT JOIN wiki_revisions r ON p.id = r.page_id
  AND r.id = (SELECT MAX(id) FROM wiki_revisions WHERE page_id = p.id)
WHERE p.slug = ? AND p.namespace = 'journals' AND p.created_by = ?
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "journal-1234",
    "title": "My Journal",
    "content": "<p>Entry content...</p>",
    "revision_timestamp": "2025-10-29 10:30:45",
    "isBookmarked": false
  }
}
```

**Why `revision_timestamp` is Critical**:
Without it, `lastSavedTimestamp` initializes to `null`, breaking conflict detection.

### POST /api/journals

**Purpose**: Create a new journal

**Request**:

```json
{
  "title": "Journal Title",
  "content": "<p>Initial content</p>"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": 2,
    "slug": "journal-1730206805",
    "title": "Journal Title",
    "created_at": "2025-10-29 10:30:05"
  }
}
```

**CSRF Setting**: `enableCSRF: false` (user auth via `getCurrentUser()` is sufficient)

### PATCH /api/journals/[slug]/autosave

**Purpose**: Auto-save journal content with conflict detection

**Request**:

```json
{
  "content": "<p>Updated content</p>",
  "lastKnownTimestamp": "2025-10-29 10:30:45"
}
```

**Conflict Detection Logic**:

```typescript
const hasConflict = await wikiPageService.detectConflict(
  page.id,
  lastKnownTimestamp,
);

// Returns true if: latest_revision_timestamp > lastKnownTimestamp
// Meaning: another session modified the journal after user's last save
```

**Responses**:

- **200**: Save successful, returns new `revision_timestamp`
- **409**: Conflict detected, user must reload
- **403**: Access denied (not journal owner)
- **401**: Not authenticated

**CSRF Setting**: `enableCSRF: false` (same reasoning as POST)

## Database Schema

### wiki_pages table

```sql
CREATE TABLE wiki_pages (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  namespace TEXT NOT NULL,  -- 'journals' for journal entries
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### wiki_revisions table

```sql
CREATE TABLE wiki_revisions (
  id INTEGER PRIMARY KEY,
  page_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  author_id INTEGER NOT NULL,
  is_minor INTEGER DEFAULT 0,  -- 1 for auto-saves
  size_bytes INTEGER,
  revision_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (page_id) REFERENCES wiki_pages(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);
```

## Zustand Store (`src/stores/journalsStore.ts`)

**Journal-Specific State**:

```typescript
{
  // Current Content
  currentContent: string;
  lastSavedTimestamp: string | null; // ✅ CRITICAL FOR CONFLICT DETECTION
  isDirty: boolean;

  // Save Status
  isSaving: boolean;
  saveError: string | null;

  // Conflict Detection
  hasConflict: boolean;
  conflictMessage: string | null;

  // UI State
  isPreviewMode: boolean;
  selectedJournalId: string | null;
  expandedNodes: Set<string>;
  bookmarkedJournals: Set<string>;
}
```

**Key Actions**:

- `setCurrentContent(html)` - Update content, sets `isDirty: true`
- `setLastSavedTimestamp(timestamp)` - Update baseline for conflict detection
- `setIsSaving(bool)` - Track autosave in progress
- `setHasConflict(bool)` - Display conflict warning

## The Conflict Detection Bug (Fixed)

### The Problem

When loading an existing journal in a new session, the conflict detection system would show **false positive conflicts** even with only one session open.

### Root Cause

The `GET /api/journals/[slug]` endpoint did not return `revision_timestamp`. This caused:

1. Journal loads → `lastSavedTimestamp = null`
2. User types → First autosave sends `lastKnownTimestamp: null`
3. Server skips conflict check (because `null` means "first save")
4. Subsequent autosaves use stale timestamps
5. Race conditions trigger false conflicts

### The Fix

**4-part fix that solved the issue:**

#### Part 1: Include timestamp in GET response

```typescript
// Query includes: r.revision_timestamp
// Response includes: revision_timestamp: journal.revision_timestamp || null
```

#### Part 2: Update JournalsPageClient

```typescript
// JournalData interface includes: revision_timestamp?: string | null
// Pass through to layout: revision_timestamp: currentJournal.revision_timestamp
```

#### Part 3: Update JournalsLayout

```typescript
// Interface includes: revision_timestamp?: string | null
// Pass to editor: initialTimestamp={currentPage.revision_timestamp || null}
```

#### Part 4: Initialize timestamp in JournalsEditor

```typescript
const { ..., lastSavedTimestamp, setLastSavedTimestamp } = useJournalsStore();

useEffect(() => {
  // Always reset when switching journals
  setCurrentContent(initialContent || '');
  setLastSavedTimestamp(initialTimestamp);  // ✅ Initialize baseline
}, [slug, initialContent, initialTimestamp]);
```

The last change is **critical**: it ensures that when switching between journals, stale timestamps don't trigger false conflicts.

## How to Use

### User Workflow

1. **Navigate to Journals**: `/wiki/category/journals`
2. **Create Journal**: Click `+` button → Enter title → Click "Create"
3. **Select Journal**: Click journal in sidebar (URL updates to `?selected=slug`)
4. **Edit**: Type in the rich text editor
5. **Auto-save**: Content saves every 2 seconds (no action needed)
6. **Conflict**: If another session edits → "Conflict Detected" message → Reload to get latest

### For Developers

#### Adding to a Page

```tsx
// In CategoryPage when category_id === 'journals'
import { JournalsPageClient } from "@/app/wiki/category/journals/JournalsPageClient";

const journals = await fetchJournals(userId);
return <JournalsPageClient journals={journals} />;
```

#### Querying Journals Directly

```typescript
const db = dbPool.getConnection("wiki");
const journals = db
  .prepare(
    `
  SELECT id, slug, title, created_at
  FROM wiki_pages
  WHERE namespace = 'journals' AND created_by = ?
  ORDER BY created_at DESC
`,
  )
  .all(userId) as JournalPage[];
```

#### Understanding Timestamps

- **SQLite Format**: `YYYY-MM-DD HH:MM:SS` (second precision)
- **Stored In**: `wiki_revisions.revision_timestamp`
- **Set By**: `CURRENT_TIMESTAMP` (server time)
- **Compared In**: `WikiPageService.detectConflict()`

## Performance Considerations

### Debouncing

- Autosave debounces by **2 seconds** (configurable in `useAutoSave.ts`)
- Prevents API spam during rapid typing
- User sees save indicator while debouncing

### Conflict Resolution Strategy

- **Detection**: Only on autosave (not on manual edits)
- **Resolution**: User must reload page to get latest version
- **Frequency**: False conflicts eliminated by proper timestamp initialization

### Browser History

- `router.replace()` updates URL without creating history entries
- Back/forward buttons skip intermediate `?selected=` URLs
- Bookmarking works: `/wiki/category/journals?selected=journal-slug`

## Future Enhancements

### Short Term

- [ ] Merge conflicts: Show both versions, let user choose
- [ ] Offline editing: Cache journals locally, sync on reconnect
- [ ] Full-text search: Search journal content, not just titles

### Medium Term

- [ ] Templates: Create journals from templates
- [ ] Tags: Organize journals with tags + tag-based filtering
- [ ] Reminders: Daily journal prompts at configurable time
- [ ] Sharing: Share read-only journal snapshots with others

### Long Term

- [ ] Publishing: Convert journals to static blog
- [ ] Analytics: Reading statistics, writing streaks
- [ ] Encryption: End-to-end encryption for private journals
- [ ] Mobile app: Native iOS/Android sync

## Troubleshooting

### "Conflict Detected" on every save

**Cause**: `lastSavedTimestamp` not initialized with `revision_timestamp`
**Solution**: Ensure GET endpoint returns `revision_timestamp` and JournalsEditor initializes it

### Tiptap "SSR has been detected" error

**Cause**: Editor renders on server before client hydration
**Solution**: Set `immediatelyRender: false` in `useEditor()` config

### Autosaves not working

**Cause**: CSRF enabled on autosave endpoint
**Solution**: Set `enableCSRF: false` in endpoint wrapper

### Journal doesn't load after creation

**Cause**: Component not properly connected to Zustand store
**Solution**: Verify `setSelectedJournal()` is called and URL updates

## Related Documentation

- [DATABASE.md](../DATABASE.md) - Database architecture (10 SQLite DBs)
- [REACT_PATTERNS.md](../REACT_PATTERNS.md) - React 19 + Next.js 15 patterns
- [forums/FORUMS_DOCUMENTATION_INDEX.md](../forums/FORUMS_DOCUMENTATION_INDEX.md) - Similar system (forums)
- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) - General debugging guide

---

**Last Updated**: October 29, 2025
**Status**: ✅ Production Ready
