'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { User } from '@/lib/auth/utils';
import { fetchJSON } from '@/lib/utils/csrf';
import { logger } from '@/lib/utils/logger';

interface AuthState {
  // Core state
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (userData: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setUser: (user: User | null) => void;

  // Permission methods
  hasPermission: (permission: string) => boolean;
  canEditWiki: () => boolean;
  canCreateWiki: () => boolean;
  canDeleteWiki: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      loading: true,
      isAuthenticated: false,

      // Actions
      setLoading: loading => set({ loading }),

      setUser: user => set({ user, isAuthenticated: !!user, loading: false }),

      login: userData => {
        set({ user: userData, isAuthenticated: true, loading: false });

        // Trigger cross-tab sync
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth-event', Date.now().toString());
          localStorage.removeItem('auth-event');

          // Dispatch custom event for CSRF token cache invalidation
          window.dispatchEvent(
            new CustomEvent('auth-state-changed', {
              detail: { type: 'login', user: userData },
            })
          );
        }
      },

      logout: async () => {
        try {
          await fetchJSON('/api/auth/logout', {
            method: 'POST',
          });
        } catch (error) {
          logger.error('Logout error:', error);
        } finally {
          set({ user: null, isAuthenticated: false, loading: false });

          if (typeof window !== 'undefined') {
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
        }
      },

      checkAuth: async () => {
        set({ loading: true });
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              set({
                user: result.data.user,
                isAuthenticated: true,
                loading: false,
              });
            } else {
              set({ user: null, isAuthenticated: false, loading: false });
            }
          } else {
            set({ user: null, isAuthenticated: false, loading: false });
          }
        } catch (error) {
          logger.error('Auth check error:', error);
          set({ user: null, isAuthenticated: false, loading: false });
        }
      },

      // Permission methods
      hasPermission: permission => {
        const { user } = get();
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

      canEditWiki: () => {
        return get().hasPermission('wiki:edit');
      },

      canCreateWiki: () => {
        return get().hasPermission('wiki:create');
      },

      canDeleteWiki: () => {
        const { user } = get();
        return get().hasPermission('wiki:delete') || user?.role === 'admin' || false;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: state => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Setup cross-tab sync
if (typeof window !== 'undefined') {
  // Listen for storage events for cross-tab sync
  window.addEventListener('storage', e => {
    if (e.key === 'auth-event') {
      useAuthStore.getState().checkAuth();
    }
  });

  // Initialize auth check
  useAuthStore.getState().checkAuth();
}

export default useAuthStore;
