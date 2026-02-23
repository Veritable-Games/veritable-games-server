import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  try {
    const result = await dbAdapter.query(
      `SELECT id, email, email_verified, email_verification_expires_at FROM users.users WHERE email_verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return NextResponse.redirect(new URL('/login?message=already_verified', request.url));
    }

    const expiresAt = new Date(user.email_verification_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.redirect(new URL('/login?error=token_expired', request.url));
    }

    await dbAdapter.query(
      `UPDATE users.users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = $1`,
      [user.id]
    );

    return NextResponse.redirect(new URL('/login?message=email_verified', request.url));
  } catch (error) {
    logger.error('Email verification error:', error);
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
  }
}

export const GET = withSecurity(GETHandler);
