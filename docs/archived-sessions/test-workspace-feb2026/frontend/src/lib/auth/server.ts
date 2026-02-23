/**
 * Server-Only Auth Utilities
 *
 * Functions that require server-side APIs (cookies, etc.)
 * DO NOT import from client components!
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authService } from './service';
import type { User } from './types';

// Re-export User type for external consumption
export type { User } from './types';

// Use __Secure- prefix only if explicitly enabled (requires HTTPS)
// Default to false for HTTP-compatible deployments (e.g., behind proxy)
const USE_SECURE_PREFIX =
  process.env.COOKIE_USE_SECURE_PREFIX !== undefined
    ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
    : false;

const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Get current user from request (for middleware and server components)
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  let sessionId: string | undefined;

  if (request) {
    // Get session from request cookies
    sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  } else {
    // Get session from Next.js cookies (server components)
    try {
      const cookieStore = await cookies();
      sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch (error) {
      // cookies() can only be used in server components
      return null;
    }
  }

  if (!sessionId) return null;

  return await authService.validateSession(sessionId);
}

// Get current session ID from request (for session management)
export function getCurrentSessionId(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

// Set session cookie in response with enhanced security
export function setSessionCookie(response: NextResponse, sessionId: string): void {
  const cookieOptions = {
    httpOnly: true,
    // Hybrid approach: environment variable override or default based on NODE_ENV
    // Set COOKIE_SECURE_FLAG=false for HTTP-only deployments
    secure:
      process.env.COOKIE_SECURE_FLAG !== undefined
        ? process.env.COOKIE_SECURE_FLAG === 'true'
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const, // Strict for session cookies to prevent CSRF
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    // Add domain restriction in production for subdomain security
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  };

  response.cookies.set(SESSION_COOKIE_NAME, sessionId, cookieOptions);

  // Set indicator cookie (non-HttpOnly) so client can check auth state without 401s
  const indicatorCookieName = USE_SECURE_PREFIX ? '__Secure-has_auth' : 'has_auth';
  response.cookies.set(indicatorCookieName, '1', {
    httpOnly: false, // MUST be false so JavaScript can read it
    secure: cookieOptions.secure,
    sameSite: 'strict' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  });
}

// Clear session cookie with matching security settings
export function clearSessionCookie(response: NextResponse): void {
  const cookieOptions = {
    httpOnly: true,
    // Must match setSessionCookie secure setting
    secure:
      process.env.COOKIE_SECURE_FLAG !== undefined
        ? process.env.COOKIE_SECURE_FLAG === 'true'
        : process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0, // Immediate expiration
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  };

  response.cookies.set(SESSION_COOKIE_NAME, '', cookieOptions);

  // Also clear the indicator cookie
  const indicatorCookieName = USE_SECURE_PREFIX ? '__Secure-has_auth' : 'has_auth';
  response.cookies.set(indicatorCookieName, '', {
    httpOnly: false,
    secure: cookieOptions.secure,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0,
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  });
}

// Create response with session cookie
export async function createAuthResponse(data: any, sessionId: string) {
  // FIX: Use cookies() from next/headers instead of response.headers.append
  // This avoids Next.js bug #46579 where multiple Set-Cookie headers are collapsed
  const isProduction = process.env.NODE_ENV === 'production';
  const secure =
    process.env.COOKIE_SECURE_FLAG !== undefined
      ? process.env.COOKIE_SECURE_FLAG === 'true'
      : isProduction;

  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    ...(isProduction && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };

  // Set session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, cookieOptions);

  // Set auth indicator cookie (non-httpOnly for client-side access)
  const indicatorCookieName = 'has_auth';
  cookieStore.set(indicatorCookieName, '1', {
    httpOnly: false, // Client needs to read this
    secure,
    sameSite: 'strict' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  const response = NextResponse.json(data);
  response.headers.set('X-Auth-State-Changed', 'true');

  return response;
}

// Create logout response
export function createLogoutResponse(data: any) {
  const response = NextResponse.json(data);
  clearSessionCookie(response);
  return response;
}

// Check if user is authenticated (for API routes)
export async function requireAuth(
  request: NextRequest
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

// Export alias for backward compatibility
export const getServerSession = getCurrentUser;

// Check if user has admin role
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const authResult = await requireAuth(request);

  if (authResult.response) {
    return authResult;
  }

  if (authResult.user.role !== 'admin') {
    return {
      response: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

// Check if user has moderator or admin role
export async function requireModerator(
  request: NextRequest
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const authResult = await requireAuth(request);

  if (authResult.response) {
    return authResult;
  }

  if (!['admin', 'moderator', 'developer'].includes(authResult.user.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Moderator access required' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}

// Check if user has developer or admin role (for workspace access)
export async function requireDeveloper(
  request: NextRequest
): Promise<{ user: User; response?: never } | { user?: never; response: NextResponse }> {
  const authResult = await requireAuth(request);

  if (authResult.response) {
    return authResult;
  }

  if (!['admin', 'developer'].includes(authResult.user.role)) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Developer access required' },
        { status: 403 }
      ),
    };
  }

  return authResult;
}
