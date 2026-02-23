/**
 * Login History Service
 *
 * Tracks all login attempts (successful and failed) with device
 * and location information for security monitoring.
 */

import { dbAdapter } from '../database/adapter';
import { DeviceInfo, formatDeviceInfo } from '../security/device-detection';
import { GeoLocation, formatLocation } from '../security/geolocation';
import { logger } from '@/lib/utils/logger';

export type LoginFailureReason =
  | 'invalid_password'
  | 'user_not_found'
  | '2fa_failed'
  | '2fa_required'
  | 'account_locked'
  | 'account_banned'
  | 'account_inactive'
  | 'rate_limited';

export interface LoginHistoryEntry {
  id: number;
  userId: number;
  sessionId: number | null;

  // Request metadata
  ipAddress: string | null;
  userAgent: string | null;

  // Device info
  browser: string | null;
  device: string | null;
  os: string | null;

  // Location
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;

  // Result
  loginSuccessful: boolean;
  failureReason: LoginFailureReason | null;

  // Timestamp
  createdAt: Date;
}

export interface LoginHistoryDisplay {
  id: number;
  successful: boolean;
  failureReason: string | null;
  deviceInfo: string;
  location: string;
  ipAddress: string;
  browser: string;
  device: string;
  os: string;
  timestamp: string;
}

class LoginHistoryService {
  /**
   * Log a login attempt (success or failure)
   */
  async logLoginAttempt(
    userId: number,
    sessionId: number | null,
    deviceInfo: DeviceInfo,
    location: GeoLocation | null,
    successful: boolean,
    failureReason?: LoginFailureReason
  ): Promise<void> {
    try {
      await dbAdapter.query(
        `INSERT INTO login_history (
          user_id, session_id, ip_address, user_agent,
          browser, device, os,
          city, region, country, country_code,
          login_successful, failure_reason, created_at
        ) VALUES (
          $1, $2, $3::inet, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, NOW()
        )`,
        [
          userId,
          sessionId,
          deviceInfo.ip || null,
          deviceInfo.userAgent || null,
          deviceInfo.browser || null,
          deviceInfo.device || null,
          deviceInfo.os || null,
          location?.city || null,
          location?.region || null,
          location?.country || null,
          location?.countryCode || null,
          successful,
          failureReason || null,
        ],
        { schema: 'auth' }
      );
    } catch (error) {
      // Don't fail the login flow if history logging fails
      logger.error('Failed to log login attempt:', error);
    }
  }

  /**
   * Get login history for a user (paginated)
   */
  async getLoginHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ entries: LoginHistoryEntry[]; total: number }> {
    // Get total count
    const countResult = await dbAdapter.query(
      `SELECT COUNT(*) as count FROM login_history WHERE user_id = $1`,
      [userId],
      { schema: 'auth' }
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // Get paginated entries
    const result = await dbAdapter.query(
      `SELECT
        id, user_id, session_id, ip_address, user_agent,
        browser, device, os,
        city, region, country, country_code,
        login_successful, failure_reason, created_at
      FROM login_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
      { schema: 'auth' }
    );

    const entries = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      browser: row.browser,
      device: row.device,
      os: row.os,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.country_code,
      loginSuccessful: row.login_successful,
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at),
    }));

    return { entries, total };
  }

  /**
   * Get login history formatted for display in the UI
   */
  async getLoginHistoryForDisplay(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ entries: LoginHistoryDisplay[]; total: number }> {
    const { entries, total } = await this.getLoginHistory(userId, limit, offset);

    const displayEntries = entries.map(entry => ({
      id: entry.id,
      successful: entry.loginSuccessful,
      failureReason: entry.failureReason ? formatFailureReason(entry.failureReason) : null,
      deviceInfo: formatDeviceInfo({
        browser: entry.browser || undefined,
        os: entry.os || undefined,
        device: (entry.device as DeviceInfo['device'] | null) || undefined,
      }),
      location: formatLocation(
        entry.city || entry.country
          ? {
              city: entry.city || '',
              region: entry.region || '',
              country: entry.country || '',
              countryCode: entry.countryCode || '',
            }
          : null
      ),
      ipAddress: entry.ipAddress || 'Unknown',
      browser: entry.browser || 'Unknown',
      device: entry.device || 'Unknown',
      os: entry.os || 'Unknown',
      timestamp: entry.createdAt.toISOString(),
    }));

    return { entries: displayEntries, total };
  }

  /**
   * Get count of recent failed login attempts
   */
  async getRecentFailedAttempts(userId: number, sinceMinutes: number = 60): Promise<number> {
    const result = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM login_history
       WHERE user_id = $1
         AND login_successful = false
         AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [userId, sinceMinutes],
      { schema: 'auth' }
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Get count of failed attempts from a specific IP
   */
  async getFailedAttemptsFromIP(ip: string, sinceMinutes: number = 60): Promise<number> {
    const result = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM login_history
       WHERE ip_address = $1::inet
         AND login_successful = false
         AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [ip, sinceMinutes],
      { schema: 'auth' }
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Get the last successful login for a user
   */
  async getLastSuccessfulLogin(userId: number): Promise<LoginHistoryEntry | null> {
    const result = await dbAdapter.query(
      `SELECT
        id, user_id, session_id, ip_address, user_agent,
        browser, device, os,
        city, region, country, country_code,
        login_successful, failure_reason, created_at
      FROM login_history
      WHERE user_id = $1 AND login_successful = true
      ORDER BY created_at DESC
      LIMIT 1`,
      [userId],
      { schema: 'auth' }
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      browser: row.browser,
      device: row.device,
      os: row.os,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.country_code,
      loginSuccessful: row.login_successful,
      failureReason: row.failure_reason,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * Check if this is a new device/location for the user
   * Returns true if the IP/browser combination hasn't been seen before
   */
  async isNewDeviceOrLocation(userId: number, deviceInfo: DeviceInfo): Promise<boolean> {
    const result = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM login_history
       WHERE user_id = $1
         AND ip_address = $2::inet
         AND browser = $3
         AND login_successful = true`,
      [userId, deviceInfo.ip, deviceInfo.browser],
      { schema: 'auth' }
    );

    return parseInt(result.rows[0]?.count || '0', 10) === 0;
  }

  /**
   * Clean up old login history entries (keep last N days)
   */
  async cleanupOldHistory(daysToKeep: number = 90): Promise<number> {
    const result = await dbAdapter.query(
      `DELETE FROM login_history
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep],
      { schema: 'auth' }
    );

    return result.rows.length;
  }
}

/**
 * Format failure reason for display
 */
function formatFailureReason(reason: LoginFailureReason): string {
  switch (reason) {
    case 'invalid_password':
      return 'Incorrect password';
    case 'user_not_found':
      return 'Account not found';
    case '2fa_failed':
      return '2FA verification failed';
    case '2fa_required':
      return '2FA required';
    case 'account_locked':
      return 'Account locked';
    case 'account_banned':
      return 'Account banned';
    case 'account_inactive':
      return 'Account inactive';
    case 'rate_limited':
      return 'Too many attempts';
    default:
      return 'Unknown error';
  }
}

// Singleton instance
export const loginHistoryService = new LoginHistoryService();
