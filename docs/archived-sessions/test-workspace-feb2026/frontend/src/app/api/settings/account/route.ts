import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/server';
import { authService } from '@/lib/auth/service';
import { validatePassword } from '@/lib/auth/utils';
import { withSecurity } from '@/lib/security/middleware';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';
// TOTP authentication removed

// GET - Retrieve current account information
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    // Check if user has 2FA enabled
    const hasTwoFactor = false; // TOTP functionality removed

    // Return basic account information (no sensitive data)
    const accountInfo = {
      username: authResult.user.username,
      email: authResult.user.email,
      created_at: authResult.user.created_at,
      last_active: authResult.user.last_active,
      email_verified: authResult.user.email_verified,
      two_factor_enabled: hasTwoFactor,
    };

    return NextResponse.json({
      success: true,
      data: accountInfo,
    });
  } catch (error) {
    logger.error('Error retrieving account info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve account information' },
      { status: 500 }
    );
  }
}

// PUT - Update account settings (password change)
export const PUT = withSecurity(
  async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    try {
      const body = await request.json();
      const { action, currentPassword, newPassword, confirmPassword, username } = body;

      // Handle username change
      if (action === 'change-username') {
        // Validate required fields
        if (!username || !currentPassword) {
          return NextResponse.json(
            { success: false, error: 'Username and current password are required' },
            { status: 400 }
          );
        }

        // Validate username format
        if (username.length < 3 || username.length > 30) {
          return NextResponse.json(
            { success: false, error: 'Username must be between 3 and 30 characters' },
            { status: 400 }
          );
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Username can only contain letters, numbers, hyphens, and underscores',
            },
            { status: 400 }
          );
        }

        try {
          // Change username using AuthService
          await authService.changeUsername(authResult.user.id, username, currentPassword);

          return NextResponse.json({
            success: true,
            message: 'Username changed successfully',
            data: { username },
          });
        } catch (error: any) {
          if (error.message === 'Invalid current password') {
            return NextResponse.json(
              { success: false, error: 'Current password is incorrect' },
              { status: 400 }
            );
          }

          if (error.message === 'Username already taken') {
            return NextResponse.json(
              { success: false, error: 'Username is already taken' },
              { status: 409 }
            );
          }

          throw error; // Re-throw for general error handling
        }
      }

      if (action === 'change-password') {
        // Validate required fields
        if (!currentPassword || !newPassword || !confirmPassword) {
          return NextResponse.json(
            { success: false, error: 'All password fields are required' },
            { status: 400 }
          );
        }

        // Verify passwords match
        if (newPassword !== confirmPassword) {
          return NextResponse.json(
            { success: false, error: 'New passwords do not match' },
            { status: 400 }
          );
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
          return NextResponse.json(
            { success: false, error: passwordValidation.errors.join('. ') },
            { status: 400 }
          );
        }

        // Ensure new password is different from current
        if (currentPassword === newPassword) {
          return NextResponse.json(
            { success: false, error: 'New password must be different from current password' },
            { status: 400 }
          );
        }

        try {
          // Change password using AuthService
          await authService.changePassword(authResult.user.id, currentPassword, newPassword);

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
      }

      // Handle other account actions here in the future
      // e.g., email changes, 2FA setup, account deletion requests

      return NextResponse.json(
        { success: false, error: 'Invalid action specified' },
        { status: 400 }
      );
    } catch (error) {
      logger.error('Error updating account settings:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update account settings' },
        { status: 500 }
      );
    }
  },
  {
    enableCSRF: true,
  }
);
