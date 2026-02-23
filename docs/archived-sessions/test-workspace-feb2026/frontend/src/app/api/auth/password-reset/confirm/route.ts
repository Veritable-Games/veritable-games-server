import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

const confirmSchema = z.object({
  token: z.string().min(32, 'Invalid token'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{}\\|;:'",.<>/?`~])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
});

/**
 * GET /api/auth/password-reset/confirm?token=xxx
 * Validate a password reset token
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || token.length < 32) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing token' },
        { status: 400 }
      );
    }

    // Look up token
    const result = await dbAdapter.query<{
      id: number;
      username: string;
      email: string;
      password_reset_expires_at: string;
    }>(
      `SELECT id, username, email, password_reset_expires_at
       FROM users.users
       WHERE password_reset_token = $1`,
      [token],
      { schema: 'users' }
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    // Check expiration
    const expiresAt = new Date(user.password_reset_expires_at);
    if (expiresAt < new Date()) {
      // Clear expired token
      await dbAdapter.query(
        `UPDATE users.users SET password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = $1`,
        [user.id],
        { schema: 'users' }
      );

      return NextResponse.json(
        { success: false, error: 'Token has expired. Please request a new password reset.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Token is valid',
      username: user.username,
    });
  } catch (error) {
    logger.error('Token validation error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/password-reset/confirm
 * Reset password with valid token
 */
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = confirmSchema.parse(body);

    // Look up token
    const result = await dbAdapter.query<{
      id: number;
      username: string;
      email: string;
      password_reset_expires_at: string;
    }>(
      `SELECT id, username, email, password_reset_expires_at
       FROM users.users
       WHERE password_reset_token = $1`,
      [token],
      { schema: 'users' }
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    // Check expiration
    const expiresAt = new Date(user.password_reset_expires_at);
    if (expiresAt < new Date()) {
      // Clear expired token
      await dbAdapter.query(
        `UPDATE users.users SET password_reset_token = NULL, password_reset_expires_at = NULL WHERE id = $1`,
        [user.id],
        { schema: 'users' }
      );

      return NextResponse.json(
        { success: false, error: 'Token has expired. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await dbAdapter.query(
      `UPDATE users.users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, user.id],
      { schema: 'users' }
    );

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError?.message || 'Validation error' },
        { status: 400 }
      );
    }

    logger.error('Password reset error:', error);
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
