// Enhanced testing utilities for React Testing Library
// Provides common test setup, mocking, and assertion helpers

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { AuthProvider } from '@/contexts/AuthContext';
import type { User } from '@/types/database';

// Mock user data for testing
export const mockUsers: Record<
  'admin' | 'moderator' | 'user',
  User & { status?: string; reputation?: number; post_count?: number; last_active?: string }
> = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@veritable-games.com',
    display_name: 'Administrator',
    role: 'admin' as const,
    is_active: true,
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    avatar_url: undefined,
    last_login: '2024-01-15T12:00:00Z',
    preferences: undefined,
    // Extended properties for tests
    status: 'active' as const,
    reputation: 1000,
    post_count: 50,
    last_active: '2024-01-15T12:00:00Z',
  },
  moderator: {
    id: 2,
    username: 'moderator',
    email: 'mod@veritable-games.com',
    display_name: 'Moderator',
    role: 'moderator' as const,
    is_active: true,
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    avatar_url: undefined,
    last_login: '2024-01-15T11:00:00Z',
    preferences: undefined,
    // Extended properties for tests
    status: 'active' as const,
    reputation: 500,
    post_count: 25,
    last_active: '2024-01-15T11:00:00Z',
  },
  user: {
    id: 3,
    username: 'testuser',
    email: 'user@veritable-games.com',
    display_name: 'Test User',
    role: 'user' as const,
    is_active: true,
    email_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    avatar_url: undefined,
    last_login: '2024-01-15T10:00:00Z',
    preferences: undefined,
    // Extended properties for tests
    status: 'active' as const,
    reputation: 100,
    post_count: 5,
    last_active: '2024-01-15T10:00:00Z',
  },
};

// Mock forum data
export const mockForumData = {
  category: {
    id: 1,
    name: 'General Discussion',
    slug: 'general',
    description: 'General discussions about gaming',
    display_order: 1,
    active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  topic: {
    id: 1,
    title: 'Welcome to Veritable Games',
    content: 'This is a welcome topic for new users.',
    category_id: 1,
    author_id: 1,
    author_username: 'admin',
    is_pinned: true,
    is_locked: false,
    reply_count: 5,
    view_count: 100,
    created_at: '2024-01-01T00:00:00Z',
  },
  reply: {
    id: 1,
    topic_id: 1,
    author_id: 2,
    author_username: 'moderator',
    content: 'Thanks for the warm welcome!',
    created_at: '2024-01-01T01:00:00Z',
  },
};

// Mock wiki data
export const mockWikiData = {
  page: {
    id: 1,
    title: 'Getting Started Guide',
    slug: 'getting-started',
    content: '# Getting Started\n\nWelcome to the wiki!',
    author_id: 1,
    is_published: true,
    view_count: 50,
    revision_number: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
  category: {
    id: 1,
    name: 'Guides',
    slug: 'guides',
    description: 'User guides and tutorials',
    display_order: 1,
    created_at: '2024-01-01T00:00:00Z',
  },
};

// Provider wrapper for tests that need authentication context
interface AllTheProvidersProps {
  children: React.ReactNode;
  user?: User | null;
}

const AllTheProviders = ({ children, user = null }: AllTheProvidersProps) => {
  // Mock the AuthProvider with the provided user
  const mockAuthValue = {
    user,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    isAuthenticated: !!user,
    checkAuth: jest.fn(),
    hasPermission: jest.fn(),
    canEditWiki: jest.fn(),
    canCreateWiki: jest.fn(),
    canDeleteWiki: jest.fn(),
  };

  // Create a mock context provider
  const AuthContext = React.createContext(mockAuthValue);
  return <AuthContext.Provider value={mockAuthValue}>{children}</AuthContext.Provider>;
};

// Enhanced render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: User | null;
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult {
  const { user, wrapper, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const content = <AllTheProviders user={user}>{children}</AllTheProviders>;

    return wrapper
      ? React.createElement(wrapper, { children: content } as { children: React.ReactNode })
      : content;
  };

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock Next.js router
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  isFallback: false,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
  beforePopState: jest.fn(),
  reload: jest.fn(),
};

// Mock fetch for API calls
export const mockFetch = (response: any, ok: boolean = true) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 400,
      json: () => Promise.resolve(response),
    })
  ) as jest.Mock;
};

// Helper to wait for async operations
export const waitFor = async (callback: () => void, timeout: number = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      try {
        callback();
        resolve();
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          setTimeout(check, 50);
        }
      }
    };
    check();
  });
};

// Accessibility testing helpers
export const axeMatchers = {
  toHaveNoViolations: (received: any) => {
    const violations = received.violations;
    const pass = violations.length === 0;

    if (pass) {
      return {
        message: () => `Expected element to have accessibility violations, but none were found`,
        pass: true,
      };
    } else {
      const violationMessages = violations
        .map((v: any) => `${v.id}: ${v.description} (${v.nodes.length} instances)`)
        .join('\n');

      return {
        message: () =>
          `Expected element to have no accessibility violations, but found:\n${violationMessages}`,
        pass: false,
      };
    }
  },
};

// Custom matchers for Jest
expect.extend(axeMatchers);

// Mock window.matchMedia for responsive tests
export const mockMatchMedia = (query: string, matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(q => ({
      matches: q === query ? matches : false,
      media: q,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Mock IntersectionObserver for virtual scrolling tests
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  window.IntersectionObserver = mockIntersectionObserver;
  window.IntersectionObserverEntry = jest.fn();
};

// Database mocking utilities
export const mockDatabase = {
  prepare: jest.fn(() => ({
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  })),
  transaction: jest.fn(fn => fn),
  close: jest.fn(),
};

// Export everything for easy imports
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
