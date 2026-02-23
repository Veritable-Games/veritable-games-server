import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { authService } from '@/lib/auth/service';
import { validatePassword } from '@/lib/auth/utils';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * PUT /api/settings/account/password
 * Change user password
 * Requires current password verification
 */
export const PUT = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
      const body = await request.json();
      const { current_password, new_password, confirmPassword } = body;

      // Validate required fields
      if (!current_password || !new_password) {
        return NextResponse.json(
          { success: false, error: 'All password fields are required' },
          { status: 400 }
        );
      }

      // Verify passwords match if confirmPassword provided
      if (confirmPassword && new_password !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: 'New passwords do not match' },
          { status: 400 }
        );
      }

      // Validate new password strength
      const passwordValidation = validatePassword(new_password);
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { success: false, error: passwordValidation.errors.join('. ') },
          { status: 400 }
        );
      }

      // Ensure new password is different from current
      if (current_password === new_password) {
        return NextResponse.json(
          { success: false, error: 'New password must be different from current password' },
          { status: 400 }
        );
      }

      try {
        // Change password using AuthService
        await authService.changePassword(authResult.user.id, current_password, new_password);

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (error: any) {
        if (error.message === 'Invalid current password') {
          return NextResponse.json(
            { success: false, error: 'Current password is incorrect' },
            { status: 400 }
          );
        }

        throw error; // Re-throw for general error handling
      }
    } catch (error) {
      logger.error('Error changing password:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to change password' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
