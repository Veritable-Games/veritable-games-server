/**
 * CSRF Token Initialization Endpoint
 *
 * This endpoint is called on app load to bootstrap the CSRF token.
 * It doesn't require authentication or validation - it simply sets
 * the csrf_token cookie so subsequent requests can include it.
 *
 * @route GET /api/csrf
 * @returns { success: true }
 */

import { NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Initialize CSRF token
 *
 * This endpoint is used to bootstrap the CSRF token on initial page load.
 * The withSecurity wrapper will automatically add the CSRF cookie to the response.
 *
 * Security Notes:
 * -  - We don't validate CSRF on this endpoint (chicken-and-egg problem)
 * - No authentication required - Public endpoint for token initialization
 * - Token is generated server-side with crypto.randomBytes(32)
 * - Cookie is set with SameSite=strict and Secure flag (in production)
 */
export const GET = withSecurity(
  async () => {
    return NextResponse.json({
      success: true,
      message: 'CSRF token initialized',
    });
  },
  {
    // Don't validate CSRF on this endpoint
  }
);
