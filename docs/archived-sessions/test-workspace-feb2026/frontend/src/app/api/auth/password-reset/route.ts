import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { emailService } from '@/lib/email/service';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/auth/password-reset
 * Request a password reset email
 */
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    // Look up user by email
    const result = await dbAdapter.query<{
      id: number;
      username: string;
      email: string;
      is_active: boolean;
    }>(
      `SELECT id, username, email, is_active FROM users.users WHERE email = $1`,
      [email.toLowerCase()],
      { schema: 'users' }
    );

    const user = result.rows[0];

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, we say "email sent"
    if (!user || !user.is_active) {
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Send password reset email
    const emailSent = await emailService.sendPasswordResetEmail(user.id, user.email, user.username);

    if (!emailSent) {
      logger.error('Failed to send password reset email to:', email);
      // Still return success to prevent enumeration
    }

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    logger.error('Password reset request error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

export const POST = withSecurity(handler, {
  rateLimiter: rateLimiters.auth,
  rateLimiterType: 'auth',
});
