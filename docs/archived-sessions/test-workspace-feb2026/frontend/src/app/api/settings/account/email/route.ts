import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { authService } from '@/lib/auth/service';
import { validateEmail } from '@/lib/auth/utils';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

/**
 * PUT /api/settings/account/email
 * Change user email address
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
      const { email, current_password } = body;

      // Validate required fields
      if (!email || !current_password) {
        return NextResponse.json(
          { success: false, error: 'Email and current password are required' },
          { status: 400 }
        );
      }

      // Validate email format
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: emailValidation.errors.join('. '),
          },
          { status: 400 }
        );
      }

      // Check if new email is same as current
      if (email.toLowerCase() === authResult.user.email.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'New email must be different from current email' },
          { status: 400 }
        );
      }

      try {
        // Verify current password and update email
        await authService.changeEmail(authResult.user.id, current_password, email);

        return NextResponse.json({
          success: true,
          message: 'Email changed successfully',
        });
      } catch (error: any) {
        if (error.message === 'Invalid current password') {
          return NextResponse.json(
            { success: false, error: 'Current password is incorrect' },
            { status: 400 }
          );
        }

        if (error.message.includes('already in use') || error.message.includes('already exists')) {
          return NextResponse.json(
            { success: false, error: 'This email address is already in use' },
            { status: 409 }
          );
        }

        throw error; // Re-throw for general error handling
      }
    } catch (error) {
      logger.error('Error changing email:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to change email' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
