import { cookies } from 'next/headers';
import { AuthService } from './service';
import { User } from './types';
import { logger } from '@/lib/utils/logger';

/**
 * Get the current user's session on the server
 * This is used in Server Components to access authentication state
 *
 * @returns User object if authenticated, null otherwise
 */
export async function getServerSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return null;
    }

    const authService = new AuthService();
    const user = await authService.validateSession(sessionId);

    return user;
  } catch (error) {
    logger.error('Error validating server session:', error);
    return null;
  }
}

/**
 * Check if the current request is authenticated
 * Useful for middleware and route protection
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return session !== null;
}

/**
 * Require authentication in Server Components
 * Throws error if not authenticated (use in try-catch or error boundaries)
 */
export async function requireAuth(): Promise<User> {
  const session = await getServerSession();
  if (!session) {
    throw new Error('Authentication required');
  }
  return session;
}
