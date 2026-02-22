# Real-Time Updates Pattern: Next.js 15 + React 19

## Overview

This document explains the production-ready pattern for implementing real-time updates with optimistic UI in Next.js 15 App Router with React 19.

## The Problem

When using Server Components to fetch data and Client Components to display it, you need a way to:
1. Show instant UI feedback (optimistic updates)
2. Sync with server after mutations
3. Handle errors gracefully (rollback on failure)
4. Avoid manual page refresh

## The Solution: `useOptimistic` + `router.refresh()`

The canonical Next.js 15 pattern combines two React/Next.js features:

1. **`useOptimistic`** (React 19) - Instant UI updates
2. **`router.refresh()`** (Next.js 15) - Server Component re-render

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Server Component (TopicPage)                              │
│    - Fetches data from database                              │
│    - Passes data as props to Client Component                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Client Component (ReplyList)                              │
│    - Receives initial data                                   │
│    - Uses useOptimistic to manage state                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. User Action (Create Reply)                                │
│    a) Add optimistic reply to UI (instant feedback)          │
│    b) Send POST request to API route                         │
│    c) Call router.refresh() on success                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. router.refresh() Effect                                   │
│    - Re-runs Server Component                                │
│    - Fetches fresh data from database                        │
│    - Replaces optimistic state with real server data         │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Guide

### Step 1: Server Component (Data Fetching)

```typescript
// app/forums/topic/[id]/page.tsx
export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch data from database
  const replies = await getRepliesForTopic(id);

  return (
    <div>
      {/* Pass data to Client Component */}
      <ReplyList topicId={id} replies={replies} />
    </div>
  );
}
```

**Key Points:**
- Server Component runs on the server
- Fetches data directly from database
- No client-side state management needed
- Re-runs on `router.refresh()`

### Step 2: Client Component (Optimistic UI)

```typescript
// components/forums/ReplyList.tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function ReplyList({ replies: initialReplies }: { replies: Reply[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // useOptimistic manages optimistic state
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    initialReplies,
    (currentReplies, newReply) => [...currentReplies, newReply]
  );

  const handleReplySubmit = async (content: string) => {
    // 1. Create optimistic reply with temporary data
    const optimisticReply = {
      id: Date.now(), // Temporary ID
      content,
      created_at: new Date().toISOString(),
      author_username: user.username,
      // ... other fields
    };

    // 2. Add to UI immediately (0ms perceived latency)
    startTransition(() => {
      addOptimisticReply(optimisticReply);
    });

    try {
      // 3. Send API request in background
      const response = await fetch('/api/forums/replies', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        // 4. SUCCESS: Sync with server
        // This re-runs the Server Component, fetching fresh data
        // Fresh data replaces optimistic state automatically
        router.refresh();

        toast.success('Reply posted');
      } else {
        // 5. ERROR: Revert to server state
        toast.error('Failed to post reply');
        router.refresh(); // Reverts optimistic update
      }
    } catch (error) {
      // 6. EXCEPTION: Revert to server state
      toast.error('Network error');
      router.refresh(); // Reverts optimistic update
    }
  };

  // 7. Render optimistic state
  return (
    <div>
      {optimisticReplies.map(reply => (
        <ReplyCard key={reply.id} reply={reply} />
      ))}
    </div>
  );
}
```

**Key Points:**
- `useOptimistic` creates a local state derived from server data
- `startTransition` marks the update as non-blocking
- `router.refresh()` triggers Server Component re-render
- Optimistic state is automatically replaced by fresh server data
- Error handling calls `router.refresh()` to revert

### Step 3: API Route (Server Mutation)

```typescript
// app/api/forums/replies/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate input
  const result = CreateReplySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Create reply in database
  const reply = await createReply(result.data);

  // Return server-generated data
  return NextResponse.json({
    success: true,
    data: { reply },
  }, { status: 201 });
}
```

**Key Points:**
- API route validates input
- Creates record in database
- Returns server-generated data (IDs, timestamps, etc.)
- No need to manually trigger cache revalidation

## Advanced Patterns

### Pattern 1: Nested Optimistic Updates

For nested data structures (like threaded replies):

```typescript
const [optimisticReplies, addOptimisticReply] = useOptimistic(
  initialReplies,
  (currentReplies, newReply) => {
    // Top-level reply
    if (newReply.parent_id === null) {
      return [...currentReplies, newReply];
    }

    // Nested reply - find parent and add child
    const addToParent = (replies: Reply[]): Reply[] => {
      return replies.map(reply => {
        if (reply.id === newReply.parent_id) {
          return {
            ...reply,
            children: [...(reply.children || []), newReply],
          };
        }
        if (reply.children) {
          return {
            ...reply,
            children: addToParent(reply.children),
          };
        }
        return reply;
      });
    };

    return addToParent(currentReplies);
  }
);
```

### Pattern 2: Multiple Operations (UPDATE, DELETE)

All mutations follow the same pattern:

```typescript
// UPDATE
const handleUpdate = async (replyId: number, content: string) => {
  // Optional: Add optimistic update for immediate feedback
  const response = await fetch(`/api/forums/replies/${replyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });

  if (response.ok) {
    router.refresh(); // Sync with server
    toast.success('Reply updated');
  } else {
    router.refresh(); // Revert on error
    toast.error('Update failed');
  }
};

// DELETE
const handleDelete = async (replyId: number) => {
  if (!confirm('Delete this reply?')) return;

  const response = await fetch(`/api/forums/replies/${replyId}`, {
    method: 'DELETE',
  });

  if (response.ok) {
    router.refresh(); // Sync with server
    toast.success('Reply deleted');
  } else {
    router.refresh(); // Revert on error
    toast.error('Delete failed');
  }
};
```

### Pattern 3: Optimistic Update with Transition

Use `startTransition` to mark updates as non-blocking:

```typescript
const [isPending, startTransition] = useTransition();

const handleSubmit = async (content: string) => {
  startTransition(() => {
    addOptimisticReply(optimisticReply);
  });

  const response = await postReply(content);

  if (response.ok) {
    router.refresh();
  } else {
    router.refresh(); // Revert
  }
};

// Show loading state during transition
{isPending && <div>Posting...</div>}
```

## Common Mistakes to Avoid

### ❌ MISTAKE 1: Not calling `router.refresh()`

```typescript
// WRONG: Optimistic update never syncs with server
if (response.ok) {
  toast.success('Reply posted');
  // Missing: router.refresh()
}
```

**Why it's wrong:** The optimistic reply has a temporary ID and missing server-generated fields. Without `router.refresh()`, the UI shows stale data.

### ❌ MISTAKE 2: Manual state management instead of `useOptimistic`

```typescript
// WRONG: Manual state management
const [replies, setReplies] = useState(initialReplies);

const handleSubmit = async (content: string) => {
  setReplies([...replies, newReply]); // Manual update
  await postReply(content);
  // Now you need to manually merge server response
};
```

**Why it's wrong:** `useOptimistic` automatically handles state transitions and rollback. Manual state management is error-prone.

### ❌ MISTAKE 3: Not reverting on errors

```typescript
// WRONG: No error handling
try {
  await postReply(content);
  router.refresh();
} catch (error) {
  toast.error('Failed');
  // Missing: router.refresh() to revert optimistic update
}
```

**Why it's wrong:** If the API fails, the optimistic reply stays in the UI forever. Always call `router.refresh()` on errors.

### ❌ MISTAKE 4: Using `revalidatePath()` instead of `router.refresh()`

```typescript
// WRONG: revalidatePath() only works in Server Actions
import { revalidatePath } from 'next/cache';

const handleSubmit = async (content: string) => {
  await postReply(content);
  revalidatePath('/forums/topic/123'); // ❌ Doesn't work in Client Components
};
```

**Why it's wrong:** `revalidatePath()` is for Server Actions only. Use `router.refresh()` in Client Components.

### ❌ MISTAKE 5: Over-engineering with Server Actions

```typescript
// UNNECESSARY COMPLEXITY: Server Actions for simple mutations
'use server'
async function createReplyAction(formData: FormData) {
  const content = formData.get('content');
  await createReply(content);
  revalidatePath('/forums');
}

// Then in Client Component:
<form action={createReplyAction}>
  {/* Complex form handling */}
</form>
```

**Why it's wrong:** For simple mutations, API routes + `router.refresh()` is simpler and more flexible. Server Actions are better for:
- Progressive enhancement (works without JS)
- Form-heavy interactions
- Multi-step workflows

## Performance Considerations

### 1. `router.refresh()` Performance

**Q: Does `router.refresh()` reload the entire page?**
**A:** No. It only re-renders the affected Server Components. Client Component state is preserved.

**Q: Is it slow?**
**A:** No. It's a partial page refresh, not a full page reload. Typical latency: 50-200ms.

**Q: Does it clear form state?**
**A:** No. Client Component state (including form inputs) is preserved.

### 2. Optimistic Updates Latency

- **Optimistic update:** 0ms (instant)
- **API response:** 100-500ms (network + server processing)
- **`router.refresh()`:** 50-200ms (Server Component re-render)
- **Total perceived latency:** 0ms (user sees instant feedback)

### 3. When to Skip Optimistic Updates

Skip optimistic updates for:
- **Complex mutations** with unpredictable outcomes
- **Server-computed data** (e.g., calculated fields, aggregates)
- **Operations with high failure rates**

Just call `router.refresh()` after the mutation:

```typescript
const handleSubmit = async (content: string) => {
  // No optimistic update
  const response = await postReply(content);

  if (response.ok) {
    router.refresh(); // Fetch fresh data
    toast.success('Reply posted');
  }
};
```

## Server Actions vs API Routes

### When to Use API Routes + `router.refresh()`

✅ **Use API routes when:**
- Building a SPA with instant feedback
- Need fine-grained error handling
- Want to use existing API patterns
- Building for API consumption (mobile app, etc.)

### When to Use Server Actions

✅ **Use Server Actions when:**
- Building forms that work without JavaScript
- Need progressive enhancement
- Want to avoid CSRF token management
- Prefer co-locating server logic with components

### Comparison

| Feature | API Routes + `router.refresh()` | Server Actions |
|---------|--------------------------------|----------------|
| Optimistic UI | ✅ `useOptimistic` | ✅ `useOptimistic` |
| Error handling | Manual try/catch | Automatic error boundaries |
| CSRF protection | Manual token | Built-in |
| Works without JS | ❌ No | ✅ Yes |
| TypeScript inference | Manual typing | Automatic |
| API consumption | ✅ Yes (RESTful) | ❌ No (internal only) |

## Real-World Example: Forum Replies

See `/frontend/src/components/forums/ReplyList.tsx` for a production implementation:

- **CREATE reply:** Optimistic update + `router.refresh()` on success
- **UPDATE reply:** Direct mutation + `router.refresh()` on success
- **DELETE reply:** Direct mutation + `router.refresh()` on success
- **TOGGLE solution:** Direct mutation + `router.refresh()` on success
- **Nested replies:** Recursive optimistic update reducer
- **Error handling:** `router.refresh()` to revert on all errors

## Testing

### Unit Tests

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

test('calls router.refresh() after successful reply', async () => {
  const mockRefresh = jest.fn();
  (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });

  render(<ReplyList replies={[]} />);

  // Submit reply
  await userEvent.type(screen.getByRole('textbox'), 'Test reply');
  await userEvent.click(screen.getByRole('button', { name: /post/i }));

  // Wait for API call
  await waitFor(() => {
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('reply appears instantly and syncs with server', async ({ page }) => {
  await page.goto('/forums/topic/1');

  // Type and submit reply
  await page.fill('[data-testid="reply-input"]', 'Test reply');
  await page.click('[data-testid="reply-submit"]');

  // Optimistic update should appear immediately
  await expect(page.getByText('Test reply')).toBeVisible();

  // Wait for server sync
  await page.waitForResponse(/\/api\/forums\/replies/);

  // Verify reply persists after refresh
  await page.reload();
  await expect(page.getByText('Test reply')).toBeVisible();
});
```

## Debugging

### Enable Next.js Debug Logs

```bash
export DEBUG=next:*
npm run dev
```

### Check Server Component Re-renders

Add logging to your Server Component:

```typescript
export default async function TopicPage({ params }: TopicPageProps) {
  console.log('[Server Component] Rendering TopicPage', new Date().toISOString());

  const replies = await getReplies();

  return <ReplyList replies={replies} />;
}
```

Watch the console - you should see a new log every time `router.refresh()` is called.

### Verify Optimistic State

Add logging to `useOptimistic`:

```typescript
const [optimisticReplies, addOptimisticReply] = useOptimistic(
  initialReplies,
  (currentReplies, newReply) => {
    console.log('[Optimistic] Adding reply', newReply);
    return [...currentReplies, newReply];
  }
);
```

## Migration Guide

### Migrating from TanStack Query

**Before (TanStack Query):**
```typescript
const { data: replies, refetch } = useQuery({
  queryKey: ['replies', topicId],
  queryFn: () => fetchReplies(topicId),
});

const mutation = useMutation({
  mutationFn: createReply,
  onSuccess: () => {
    refetch(); // Refetch data
  },
});
```

**After (Next.js 15 + React 19):**
```typescript
// Server Component fetches data
export default async function TopicPage() {
  const replies = await getReplies(); // Direct database query
  return <ReplyList replies={replies} />;
}

// Client Component uses optimistic UI
const [optimisticReplies, addOptimisticReply] = useOptimistic(initialReplies, ...);

const handleSubmit = async () => {
  addOptimisticReply(newReply);
  await createReply();
  router.refresh(); // Sync with server
};
```

**Benefits:**
- No external library (reduced bundle size)
- Simpler mental model
- Better TypeScript integration
- Automatic cache invalidation

## Conclusion

The `useOptimistic` + `router.refresh()` pattern is the canonical Next.js 15 approach for real-time updates:

1. **Server Components** fetch data from database
2. **Client Components** show optimistic updates
3. **`router.refresh()`** syncs with server after mutations
4. **Automatic rollback** on errors

This pattern provides:
- ✅ Instant UI feedback (0ms perceived latency)
- ✅ Automatic sync with server
- ✅ Error handling with automatic rollback
- ✅ No manual cache invalidation
- ✅ No external libraries needed
- ✅ Production-ready out of the box

## References

- [React 19: useOptimistic](https://react.dev/reference/react/useOptimistic)
- [Next.js 15: Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Next.js 15: useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)
- [Next.js 15: Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
