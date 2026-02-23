import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/service';
import { createLogoutResponse } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Check if maintenance mode is enabled
 */
function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === 'true';
}

async function postHandler(request: NextRequest) {
  try {
    // Get session ID from request cookies
    // Use secure cookie name if explicitly enabled
    const USE_SECURE_PREFIX =
      process.env.COOKIE_USE_SECURE_PREFIX !== undefined
        ? process.env.COOKIE_USE_SECURE_PREFIX === 'true'
        : false;

    const SESSION_COOKIE_NAME = USE_SECURE_PREFIX ? '__Secure-session_id' : 'session_id';
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionId) {
      // Delete session from database
      await authService.logout(sessionId);
    }

    // Determine redirect path based on maintenance mode
    const redirectPath = isMaintenanceMode() ? '/landing' : '/auth/login';

    // Return response with cleared session cookie and redirect path
    return createLogoutResponse({
      success: true,
      message: 'Logged out successfully',
      redirect: redirectPath,
    });
  } catch (error) {
    logger.error('Logout error:', error);

    // Still clear the cookie even if there was an error
    // Redirect to landing if in maintenance mode
    const redirectPath = isMaintenanceMode() ? '/landing' : '/auth/login';

    return createLogoutResponse({
      success: false,
      error: 'Logout failed',
      redirect: redirectPath,
    });
  }
}

export const POST = withSecurity(postHandler, {
  enableCSRF: true,
});
