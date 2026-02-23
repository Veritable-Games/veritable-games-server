import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/service';
import { createAuthResponse } from '@/lib/auth/server';
import { LoginData } from '@/lib/auth/service';
import { withSecurity, rateLimiters } from '@/lib/security/middleware';
import { totpService } from '@/lib/security/totp-service';
import { extractDeviceInfo } from '@/lib/security/device-detection';
import { getLocationFromIP } from '@/lib/security/geolocation';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function loginHandler(request: NextRequest) {
  // Parse request body once (can't be re-read after consumption)
  let twoFactorToken: string | undefined;
  let twoFactorType: 'totp' | 'backup' | undefined;

  try {
    const data: LoginData = await request.json();
    const parsedData = data as LoginData & {
      twoFactorToken?: string;
      twoFactorType?: 'totp' | 'backup';
    };

    const { username, password } = parsedData;
    twoFactorToken = parsedData.twoFactorToken;
    twoFactorType = parsedData.twoFactorType;

    // Extract device info from request
    const deviceInfo = extractDeviceInfo(request);

    // Look up geolocation (non-blocking, will continue if it fails)
    const location = await getLocationFromIP(deviceInfo.ip);

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Username and password are required',
        },
        { status: 400 }
      );
    }

    // Attempt login with device tracking (validates password, logs attempt)
    const { user, sessionId } = await authService.loginWithTracking(
      { username, password },
      deviceInfo,
      location
    );

    // Check if user has 2FA enabled
    const has2FA = await totpService.isEnabled(user.id);

    if (has2FA) {
      // If 2FA token provided, verify it
      if (twoFactorToken) {
        let verifyResult;
        if (twoFactorType === 'backup') {
          verifyResult = await totpService.verifyBackupCode(user.id, twoFactorToken);
        } else {
          verifyResult = await totpService.verifyToken(user.id, twoFactorToken);
        }

        if (!verifyResult.success) {
          return NextResponse.json(
            {
              success: false,
              error: verifyResult.error || 'Invalid verification code',
              requires2FA: true,
              userId: user.id,
            },
            { status: 401 }
          );
        }

        // 2FA verified, continue with login
      } else {
        // No 2FA token provided, request it
        return NextResponse.json({
          success: false,
          requires2FA: true,
          userId: user.id,
          message: 'Two-factor authentication required',
        });
      }
    }

    // Return user data with session cookie
    return await createAuthResponse(
      {
        success: true,
        data: { user },
        message: 'Login successful',
      },
      sessionId
    );
  } catch (error: any) {
    // twoFactorToken is already in scope from the try block
    logger.error('[LOGIN DEBUG] Login error caught:', {
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorType: error?.constructor?.name,
      had2FAToken: !!twoFactorToken,
    });

    // If a 2FA token was provided, the password was already validated successfully
    // (user reached the 2FA screen), so return a 2FA-specific error
    if (twoFactorToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Two-factor authentication failed. Please try again or use a backup code.',
          requires2FA: true,
        },
        { status: 401 }
      );
    }

    // Return generic error for password validation failures (security best practice)
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid username or password',
      },
      { status: 401 }
    );
  }
}

export const POST = withSecurity(loginHandler, {
  rateLimiter: rateLimiters.auth,
  rateLimiterType: 'auth',
  rateLimitKey: req => {
    // Rate limit by IP address for login attempts
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
    return `auth:login:${ip}`;
  },
  // Whitelist development IP to avoid rate limiting during testing
  rateLimitWhitelist: ['192.168.1.15', '127.0.0.1', 'localhost', '::1'],
});
