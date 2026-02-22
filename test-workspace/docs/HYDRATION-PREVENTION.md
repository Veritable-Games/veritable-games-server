# Hydration Error Prevention

Critical patterns to prevent hydration errors in Next.js 15 + React 19. **NEVER REINTRODUCE THESE BANNED PATTERNS** (removed October 2025 after persistent hydration issues).

## ❌ BANNED: template.tsx

```typescript
// ❌ NEVER CREATE app/template.tsx
// template.tsx remounts on EVERY route change, causing:
// - QueryClient/Provider recreation
// - State loss and hydration mismatches
// - Multiple render cycles
```

**Why it was removed:** `template.tsx` caused the server to render with one version of navigation while the client hydrated with another, creating persistent "Forums"/"Library" text mismatches and hydration errors.

## ❌ BANNED: TanStack Query (@tanstack/react-query)

```typescript
// ❌ DO NOT install @tanstack/react-query
// ❌ DO NOT create QueryClient instances
// ❌ DO NOT use useQuery/useMutation hooks
```

**Why it was removed:**
- The application was already using Server Components with direct service calls
- TanStack Query was 900+ lines of unused dead code
- Added 50KB to bundle size for no benefit
- Created complex wrapper layers that fought with Next.js 15's Server Component model

**What to use instead:**
```typescript
// ✅ CORRECT: Server Components fetch directly
import { WikiService } from '@/lib/wiki/service';

export default async function WikiPage() {
  const wikiService = new WikiService();
  const categories = await wikiService.getCategories();
  return <div>{/* render */}</div>;
}

// ✅ CORRECT: Client mutations use direct fetch
async function handleSubmit(data) {
  const response = await fetch('/api/wiki/pages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

## ❌ BANNED: Multiple Client Wrapper Layers

```typescript
// ❌ DO NOT create these files:
// - app/client-wrapper.tsx
// - app/client-layout.tsx
// - app/client-only-layout.tsx
// - providers/QueryProvider.tsx (multiple provider files)
```

**Why they were removed:** Multiple wrapper layers create competing render cycles and hydration mismatches.

**What to use instead:**
```typescript
// ✅ CORRECT: Single providers.tsx for client state only
// app/providers.tsx
'use client'
import { AuthProvider } from '@/contexts/AuthContext';

export function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// app/layout.tsx (Server Component)
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
```

## ✅ CORRECT: Architecture Pattern

### Server Components by Default

- Use Server Components for all pages and static layouts
- Only use `'use client'` for interactive widgets (dropdowns, modals, forms)
- Fetch data directly in Server Components using service classes

### Client State Management

- Use Zustand for complex client UI state (already installed)
- Use React Context only for auth and minimal global state
- NO external data fetching libraries (TanStack Query, SWR, etc.)

### Authentication Pattern

```typescript
// Server Components
import { getServerSession } from '@/lib/auth/session';

export default async function Page() {
  const session = await getServerSession();
  return <div>{session?.user.username}</div>;
}

// Client Components (for real-time UI)
'use client'
import { useAuth } from '@/contexts/AuthContext';

export function UserWidget() {
  const { user } = useAuth();
  return <div>{user?.username}</div>;
}
```

## ⚠️ CRITICAL: Next.js 15 Async Params

Next.js 15 changed route params and searchParams to be async. You MUST await them before use.

### ❌ WRONG - Direct access (Next.js 14 pattern)

```typescript
// API Route Handler
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const projectId = params.slug; // ❌ ERROR in Next.js 15
}

// Page Component
export default function Page({ params }: { params: { slug: string } }) {
  const slug = params.slug; // ❌ ERROR in Next.js 15
}
```

### ✅ CORRECT - Await params (Next.js 15 pattern)

```typescript
// API Route Handler
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const params = await context.params; // ✅ Await the Promise
  const projectId = params.slug;
}

// Page Component - Server Component
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params; // ✅ Await in Server Component
  const slug = resolvedParams.slug;
}

// Page Component - Client Component
'use client'
export default function Page({
  params,
}: {
  params: { slug: string }; // Client components receive resolved params
}) {
  const slug = params.slug; // ✅ Already resolved for client components
}

// SearchParams also need await
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams; // ✅ This is sync
  // OR for page components:
  const { searchParams } = await props; // ✅ Await if from props
}
```

### Common Error Patterns to Fix

```typescript
// ❌ ERROR: Route "/api/projects/[slug]/..." used `params.slug`
project_id: params.slug, // WRONG

// ✅ FIX: Await params first
const { slug } = await params;
project_id: slug, // CORRECT

// ❌ ERROR: useEffect dependency using params directly
useEffect(() => {
  fetchData();
}, [params.slug]); // WRONG in client component with server params

// ✅ FIX: Destructure params or use resolved value
const slug = typeof params === 'object' && 'slug' in params ? params.slug : '';
useEffect(() => {
  fetchData();
}, [slug]); // CORRECT
```

## ⚠️ CRITICAL: SSR-Safe Client Code

Many browser APIs (localStorage, window, document) are not available during server-side rendering.

### ❌ WRONG - Direct browser API usage

```typescript
// This will error: "localStorage is not defined"
const stored = localStorage.getItem('key'); // ❌ SSR error
```

### ✅ CORRECT - Client-side guards

```typescript
// Pattern 1: Check if window exists
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('key'); // ✅ Safe
}

// Pattern 2: Use useEffect (Client Components only)
'use client'
import { useEffect, useState } from 'react';

function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Safe - only runs on client
    const stored = localStorage.getItem('key');
    setData(stored);
  }, []);
}

// Pattern 3: Early return for SSR
if (typeof window === 'undefined') {
  return null; // or default value
}
```

## 🎯 Rule of Thumb

**Before adding ANY new dependency, ask:**
1. Does Next.js 15 provide this natively? (Usually yes)
2. Are we already fetching in Server Components? (Yes)
3. Will this create wrapper layers? (Bad)
4. Will this add client-side JavaScript? (Minimize)

**If in doubt:** Use Server Components with direct service calls. This is the Next.js 15 + React 19 way.

## Recent Architectural Changes (October 2025)

**Removed to fix hydration errors:**
- TanStack Query (@tanstack/react-query)
- ESLint (conflicted with strict linting rules)
- template.tsx (caused route change remounts)
- Multiple client wrapper layers
- PWA service worker (hydration conflicts)

**What Remains:**
- Server Components with direct service calls
- Zustand for client UI state
- React Context for auth only
- Native fetch() for mutations
- Simple provider pattern (single file)

## Related Documentation

- [Troubleshooting](.claude/troubleshooting.md) - Hydration error solutions
- Main CLAUDE.md - Core architecture rules
