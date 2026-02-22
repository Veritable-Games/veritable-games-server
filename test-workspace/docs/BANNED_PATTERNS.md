# Banned Patterns (NEVER Reintroduce)

**CRITICAL**: These patterns were removed in October 2025 after causing persistent bugs. They will break the application if reintroduced.

---

## ❌ NEVER: template.tsx

### What It Is
A file at `app/template.tsx` that wraps all pages and remounts on every route change.

### Why It Was Removed
- Causes complete re-render of the template on every navigation
- Breaks React state and Query providers
- Creates persistent hydration mismatches between server and client

### Symptoms of Reintroduction
- Navigation shows wrong page (Forums/Library text mismatches)
- Hydration errors in browser console
- Page refreshes when clicking navigation links
- State/localStorage values reset on navigation

### ✅ What to Use Instead
```typescript
// app/layout.tsx (Server Component)
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
```

Template is for persistent layouts - use middleware or layouts instead.

---

## ❌ NEVER: TanStack Query (@tanstack/react-query)

### What It Was
```typescript
// ❌ DO NOT ADD
npm install @tanstack/react-query
```

### Why It Was Removed
- **900+ lines of dead code** (not used anywhere)
- **50KB added to bundle** for zero benefit
- Architecture was already using Server Components with direct service calls
- Created redundant wrapper layers that fought with Next.js 15
- No actual use cases in the application

### What It Would Have Looked Like (DON'T DO THIS)
```typescript
// ❌ WRONG
const { data, isLoading, error } = useQuery({
  queryKey: ['topics'],
  queryFn: async () => {
    const response = await fetch('/api/forums/topics');
    return response.json();
  }
});
```

### ✅ What to Use Instead

**In Server Components**:
```typescript
// app/forums/page.tsx (Server Component)
import { ForumService } from '@/lib/forums/service';

export default async function ForumsPage() {
  const service = new ForumService();
  const topics = await service.getTopics();
  return <div>{/* render */}</div>;
}
```

**In Client Components (mutations)**:
```typescript
// app/forums/create/page.tsx
'use client'

async function handleCreateTopic(data) {
  const response = await fetch('/api/forums/topics', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (response.ok) {
    router.refresh(); // Revalidate data from server
  }
}
```

**For complex state**: Use Zustand instead (already installed).

---

## ❌ NEVER: Multiple Client Wrapper Layers

### What They Were
```typescript
// ❌ DO NOT CREATE THESE:
// - app/client-wrapper.tsx
// - app/client-layout.tsx
// - app/client-only-layout.tsx
// - providers/QueryProvider.tsx (one file only)
// - providers/CacheProvider.tsx
// - providers/StateProvider.tsx
// - lib/providers/ (provider factory)
```

### Why They Were Removed
- Multiple provider layers create competing render cycles
- Each provider re-renders on state change, causing cascading updates
- Client and server get out of sync (hydration errors)
- Breaks navigation and page transitions

### ✅ What to Use Instead

**Single providers file only**:
```typescript
// app/providers.tsx
'use client'

import { AuthProvider } from '@/contexts/AuthContext';

export function Providers({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
```

```typescript
// app/layout.tsx (Server Component)
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          <MainLayout>
            {children}
          </MainLayout>
        </Providers>
      </body>
    </html>
  );
}
```

**Key rules**:
- One `Providers` component only
- Must be `'use client'`
- Wrap it in `RootLayout` (Server Component)
- No nested provider files

---

## ❌ NEVER: String Concatenation in SQL

### What It Looks Like
```typescript
// ❌ WRONG - SQL injection vulnerability
const id = getUserInput();
const result = db.prepare(`SELECT * FROM users WHERE id = ${id}`).all();
```

### Why It's Dangerous
- Attacker can inject SQL commands: `id = "1 OR 1=1"` → query returns all users
- Violates SQL injection prevention
- Can delete/modify data or leak secrets

### ✅ What to Use Instead
```typescript
// ✅ CORRECT - Prepared statements with placeholders
const id = getUserInput();
const result = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
```

**With named parameters**:
```typescript
const result = db.prepare('SELECT * FROM users WHERE id = @id').get({ id });
```

**Always use `?` placeholders** - never string concat.

---

## ❌ NEVER: Creating Database Instances Directly

### What It Looks Like
```typescript
// ❌ WRONG
import Database from 'better-sqlite3';
const db = new Database('./data/users.db');
const users = db.prepare('SELECT * FROM users').all();
```

### Why It's Wrong
- Creates **connection leaks** (connections never close properly)
- Bypasses connection pooling (wastes resources)
- Loses automatic schema initialization
- Loses build-time mocking (breaks builds)

### ✅ What to Use Instead
```typescript
// ✅ CORRECT - Always use the singleton pool
import { dbPool } from '@/lib/database/pool';

const db = dbPool.getConnection('users');
const users = db.prepare('SELECT * FROM users').all();
```

**Pool handles**:
- Connection lifecycle management
- Max concurrent connection limits (50)
- LRU eviction policy
- WAL mode setup
- Schema auto-initialization
- Build-time mocking

**Never bypass the pool** - it's the ONLY way to access databases.

---

## Summary: Check Before Committing

Before pushing code, search for:
```bash
# ❌ Check for banned patterns
grep -r "app/template" frontend/src/
grep -r "tanstack/react-query" frontend/
grep -r "QueryClient" frontend/src/
grep -r "new Database" frontend/src/ --include="*.ts" --include="*.tsx"
grep -r "app/client-wrapper\|app/client-layout\|providers/.*Provider" frontend/src/
```

If any of these patterns appear, remove them immediately.

---

## Questions?

See full documentation:
- Next.js 15 patterns: [docs/REACT_PATTERNS.md](../../docs/REACT_PATTERNS.md)
- Database architecture: [docs/DATABASE.md](../../docs/DATABASE.md)
- Hydration prevention: [.claude/hydration-prevention.md](./hydration-prevention.md)
