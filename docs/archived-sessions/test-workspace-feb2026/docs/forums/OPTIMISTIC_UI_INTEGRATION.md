# Optimistic UI Integration Guide

This guide shows how to integrate the new optimistic UI components into your
forum topic pages for instant moderation feedback.

## Overview

The optimistic UI system provides instant feedback for moderation actions (lock,
pin, solve, archive) using React 19's `useOptimistic` hook combined with
real-time Server-Sent Events (SSE).

**Benefits:**

- Instant UI updates (<16ms response time)
- Automatic rollback on errors
- Real-time synchronization with other users via SSE
- Loading states and animations
- Type-safe moderation actions

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ TopicView Page (Server Component)                       │
│ - Fetches initial topic data from database              │
└────────────────┬────────────────────────────────────────┘
                 │ Passes initialTopic
                 ▼
┌─────────────────────────────────────────────────────────┐
│ OptimisticTopicWrapper (Client Component)               │
│ - useOptimisticModeration hook                          │
│ - Listens to SSE events via useForumEvents              │
│ - Manages optimistic state + server state               │
└────────────────┬────────────────────────────────────────┘
                 │ Provides: { topic, actions, isPending }
                 ▼
┌─────────────────────────────────────────────────────────┐
│ UI Components (render props children)                   │
│ - OptimisticStatusBadges (shows current status)         │
│ - OptimisticModerationDropdown (action buttons)         │
│ - TopicView content (title, body, replies)              │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Basic Integration

Update your topic page to use the optimistic wrapper:

```typescript
// src/app/forums/topic/[id]/page.tsx

import { OptimisticTopicWrapper } from '@/components/forums/OptimisticTopicWrapper';
import { OptimisticStatusBadges } from '@/components/forums/OptimisticStatusBadges';
import { OptimisticModerationDropdown } from '@/components/forums/OptimisticModerationDropdown';

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const topicId = parseInt(id);

  // Fetch initial topic data (server-side)
  const result = await forumService.getTopicById(topicId);
  if (!result.ok) {
    notFound();
  }

  const topic = result.value;

  return (
    <OptimisticTopicWrapper initialTopic={topic}>
      {({ topic: optimisticTopic, actions, isPending }) => (
        <div className="space-y-4">
          {/* Header with status badges and moderation dropdown */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{optimisticTopic.title}</h1>
              <OptimisticStatusBadges
                topic={optimisticTopic}
                isPending={isPending}
              />
            </div>

            {/* Moderation dropdown (moderators only) */}
            <OptimisticModerationDropdown
              topic={optimisticTopic}
              actions={actions}
              isPending={isPending}
            />
          </div>

          {/* Topic content */}
          <div className="prose">
            {optimisticTopic.content}
          </div>

          {/* Replies, etc. */}
        </div>
      )}
    </OptimisticTopicWrapper>
  );
}
```

### 2. With Success/Error Callbacks

Add toast notifications for user feedback:

```typescript
'use client';

import { useToast } from '@/hooks/useToast'; // Or your toast library

export function TopicViewClient({ initialTopic }: { initialTopic: OptimisticTopic }) {
  const { toast } = useToast();

  const handleSuccess = (action: string) => {
    toast.success(`Successfully ${action}`);
  };

  const handleError = (error: Error) => {
    toast.error(`Failed: ${error.message}`);
  };

  return (
    <OptimisticTopicWrapper
      initialTopic={initialTopic}
      onSuccess={handleSuccess}
      onError={handleError}
    >
      {({ topic, actions, isPending }) => (
        <div>
          {/* Your UI */}
        </div>
      )}
    </OptimisticTopicWrapper>
  );
}
```

### 3. Topic List Integration (Compact Badges)

Use compact badges in topic lists:

```typescript
import { CompactStatusBadges } from '@/components/forums/OptimisticStatusBadges';

function TopicRow({ topic }: { topic: ForumTopic }) {
  return (
    <div className="flex items-center gap-2">
      <CompactStatusBadges topic={topic} />
      <Link href={`/forums/topic/${topic.id}`}>
        {topic.title}
      </Link>
    </div>
  );
}
```

## Component Reference

### OptimisticTopicWrapper

**Purpose:** Manages optimistic state and provides actions to children via
render props.

**Props:**

```typescript
interface OptimisticTopicWrapperProps {
  initialTopic: OptimisticTopic; // Initial topic data from server
  children: (props: {
    topic: OptimisticTopic; // Current optimistic state
    actions: OptimisticActions; // Moderation action functions
    isPending: boolean; // True during server sync
  }) => ReactNode;
  onSuccess?: (action: string) => void; // Called on successful action
  onError?: (error: Error) => void; // Called on error
}
```

**Actions Provided:**

```typescript
interface OptimisticActions {
  toggleLock: () => Promise<void>; // Lock/unlock topic
  togglePin: () => Promise<void>; // Pin/unpin topic
  toggleSolved: () => Promise<void>; // Mark solved/unsolved
  toggleArchived: () => Promise<void>; // Archive/unarchive topic
  refresh: () => void; // Manual refresh from server
}
```

### OptimisticStatusBadges

**Purpose:** Displays topic status badges with pulse animation during pending
state.

**Props:**

```typescript
interface OptimisticStatusBadgesProps {
  topic: {
    is_locked?: boolean;
    is_pinned?: boolean;
    is_solved?: boolean;
    is_archived?: boolean;
  };
  isPending?: boolean; // Shows pulse animation
  showIcons?: boolean; // Show emoji icons (default: true)
  size?: 'sm' | 'md' | 'lg'; // Badge size (default: 'sm')
}
```

**Example:**

```typescript
<OptimisticStatusBadges
  topic={optimisticTopic}
  isPending={isPending}
  size="md"
  showIcons={true}
/>
```

### CompactStatusBadges

**Purpose:** Icon-only badges for topic lists (no text labels).

**Props:**

```typescript
interface CompactStatusBadgesProps {
  topic: {
    is_locked?: boolean;
    is_pinned?: boolean;
    is_solved?: boolean;
    is_archived?: boolean;
  };
  isPending?: boolean;
}
```

**Example:**

```typescript
<CompactStatusBadges topic={topic} isPending={false} />
```

### OptimisticModerationDropdown

**Purpose:** Dropdown menu with all moderation actions.

**Props:**

```typescript
interface OptimisticModerationDropdownProps {
  topic: {
    is_locked?: boolean;
    is_pinned?: boolean;
    is_solved?: boolean;
    is_archived?: boolean;
  };
  actions: OptimisticActions; // From OptimisticTopicWrapper
  isPending: boolean; // From OptimisticTopicWrapper
}
```

**Features:**

- Dropdown closes on action click
- Disabled during pending state
- Shows "Updating..." text when pending
- Pulse indicator during updates
- Click outside to close
- Icons for each action
- Refresh button to sync with server

## Real-time Updates

The system automatically receives real-time updates from other users via
Server-Sent Events (SSE):

**How it works:**

1. `OptimisticTopicWrapper` uses `useForumEvents` hook to connect to
   `/api/forums/events`
2. When another user moderates a topic, the server broadcasts an SSE event
3. All connected clients receive the event and update their optimistic state
4. No manual refresh needed - changes appear in real-time

**Event Types:**

- `topic:locked` / `topic:unlocked`
- `topic:pinned` / `topic:unpinned`
- `topic:solved` / `topic:unsolved`
- `topic:archived` / `topic:unarchived`

**Automatic Reconnection:** The SSE connection automatically reconnects if the
network drops, and catches up on missed events using the `lastEventId`
mechanism.

## Migration Guide

### Old Pattern (TopicView without optimistic UI)

```typescript
// ❌ OLD: Manual refresh, no instant feedback

export default async function TopicPage({ params }) {
  const topic = await getTopic(params.id);

  return (
    <div>
      <TopicHeader topic={topic} />
      <TopicModerationDropdown topicId={topic.id} />
      {/* Requires full page refresh to see changes */}
    </div>
  );
}
```

### New Pattern (with OptimisticTopicWrapper)

```typescript
// ✅ NEW: Instant feedback, automatic updates

export default async function TopicPage({ params }) {
  const { id } = await params;
  const topic = await getTopic(parseInt(id));

  return (
    <OptimisticTopicWrapper initialTopic={topic}>
      {({ topic: optimisticTopic, actions, isPending }) => (
        <div>
          <OptimisticStatusBadges topic={optimisticTopic} isPending={isPending} />
          <OptimisticModerationDropdown
            topic={optimisticTopic}
            actions={actions}
            isPending={isPending}
          />
          {/* Instant updates, no refresh needed */}
        </div>
      )}
    </OptimisticTopicWrapper>
  );
}
```

## Advanced Usage

### Custom Optimistic Hook

If you need custom behavior, use `useOptimisticModeration` directly:

```typescript
'use client';

import { useOptimisticModeration } from '@/hooks/useOptimisticModeration';

export function CustomTopicView({ initialTopic }: { initialTopic: OptimisticTopic }) {
  const { topic, isPending, toggleLock, togglePin, refresh } = useOptimisticModeration({
    initialTopic,
    autoRefresh: true,
    onSuccess: (action) => console.log(`Success: ${action}`),
    onError: (error) => console.error(error),
  });

  return (
    <div>
      {/* Custom UI using topic, isPending, toggleLock, etc. */}
      <button onClick={toggleLock} disabled={isPending}>
        {topic.is_locked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  );
}
```

### Disable Auto-refresh

If you want manual control over SSE updates:

```typescript
const { topic, isPending, refresh } = useOptimisticModeration({
  initialTopic,
  autoRefresh: false, // Disable SSE
});

// Manual refresh when needed
<button onClick={refresh}>Refresh</button>
```

### Filter SSE Events by Category

Connect only to events from a specific category:

```typescript
// In useOptimisticModeration hook (internal)
useForumEvents({
  categoryId: topic.category_id, // Only receive events from this category
  topicId: topic.id, // Only receive events for this topic
  enabled: autoRefresh,
});
```

## Performance Considerations

**SSE Connection Management:**

- One SSE connection per `OptimisticTopicWrapper` instance
- Connections auto-close when component unmounts
- Heartbeat every 30 seconds keeps connection alive
- Automatic reconnection with exponential backoff

**Optimistic Updates:**

- UI updates happen synchronously (<16ms)
- Server request happens asynchronously in background
- Automatic rollback if server request fails
- No blocking, no loading spinners for initial feedback

**Event Broadcasting:**

- Server broadcasts to all connected clients
- Clients receive only events matching their filters (category/topic)
- Event history (last 50 events) for reconnecting clients

## Troubleshooting

### Updates not appearing

**Problem:** Moderation actions don't update the UI.

**Solution:** Ensure `OptimisticTopicWrapper` is wrapping your components and
you're using `optimisticTopic` (not `initialTopic`) in your UI.

### Multiple SSE connections

**Problem:** Console shows multiple SSE connection messages.

**Solution:** Ensure `OptimisticTopicWrapper` is not being re-mounted
unnecessarily. Use React DevTools to check component tree.

### Rollback not working

**Problem:** UI doesn't revert when server request fails.

**Solution:** Make sure you're passing `onError` callback to see what error
occurred. The hook automatically rolls back on error.

### SSE not connecting

**Problem:** No real-time updates from other users.

**Solution:**

1. Check browser dev tools Network tab for `/api/forums/events` request
2. Verify `autoRefresh` is `true` (default)
3. Check server logs for SSE connection messages

## Testing

### Test Optimistic Updates

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('locks topic optimistically', async () => {
  const user = userEvent.setup();
  const mockTopic = { id: 1, is_locked: false, /* ... */ };

  render(
    <OptimisticTopicWrapper initialTopic={mockTopic}>
      {({ topic, actions, isPending }) => (
        <>
          <button onClick={actions.toggleLock}>Lock</button>
          {topic.is_locked && <span>Locked</span>}
          {isPending && <span>Pending</span>}
        </>
      )}
    </OptimisticTopicWrapper>
  );

  // Click lock button
  await user.click(screen.getByRole('button', { name: /lock/i }));

  // Optimistic update should be instant
  expect(screen.getByText('Locked')).toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();

  // Wait for server confirmation
  await waitFor(() => {
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });
});
```

### Test Real-time Events

```typescript
test('receives SSE updates from other users', async () => {
  const mockTopic = { id: 1, is_locked: false };

  render(
    <OptimisticTopicWrapper initialTopic={mockTopic}>
      {({ topic }) => (
        <div>{topic.is_locked ? 'Locked' : 'Unlocked'}</div>
      )}
    </OptimisticTopicWrapper>
  );

  expect(screen.getByText('Unlocked')).toBeInTheDocument();

  // Simulate SSE event from another user
  const event = new MessageEvent('message', {
    data: JSON.stringify({
      type: 'topic:locked',
      data: { topic_id: 1, status: 1, is_locked: true },
    }),
  });
  window.dispatchEvent(event);

  // UI should update based on SSE event
  await waitFor(() => {
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
```

## See Also

- [useOptimisticModeration Hook Documentation](./OPTIMISTIC_MODERATION_HOOK.md)
- [SSE Events Reference](./SSE_EVENTS.md)
- [Forum Status Bit Flags](./STATUS_FLAGS.md)
- [React 19 useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
