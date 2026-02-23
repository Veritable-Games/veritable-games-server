import { NextRequest, NextResponse } from 'next/server';
import { generateNonce } from '@/lib/security/csp';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * CSP Nonce Generation Endpoint
 *
 * This endpoint provides CSP nonces for client-side use when the nonce
 * is not available through server-side rendering. This should be used
 * sparingly as it requires an additional HTTP request.
 *
 * Preferred approach is to include the nonce in server-rendered HTML.
 */
async function GETHandler(request: NextRequest) {
  try {
    // Generate a new nonce for this request
    const nonce = generateNonce();

    // Return the nonce with appropriate cache headers
    const response = NextResponse.json({
      success: true,
      nonce,
      timestamp: Date.now(),
    });

    // Prevent caching of nonces (each should be unique)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');

    return response;
  } catch (error) {
    logger.error('CSP nonce generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate CSP nonce',
      },
      { status: 500 }
    );
  }
}

/**
 * POST method not allowed
 */
async function POSTHandler(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

// Apply security middleware
export const GET = withSecurity(GETHandler, {});
export const POST = withSecurity(POSTHandler, {});
