import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * Extended user type with authentication fields
 * These fields may not be present on all user objects
 */
interface UserWithAuthFields {
  totp_enabled?: boolean;
  webauthn_enabled?: boolean;
  full_name?: string | null;
}

/**
 * GET /api/auth/session
 * Returns the current user session data or 401 if not authenticated
 */
async function GETHandler(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
          user: null,
          expires: null,
        },
        { status: 401 }
      );
    }

    // Calculate session expiration (30 days from now)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Cast to extended type to access authentication fields
    const userWithAuth = user as unknown as UserWithAuthFields;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        totp_enabled: userWithAuth.totp_enabled || false,
        webauthn_enabled: userWithAuth.webauthn_enabled || false,
        full_name: userWithAuth.full_name || user.display_name,
        bio: user.bio,
        avatar_url: user.avatar_url,
      },
      expires: expiresAt.toISOString(),
    });
  } catch (error: any) {
    logger.error('Session endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve session',
        user: null,
        expires: null,
      },
      { status: 500 }
    );
  }
}

// Apply security middleware - no CSRF for GET requests
export const GET = withSecurity(GETHandler, {});
