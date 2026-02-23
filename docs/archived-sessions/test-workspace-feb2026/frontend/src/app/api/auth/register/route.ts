import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/service';
import { createAuthResponse } from '@/lib/auth/server';
import { validateUsername, validateEmail, validatePassword } from '@/lib/auth/utils';
import { RegisterData } from '@/lib/auth/service';
import { withSecurity, rateLimiters, getClientIP } from '@/lib/security/middleware';
import { settingsService } from '@/lib/settings/service';
import { invitationService } from '@/lib/invitations/service';
import { emailService } from '@/lib/email/service';
import { logger } from '@/lib/utils/logger';
import { dbAdapter } from '@/lib/database/adapter';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function registerHandler(request: NextRequest) {
  try {
    // Check if registration is enabled
    const registrationEnabled = await settingsService.getSetting('registrationEnabled');
    if (!registrationEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Registration is currently disabled',
        },
        { status: 403 }
      );
    }

    const data: RegisterData & { invitation_token?: string } = await request.json();

    const { username, email, password, display_name, invitation_token } = data;

    // Validate required fields
    if (!username || !email || !password || !display_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fields are required',
        },
        { status: 400 }
      );
    }

    // Require invitation token for registration
    if (!invitation_token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invitation token is required for registration',
        },
        { status: 400 }
      );
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid username',
          details: usernameValidation.errors,
        },
        { status: 400 }
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email',
          details: emailValidation.errors,
        },
        { status: 400 }
      );
    }

    // Check if email is banned
    const bannedEmailCheck = await dbAdapter.query(
      'SELECT email FROM users.banned_emails WHERE email = $1',
      [email.trim().toLowerCase()],
      { schema: 'users' }
    );

    if (bannedEmailCheck.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email address is not eligible for registration',
        },
        { status: 403 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid password',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // Validate display name length
    if (display_name.trim().length < 2 || display_name.trim().length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Display name must be between 2 and 50 characters',
        },
        { status: 400 }
      );
    }

    // Validate invitation token
    const invitationValidation = await invitationService.validateToken(
      invitation_token,
      email.trim().toLowerCase()
    );

    if (!invitationValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: invitationValidation.error || 'Invalid invitation token',
        },
        { status: 400 }
      );
    }

    // Attempt registration
    const { user, sessionId } = await authService.register({
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      display_name: display_name.trim(),
    });

    // Mark invitation as used
    await invitationService.markAsUsed(invitation_token, user.id);

    // Send verification email (non-blocking - don't wait for it)
    emailService.sendVerificationEmail(user.id, user.email, user.username).catch(error => {
      logger.error('Failed to send verification email:', error);
    });

    // Send admin notification (non-blocking - don't wait for it)
    emailService
      .sendAdminNotification({
        username: user.username,
        email: user.email,
        id: user.id,
      })
      .catch(error => {
        logger.error('Failed to send admin notification:', error);
      });

    // Return user data with session cookie
    return await createAuthResponse(
      {
        success: true,
        data: { user },
        message: 'Registration successful',
      },
      sessionId
    );
  } catch (error: any) {
    logger.error('Registration error:', error);
    logger.error('Registration error stack:', error?.stack);
    logger.error('Registration error message:', error?.message);

    // TEMPORARY: Return detailed error for debugging registration issues
    // TODO: Remove after debugging is complete
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Registration failed. Please try again.',
        details: [error?.message, error?.code, error?.constraint].filter(Boolean),
      },
      { status: 400 }
    );
  }
}

export const POST = withSecurity(registerHandler, {
  rateLimiter: rateLimiters.auth,
  rateLimiterType: 'auth',
  rateLimitKey: req => `auth:register:${getClientIP(req)}`,
  // Whitelist development IP to avoid rate limiting during testing
  rateLimitWhitelist: ['192.168.1.15'],
});
