# Forums React 19 Migration Guide

**Step-by-Step Implementation Guide**

This document provides concrete, actionable steps to migrate the forums implementation to modern React 19 patterns with Server Components, streaming, and Server Actions.

---

## Quick Start: Priority Order

If you only have time for a few changes, do these **in order** for maximum impact:

1. ✅ **Convert TopicRow to Server Component** (2 hours, -8KB bundle)
2. ✅ **Add Suspense boundaries for streaming** (4 hours, 75% faster FCP)
3. ✅ **Implement Server Actions for reply creation** (3 hours, better UX)
4. ✅ **Add TanStack Query** (2 hours, better caching)
5. ✅ **Server-side conversation detection** (3 hours, -15KB bundle)

Total: **14 hours for 80% of the performance gains**

---

## Phase 1: Convert Static Components to Server Components

### Step 1.1: TopicRow → Server Component (2 hours)

**File**: `frontend/src/components/forums/TopicRow.tsx`

#### Before:
```typescript
'use client';

import React from 'react';
import Link from 'next/link';
import { UserLink } from './UserLink';

interface TopicData {
  id: number;
  title: string;
  username?: string;
  // ... other fields
}

export function TopicRow({ topic, categoryId }: TopicRowProps) {
  const handleTopicClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('a[href^="/profile/"]')) {
      window.location.href = `/forums/topic/${topic.id}`;
    }
  };

  return (
    <div onClick={handleTopicClick} className="cursor-pointer">
      {/* ... content */}
    </div>
  );
}
```

#### After:
```typescript
// Remove 'use client' directive - this is now a Server Component!
import Link from 'next/link';
import { UserLink } from './UserLink';

interface TopicData {
  id: number;
  title: string;
  username?: string;
  // ... other fields
}

export function TopicRow({ topic, categoryId }: TopicRowProps) {
  return (
    <Link
      href={`/forums/topic/${topic.id}`}
      className="block hover:bg-gray-800/30 transition-colors"
    >
      <div className="px-4 py-2 min-h-[40px] flex items-center border-b border-gray-700">
        {/* Exact same content structure */}
        <div className="grid grid-cols-12 gap-4 w-full items-center">
          {/* ... rest of component unchanged */}
        </div>
      </div>
    </Link>
  );
}
```

**Changes**:
1. ✅ Remove `'use client'` directive
2. ✅ Replace `<div onClick>` with `<Link href>`
3. ✅ Remove `handleTopicClick` function (no longer needed)
4. ✅ Keep all styling and content identical

**Testing**:
```bash
# Verify component still renders
npm run dev
# Navigate to /forums and click topics - should work identically

# Verify bundle size reduction
npm run build
# Check .next/analyze - should see ~8KB reduction in client bundle
```

---

### Step 1.2: ForumCategoryList → Server Component (1 hour)

**File**: `frontend/src/components/forums/ForumCategoryList.tsx`

Check if this component has any interactivity:
- ❌ No `useState`, `useEffect`, `onClick` handlers → Convert to Server Component
- ✅ Only renders data → Safe to convert

```typescript
// Before: 'use client'
// After: Remove directive, component stays the same

export function ForumCategoryList({ categories }: Props) {
  return (
    <div className="space-y-2">
      {categories.map(category => (
        <Link key={category.id} href={`/forums/category/${category.id}`}>
          {/* ... content */}
        </Link>
      ))}
    </div>
  );
}
```

---

### Step 1.3: Create Server Component Versions of Complex Components

**Strategy**: Keep client versions for interactivity, create server versions for SSR.

#### Create: `TopicViewServer.tsx`

```typescript
// frontend/src/components/forums/TopicViewServer.tsx
import { ForumTag } from '@/lib/forums/tags';
import { TopicWithReplies } from '@/lib/forums/types';
import { HybridMarkdownRenderer } from '@/components/ui/HybridMarkdownRenderer';
import { TagDisplay } from './TagDisplay';
import { TopicActions } from './TopicActions'; // New client component

interface TopicViewServerProps {
  topic: TopicWithReplies;
  tags?: ForumTag[];
}

// Server Component - no 'use client'
export async function TopicViewServer({ topic, tags = [] }: TopicViewServerProps) {
  return (
    <div className="bg-gray-900/30 border border-gray-700 rounded-lg overflow-hidden">
      {/* Static header */}
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* User info - static */}
          <div className="flex items-center space-x-2">
            <Avatar user={topic} size="lg" />
            <div>
              <div className="font-medium text-white text-sm">
                {topic.username || 'Unknown User'}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(topic.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Interactive actions - client component */}
          <TopicActions
            topicId={topic.id}
            isLocked={topic.is_locked}
            isPinned={topic.is_pinned}
            status={topic.status}
          />
        </div>
      </div>

      {/* Content - server-rendered */}
      <div className="p-3">
        <HybridMarkdownRenderer
          content={topic.content}
          className="text-gray-200 leading-relaxed"
        />

        {tags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <TagDisplay tags={tags} size="sm" linkable={true} />
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Create: `TopicActions.tsx` (Client Component for Interactivity)

```typescript
// frontend/src/components/forums/TopicActions.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface TopicActionsProps {
  topicId: number;
  isLocked: boolean;
  isPinned: boolean;
  status: string;
}

export function TopicActions({ topicId, isLocked, isPinned, status }: TopicActionsProps) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show actions to admins
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowActions(!showActions)}
        className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
      >
        Moderate
      </button>

      {showActions && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          {/* Action buttons */}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 2: Implement Streaming with Suspense

### Step 2.1: Refactor Topic Page for Streaming (4 hours)

**File**: `frontend/src/app/forums/topic/[id]/page.tsx`

#### Before (Blocking):
```typescript
async function getTopicData(topicId: string) {
  const topicWithReplies = await forumService.getTopicWithReplies(topicId);
  const category = await forumService.getCategoryById(topic.category_id);
  const tags = await forumTagService.getTopicTags(topicId);
  return { topic, category, tags };
}

export default async function TopicPage({ params }) {
  const data = await getTopicData(params.id); // BLOCKS entire page
  return (
    <div>
      <TopicView topic={data.topic} />
      <ReplyList replies={data.topic.replies} />
    </div>
  );
}
```

#### After (Streaming):
```typescript
import { Suspense } from 'react';
import { TopicHeaderAsync } from '@/components/forums/TopicHeaderAsync';
import { ReplyListAsync } from '@/components/forums/ReplyListAsync';
import { TopicHeaderSkeleton, ReplyListSkeleton } from '@/components/forums/Skeletons';

export default async function TopicPage({ params }) {
  const resolvedParams = await params;

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto px-6 py-6">
      {/* Stream 1: Topic header loads first (fast - ~200ms) */}
      <Suspense fallback={<TopicHeaderSkeleton />}>
        <TopicHeaderAsync topicId={resolvedParams.id} />
      </Suspense>

      {/* Stream 2: Replies load in parallel (slower - ~500ms) */}
      <Suspense fallback={<ReplyListSkeleton />}>
        <ReplyListAsync topicId={resolvedParams.id} />
      </Suspense>
    </div>
  );
}
```

---

### Step 2.2: Create Async Component Wrappers

#### Create: `TopicHeaderAsync.tsx`
```typescript
// frontend/src/components/forums/TopicHeaderAsync.tsx
import { forumService } from '@/lib/forums/service';
import { forumTagService } from '@/lib/forums/tags';
import { TopicViewServer } from './TopicViewServer';
import { notFound } from 'next/navigation';

interface Props {
  topicId: string;
}

export async function TopicHeaderAsync({ topicId }: Props) {
  const numericId = parseInt(topicId);
  if (isNaN(numericId)) notFound();

  // Parallel data fetching
  const [topic, tags] = await Promise.all([
    forumService.getTopicById(numericId, true), // Increment view count
    forumTagService.getTopicTags(numericId),
  ]);

  if (!topic) notFound();

  return <TopicViewServer topic={topic} tags={tags} />;
}
```

#### Create: `ReplyListAsync.tsx`
```typescript
// frontend/src/components/forums/ReplyListAsync.tsx
import { forumService } from '@/lib/forums/service';
import { ConversationDetectionService } from '@/lib/forums/conversationService';
import { ReplyListClient } from './ReplyListClient';

interface Props {
  topicId: string;
}

export async function ReplyListAsync({ topicId }: Props) {
  const numericId = parseInt(topicId);

  // Fetch replies
  const replies = await forumService.getRepliesByTopicId(numericId);

  // Process conversations SERVER-SIDE (huge win!)
  const processedReplies = ConversationDetectionService.processRepliesForDisplay(replies);

  // Pass to client component for interactivity
  return <ReplyListClient replies={processedReplies} topicId={numericId} />;
}
```

---

### Step 2.3: Create Skeleton Components

```typescript
// frontend/src/components/forums/Skeletons.tsx

export function TopicHeaderSkeleton() {
  return (
    <div className="bg-gray-900/30 border border-gray-700 rounded-lg overflow-hidden animate-pulse">
      <div className="bg-gray-800/30 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="w-12 h-12 bg-gray-700 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-700 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-700 rounded w-24" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded w-full" />
          <div className="h-4 bg-gray-700 rounded w-5/6" />
          <div className="h-4 bg-gray-700 rounded w-4/6" />
        </div>
      </div>
    </div>
  );
}

export function ReplyListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-900/30 border border-gray-700 rounded animate-pulse">
          <div className="p-3">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full" />
              <div className="h-3 bg-gray-700 rounded w-24" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-700 rounded w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Testing**:
```bash
# Slow your network to see streaming in action
# Chrome DevTools → Network → Throttling → Slow 3G

npm run dev
# Navigate to /forums/topic/1
# You should see:
# 1. TopicHeaderSkeleton appears immediately
# 2. TopicHeader streams in (~200ms)
# 3. ReplyListSkeleton still visible
# 4. ReplyList streams in (~500ms)
```

---

## Phase 3: Server Actions for Forms

### Step 3.1: Create Server Actions

**File**: `frontend/src/app/actions/forum-actions.ts`

```typescript
'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/utils';
import { forumService } from '@/lib/forums/service';
import { z } from 'zod';

// Validation schemas
const createReplySchema = z.object({
  topic_id: z.coerce.number().positive(),
  content: z.string().min(1).max(10000),
  parent_id: z.coerce.number().optional(),
});

const updateTopicSchema = z.object({
  topic_id: z.coerce.number().positive(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  is_locked: z.coerce.boolean().optional(),
  is_pinned: z.coerce.boolean().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

/**
 * Create a new reply to a topic
 */
export async function createReplyAction(formData: FormData) {
  try {
    // Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in to reply' };
    }

    // Validate input
    const rawData = {
      topic_id: formData.get('topic_id'),
      content: formData.get('content'),
      parent_id: formData.get('parent_id') || undefined,
    };

    const validatedData = createReplySchema.parse(rawData);

    // Check if topic is locked
    const topic = await forumService.getTopicById(validatedData.topic_id, false);
    if (!topic) {
      return { success: false, error: 'Topic not found' };
    }
    if (topic.is_locked && user.role !== 'admin') {
      return { success: false, error: 'This topic is locked' };
    }

    // Create reply
    const reply = await forumService.createReply(
      {
        topic_id: validatedData.topic_id,
        content: validatedData.content,
        parent_id: validatedData.parent_id,
      },
      user.id
    );

    // Revalidate the topic page (triggers server re-render)
    revalidatePath(`/forums/topic/${validatedData.topic_id}`);

    return { success: true, reply };
  } catch (error) {
    console.error('Create reply error:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid input: ' + error.errors.map(e => e.message).join(', '),
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create reply',
    };
  }
}

/**
 * Update a topic (title, content, or moderation flags)
 */
export async function updateTopicAction(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    const rawData = Object.fromEntries(formData);
    const validatedData = updateTopicSchema.parse(rawData);

    // Authorization check
    const topic = await forumService.getTopicById(validatedData.topic_id, false);
    if (!topic) {
      return { success: false, error: 'Topic not found' };
    }

    const isAuthor = user.id === topic.user_id;
    const isAdmin = user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return { success: false, error: 'You do not have permission to edit this topic' };
    }

    // Users can only edit title/content, admins can edit everything
    const updateData: any = {};
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.content !== undefined) updateData.content = validatedData.content;

    if (isAdmin) {
      if (validatedData.is_locked !== undefined) updateData.is_locked = validatedData.is_locked;
      if (validatedData.is_pinned !== undefined) updateData.is_pinned = validatedData.is_pinned;
      if (validatedData.status !== undefined) updateData.status = validatedData.status;
    }

    // Update topic
    const updatedTopic = await forumService.updateTopic(
      validatedData.topic_id,
      updateData,
      user.id
    );

    // Revalidate
    revalidatePath(`/forums/topic/${validatedData.topic_id}`);
    revalidatePath('/forums'); // Also revalidate forum home

    return { success: true, topic: updatedTopic };
  } catch (error) {
    console.error('Update topic error:', error);

    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input: ' + error.errors[0].message };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update topic',
    };
  }
}

/**
 * Delete a topic
 */
export async function deleteTopicAction(topicId: number) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in' };
    }

    const topic = await forumService.getTopicById(topicId, false);
    if (!topic) {
      return { success: false, error: 'Topic not found' };
    }

    const isAuthor = user.id === topic.user_id;
    const isAdmin = user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return { success: false, error: 'You do not have permission to delete this topic' };
    }

    await forumService.deleteTopic(topicId, user.id);

    revalidatePath('/forums');
    revalidatePath(`/forums/category/${topic.category_id}`);

    return { success: true };
  } catch (error) {
    console.error('Delete topic error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete topic',
    };
  }
}
```

---

### Step 3.2: Update ReplyForm to Use Server Actions

**File**: `frontend/src/components/forums/ReplyForm.tsx`

```typescript
'use client';

import { useFormStatus } from 'react-dom';
import { useOptimistic, useTransition } from 'react';
import { createReplyAction } from '@/app/actions/forum-actions';
import { HybridMarkdownEditor } from '@/components/editor/HybridMarkdownEditor';
import { ProcessedReply } from '@/lib/forums/conversationService';

interface ReplyFormProps {
  topicId: number;
  parentId?: number;
  initialReplies: ProcessedReply[];
  onSuccess?: () => void;
}

export function ReplyForm({ topicId, parentId, initialReplies, onSuccess }: ReplyFormProps) {
  const [isPending, startTransition] = useTransition();

  // Optimistic UI updates
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    initialReplies,
    (state, newReply: ProcessedReply) => [...state, newReply]
  );

  const handleSubmit = async (formData: FormData) => {
    // Get content for optimistic update
    const content = formData.get('content') as string;

    // Add optimistic reply immediately (shows in UI before server responds)
    addOptimisticReply({
      id: Date.now(), // Temporary ID
      topic_id: topicId,
      user_id: 0, // Will be filled by server
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      username: 'You', // Temporary
      isPending: true, // Flag for styling
      replies: [],
    });

    // Submit to server in background
    startTransition(async () => {
      const result = await createReplyAction(formData);

      if (result.success) {
        onSuccess?.();
      } else {
        // Show error toast
        alert(result.error);
      }
    });
  };

  return (
    <div>
      {/* Show optimistic replies */}
      <div className="space-y-4 mb-6">
        {optimisticReplies.map(reply => (
          <div
            key={reply.id}
            className={`bg-gray-900/30 border border-gray-700 rounded ${
              reply.isPending ? 'opacity-50' : ''
            }`}
          >
            {/* Reply content */}
          </div>
        ))}
      </div>

      {/* Reply form */}
      <form action={handleSubmit}>
        <input type="hidden" name="topic_id" value={topicId} />
        {parentId && <input type="hidden" name="parent_id" value={parentId} />}

        <HybridMarkdownEditor
          content=""
          onChange={() => {}}
          placeholder="Write your reply..."
          rows={8}
        />

        <div className="mt-4 flex justify-end">
          <SubmitButton isPending={isPending} />
        </div>
      </form>
    </div>
  );
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || isPending}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending || isPending ? 'Posting...' : 'Post Reply'}
    </button>
  );
}
```

**Benefits of Server Actions**:
- ✅ No CSRF token needed (Server Actions are POST-only and origin-checked)
- ✅ Progressive enhancement (works without JavaScript)
- ✅ Built-in loading states with `useFormStatus`
- ✅ Type-safe with Zod validation
- ✅ Optimistic updates with `useOptimistic`
- ✅ Automatic revalidation with `revalidatePath`

---

## Phase 4: Add TanStack Query

### Step 4.1: Install and Configure

```bash
cd frontend
npm install @tanstack/react-query
```

### Step 4.2: Create Query Provider

**File**: `frontend/src/providers/QueryProvider.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Step 4.3: Add to Root Layout

**File**: `frontend/src/app/layout.tsx`

```typescript
import { QueryProvider } from '@/providers/QueryProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>
          {/* ... other providers */}
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

### Step 4.4: Use in Components

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function ReplyList({ topicId, initialReplies }) {
  const queryClient = useQueryClient();

  // Fetch replies with automatic caching
  const { data: replies, isLoading } = useQuery({
    queryKey: ['replies', topicId],
    queryFn: async () => {
      const res = await fetch(`/api/forums/topics/${topicId}/replies`);
      return res.json();
    },
    initialData: initialReplies, // Hydrate from server
    staleTime: 30_000, // 30 seconds
  });

  // Mutation for creating replies
  const createReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/forums/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, content }),
      });
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch replies
      queryClient.invalidateQueries({ queryKey: ['replies', topicId] });
    },
  });

  return (
    <div>
      {isLoading ? <div>Loading...</div> : replies.map(reply => <ReplyView reply={reply} />)}
    </div>
  );
}
```

---

## Phase 5: Performance Optimizations

### Step 5.1: Virtualize Long Reply Lists

```bash
npm install react-window react-window-infinite-loader
```

**File**: `frontend/src/components/forums/VirtualizedReplyList.tsx`

```typescript
'use client';

import { VariableSizeList } from 'react-window';
import { useRef, useEffect, useState } from 'react';
import { ReplyView } from './ReplyView';

export function VirtualizedReplyList({ replies, topicId }) {
  const listRef = useRef<VariableSizeList>(null);
  const [rowHeights, setRowHeights] = useState<Map<number, number>>(new Map());

  const getRowHeight = (index: number) => {
    return rowHeights.get(index) || 200; // Default height
  };

  const setRowHeight = (index: number, height: number) => {
    setRowHeights(prev => {
      const next = new Map(prev);
      next.set(index, height);
      return next;
    });
    listRef.current?.resetAfterIndex(index);
  };

  return (
    <VariableSizeList
      ref={listRef}
      height={800}
      itemCount={replies.length}
      itemSize={getRowHeight}
      width="100%"
      overscanCount={5} // Render 5 extra items above/below viewport
    >
      {({ index, style }) => (
        <div style={style}>
          <ReplyView
            reply={replies[index]}
            topicId={topicId}
            onHeightChange={height => setRowHeight(index, height)}
          />
        </div>
      )}
    </VariableSizeList>
  );
}
```

**When to Use**:
- ✅ Topics with 50+ replies
- ✅ Mobile devices (better scroll performance)
- ❌ Short topics (overhead not worth it)

---

## Testing Checklist

After each phase, verify:

### Functionality Tests
```bash
# 1. Can users view topics?
- [ ] Navigate to /forums
- [ ] Click a topic
- [ ] Topic and replies visible

# 2. Can users create replies?
- [ ] Login as user
- [ ] Post a reply
- [ ] Reply appears immediately (optimistic)
- [ ] Refresh page - reply persists

# 3. Can admins moderate?
- [ ] Login as admin
- [ ] Lock/unlock topic
- [ ] Pin/unpin topic
- [ ] Mark reply as solution

# 4. Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes
- [ ] Focus management correct
```

### Performance Tests
```bash
# 1. Lighthouse audit
npm run build
npm start
# Chrome DevTools → Lighthouse → Run audit

# Target scores:
- Performance: 90+
- Accessibility: 100
- Best Practices: 100
- SEO: 95+

# 2. Bundle size
npm run build:analyze
# Check that forum-related chunks are < 100KB

# 3. Time to Interactive
# Chrome DevTools → Performance → Record page load
# TTI should be < 500ms on desktop, < 1000ms on mobile
```

---

## Common Issues & Solutions

### Issue 1: Hydration Errors

**Error**: "Text content does not match server-rendered HTML"

**Solution**: Ensure Server Components and Client Components use same data format

```typescript
// BAD - Date formatting differs between server/client
<time>{new Date(reply.created_at).toLocaleString()}</time>

// GOOD - Format on server, pass string to client
const formattedDate = new Date(reply.created_at).toISOString();
<time dateTime={formattedDate}>{formattedDate}</time>
```

### Issue 2: Server Actions Not Working

**Error**: "Server Actions must be async functions"

**Solution**: Check for proper 'use server' directive

```typescript
// BAD - directive must be at top of file
export async function createReply() {
  'use server'; // ❌ Wrong place!
}

// GOOD
'use server'; // ✅ At top of file

export async function createReply() {
  // ...
}
```

### Issue 3: Suspense Boundaries Not Streaming

**Error**: Page still blocks on data loading

**Solution**: Ensure async components are separate functions

```typescript
// BAD - inline async in JSX doesn't stream
<Suspense fallback={<Loading />}>
  {await getData()} {/* ❌ Blocks */}
</Suspense>

// GOOD - separate async component
<Suspense fallback={<Loading />}>
  <AsyncComponent /> {/* ✅ Streams */}
</Suspense>

async function AsyncComponent() {
  const data = await getData();
  return <div>{data}</div>;
}
```

---

## Rollback Plan

If issues arise during migration:

### Quick Rollback (< 5 minutes)
```bash
# Revert to previous git commit
git reset --hard HEAD~1
npm run build
npm start
```

### Partial Rollback (keep some changes)
```bash
# Revert specific files
git checkout HEAD~1 -- src/components/forums/TopicRow.tsx
npm run build
```

### Feature Flag Approach (Recommended)
```typescript
// Enable new features gradually
const USE_SERVER_COMPONENTS = process.env.NEXT_PUBLIC_USE_RSC === 'true';

export default function TopicPage({ params }) {
  if (USE_SERVER_COMPONENTS) {
    return <NewStreamingTopicPage params={params} />;
  }
  return <LegacyTopicPage params={params} />;
}
```

---

## Next Steps

After completing this migration:

1. **Monitor Performance**: Use Vercel Analytics or similar to track Core Web Vitals
2. **User Feedback**: Collect feedback on perceived performance improvements
3. **Iterate**: Based on data, add more optimizations (caching, CDN, etc.)
4. **Document**: Update team docs with new patterns

---

## Resources

- [React 19 Docs](https://react.dev)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [TanStack Query](https://tanstack.com/query/latest/docs/react/overview)
- [React Window](https://github.com/bvaughn/react-window)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-01
**Estimated Total Migration Time**: 4-6 weeks (2-3 developers)
