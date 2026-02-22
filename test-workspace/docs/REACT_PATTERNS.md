# React & Next.js Patterns

Critical patterns and anti-patterns for Next.js 15 + React 19.

## ⚠️ BANNED PATTERNS (Removed October 2025)

### ❌ NEVER: template.tsx
```typescript
// ❌ NEVER CREATE app/template.tsx
// Causes: QueryClient recreation, state loss, hydration mismatches
```

**Why removed**: Server renders different nav than client hydrates, causing persistent hydration errors.

###❌ NEVER: TanStack Query
```typescript
// ❌ DO NOT install @tanstack/react-query
// ❌ DO NOT use useQuery/useMutation
```

**Why removed**: 900+ lines of dead code, 50KB bundle, fights with Server Components.

### ❌ NEVER: Multiple Client Wrappers
```typescript
// ❌ DO NOT create:
// - app/client-wrapper.tsx
// - app/client-layout.tsx
// - providers/QueryProvider.tsx (multiple files)
```

**Why removed**: Competing render cycles cause hydration mismatches.

## ✅ CORRECT PATTERNS

### Server Components (Default)
```typescript
// app/page.tsx (Server Component)
import { WikiService } from '@/lib/wiki/service';

export default async function Page() {
  const service = new WikiService();
  const categories = await service.getCategories();
  return <div>{/* render */}</div>;
}
```

### Client Mutations
```typescript
// Direct fetch (no library needed)
async function handleSubmit(data) {
  const response = await fetch('/api/wiki/pages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

### Single Providers File
```typescript
// app/providers.tsx
'use client'
export function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// app/layout.tsx (Server Component)
import { Providers } from './providers';
export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>;
}
```

## Next.js 15: Async Params

### ❌ WRONG (Next.js 14)
```typescript
export async function GET(req, { params }: { params: { slug: string } }) {
  const id = params.slug; // ERROR in Next.js 15
}
```

### ✅ CORRECT (Next.js 15)
```typescript
export async function GET(req, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  const id = params.slug;
}

// Page components
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```

## SSR-Safe Client Code

### ❌ WRONG
```typescript
const stored = localStorage.getItem('key'); // ERROR: localStorage not defined
```

### ✅ CORRECT
```typescript
// Pattern 1: Client guard
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('key');
}

// Pattern 2: useEffect (Client Components)
'use client'
useEffect(() => {
  const stored = localStorage.getItem('key');
}, []);

// Pattern 3: Early return
if (typeof window === 'undefined') return null;
```

## Optimistic UI Pattern (React 19)

### Basic Usage
```typescript
import { useOptimistic } from 'react';

function ReplyList({ replies }) {
  const [optimisticReplies, addOptimisticReply] = useOptimistic(
    replies,
    (current, newReply) => [...current, newReply]
  );

  const handleSubmit = async () => {
    addOptimisticReply({ id: Date.now(), content: userInput, /* ... */ });
    setUserInput(''); // Clear form immediately

    await fetch('/api/forums/replies', {
      method: 'POST',
      body: JSON.stringify({ content: userInput })
    });
    router.refresh(); // Sync with server
  };
}
```

**Benefits**:
- Instant UI feedback (<16ms)
- Auto-rollback on errors
- No external state management needed

**Real implementation**: See `frontend/src/components/forums/ReplyList.tsx`

### Forum Events (Real-Time Updates)

For server-sent events and real-time updates:

```typescript
import { useForumEvents } from '@/hooks/useForumEvents';

function TopicView() {
  const { connected, error } = useForumEvents({
    onTopicLocked: (data) => {
      // Handle topic locked event
      router.refresh();
    },
    onReplyCreated: (data) => {
      // Handle new reply
      router.refresh();
    },
    topicId: 123, // Optional: filter by topic
  });

  return <div>{/* render */}</div>;
}
```

**Features**:
- SSE-based real-time updates
- Automatic reconnection
- Type-safe event callbacks
- Filters by category/topic

**Real implementation**: See `frontend/src/hooks/useForumEvents.ts`

## News Editing Pattern

Inline markdown editing with auto-extraction:

```typescript
'use client'
import { useState } from 'react';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

export default function NewsArticle({ article }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(article.content);

  const handleSave = async () => {
    // Title auto-extracted from first # Header
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : article.title;

    await fetch(`/api/news/${article.slug}`, {
      method: 'PUT',
      body: JSON.stringify({ content, title }),
    });

    setIsEditing(false);
  };

  return isEditing ? (
    <MarkdownEditor value={content} onChange={setContent} />
  ) : (
    <HybridMarkdownRenderer content={content} />
  );
}
```

**Key Features**:
- Title extracted from first `# Header` in markdown
- Author auto-set from current user
- No separate input fields needed
- DOMPurify sanitization on render

**Complete guide**: See `docs/features/NEWS_EDITING_IMPLEMENTATION.md`

## Service Export Pattern

Services must export both class AND instance for the service registry:

```typescript
// ✅ CORRECT: Export both
export class UsersService {
  constructor() { /* ... */ }
  async getUser(id: number) { /* ... */ }
}

// Export singleton instance
export const usersService = new UsersService();
```

**Why**: The service registry (`lib/services/registry.ts`) expects singleton instances.

## Rule of Thumb

Before adding ANY dependency:
1. Does Next.js 15 provide this natively?
2. Are we already fetching in Server Components?
3. Will this create wrapper layers?
4. Will this add client JavaScript?

**Default**: Use Server Components with direct service calls.
