import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { totpService } from '@/lib/security/totp-service';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * POST - Verify 2FA token during login
 *
 * This endpoint is called after successful password authentication
 * when the user has 2FA enabled. It accepts either a TOTP token
 * or a backup code.
 */
export const POST = withSecurity(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { userId, token, type = 'totp' } = body;

      // Validate required fields
      if (!userId) {
        return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
      }

      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Verification code is required' },
          { status: 400 }
        );
      }

      // Verify the user exists and has 2FA enabled
      const userResult = await dbAdapter.query<{ two_factor_enabled: boolean }>(
        `SELECT two_factor_enabled FROM users.users WHERE id = ?`,
        [userId],
        { schema: 'users' }
      );

      const userRow = userResult.rows[0];
      if (!userRow) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }

      if (!userRow.two_factor_enabled) {
        return NextResponse.json(
          { success: false, error: '2FA is not enabled for this account' },
          { status: 400 }
        );
      }

      let result;

      if (type === 'backup') {
        // Verify backup code
        result = await totpService.verifyBackupCode(userId, token);

        if (result.success && result.remainingCodes !== undefined && result.remainingCodes <= 2) {
          // Warn user about low backup codes
          return NextResponse.json({
            success: true,
            verified: true,
            warning: `Only ${result.remainingCodes} backup codes remaining. Consider generating new codes.`,
          });
        }
      } else {
        // Verify TOTP token
        result = await totpService.verifyToken(userId, token);
      }

      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        verified: true,
      });
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to verify authentication code' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
