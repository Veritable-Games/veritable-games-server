# State Management Patterns (Zustand)

**Stack**: Zustand 5.0.8 is the default state management library.

> **Why Zustand?** Lightweight (~1KB), works with Server Components, plays well with Next.js 15, no provider setup complexity.

---

## Core Concepts

- **Stores** = simple functions that return state + actions
- **No Provider required** for basic usage
- **Subscribe to changes** = React components re-render when store updates
- **Persist optionally** = localStorage or custom storage
- **Async/await supported** = handle API calls inside actions

---

## Pattern 1: Basic Store

### Simple Store (UI State)
```typescript
// lib/stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',

  toggleSidebar: () => set((state) => ({
    sidebarOpen: !state.sidebarOpen
  })),

  setTheme: (theme) => set({ theme }),
}));
```

### Usage in Client Component
```typescript
// app/components/Sidebar.tsx
'use client'

import { useUIStore } from '@/lib/stores/uiStore';

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <button onClick={toggleSidebar}>
      {sidebarOpen ? 'Close' : 'Open'} Sidebar
    </button>
  );
}
```

---

## Pattern 2: Store with Async Actions

### Async Store (Data Fetching)
```typescript
// lib/stores/forumStore.ts
import { create } from 'zustand';
import { forumService } from '@/lib/forums/service';

interface ForumState {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  fetchTopics: (categoryId: string) => Promise<void>;
  clear: () => void;
}

export const useForumStore = create<ForumState>((set) => ({
  topics: [],
  loading: false,
  error: null,

  fetchTopics: async (categoryId) => {
    set({ loading: true, error: null });
    try {
      const topics = await forumService.getTopicsByCategory(categoryId);
      set({ topics, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      });
    }
  },

  clear: () => set({ topics: [], loading: false, error: null }),
}));
```

### Usage
```typescript
'use client'

import { useForumStore } from '@/lib/stores/forumStore';

export function TopicList({ categoryId }: { categoryId: string }) {
  const { topics, loading, fetchTopics } = useForumStore();

  useEffect(() => {
    fetchTopics(categoryId);
  }, [categoryId, fetchTopics]);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {topics.map(topic => (
        <li key={topic.id}>{topic.title}</li>
      ))}
    </ul>
  );
}
```

---

## Pattern 3: Persisted Store (localStorage)

### Store with Persistence
```typescript
// lib/stores/userPreferencesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPreferences {
  fontSize: number;
  autoSave: boolean;
  recentSearches: string[];
  setFontSize: (size: number) => void;
  addRecentSearch: (query: string) => void;
}

export const useUserPreferencesStore = create<UserPreferences>(
  persist(
    (set) => ({
      fontSize: 16,
      autoSave: true,
      recentSearches: [],

      setFontSize: (size) => set({ fontSize: size }),

      addRecentSearch: (query) => set((state) => ({
        recentSearches: [query, ...state.recentSearches].slice(0, 10),
      })),
    }),
    {
      name: 'user-preferences', // localStorage key
      partialize: (state) => ({
        fontSize: state.fontSize,
        autoSave: state.autoSave,
        recentSearches: state.recentSearches,
        // Don't persist functions, only state
      }),
    }
  )
);
```

### Important: Use in useEffect (SSR Safety)
```typescript
'use client'

export function FontSizeControl() {
  const [mounted, setMounted] = useState(false);
  const { fontSize, setFontSize } = useUserPreferencesStore();

  // localStorage only works in browser
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <input
      type="range"
      value={fontSize}
      onChange={(e) => setFontSize(Number(e.target.value))}
    />
  );
}
```

---

## Pattern 4: Multiple Store Usage (Composition)

### Combining Stores
```typescript
'use client'

import { useUIStore } from '@/lib/stores/uiStore';
import { useForumStore } from '@/lib/stores/forumStore';

export function Dashboard() {
  // Use multiple stores
  const { theme } = useUIStore();
  const { topics, fetchTopics } = useForumStore();

  return (
    <div className={theme === 'dark' ? 'bg-black' : 'bg-white'}>
      {topics.map(topic => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
```

---

## Pattern 5: Server Component Access (Async)

### Accessing Store State in Server Components
```typescript
// lib/stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  setUserId: (id: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  setUserId: (id) => set({ userId: id }),
}));

// Get current state (NOT reactive)
export const getAuthState = () => useAuthStore.getState();
```

### Server Component Usage
```typescript
// app/dashboard/page.tsx (Server Component)
import { getAuthState } from '@/lib/stores/authStore';

export default async function DashboardPage() {
  const { userId } = getAuthState();

  // Use userId for initial data fetch
  const userData = await fetchUserData(userId);

  return <Dashboard initialData={userData} />;
}
```

> Note: Server Components can't use hooks, but can access store state via `getState()`.

---

## Pattern 6: Custom Hooks (Composability)

### Encapsulate Store Logic
```typescript
// lib/hooks/useForumTopics.ts
import { useEffect } from 'react';
import { useForumStore } from '@/lib/stores/forumStore';

export function useForumTopics(categoryId: string) {
  const { topics, loading, fetchTopics } = useForumStore();

  useEffect(() => {
    fetchTopics(categoryId);
  }, [categoryId, fetchTopics]);

  return { topics, loading };
}
```

### Usage (Much Cleaner)
```typescript
'use client'

import { useForumTopics } from '@/lib/hooks/useForumTopics';

export function TopicList({ categoryId }: { categoryId: string }) {
  const { topics, loading } = useForumTopics(categoryId);

  if (loading) return <div>Loading...</div>;
  return <ul>{topics.map(t => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

---

## Pattern 7: Selectors (Performance)

### Prevent Unnecessary Re-renders
```typescript
// ❌ WRONG - Re-renders on ANY store change
const { topics, userId, theme, loading } = useForumStore();

// ✅ CORRECT - Re-renders only when `topics` changes
const topics = useForumStore((state) => state.topics);
const loading = useForumStore((state) => state.loading);
```

### Selector Hook Pattern
```typescript
// lib/stores/forumStore.ts
export const selectTopics = (state: ForumState) => state.topics;
export const selectLoading = (state: ForumState) => state.loading;

// Usage
const topics = useForumStore(selectTopics);
const loading = useForumStore(selectLoading);
```

---

## When to Use Zustand vs. Context vs. Server State

| Scenario | Use | Reason |
|----------|-----|--------|
| Form input (temporary) | React useState | Local to component |
| User preferences (persistent) | Zustand + persist | Survives page reload |
| Authentication context | Zustand + Context | Share across app |
| Page data from API | Server fetch | Server Component |
| Real-time updates | Zustand + WebSocket | Global async state |
| Forum topics list | Zustand | Global client state |
| Modal open/closed | Zustand or useState | Light state |

---

## Common Mistakes to Avoid

### ❌ Storing Unnecessary Data
```typescript
// ❌ WRONG - Don't store server data in Zustand
const useStore = create(() => ({
  allUsers: [], // Fetch with service instead
  allProducts: [], // Keep state light
}));
```

### ❌ Not Using Selectors
```typescript
// ❌ WRONG - Re-renders on unrelated changes
const store = useForumStore(); // All state
const { topics } = store; // Only need topics
```

### ✅ Correct Approach
```typescript
// ✅ CORRECT - Only subscribe to what you need
const topics = useForumStore((state) => state.topics);
```

### ❌ Async Logic Without Error Handling
```typescript
// ❌ WRONG - No error handling
const fetchData = async () => {
  const data = await fetch('/api/data');
  set({ data });
};
```

### ✅ Correct Approach
```typescript
// ✅ CORRECT - Proper error handling
const fetchData = async () => {
  set({ loading: true, error: null });
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    set({ data, loading: false });
  } catch (error) {
    set({
      error: error instanceof Error ? error.message : 'Unknown error',
      loading: false
    });
  }
};
```

---

## Full Example Store

```typescript
// lib/stores/wikiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WikiPageService } from '@/lib/wiki/service';

interface WikiState {
  currentPage: { id: string; title: string } | null;
  recentPages: Array<{ id: string; title: string; viewedAt: number }>;
  loading: boolean;
  error: string | null;

  // Actions
  setCurrentPage: (page: { id: string; title: string }) => void;
  fetchPage: (id: string) => Promise<void>;
  addRecentPage: (page: { id: string; title: string }) => void;
  clearError: () => void;
}

export const useWikiStore = create<WikiState>(
  persist(
    (set) => ({
      currentPage: null,
      recentPages: [],
      loading: false,
      error: null,

      setCurrentPage: (page) => set({ currentPage: page }),

      fetchPage: async (id) => {
        set({ loading: true, error: null });
        try {
          const service = new WikiPageService();
          const page = await service.getPageById(id);
          set({
            currentPage: { id: page.id, title: page.title },
            loading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load page',
            loading: false,
          });
        }
      },

      addRecentPage: (page) => set((state) => ({
        recentPages: [
          { ...page, viewedAt: Date.now() },
          ...state.recentPages.filter(p => p.id !== page.id),
        ].slice(0, 10),
      })),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'wiki-store',
      partialize: (state) => ({
        recentPages: state.recentPages,
      }),
    }
  )
);
```

---

## See Also

- Zustand docs: https://github.com/pmndrs/zustand
- React Hooks: [docs/REACT_PATTERNS.md](../../docs/REACT_PATTERNS.md)
- Database patterns: [DATABASE_QUERIES_QUICK_REF.md](./DATABASE_QUERIES_QUICK_REF.md)
