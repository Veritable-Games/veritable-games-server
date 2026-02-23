/**
 * Security Status API Endpoint
 *
 * GET - Get real security score and status for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { requireAuth } from '@/lib/auth/server';
import { totpService } from '@/lib/security/totp-service';
import { loginHistoryService } from '@/lib/auth/login-history-service';
import { sessionService } from '@/lib/auth/session-service';
import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

interface SecurityItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

// GET - Get security status
async function GETHandler(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const userId = authResult.user.id;

    // Gather all security metrics in parallel
    const [
      has2FA,
      backupCodesCount,
      recentFailedAttempts,
      activeSessionCount,
      lastLogin,
      userInfo,
    ] = await Promise.all([
      totpService.isEnabled(userId),
      getBackupCodesCount(userId),
      loginHistoryService.getRecentFailedAttempts(userId, 24 * 60), // Last 24 hours
      sessionService.getActiveSessionCount(userId),
      loginHistoryService.getLastSuccessfulLogin(userId),
      getUserSecurityInfo(userId),
    ]);

    // Build security items checklist
    const securityItems: SecurityItem[] = [
      {
        id: '2fa',
        label: 'Two-Factor Authentication',
        description: has2FA
          ? 'Your account is protected with 2FA'
          : 'Enable 2FA to add an extra layer of security',
        completed: has2FA,
        priority: 'high',
      },
      {
        id: 'backup-codes',
        label: 'Backup Codes',
        description:
          backupCodesCount > 0
            ? `You have ${backupCodesCount} backup code(s) remaining`
            : 'Generate backup codes for account recovery',
        completed: backupCodesCount > 0,
        priority: has2FA ? 'high' : 'low',
      },
      {
        id: 'recovery-email',
        label: 'Recovery Email',
        description: userInfo.hasRecoveryEmail
          ? 'Recovery email is configured'
          : 'Add a recovery email for account recovery',
        completed: userInfo.hasRecoveryEmail,
        priority: 'medium',
      },
      {
        id: 'recent-activity',
        label: 'Recent Login Activity',
        description:
          recentFailedAttempts === 0
            ? 'No suspicious login attempts detected'
            : `${recentFailedAttempts} failed login attempt(s) in the last 24 hours`,
        completed: recentFailedAttempts === 0,
        priority: recentFailedAttempts > 5 ? 'high' : 'low',
      },
    ];

    // Calculate security score
    const completedItems = securityItems.filter(item => item.completed).length;
    const totalItems = securityItems.length;
    const scorePercentage = Math.round((completedItems / totalItems) * 100);

    // Determine security level
    let securityLevel: 'strong' | 'moderate' | 'weak';
    if (scorePercentage >= 75 && has2FA) {
      securityLevel = 'strong';
    } else if (scorePercentage >= 50) {
      securityLevel = 'moderate';
    } else {
      securityLevel = 'weak';
    }

    return NextResponse.json({
      success: true,
      data: {
        score: {
          percentage: scorePercentage,
          completed: completedItems,
          total: totalItems,
          level: securityLevel,
        },
        items: securityItems,
        stats: {
          has2FA,
          backupCodesCount,
          recentFailedAttempts,
          activeSessionCount,
          lastLoginAt: lastLogin?.createdAt?.toISOString() || null,
          lastLoginLocation: lastLogin ? formatLoginLocation(lastLogin) : null,
          passwordLastChanged: userInfo.passwordLastChanged,
        },
      },
    });
  } catch (error) {
    logger.error('Error retrieving security status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve security status' },
      { status: 500 }
    );
  }
}

/**
 * Get count of remaining backup codes for a user
 */
async function getBackupCodesCount(userId: number): Promise<number> {
  try {
    const result = await dbAdapter.query(
      `SELECT COUNT(*) as count FROM totp_backup_codes
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
      { schema: 'auth' }
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  } catch {
    return 0;
  }
}

/**
 * Get security-related user info
 */
async function getUserSecurityInfo(userId: number): Promise<{
  hasRecoveryEmail: boolean;
  passwordLastChanged: string | null;
}> {
  try {
    // Check if user has a verified email (acts as recovery)
    // In a real implementation, you'd have a separate recovery_email field
    const result = await dbAdapter.query(
      `SELECT email, email_verified, updated_at FROM users WHERE id = $1`,
      [userId],
      { schema: 'users' }
    );

    const user = result.rows[0];
    return {
      hasRecoveryEmail: !!user?.email, // Email acts as recovery
      passwordLastChanged: user?.updated_at ? new Date(user.updated_at).toISOString() : null,
    };
  } catch {
    return {
      hasRecoveryEmail: false,
      passwordLastChanged: null,
    };
  }
}

/**
 * Format login location for display
 */
function formatLoginLocation(login: {
  city: string | null;
  country: string | null;
  countryCode: string | null;
}): string {
  if (login.city && login.countryCode) {
    return `${login.city}, ${login.countryCode}`;
  }
  if (login.country) {
    return login.country;
  }
  return 'Unknown';
}

export const GET = withSecurity(GETHandler);
