'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { User } from '@/lib/auth/utils';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  canEditWiki: () => boolean;
  canCreateWiki: () => boolean;
  canDeleteWiki: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize CSRF token and check for existing session on mount
  useEffect(() => {
    // Initialize CSRF token first, then check auth
    async function initialize() {
      try {
        // Initialize CSRF token by calling the /api/csrf endpoint
        await fetch('/api/csrf', { credentials: 'include' });
        logger.info('✅ CSRF token initialized');
      } catch (error) {
        logger.error('⚠️ CSRF init failed:', error);
        // Continue anyway - checkAuth might still work
      }

      // Now check authentication status
      await checkAuth();
    }

    initialize();

    // Listen for cross-tab login/logout events via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-event') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - checkAuth is stable (memoized)

  // Memoize functions to prevent unnecessary re-renders
  const checkAuth = useCallback(async () => {
    try {
      // Check for indicator cookie to avoid 401 spam for unauthenticated users
      // The actual session is HttpOnly (secure), but we set a readable indicator
      const hasAuthCookie = document.cookie
        .split(';')
        .some(
          cookie =>
            cookie.trim().startsWith('has_auth=') || cookie.trim().startsWith('__Secure-has_auth=')
        );

      if (!hasAuthCookie) {
        // No indicator cookie - user is definitely not authenticated
        setUser(null);
        setLoading(false);
        return;
      }

      // Indicator cookie present - verify session with server
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Important for cookies
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUser(result.data.user);
        } else {
          // Clear user state if API says not authenticated
          setUser(null);
        }
      } else if (response.status === 401) {
        // 401 is expected for unauthenticated users - not an error
        setUser(null);
      } else {
        // Log other errors (500, network issues, etc.)
        logger.error('Auth check failed', {
          status: response.status,
          statusText: response.statusText,
        });
        setUser(null);
      }
    } catch (error) {
      logger.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    // Trigger cross-tab sync
    localStorage.setItem('auth-event', Date.now().toString());
    localStorage.removeItem('auth-event');

    // Dispatch custom event for CSRF token cache invalidation
    window.dispatchEvent(
      new CustomEvent('auth-state-changed', {
        detail: { type: 'login', user: userData },
      })
    );
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchJSON('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      logger.error('Logout error:', error);
    } finally {
      setUser(null);
      // Trigger cross-tab sync
      localStorage.setItem('auth-event', Date.now().toString());
      localStorage.removeItem('auth-event');

      // Dispatch custom event for CSRF token cache invalidation
      window.dispatchEvent(
        new CustomEvent('auth-state-changed', {
          detail: { type: 'logout', user: null },
        })
      );
    }
  }, []);

  // Memoize permission functions to prevent recalculations
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;

      // Admin has all permissions
      if (user.role === 'admin') return true;

      // Check specific permissions based on role
      const permissions: Record<string, string[]> = {
        moderator: [
          'wiki:read',
          'wiki:create',
          'wiki:edit',
          'wiki:moderate',
          'forum:read',
          'forum:create',
          'forum:reply',
          'forum:moderate',
          'user:profile',
        ],
        user: [
          'wiki:read',
          'wiki:create',
          'wiki:edit',
          'forum:read',
          'forum:create',
          'forum:reply',
          'user:profile',
        ],
      };

      return permissions[user.role]?.includes(permission) || false;
    },
    [user]
  );

  const canEditWiki = useCallback((): boolean => {
    return hasPermission('wiki:edit');
  }, [hasPermission]);

  const canCreateWiki = useCallback((): boolean => {
    return hasPermission('wiki:create');
  }, [hasPermission]);

  const canDeleteWiki = useCallback((): boolean => {
    return hasPermission('wiki:delete') || user?.role === 'admin' || false;
  }, [hasPermission, user]);

  // Memoize context value to prevent unnecessary re-renders
  const value: AuthContextType = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      checkAuth,
      hasPermission,
      canEditWiki,
      canCreateWiki,
      canDeleteWiki,
    }),
    [
      user,
      loading,
      login,
      logout,
      checkAuth,
      hasPermission,
      canEditWiki,
      canCreateWiki,
      canDeleteWiki,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export the AuthContext for direct use
export { AuthContext };
