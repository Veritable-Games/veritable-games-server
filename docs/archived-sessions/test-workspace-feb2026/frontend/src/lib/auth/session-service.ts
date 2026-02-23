/**
 * Session Service
 *
 * Manages user sessions with device tracking and location information.
 * Provides CRUD operations for sessions and supports terminating sessions.
 */

import { randomBytes } from 'crypto';
import { dbAdapter } from '../database/adapter';
import { DeviceInfo, formatDeviceInfo } from '../security/device-detection';
import { GeoLocation, formatLocation } from '../security/geolocation';

export interface SessionData {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;

  // Device info
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;

  // Location
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

export interface SessionDisplay {
  id: number;
  isCurrent: boolean;
  deviceInfo: string;
  location: string;
  ipAddress: string;
  browser: string;
  device: string;
  os: string;
  lastActivity: string;
  createdAt: string;
}

class SessionService {
  /**
   * Create a new session with device and location information
   */
  async createSessionWithDeviceInfo(
    userId: number,
    deviceInfo: DeviceInfo,
    location: GeoLocation | null
  ): Promise<string> {
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await dbAdapter.query(
      `INSERT INTO sessions (
        token, user_id, expires_at, created_at, last_activity, is_active,
        ip_address, user_agent, browser, device, os,
        city, region, country, country_code
      ) VALUES (
        $1, $2, $3, NOW(), NOW(), true,
        $4::inet, $5, $6, $7, $8,
        $9, $10, $11, $12
      )`,
      [
        sessionToken,
        userId,
        expiresAt.toISOString(),
        deviceInfo.ip || null,
        deviceInfo.userAgent || null,
        deviceInfo.browser || null,
        deviceInfo.device || null,
        deviceInfo.os || null,
        location?.city || null,
        location?.region || null,
        location?.country || null,
        location?.countryCode || null,
      ],
      { schema: 'auth' }
    );

    return sessionToken;
  }

  /**
   * Get all active sessions for a user
   */
  async getSessions(userId: number): Promise<SessionData[]> {
    const result = await dbAdapter.query(
      `SELECT
        id, token, user_id, expires_at, created_at, last_activity, is_active,
        ip_address, user_agent, browser, device, os,
        city, region, country, country_code
      FROM sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY last_activity DESC`,
      [userId],
      { schema: 'auth' }
    );

    return result.rows.map(row => ({
      id: row.id,
      token: row.token,
      userId: row.user_id,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity || row.created_at),
      isActive: row.is_active,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      browser: row.browser,
      device: row.device,
      os: row.os,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.country_code,
    }));
  }

  /**
   * Get sessions formatted for display in the UI
   */
  async getSessionsForDisplay(
    userId: number,
    currentSessionToken: string
  ): Promise<SessionDisplay[]> {
    const sessions = await this.getSessions(userId);

    return sessions.map(session => ({
      id: session.id,
      isCurrent: session.token === currentSessionToken,
      deviceInfo: formatDeviceInfo({
        browser: session.browser || undefined,
        os: session.os || undefined,
        device: (session.device as DeviceInfo['device'] | null) || undefined,
      }),
      location: formatLocation(
        session.city || session.country
          ? {
              city: session.city || '',
              region: session.region || '',
              country: session.country || '',
              countryCode: session.countryCode || '',
            }
          : null
      ),
      ipAddress: session.ipAddress || 'Unknown',
      browser: session.browser || 'Unknown',
      device: session.device || 'Unknown',
      os: session.os || 'Unknown',
      lastActivity: session.lastActivity.toISOString(),
      createdAt: session.createdAt.toISOString(),
    }));
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(userId: number, sessionId: number): Promise<boolean> {
    // First verify the session belongs to this user
    const result = await dbAdapter.query(
      `UPDATE sessions
       SET is_active = false
       WHERE id = $1 AND user_id = $2 AND is_active = true
       RETURNING id`,
      [sessionId, userId],
      { schema: 'auth' }
    );

    return result.rows.length > 0;
  }

  /**
   * Terminate all sessions except the current one
   */
  async terminateAllOtherSessions(userId: number, currentSessionToken: string): Promise<number> {
    const result = await dbAdapter.query(
      `UPDATE sessions
       SET is_active = false
       WHERE user_id = $1 AND token != $2 AND is_active = true
       RETURNING id`,
      [userId, currentSessionToken],
      { schema: 'auth' }
    );

    return result.rows.length;
  }

  /**
   * Update last activity timestamp for a session
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    await dbAdapter.query(
      `UPDATE sessions
       SET last_activity = NOW()
       WHERE token = $1 AND is_active = true`,
      [sessionToken],
      { schema: 'auth' }
    );
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<SessionData | null> {
    const result = await dbAdapter.query(
      `SELECT
        id, token, user_id, expires_at, created_at, last_activity, is_active,
        ip_address, user_agent, browser, device, os,
        city, region, country, country_code
      FROM sessions
      WHERE token = $1 AND is_active = true AND expires_at > NOW()`,
      [token],
      { schema: 'auth' }
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      token: row.token,
      userId: row.user_id,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastActivity: new Date(row.last_activity || row.created_at),
      isActive: row.is_active,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      browser: row.browser,
      device: row.device,
      os: row.os,
      city: row.city,
      region: row.region,
      country: row.country,
      countryCode: row.country_code,
    };
  }

  /**
   * Get count of active sessions for a user
   */
  async getActiveSessionCount(userId: number): Promise<number> {
    const result = await dbAdapter.query(
      `SELECT COUNT(*) as count
       FROM sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()`,
      [userId],
      { schema: 'auth' }
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Clean up inactive and expired sessions
   */
  async cleanupSessions(): Promise<number> {
    const result = await dbAdapter.query(
      `DELETE FROM sessions
       WHERE expires_at < NOW() OR is_active = false
       RETURNING id`,
      [],
      { schema: 'auth' }
    );

    return result.rows.length;
  }
}

// Singleton instance
export const sessionService = new SessionService();
