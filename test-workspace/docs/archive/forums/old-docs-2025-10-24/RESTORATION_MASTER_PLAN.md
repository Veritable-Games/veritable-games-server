# Forum Restoration Master Plan

**Date Created:** October 13, 2025
**Status:** IN PROGRESS - Phase 0 (Planning & Foundation)
**Estimated Total Time:** 5-7 days

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Current State](#current-state)
3. [Target State](#target-state)
4. [What Was Completed](#what-was-completed)
5. [Implementation Plan](#implementation-plan)
6. [Technical Specifications](#technical-specifications)
7. [File Structure](#file-structure)
8. [Code Snippets & Patterns](#code-snippets--patterns)
9. [Testing Requirements](#testing-requirements)
10. [References](#references)

---

## Project Overview

### Goal
Re-implement v0.36 forums functionality with v0.37's improved architecture patterns while keeping the v0.36 UI/UX.

### Why This Approach
- **v0.36 had better UX features**: Complete tagging system, extracted components, advanced search
- **v0.37 has better architecture**: Optimistic UI, compact layout, standardized error handling, Result pattern
- **Best of both worlds**: Combine v0.36 features with v0.37 patterns

### Key Principle
**KEEP v0.37 improvements, RESTORE v0.36 features**

---

## Current State

### What Exists Now (October 13, 2025)

**Forums Status:** ❌ **STRIPPED** - All functionality removed, stubs remain

**Pages (7 files - all return 404):**
```
/forums/page.tsx
/forums/category/[slug]/page.tsx
/forums/topic/[id]/page.tsx
/forums/create/page.tsx
/forums/search/page.tsx
/forums/moderation/page.tsx
/forums/test/page.tsx
```

**API Routes (12 files - all return 404):**
```
/api/forums/categories/route.ts
/api/forums/categories/[slug]/route.ts
/api/forums/topics/route.ts
/api/forums/topics/[id]/route.ts
/api/forums/topics/[id]/pin/route.ts
/api/forums/topics/[id]/lock/route.ts
/api/forums/topics/[id]/solved/route.ts
/api/forums/replies/route.ts
/api/forums/replies/[id]/route.ts
/api/forums/replies/[id]/solution/route.ts
/api/forums/search/route.ts
/api/forums/stats/route.ts
```

**What Still Exists (Stubs):**
- ✅ Navigation button (links to /forums → 404)
- ✅ Directory structure intact
- ✅ Forum components (13 files as stubs)
- ✅ Forum services (4 files as stubs)
- ✅ Forum database (`forums.db` - completely intact with all data)
- ✅ Forum documentation (25 files in `docs/forums/`)

**Documentation References:**
- `FORUMS_STRIPPED.md` - Details of what was removed
- `docs/forums/FORUM_V036_V037_COMPARISON.md` - Complete comparison analysis

---

## Target State

### What We're Building

**Complete Forum System with:**
1. ✅ Basic forum functionality (categories, topics, replies)
2. ✅ Complete tagging system (TagDisplay, TagSelector, autocomplete)
3. ✅ Extracted components (TopicHeader, TopicFooter, TopicEditForm)
4. ✅ Advanced search UI (ForumSearchClient)
5. ✅ Consistent header actions (ForumHeaderActions)
6. ✅ Optimistic UI (React 19's useOptimistic - KEEP from v0.37)
7. ✅ Compact layout (table-style lists - KEEP from v0.37)
8. ✅ Status badge variants (icon/badge modes - KEEP from v0.37)

---

## What Was Completed

### ✅ Phase 0: Planning & Foundation (Completed)

**Date:** October 13, 2025

**Files Created:**
1. `/frontend/src/lib/forums/tags.ts` - Tag types and helper functions
   - `ForumTag` interface
   - `TagSuggestion` interface
   - `TopicTag` interface
   - `createTagSlug()` helper
   - `generateTagColor()` helper

**Documents Created:**
1. `FORUMS_STRIPPED.md` - Documentation of what was removed
2. `FORUM_RESTORATION_MASTER_PLAN.md` (this file)

**Analysis Completed:**
- Read complete comparison document (`FORUM_V036_V037_COMPARISON.md`)
- Identified 8 missing components from v0.36
- Identified complete tagging system removal
- Identified 3 extracted component patterns missing
- Mapped out 5-7 day implementation plan

---

## Implementation Plan

### Phase 1: Restore Basic Functionality (Day 1)

**Goal:** Get forums working again with basic features

**Tasks:**
1. **Restore all forum pages** (7 files)
   - Replace 404 stub with functional code
   - Use v0.37 architecture patterns
   - Reference: `docs/forums/FORUM_V036_V037_COMPARISON.md`

2. **Restore all forum API routes** (12 files)
   - Replace 404 stub with functional code
   - Use standardized error handling from v0.37
   - Use `safeParseRequest()` with Zod validation
   - Use `errorResponse()` for consistent errors

3. **Verify database schema**
   - Check if `forum_tags` table exists
   - Check if `topic_tags` junction table exists
   - Verify FTS5 search tables exist

**Files to Modify:**
```
frontend/src/app/forums/page.tsx
frontend/src/app/forums/category/[slug]/page.tsx
frontend/src/app/forums/topic/[id]/page.tsx
frontend/src/app/forums/create/page.tsx
frontend/src/app/forums/search/page.tsx
frontend/src/app/forums/moderation/page.tsx
frontend/src/app/forums/test/page.tsx

frontend/src/app/api/forums/categories/route.ts
frontend/src/app/api/forums/categories/[slug]/route.ts
frontend/src/app/api/forums/topics/route.ts
frontend/src/app/api/forums/topics/[id]/route.ts
frontend/src/app/api/forums/topics/[id]/pin/route.ts
frontend/src/app/api/forums/topics/[id]/lock/route.ts
frontend/src/app/api/forums/topics/[id]/solved/route.ts
frontend/src/app/api/forums/replies/route.ts
frontend/src/app/api/forums/replies/[id]/route.ts
frontend/src/app/api/forums/replies/[id]/solution/route.ts
frontend/src/app/api/forums/search/route.ts
frontend/src/app/api/forums/stats/route.ts
```

**Success Criteria:**
- [ ] All forum pages render without 404
- [ ] Can view forum categories
- [ ] Can view topics in a category
- [ ] Can view topic with replies
- [ ] Can create topic (basic, without tags)
- [ ] Can create reply
- [ ] Search returns results

---

### Phase 2: Tagging System (Day 2-3)

**Goal:** Restore complete tagging system from v0.36

**Priority:** CRITICAL (biggest missing feature)

#### Task 2.1: Create TagDisplay Component

**File:** `frontend/src/components/forums/TagDisplay.tsx`

**Features:**
- Display tags with custom colors
- Show usage count (optional)
- Multiple size variants (sm, md, lg)
- Linkable tags (optional)
- Max tags display with "+N more"
- Custom tag colors using hex values

**Props:**
```typescript
interface TagDisplayProps {
  tags: ForumTag[];
  size?: 'sm' | 'md' | 'lg';
  showUsageCount?: boolean;
  linkable?: boolean;
  maxTags?: number;
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 103-126

#### Task 2.2: Create TagSelector Component

**File:** `frontend/src/components/forums/TagSelector.tsx`

**Features:**
- Autocomplete with debounced search
- Keyboard navigation (Arrow keys, Enter, Escape, Backspace)
- Tag creation on-the-fly
- Selected tags display with remove button
- Maximum tags limit
- Custom styling matching forum theme

**Props:**
```typescript
interface TagSelectorProps {
  selectedTags: ForumTag[];
  onTagsChange: (tags: ForumTag[]) => void;
  maxTags?: number;
  placeholder?: string;
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 79-98

#### Task 2.3: Create Tag API Endpoint

**File:** `frontend/src/app/api/forums/tags/route.ts`

**Endpoints:**
```typescript
// Tag autocomplete search
GET /api/forums/tags?action=search&q=<query>&limit=10
Response: { suggestions: TagSuggestion[] }

// Popular tags widget
GET /api/forums/tags?action=popular&limit=20
Response: { tags: ForumTag[] }

// Trending tags widget
GET /api/forums/tags?action=trending&limit=10
Response: { tags: ForumTag[] }

// Create new tag
POST /api/forums/tags
Body: { name: string, description?: string, color?: string }
Response: { tag: ForumTag }
```

**Database Queries Needed:**
```sql
-- Search tags (autocomplete)
SELECT id, name, slug, usage_count
FROM forum_tags
WHERE name LIKE ? OR slug LIKE ?
ORDER BY usage_count DESC, name ASC
LIMIT ?

-- Popular tags
SELECT * FROM forum_tags
ORDER BY usage_count DESC
LIMIT ?

-- Trending tags (recently used)
SELECT ft.*, COUNT(tt.topic_id) as recent_usage
FROM forum_tags ft
JOIN topic_tags tt ON ft.id = tt.tag_id
WHERE tt.created_at > datetime('now', '-7 days')
GROUP BY ft.id
ORDER BY recent_usage DESC
LIMIT ?

-- Create tag
INSERT INTO forum_tags (name, slug, description, color, usage_count)
VALUES (?, ?, ?, ?, 0)
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 296-319

#### Task 2.4: Create PopularTags Widget

**File:** `frontend/src/components/forums/PopularTags.tsx`

**Features:**
- Display top 20 most-used tags
- Shows usage count
- Clickable tags linking to filtered topics
- Refreshes automatically

#### Task 2.5: Create TrendingTags Widget

**File:** `frontend/src/components/forums/TrendingTags.tsx`

**Features:**
- Display top 10 recently-used tags
- Shows trend indicator
- Clickable tags linking to filtered topics
- Updates in real-time

#### Task 2.6: Integrate Tags into TopicEditor

**File:** `frontend/src/components/forums/TopicEditor.tsx`

**Changes:**
- Replace simple string array with TagSelector
- Store selected tags as ForumTag[]
- Send tag IDs to API on topic creation
- Display selected tags during editing

**Current Code (v0.37):**
```typescript
tags?: string[]  // Simple string array
```

**New Code (v0.36 pattern):**
```typescript
selectedTags: ForumTag[]
onTagsChange: (tags: ForumTag[]) => void
```

#### Task 2.7: Integrate Tags into TopicList

**File:** `frontend/src/components/forums/TopicList.tsx`

**Changes:**
- Display tags using TagDisplay component
- Show up to 3 tags per topic
- Linkable tags for filtering

**Success Criteria:**
- [ ] TagDisplay renders tags with custom colors
- [ ] TagSelector autocomplete works
- [ ] Can create new tags from TagSelector
- [ ] Popular tags widget shows top 20 tags
- [ ] Trending tags widget shows recent tags
- [ ] Can add tags when creating topic
- [ ] Tags display in topic lists
- [ ] Tags display on topic pages
- [ ] Tag filtering works

---

### Phase 3: Component Extraction (Day 4)

**Goal:** Extract inline components for better composition

**Priority:** MEDIUM (improves maintainability)

#### Task 3.1: Extract TopicHeader Component

**File:** `frontend/src/components/forums/TopicHeader.tsx`

**Responsibilities:**
- Display topic author avatar (large size)
- Show author username with UserLink
- Display status badges (Pinned, Locked, Solved)
- Show edit button for topic authors
- Show TopicModerationDropdown for admins
- Display creation timestamp

**Props:**
```typescript
interface TopicHeaderProps {
  topic: {
    id: number;
    title: string;
    author_id: number;
    author_username: string;
    is_pinned: boolean;
    is_locked: boolean;
    is_solved: boolean;
    created_at: string;
  };
  currentUserId?: number;
  isAdmin?: boolean;
  onEdit?: () => void;
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 143-158

#### Task 3.2: Extract TopicFooter Component

**File:** `frontend/src/components/forums/TopicFooter.tsx`

**Responsibilities:**
- "Reply to Topic" button
- Delete button for authors/admins
- Login prompt for guests
- Scroll-to-reply-editor functionality

**Props:**
```typescript
interface TopicFooterProps {
  topicId: number;
  authorId: number;
  currentUserId?: number;
  isAdmin?: boolean;
  onReply?: () => void;
  onDelete?: () => void;
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 143-158

#### Task 3.3: Extract TopicEditForm Component

**File:** `frontend/src/components/forums/TopicEditForm.tsx`

**Responsibilities:**
- HybridMarkdownEditor integration
- Title input with character count
- Loading states with spinner
- Error display with icon
- Save/Cancel buttons
- Markdown hints

**Props:**
```typescript
interface TopicEditFormProps {
  title: string;
  content: string;
  error?: string;
  loading?: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 179-205

#### Task 3.4: Refactor TopicView to Use Extracted Components

**File:** `frontend/src/components/forums/TopicView.tsx`

**Changes:**
- Replace inline header with TopicHeader component
- Replace inline footer with TopicFooter component
- Replace inline edit form with TopicEditForm component
- Cleaner component composition
- Easier testing

**Success Criteria:**
- [ ] TopicHeader displays correctly
- [ ] TopicFooter displays correctly
- [ ] TopicEditForm works for editing
- [ ] All components properly isolated
- [ ] TopicView is cleaner and more maintainable

---

### Phase 4: Header Actions (Day 5 - Morning)

**Goal:** Create consistent header pattern across forum pages

**Priority:** LOW (code consistency)

#### Task 4.1: Create ForumHeaderActions Component

**File:** `frontend/src/components/forums/ForumHeaderActions.tsx`

**Features:**
- Integrate UnifiedLoginWidget
- Show "User List" link for logged-in users
- Handle loading states
- Consistent across all forum pages

**Code:**
```typescript
export function ForumHeaderActions() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="flex items-center space-x-2">
      <UnifiedLoginWidget />
      {user && (
        <Link
          href="/users"
          className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800/60 hover:bg-gray-700/70 rounded border border-gray-600/50 hover:border-gray-500/70 transition-colors"
        >
          User List
        </Link>
      )}
    </div>
  );
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 208-247

#### Task 4.2: Update Forum Pages

**Files to Update:**
- `/forums/page.tsx`
- `/forums/category/[slug]/page.tsx`
- `/forums/topic/[id]/page.tsx`
- `/forums/search/page.tsx`

**Change:**
Replace direct `<UnifiedLoginWidget />` with `<ForumHeaderActions />`

**Success Criteria:**
- [ ] Consistent header across all pages
- [ ] User List link appears when logged in
- [ ] Loading states handled properly

---

### Phase 5: Advanced Search UI (Day 5 - Afternoon)

**Goal:** Restore sophisticated search experience

**Priority:** MEDIUM (consistency with other sections)

#### Task 5.1: Create ForumSearchClient Component

**File:** `frontend/src/components/forums/ForumSearchClient.tsx`

**Features:**
- Client-side search state management
- Multiple filters (type, category, sort)
- URL parameter synchronization
- Debounced search (300ms)
- UnifiedSearchHeader integration
- SearchResultTable integration

**Props:**
```typescript
interface ForumSearchClientProps {
  categories: ForumCategory[];
  initialQuery?: string;
  initialFilters?: {
    type?: 'topics' | 'replies';
    category?: string;
    sort?: 'relevance' | 'date' | 'replies';
  };
}
```

**Reference:** `docs/forums/FORUM_V036_V037_COMPARISON.md` lines 250-291

#### Task 5.2: Update Search Page

**File:** `/app/forums/search/page.tsx`

**Changes:**
- Replace custom search implementation with ForumSearchClient
- Use UnifiedSearchHeader for consistent experience
- Use SearchResultTable for results display
- Add category and sort filters

**Success Criteria:**
- [ ] Search UI consistent with wiki/library
- [ ] Multiple filter options available
- [ ] URL parameters sync with state
- [ ] Debounced search works
- [ ] Professional search result display

---

## Technical Specifications

### Architecture Patterns to Use (v0.37)

**1. Database Access:**
```typescript
import { dbPool } from '@/lib/database/pool';
const db = dbPool.getConnection('forums');
```

**2. API Route Pattern:**
```typescript
import { withSecurity } from '@/lib/security/middleware';
import { safeParseRequest, CreateTopicDTOSchema } from '@/lib/forums/validation-schemas';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser(request);
    if (!user) throw new AuthenticationError();

    const bodyResult = await safeParseRequest(request, CreateTopicDTOSchema);
    if (bodyResult.isErr()) throw new ValidationError(bodyResult.error.message);

    const topic = await forumServices.topics.createTopic(bodyResult.value, user.id);
    return NextResponse.json({ success: true, data: { topic } });
  } catch (error) {
    return errorResponse(error);
  }
});
```

**3. Optimistic UI (KEEP from v0.37):**
```typescript
import { useOptimistic } from 'react';

const [optimisticReplies, addOptimisticReply] = useOptimistic(
  replies,
  (current, newReply) => [...current, newReply]
);
```

**4. Next.js 15 Async Params:**
```typescript
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params; // Must await
  const slug = params.slug;
}
```

### Database Schema Requirements

**Tag Tables (Must Exist):**
```sql
-- Forum tags table
CREATE TABLE IF NOT EXISTS forum_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Topic-Tag junction table
CREATE TABLE IF NOT EXISTS topic_tags (
  topic_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES forum_tags(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_id ON topic_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_forum_tags_slug ON forum_tags(slug);
CREATE INDEX IF NOT EXISTS idx_forum_tags_usage_count ON forum_tags(usage_count DESC);
```

**Triggers for Usage Count:**
```sql
-- Increment usage_count when tag is added to topic
CREATE TRIGGER IF NOT EXISTS increment_tag_usage
AFTER INSERT ON topic_tags
BEGIN
  UPDATE forum_tags
  SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.tag_id;
END;

-- Decrement usage_count when tag is removed from topic
CREATE TRIGGER IF NOT EXISTS decrement_tag_usage
AFTER DELETE ON topic_tags
BEGIN
  UPDATE forum_tags
  SET usage_count = usage_count - 1, updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.tag_id;
END;
```

---

## File Structure

### Complete File Tree (After Restoration)

```
frontend/src/
├── components/forums/
│   ├── CategoryBadge.tsx ✅ (exists - keep)
│   ├── CreateTopicButton.tsx ✅ (exists - keep)
│   ├── ForumCategoryList.tsx ✅ (exists - keep)
│   ├── ForumHeaderActions.tsx ⭐ (NEW - restore)
│   ├── ForumListLayout.tsx ✅ (exists - keep)
│   ├── ForumRow.tsx ✅ (exists - keep)
│   ├── ForumSearchClient.tsx ⭐ (NEW - restore)
│   ├── ForumSection.tsx ✅ (exists - keep)
│   ├── ModerationPanel.tsx ✅ (exists - keep)
│   ├── PopularTags.tsx ⭐ (NEW - restore)
│   ├── ReplyForm.tsx ✅ (exists - keep)
│   ├── ReplyHeader.tsx ✅ (exists - keep)
│   ├── ReplyList.tsx ✅ (exists - keep - has optimistic UI)
│   ├── ReplyModerationControls.tsx ✅ (exists - keep)
│   ├── SearchBox.tsx ✅ (exists - keep)
│   ├── StatusBadges.tsx ✅ (exists - keep)
│   ├── TagDisplay.tsx ⭐ (NEW - restore)
│   ├── TagSelector.tsx ⭐ (NEW - restore)
│   ├── TopicEditForm.tsx ⭐ (NEW - restore)
│   ├── TopicEditor.tsx ✅ (exists - update with TagSelector)
│   ├── TopicFooter.tsx ⭐ (NEW - restore)
│   ├── TopicHeader.tsx ⭐ (NEW - restore)
│   ├── TopicList.tsx ✅ (exists - update with TagDisplay)
│   ├── TopicModerationDropdown.tsx ✅ (exists - keep)
│   ├── TopicPostFooter.tsx ✅ (exists - keep)
│   ├── TopicPostHeader.tsx ✅ (exists - keep)
│   ├── TopicView.tsx ✅ (exists - refactor with extracted components)
│   ├── TrendingTags.tsx ⭐ (NEW - restore)
│   └── UserLink.tsx ✅ (exists - keep)
│
├── lib/forums/
│   ├── services/
│   │   ├── ForumService.ts ✅ (exists - keep)
│   │   ├── ForumSearchService.ts ✅ (exists - keep)
│   │   ├── ForumStatsService.ts ✅ (exists - keep)
│   │   ├── ForumModerationService.ts ✅ (exists - keep)
│   │   └── index.ts ✅ (exists - keep)
│   ├── repositories/
│   │   ├── category-repository.ts ✅ (exists - keep)
│   │   ├── topic-repository.ts ✅ (exists - keep)
│   │   ├── reply-repository.ts ✅ (exists - keep)
│   │   ├── search-repository.ts ✅ (exists - keep)
│   │   └── index.ts ✅ (exists - keep)
│   ├── tags.ts ✅ (CREATED - tag types)
│   ├── types.ts ✅ (exists - may need tag type integration)
│   └── validation.ts ✅ (exists - may need tag validation schemas)
│
├── app/forums/
│   ├── page.tsx ⭐ (restore from 404)
│   ├── category/[slug]/page.tsx ⭐ (restore from 404)
│   ├── topic/[id]/page.tsx ⭐ (restore from 404)
│   ├── create/page.tsx ⭐ (restore from 404)
│   ├── search/page.tsx ⭐ (restore from 404)
│   ├── moderation/page.tsx ⭐ (restore from 404)
│   └── test/page.tsx ⭐ (restore from 404)
│
└── app/api/forums/
    ├── categories/
    │   ├── route.ts ⭐ (restore from 404)
    │   └── [slug]/route.ts ⭐ (restore from 404)
    ├── topics/
    │   ├── route.ts ⭐ (restore from 404)
    │   ├── [id]/
    │   │   ├── route.ts ⭐ (restore from 404)
    │   │   ├── pin/route.ts ⭐ (restore from 404)
    │   │   ├── lock/route.ts ⭐ (restore from 404)
    │   │   └── solved/route.ts ⭐ (restore from 404)
    ├── replies/
    │   ├── route.ts ⭐ (restore from 404)
    │   └── [id]/
    │       ├── route.ts ⭐ (restore from 404)
    │       └── solution/route.ts ⭐ (restore from 404)
    ├── tags/
    │   └── route.ts ⭐ (NEW - create)
    ├── search/route.ts ⭐ (restore from 404)
    └── stats/route.ts ⭐ (restore from 404)
```

**Legend:**
- ✅ = Already exists (keep as-is or minor updates)
- ⭐ = Needs to be created/restored
- (restore from 404) = Currently returns 404, needs full implementation

---

## Code Snippets & Patterns

### TagDisplay Component (v0.36 Reference)

```tsx
import { ForumTag } from '@/lib/forums/tags';
import Link from 'next/link';

interface TagDisplayProps {
  tags: ForumTag[];
  size?: 'sm' | 'md' | 'lg';
  showUsageCount?: boolean;
  linkable?: boolean;
  maxTags?: number;
}

export function TagDisplay({
  tags,
  size = 'md',
  showUsageCount = false,
  linkable = true,
  maxTags
}: TagDisplayProps) {
  const displayTags = maxTags ? tags.slice(0, maxTags) : tags;
  const remainingCount = maxTags && tags.length > maxTags ? tags.length - maxTags : 0;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {displayTags.map((tag) => {
        const TagComponent = linkable ? Link : 'span';
        const tagProps = linkable ? { href: `/forums?tag=${tag.slug}` } : {};

        return (
          <TagComponent key={tag.id} {...tagProps}>
            <span
              className={`inline-flex items-center font-medium rounded-full border ${sizeClasses[size]} transition-colors ${
                linkable ? 'hover:opacity-80 cursor-pointer' : ''
              }`}
              style={{
                backgroundColor: `${tag.color}15`,
                borderColor: `${tag.color}40`,
                color: tag.color,
              }}
            >
              {tag.name}
              {showUsageCount && (
                <span className="ml-1.5 opacity-70">({tag.usage_count})</span>
              )}
            </span>
          </TagComponent>
        );
      })}
      {remainingCount > 0 && (
        <span className="text-sm text-gray-400">+{remainingCount} more</span>
      )}
    </div>
  );
}
```

### TagSelector Component Pattern

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { ForumTag, TagSuggestion } from '@/lib/forums/tags';

interface TagSelectorProps {
  selectedTags: ForumTag[];
  onTagsChange: (tags: ForumTag[]) => void;
  maxTags?: number;
  placeholder?: string;
}

export function TagSelector({
  selectedTags,
  onTagsChange,
  maxTags = 5,
  placeholder = 'Add tags...',
}: TagSelectorProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Debounced search
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const response = await fetch(
        `/api/forums/tags?action=search&q=${encodeURIComponent(input)}&limit=10`
      );
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setIsOpen(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      selectTag(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const selectTag = (suggestion: TagSuggestion) => {
    const newTag: ForumTag = {
      id: suggestion.id,
      name: suggestion.name,
      slug: suggestion.slug,
      description: '',
      color: '#6B7280',
      usage_count: suggestion.usage_count,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!selectedTags.find((t) => t.id === newTag.id)) {
      onTagsChange([...selectedTags, newTag]);
    }

    setInput('');
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Selected tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-sm rounded-full border"
            style={{
              backgroundColor: `${tag.color}15`,
              borderColor: `${tag.color}40`,
              color: tag.color,
            }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => onTagsChange(selectedTags.filter((t) => t.id !== tag.id))}
              className="hover:opacity-70"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input field */}
      {selectedTags.length < maxTags && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
        />
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => selectTag(suggestion)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-700 ${
                index === selectedIndex ? 'bg-gray-700' : ''
              }`}
            >
              {suggestion.name}
              <span className="ml-2 text-sm text-gray-400">
                ({suggestion.usage_count})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Tag API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { errorResponse, ValidationError } from '@/lib/utils/api-errors';
import { dbPool } from '@/lib/database/pool';
import { createTagSlug, generateTagColor } from '@/lib/forums/tags';

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const db = dbPool.getConnection('forums');

    if (action === 'search') {
      const query = searchParams.get('q') || '';
      const limit = parseInt(searchParams.get('limit') || '10');

      const suggestions = db
        .prepare(
          `SELECT id, name, slug, usage_count
           FROM forum_tags
           WHERE name LIKE ? OR slug LIKE ?
           ORDER BY usage_count DESC, name ASC
           LIMIT ?`
        )
        .all(`%${query}%`, `%${query}%`, limit);

      return NextResponse.json({ suggestions });
    }

    if (action === 'popular') {
      const limit = parseInt(searchParams.get('limit') || '20');

      const tags = db
        .prepare(
          `SELECT * FROM forum_tags
           ORDER BY usage_count DESC
           LIMIT ?`
        )
        .all(limit);

      return NextResponse.json({ tags });
    }

    if (action === 'trending') {
      const limit = parseInt(searchParams.get('limit') || '10');

      const tags = db
        .prepare(
          `SELECT ft.*, COUNT(tt.topic_id) as recent_usage
           FROM forum_tags ft
           JOIN topic_tags tt ON ft.id = tt.tag_id
           WHERE tt.created_at > datetime('now', '-7 days')
           GROUP BY ft.id
           ORDER BY recent_usage DESC
           LIMIT ?`
        )
        .all(limit);

      return NextResponse.json({ tags });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { name, description = '', color = generateTagColor() } = body;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Tag name is required');
    }

    const slug = createTagSlug(name);
    const db = dbPool.getConnection('forums');

    const tag = db
      .prepare(
        `INSERT INTO forum_tags (name, slug, description, color, usage_count)
         VALUES (?, ?, ?, ?, 0)
         RETURNING *`
      )
      .get(name.trim(), slug, description, color);

    return NextResponse.json({ tag });
  } catch (error) {
    return errorResponse(error);
  }
});
```

---

## Testing Requirements

### Component Testing Checklist

**TagDisplay:**
- [ ] Renders tags with custom colors
- [ ] Shows usage count when enabled
- [ ] Respects size prop (sm, md, lg)
- [ ] Limits display with maxTags
- [ ] Shows "+N more" for remaining tags
- [ ] Links work when linkable=true

**TagSelector:**
- [ ] Autocomplete triggers on input
- [ ] Debouncing works (300ms delay)
- [ ] Keyboard navigation (arrows, enter, escape)
- [ ] Tag selection adds to list
- [ ] Remove tag button works
- [ ] Respects maxTags limit
- [ ] Creates new tags when no match

**PopularTags:**
- [ ] Displays top 20 tags
- [ ] Sorted by usage_count
- [ ] Links to filtered topics
- [ ] Refreshes on mount

**TrendingTags:**
- [ ] Displays top 10 recent tags
- [ ] Shows only tags from last 7 days
- [ ] Links work correctly
- [ ] Updates in real-time

**TopicHeader:**
- [ ] Displays avatar correctly
- [ ] Shows all status badges
- [ ] Edit button only for authors
- [ ] Moderation dropdown only for admins
- [ ] Timestamp formats correctly

**TopicFooter:**
- [ ] Reply button visible for logged-in users
- [ ] Delete button only for author/admin
- [ ] Login prompt for guests
- [ ] Scroll-to-reply works

**TopicEditForm:**
- [ ] Title input with character count
- [ ] Markdown editor works
- [ ] Loading spinner shows during save
- [ ] Error messages display
- [ ] Save/Cancel buttons work

**ForumHeaderActions:**
- [ ] UnifiedLoginWidget displays
- [ ] User List link for logged-in users
- [ ] Loading state handled
- [ ] Consistent across pages

**ForumSearchClient:**
- [ ] Search input debounces
- [ ] Filter dropdowns work
- [ ] URL params sync with state
- [ ] UnifiedSearchHeader integration
- [ ] SearchResultTable displays results

### API Testing Checklist

**Tag Endpoints:**
- [ ] GET /api/forums/tags?action=search returns suggestions
- [ ] GET /api/forums/tags?action=popular returns top 20 tags
- [ ] GET /api/forums/tags?action=trending returns recent tags
- [ ] POST /api/forums/tags creates new tag
- [ ] Tag creation increments usage_count via trigger
- [ ] Tag deletion decrements usage_count via trigger
- [ ] Duplicate tag names rejected

**Forum Endpoints:**
- [ ] All forum pages render (not 404)
- [ ] Can view forum list
- [ ] Can view category
- [ ] Can view topic
- [ ] Can create topic with tags
- [ ] Can create reply
- [ ] Can edit topic
- [ ] Can delete topic
- [ ] Can pin/lock/solve topic
- [ ] Search returns results

### Database Testing Checklist

**Schema:**
- [ ] forum_tags table exists
- [ ] topic_tags table exists
- [ ] Indexes exist for performance
- [ ] Foreign keys configured correctly
- [ ] Triggers exist for usage_count

**Operations:**
- [ ] Can insert tags
- [ ] Can query tags by name/slug
- [ ] Can update tag usage_count
- [ ] Can delete tags (cascade deletes topic_tags)
- [ ] Can associate tags with topics
- [ ] Can query topics by tag
- [ ] FTS5 search includes tags

---

## References

### Key Documents

1. **FORUM_V036_V037_COMPARISON.md** (`docs/forums/`)
   - Complete comparison of v0.36 vs v0.37
   - Missing components list (8 components)
   - Missing features analysis (tagging system)
   - Code snippets from v0.36
   - Restoration priorities
   - Testing requirements

2. **FORUMS_STRIPPED.md** (root)
   - What was removed on Oct 13, 2025
   - What remains (stubs)
   - Restoration process

3. **docs/forums/README.md**
   - Current forum documentation index
   - 25 files of forum docs

4. **CLAUDE.md**
   - Main development guide
   - Critical architecture rules
   - Database access patterns
   - API route patterns

5. **docs/REACT_PATTERNS.md**
   - Next.js 15 + React 19 patterns
   - Optimistic UI examples
   - SSR-safe code patterns

### Git References

**To find original forum code:**
```bash
# Search commits before Oct 13, 2025
git log --oneline --all --before="2025-10-13" -- "*/forums/*"

# Show specific file at a commit
git show <commit-hash>:frontend/src/app/forums/page.tsx

# Restore file from commit
git checkout <commit-hash> -- frontend/src/app/forums/page.tsx
```

**Working Directory:**
- `user@local:~/Projects/web/web-0.36/veritable-games-main$` - v0.36 codebase reference

---

## Status Tracking

### Phase Completion

- [x] **Phase 0:** Planning & Foundation (COMPLETED - Oct 13, 2025)
- [ ] **Phase 1:** Restore Basic Functionality (Day 1)
- [ ] **Phase 2:** Tagging System (Day 2-3)
- [ ] **Phase 3:** Component Extraction (Day 4)
- [ ] **Phase 4:** Header Actions (Day 5 - Morning)
- [ ] **Phase 5:** Advanced Search UI (Day 5 - Afternoon)

### Files Created

- [x] `/frontend/src/lib/forums/tags.ts` - Tag types and helpers
- [x] `FORUMS_STRIPPED.md` - Stripping documentation
- [x] `FORUM_RESTORATION_MASTER_PLAN.md` - This document

### Files to Create (Next Session)

**Priority 1 (Critical):**
- [ ] All 7 forum pages (restore from 404)
- [ ] All 12 forum API routes (restore from 404)
- [ ] `/components/forums/TagDisplay.tsx`
- [ ] `/components/forums/TagSelector.tsx`
- [ ] `/api/forums/tags/route.ts`

**Priority 2 (High):**
- [ ] `/components/forums/PopularTags.tsx`
- [ ] `/components/forums/TrendingTags.tsx`
- [ ] `/components/forums/TopicHeader.tsx`
- [ ] `/components/forums/TopicFooter.tsx`
- [ ] `/components/forums/TopicEditForm.tsx`

**Priority 3 (Medium):**
- [ ] `/components/forums/ForumHeaderActions.tsx`
- [ ] `/components/forums/ForumSearchClient.tsx`

---

## Next Steps

### Immediate Actions (Start of Next Session)

1. **Verify database schema**
   - Check if tag tables exist in forums.db
   - Create tables/indexes/triggers if missing
   - Verify FTS5 search setup

2. **Restore basic forum pages** (Day 1 - Phase 1)
   - Start with main forum list page
   - Then category page
   - Then topic page
   - Test basic functionality works

3. **Restore basic API routes** (Day 1 - Phase 1)
   - Start with categories endpoints
   - Then topics endpoints
   - Then replies endpoints
   - Test API responses

4. **Build tagging system** (Day 2-3 - Phase 2)
   - Create TagDisplay component
   - Create TagSelector component
   - Create tag API endpoint
   - Integrate with TopicEditor

### Recommended Workflow

**Each Phase:**
1. Create all files for the phase
2. Test functionality
3. Git commit with phase name
4. Document any issues
5. Move to next phase

**Git Commit Messages:**
```
feat(forums): Phase 1 - Restore basic functionality
feat(forums): Phase 2 - Implement tagging system
feat(forums): Phase 3 - Extract topic components
feat(forums): Phase 4 - Add consistent header actions
feat(forums): Phase 5 - Enhance search UI
```

---

## Notes & Warnings

### Important Considerations

1. **Database Compatibility**
   - Existing forums.db may not have tag tables
   - Need to create tables without losing existing data
   - Test on backup first

2. **Existing Components**
   - 13 forum components already exist as stubs
   - Some may have partial v0.37 code
   - Review before replacing

3. **Service Layer**
   - Current services are stubs
   - May need significant updates
   - Follow Result pattern

4. **Type Safety**
   - Add tag types to existing type files
   - Update validation schemas
   - Ensure branded types used

5. **Optimistic UI**
   - Keep ReplyList's useOptimistic implementation
   - Don't break existing optimistic UI
   - Test carefully

### Known Issues to Watch For

1. **Cross-database queries** - Use ProfileAggregatorService
2. **Async params** - Must await in Next.js 15
3. **SSR vs Client** - Tag selector must be client component
4. **Connection pool** - Always use dbPool.getConnection()
5. **Error handling** - Use standardized error classes

---

## Timeline Summary

**Total Estimated Time:** 5-7 days

- **Day 1:** Restore basic functionality (7 pages + 12 API routes)
- **Day 2-3:** Build complete tagging system (5 components + API + integration)
- **Day 4:** Extract components for better composition (3 components + refactor)
- **Day 5:** Polish with header actions and advanced search (2 components)

**Current Status:** End of Day 0 (Planning Complete)
**Next Milestone:** Complete Day 1 (Basic Restoration)

---

**Document Version:** 1.0
**Last Updated:** October 13, 2025
**Next Review:** After Phase 1 completion
