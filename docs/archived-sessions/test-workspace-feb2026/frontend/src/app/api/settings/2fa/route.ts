import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { withSecurity } from '@/lib/security/middleware';
import { totpService } from '@/lib/security/totp-service';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * GET - Get 2FA status for current user
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const status = await totpService.getStatus(authResult.user.id);

    return NextResponse.json({
      success: true,
      data: {
        enabled: status.enabled,
        verifiedAt: status.verifiedAt?.toISOString() || null,
        backupCodesRemaining: status.backupCodesRemaining,
      },
    });
  } catch (error) {
    logger.error('Error getting 2FA status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get 2FA status' },
      { status: 500 }
    );
  }
}

/**
 * POST - Handle 2FA actions (setup, verify, disable, generate-backup-codes)
 */
export const POST = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
      const body = await request.json();
      const { action } = body;

      switch (action) {
        case 'setup': {
          // Initialize 2FA setup - returns QR code
          const setup = await totpService.initializeSetup(
            authResult.user.id,
            authResult.user.email
          );

          return NextResponse.json({
            success: true,
            data: {
              qrCode: setup.qrCodeDataUrl,
              secret: setup.secret, // For manual entry
              otpauthUrl: setup.otpauthUrl,
            },
          });
        }

        case 'verify': {
          // Verify setup with token and enable 2FA
          const { token } = body;

          if (!token) {
            return NextResponse.json(
              { success: false, error: 'Verification token is required' },
              { status: 400 }
            );
          }

          const result = await totpService.verifyAndEnable(authResult.user.id, token);

          if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
          }

          // Generate backup codes after successful verification
          const backupCodes = await totpService.generateBackupCodes(authResult.user.id);

          return NextResponse.json({
            success: true,
            message: 'Two-factor authentication enabled successfully',
            data: {
              backupCodes: backupCodes.codes,
            },
          });
        }

        case 'disable': {
          // Disable 2FA (requires password verification in future)
          await totpService.disable(authResult.user.id);

          return NextResponse.json({
            success: true,
            message: 'Two-factor authentication disabled',
          });
        }

        case 'generate-backup-codes': {
          // Generate new backup codes (requires 2FA to be enabled)
          const isEnabled = await totpService.isEnabled(authResult.user.id);

          if (!isEnabled) {
            return NextResponse.json(
              { success: false, error: '2FA must be enabled to generate backup codes' },
              { status: 400 }
            );
          }

          const backupCodes = await totpService.generateBackupCodes(authResult.user.id);

          return NextResponse.json({
            success: true,
            data: {
              backupCodes: backupCodes.codes,
              count: backupCodes.count,
            },
          });
        }

        default:
          return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
      }
    } catch (error) {
      logger.error('Error handling 2FA action:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process 2FA request' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
