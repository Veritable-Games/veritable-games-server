/**
 * Global Authentication Middleware
 *
 * MAINTENANCE MODE (Lockdown):
 * - When ON: Site requires authentication - redirects to /auth/login
 * - When OFF: Site is publicly accessible
 *
 * This middleware runs on EVERY request and checks the maintenance mode setting
 * from the database (with caching) to determine access control.
 *
 * IMPORTANT: This runs on Edge Runtime, so it can only do lightweight checks.
 * - Check for session_id cookie presence (NOT validation)
 * - Actual session validation happens in API routes via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * Paths that are ALWAYS public (even during maintenance/lockdown)
 */
const ALWAYS_PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/health',
  '/api/settings/maintenance',
];

/**
 * Check if a path is always publicly accessible
 */
function isAlwaysPublicPath(pathname: string): boolean {
  return ALWAYS_PUBLIC_PATHS.some(publicPath => pathname.startsWith(publicPath));
}

/**
 * In-memory cache for maintenance mode status
 * Reduces API calls in Edge Runtime
 *
 * NOTE: Kept short (5 seconds) so admin changes to maintenance mode
 * propagate quickly. The API now gets fresh data from the settings service
 * which is properly invalidated when admin saves.
 */
let maintenanceCache: { enabled: boolean; timestamp: number } | null = null;
const MAINTENANCE_CACHE_TTL = 5000; // 5 seconds - fast propagation for admin changes

/**
 * Check if maintenance mode (lockdown) is enabled
 *
 * Priority:
 * 1. Environment variable override - can only FORCE lockdown ON (emergency use)
 *    - LOCKDOWN_EMERGENCY_OVERRIDE=true → Forces lockdown ON
 *    - NEXT_PUBLIC_MAINTENANCE_MODE=true → Forces lockdown ON (legacy)
 *    - NOTE: 'false' values are intentionally NOT checked - admin UI controls unlock
 * 2. Database setting via /api/settings/maintenance (only during runtime)
 * 3. Default to true if API unavailable (fail secure)
 */
async function isMaintenanceMode(request: NextRequest): Promise<boolean> {
  // Emergency override - can only FORCE lockdown ON, not disable it
  // This ensures admin UI is the only way to unlock the site
  if (process.env.LOCKDOWN_EMERGENCY_OVERRIDE === 'true') {
    logger.info('[Middleware] LOCKDOWN_EMERGENCY_OVERRIDE is true - forcing lockdown ON');
    return true;
  }
  // Legacy support - only forcing ON (not off)
  if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true') {
    logger.info('[Middleware] NEXT_PUBLIC_MAINTENANCE_MODE is true - forcing lockdown ON');
    return true;
  }
  // NOTE: 'false' values intentionally NOT checked - database controls unlock

  // Check cache
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.timestamp < MAINTENANCE_CACHE_TTL) {
    logger.info(
      '[Middleware] Using cached maintenance mode:',
      maintenanceCache.enabled,
      'age:',
      now - maintenanceCache.timestamp,
      'ms'
    );
    return maintenanceCache.enabled;
  }

  // Fetch from API (must bypass all caches to get fresh data)
  // CRITICAL: Always fetch from localhost to avoid Edge Runtime issues with self-referential requests
  try {
    const apiUrl = 'http://localhost:3000/api/settings/maintenance';
    logger.info('[Middleware] Fetching maintenance status from:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store', // Critical: bypass Edge Runtime fetch cache
      signal: AbortSignal.timeout(3000), // 3-second timeout for safety
    });

    logger.info('[Middleware] API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      logger.info('[Middleware] API response data:', JSON.stringify(data));
      const enabled = data.success && data.data?.enabled === true;
      logger.info('[Middleware] Calculated enabled:', enabled);

      // Update cache
      maintenanceCache = { enabled, timestamp: now };
      return enabled;
    } else {
      logger.error('[Middleware] API response not OK, status:', response.status);
    }
  } catch (error) {
    // API unavailable - fail secure (require login)
    logger.info(
      '[Middleware] API unavailable:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // Default to true (fail secure - require login)
  logger.info('[Middleware] Defaulting to maintenance mode ON (fail secure)');
  return true;
}

/**
 * Check if a path is a static asset or Next.js internal route
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/uploads/') ||
    !!pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|avif|webp|txt|xml|json)$/)
  );
}

/**
 * Check if user has a valid session cookie
 */
function hasSessionCookie(request: NextRequest): boolean {
  const USE_SECURE_PREFIX =
    process.env.COOKIE_USE_SECURE_PREFIX !== undefined
      ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
      : false;

  const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return !!sessionId;
}

/**
 * Global middleware function
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow static assets without authentication
  if (isStaticAsset(pathname)) {
    const response = NextResponse.next();

    // Enhanced cache headers for chunks
    if (pathname.startsWith('/_next/static/chunks/')) {
      response.headers.set(
        'Cache-Control',
        'public, max-age=31536000, stale-while-revalidate=86400, immutable'
      );
      response.headers.set('X-Chunk-Cache', 'enabled');
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD');
      response.headers.set('Timing-Allow-Origin', '*');
    } else if (
      pathname.startsWith('/_next/') ||
      pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|avif|webp)$/)
    ) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return response;
  }

  // CRITICAL: API routes must NEVER be redirected
  // They handle authentication internally and return JSON errors
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Allow always-public paths (login, register, etc.)
  if (isAlwaysPublicPath(pathname)) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Check maintenance mode (lockdown) from database
  const maintenanceEnabled = await isMaintenanceMode(request);

  if (maintenanceEnabled) {
    // LOCKDOWN MODE: Require authentication
    const hasSession = hasSessionCookie(request);

    if (!hasSession) {
      // No session - redirect to login
      const loginUrl = new URL('/auth/login', request.url);

      // Store the original URL for post-login redirect (except for root)
      if (pathname !== '/') {
        loginUrl.searchParams.set('redirect', pathname);
      }

      const response = NextResponse.redirect(loginUrl);
      addSecurityHeaders(response);
      response.headers.set('X-Maintenance-Mode', 'true');
      response.headers.set('X-Has-Session', 'false');
      return response;
    }

    // User has session - allow access
    const response = NextResponse.next();
    addSecurityHeaders(response);
    response.headers.set('X-Maintenance-Mode', 'true');
    response.headers.set('X-Has-Session', 'true');
    return response;
  }

  // PUBLIC MODE: Maintenance is OFF, site is publicly accessible
  const response = NextResponse.next();
  addSecurityHeaders(response);
  response.headers.set('X-Maintenance-Mode', 'false');
  return response;
}

/**
 * Add security headers to response (Edge Runtime compatible)
 */
function addSecurityHeaders(response: NextResponse): void {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Vary', 'Accept-Encoding');

  // Basic CSP header - includes worker-src for Monaco editor
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' ws: wss: https://cloudflareinsights.com",
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "child-src 'self' blob: https://cdn.jsdelivr.net",
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspPolicy);
}

/**
 * Matcher configuration
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
