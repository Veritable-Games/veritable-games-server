/**
 * Emergency 2FA Rate Limit Clear API
 *
 * POST /api/emergency/clear-2fa-rate-limit
 *
 * This endpoint allows clearing 2FA rate limits without authentication,
 * secured by a secret token from environment variables.
 *
 * Use case: Admin locked out due to 2FA rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

// Environment variable for the emergency secret
const EMERGENCY_SECRET = process.env.EMERGENCY_SECRET;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    const body = await request.json();
    const { secret, username } = body;

    // Log all access attempts for security auditing
    logger.warn('[EMERGENCY] 2FA rate limit clear attempt', {
      ip,
      username: username || 'not provided',
      timestamp: new Date().toISOString(),
    });

    // Validate emergency secret is configured
    if (!EMERGENCY_SECRET) {
      logger.error('[EMERGENCY] EMERGENCY_SECRET not configured');
      return NextResponse.json({ error: 'Emergency access not configured' }, { status: 503 });
    }

    // Validate secret
    if (!secret || secret !== EMERGENCY_SECRET) {
      logger.warn('[EMERGENCY] Invalid secret attempt from IP:', ip);
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Find the user
    const userResult = await dbAdapter.query<{ id: number; username: string }>(
      'SELECT id, username FROM users.users WHERE username = ?',
      [username],
      { schema: 'users' }
    );

    const user = userResult.rows[0];
    if (!user) {
      logger.warn('[EMERGENCY] User not found:', username);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Clear failed 2FA attempts for this user
    await dbAdapter.query(
      'DELETE FROM users.two_factor_attempts WHERE user_id = ? AND success = false',
      [user.id],
      { schema: 'users' }
    );

    // Also clear any used tokens that might be causing issues
    await dbAdapter.query('DELETE FROM users.totp_used_tokens WHERE user_id = ?', [user.id], {
      schema: 'users',
    });

    logger.info('[EMERGENCY] 2FA rate limit cleared for user:', {
      userId: user.id,
      username: user.username,
      clearedBy: ip,
    });

    return NextResponse.json({
      success: true,
      message: `2FA rate limit cleared for user: ${user.username}`,
    });
  } catch (error) {
    logger.error('[EMERGENCY] Error clearing 2FA rate limit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
