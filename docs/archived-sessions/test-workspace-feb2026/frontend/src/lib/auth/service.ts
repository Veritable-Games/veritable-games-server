/**
 * Authentication Service - PostgreSQL Only
 *
 * Complete rewrite for PostgreSQL async operations
 * Replaces SQLite synchronous operations
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { dbAdapter } from '../database/adapter';
import { User } from './types';
import {
  safePasswordVerify,
  normalizeAuthError,
  isValidSessionFormat,
  artificialDelay,
  getDummyHash,
} from './timing-safe';
import { DeviceInfo } from '../security/device-detection';
import { GeoLocation } from '../security/geolocation';
import { sessionService } from './session-service';
import { loginHistoryService, LoginFailureReason } from './login-history-service';
import { logger } from '@/lib/utils/logger';

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  display_name: string;
}

export interface UpdateProfileData {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  avatar_position_x?: number;
  avatar_position_y?: number;
  avatar_scale?: number;
  location?: string;
  website_url?: string;
  github_url?: string;
  linkedin_url?: string;
  discord_username?: string;
  steam_url?: string;
  xbox_gamertag?: string;
  psn_id?: string;
  bluesky_url?: string;
  mastodon_url?: string;
}

export class AuthService {
  // User registration
  async register(data: RegisterData): Promise<{ user: User; sessionId: string }> {
    const { username, email, password, display_name } = data;

    // Validate input
    if (!username || !email || !password || !display_name) {
      throw new Error('All fields are required');
    }

    // Check if user already exists
    const existingUser = await dbAdapter.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email],
      { schema: 'users' }
    );

    if (existingUser.rows.length > 0) {
      // Use generic error to prevent username enumeration
      throw new Error('Registration failed');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Use transaction for atomic user creation + session
    const result = await dbAdapter.transaction(
      async () => {
        // Create user
        const userResult = await dbAdapter.query(
          `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
          [username, email, password_hash, display_name],
          { schema: 'users', returnLastId: true }
        );

        const userId = userResult.rows[0].id;

        // Create session
        const sessionId = await this.createSession(userId);

        // Log activity
        await this.logActivity(userId, 'user_auth', 'user', userId.toString(), 'register', {
          username,
          email,
        });

        return { userId, sessionId };
      },
      { schema: 'users' }
    );

    // Get the created user
    const user = await this.getUserById(result.userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return { user, sessionId: result.sessionId };
  }

  // User login (overloaded for both object and string parameters)
  async login(username: string, password: string): Promise<User | null>;
  async login(data: LoginData): Promise<{ user: User; sessionId: string }>;
  async login(
    usernameOrData: string | LoginData,
    password?: string
  ): Promise<User | null | { user: User; sessionId: string }> {
    let username: string;
    let pass: string;

    // Handle overloaded parameters
    if (typeof usernameOrData === 'string' && password) {
      username = usernameOrData;
      pass = password;

      // Simple authentication for testing - returns just user or null
      if (!username || !pass) {
        return null;
      }

      // Find user by username or email
      const userResult = await dbAdapter.query(
        `SELECT * FROM users
         WHERE (username = $1 OR email = $2) AND is_active = true`,
        [username, username],
        { schema: 'users' }
      );

      const userRow = userResult.rows[0];

      // Use timing-safe password verification
      const passwordHash = userRow?.password_hash || null;
      const isValid = await safePasswordVerify(pass, passwordHash);

      if (!isValid || !userRow) {
        return null;
      }

      // Return user (without password hash)
      const { password_hash, ...user } = userRow;
      return user as User;
    } else {
      // Original object-based login
      const data = usernameOrData as LoginData;
      username = data.username;
      pass = data.password;

      if (!username || !pass) {
        throw new Error('Username and password are required');
      }
    }

    // Find user by username or email
    const userResult = await dbAdapter.query(
      `SELECT * FROM users
       WHERE (username = $1 OR email = $2) AND is_active = true`,
      [username, username],
      { schema: 'users' }
    );

    const userRow = userResult.rows[0];

    // Use timing-safe password verification
    const passwordHash = userRow?.password_hash || null;
    const isValid = await safePasswordVerify(pass, passwordHash);

    if (!isValid || !userRow) {
      // Always use the same error message to prevent user enumeration
      throw normalizeAuthError(new Error('Authentication failed'));
    }

    // Update last active and create session in transaction
    const sessionId = await dbAdapter.transaction(
      async () => {
        // Update last active
        await dbAdapter.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userRow.id], {
          schema: 'users',
        });

        // Create session
        return await this.createSession(userRow.id);
      },
      { schema: 'users' }
    );

    // Return user (without password hash)
    const { password_hash, ...user } = userRow;
    return { user: user as User, sessionId };
  }

  /**
   * Login with device tracking and login history logging
   *
   * This is the preferred method for production login that tracks:
   * - Device information (browser, OS, device type)
   * - IP address and geolocation
   * - Login success/failure for security monitoring
   */
  async loginWithTracking(
    data: LoginData,
    deviceInfo: DeviceInfo,
    location: GeoLocation | null
  ): Promise<{ user: User; sessionId: string }> {
    const { username, password } = data;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    // Find user by username or email
    const userResult = await dbAdapter.query(
      `SELECT * FROM users
       WHERE (username = $1 OR email = $2) AND is_active = true`,
      [username, username],
      { schema: 'users' }
    );

    const userRow = userResult.rows[0];

    // Use timing-safe password verification
    const passwordHash = userRow?.password_hash || null;
    const isValid = await safePasswordVerify(password, passwordHash);

    // Determine failure reason if login failed
    let failureReason: LoginFailureReason | undefined;
    if (!userRow) {
      failureReason = 'user_not_found';
    } else if (!isValid) {
      failureReason = 'invalid_password';
    } else if (!userRow.is_active) {
      failureReason = 'account_inactive';
    }

    if (!isValid || !userRow) {
      // Log failed login attempt
      if (userRow) {
        await loginHistoryService.logLoginAttempt(
          userRow.id,
          null,
          deviceInfo,
          location,
          false,
          failureReason
        );
      }
      // Always use the same error message to prevent user enumeration
      throw normalizeAuthError(new Error('Authentication failed'));
    }

    // Create session with device info
    const sessionId = await dbAdapter.transaction(
      async () => {
        // Update last active
        await dbAdapter.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userRow.id], {
          schema: 'users',
        });

        // Create session with device info
        return await sessionService.createSessionWithDeviceInfo(userRow.id, deviceInfo, location);
      },
      { schema: 'users' }
    );

    // Get session ID for logging (need to fetch it from database)
    const session = await sessionService.getSessionByToken(sessionId);

    // Log successful login attempt
    await loginHistoryService.logLoginAttempt(
      userRow.id,
      session?.id ?? null,
      deviceInfo,
      location,
      true
    );

    // Return user (without password hash)
    const { password_hash: _, ...user } = userRow;
    return { user: user as User, sessionId };
  }

  // Create user session
  async createSession(userId: number): Promise<string> {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await dbAdapter.query(
      `INSERT INTO sessions (token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [sessionId, userId, expiresAt.toISOString()],
      { schema: 'auth' }
    );

    return sessionId;
  }

  // Regenerate session ID (for security on auth state changes)
  async regenerateSession(oldSessionId: string): Promise<string | null> {
    if (!oldSessionId) return null;

    // Get the current session
    const sessionResult = await dbAdapter.query(
      `SELECT user_id, expires_at FROM sessions
       WHERE token = $1 AND expires_at > NOW()`,
      [oldSessionId],
      { schema: 'auth' }
    );

    const session = sessionResult.rows[0];
    if (!session) return null;

    // Create new session and delete old one in transaction
    const newSessionId = randomBytes(32).toString('hex');

    await dbAdapter.transaction(
      async () => {
        // Insert new session
        await dbAdapter.query(
          `INSERT INTO sessions (token, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, NOW())`,
          [newSessionId, session.user_id, session.expires_at],
          { schema: 'auth' }
        );

        // Delete old session
        await dbAdapter.query('DELETE FROM sessions WHERE token = $1', [oldSessionId], {
          schema: 'auth',
        });
      },
      { schema: 'auth' }
    );

    // Log session regeneration for security audit
    await this.logActivity(session.user_id, 'user_auth', 'session', newSessionId, 'regenerate', {
      old_session: oldSessionId.substring(0, 8),
    });

    return newSessionId;
  }

  // Validate session and return user
  async validateSession(sessionId: string): Promise<User | null> {
    if (!sessionId) return null;

    // Validate session format to prevent timing attacks
    if (!isValidSessionFormat(sessionId)) {
      // Add small delay to match database query timing
      await artificialDelay(5);
      return null;
    }

    // Get session with user data
    // Note: Using explicit schema qualification (auth.sessions, users.users)
    // so NO schema option needed - prevents double-prefixing
    const result = await dbAdapter.query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.display_name,
        u.avatar_url,
        u.bio,
        u.location,
        u.role,
        u.reputation,
        u.post_count,
        u.created_at,
        u.last_active,
        u.is_active,
        u.website_url,
        u.github_url,
        u.mastodon_url,
        u.linkedin_url,
        u.discord_username,
        u.steam_url,
        u.xbox_gamertag,
        u.psn_id,
        u.bluesky_url,
        u.avatar_position_x,
        u.avatar_position_y,
        u.avatar_scale,
        s.expires_at
      FROM auth.sessions s
      JOIN users.users u ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
      [sessionId]
    );

    const session = result.rows[0];
    if (!session) return null;

    // Update last_active with throttling (only if older than 5 minutes)
    // This reduces database writes while still accurately tracking online status
    const ACTIVITY_UPDATE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms
    const lastActiveTime = session.last_active ? new Date(session.last_active).getTime() : 0;
    const timeSinceLastUpdate = Date.now() - lastActiveTime;

    if (timeSinceLastUpdate > ACTIVITY_UPDATE_THRESHOLD) {
      await dbAdapter.query('UPDATE users SET last_active = NOW() WHERE id = $1', [session.id], {
        schema: 'users',
      });
    }

    // Return user data (excluding session info)
    const { expires_at, ...user } = session;
    return user as User;
  }

  // Logout (delete session and update last_active)
  async logout(sessionId: string): Promise<void> {
    if (!sessionId) return;

    // Get the user_id from the session before deleting
    const sessionResult = await dbAdapter.query(
      'SELECT user_id FROM sessions WHERE token = $1',
      [sessionId],
      { schema: 'auth' }
    );

    const userId = sessionResult.rows[0]?.user_id;

    // Update user's last_active timestamp before logout
    // This allows us to know when the user explicitly logged out
    if (userId) {
      await dbAdapter.query('UPDATE users SET last_active = NOW() WHERE id = $1', [userId], {
        schema: 'users',
      });
    }

    // Delete the session
    await dbAdapter.query('DELETE FROM sessions WHERE token = $1', [sessionId], { schema: 'auth' });
  }

  // Get user by ID
  async getUserById(id: number): Promise<User | null> {
    const result = await dbAdapter.query(
      `SELECT id, username, email, display_name, avatar_url, bio, role,
              reputation, post_count, created_at, last_active, is_active,
              avatar_position_x, avatar_position_y, avatar_scale
       FROM users
       WHERE id = $1 AND is_active = true`,
      [id],
      { schema: 'users' }
    );

    return result.rows[0] || null;
  }

  // Get user by username
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await dbAdapter.query(
      `SELECT id, username, email, display_name, avatar_url, bio, role,
              reputation, post_count, created_at, last_active, is_active,
              avatar_position_x, avatar_position_y, avatar_scale
       FROM users
       WHERE username = $1 AND is_active = true`,
      [username],
      { schema: 'users' }
    );

    return result.rows[0] || null;
  }

  // Update user profile
  async updateProfile(userId: number, data: UpdateProfileData): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic UPDATE query
    const addUpdate = (field: string, value: any) => {
      updates.push(`${field} = $${paramIndex++}`);
      values.push(value);
    };

    if (data.display_name !== undefined) addUpdate('display_name', data.display_name);
    if (data.bio !== undefined) addUpdate('bio', data.bio);
    if (data.avatar_url !== undefined) addUpdate('avatar_url', data.avatar_url);
    if (data.avatar_position_x !== undefined)
      addUpdate('avatar_position_x', data.avatar_position_x);
    if (data.avatar_position_y !== undefined)
      addUpdate('avatar_position_y', data.avatar_position_y);
    if (data.avatar_scale !== undefined) addUpdate('avatar_scale', data.avatar_scale);
    if (data.location !== undefined) addUpdate('location', data.location);
    if (data.website_url !== undefined) addUpdate('website_url', data.website_url);
    if (data.github_url !== undefined) addUpdate('github_url', data.github_url);
    if (data.linkedin_url !== undefined) addUpdate('linkedin_url', data.linkedin_url);
    if (data.discord_username !== undefined) addUpdate('discord_username', data.discord_username);
    if (data.steam_url !== undefined) addUpdate('steam_url', data.steam_url);
    if (data.xbox_gamertag !== undefined) addUpdate('xbox_gamertag', data.xbox_gamertag);
    if (data.psn_id !== undefined) addUpdate('psn_id', data.psn_id);
    if (data.bluesky_url !== undefined) addUpdate('bluesky_url', data.bluesky_url);
    if (data.mastodon_url !== undefined) addUpdate('mastodon_url', data.mastodon_url);

    if (updates.length === 0) {
      return await this.getUserById(userId);
    }

    values.push(userId); // Add userId as last parameter

    await dbAdapter.transaction(
      async () => {
        await dbAdapter.query(
          `UPDATE users SET ${updates.join(', ')}, last_active = NOW()
         WHERE id = $${paramIndex}`,
          values,
          { schema: 'users' }
        );

        // Log activity
        await this.logActivity(userId, 'user_profile', 'user', userId.toString(), 'update', {
          updated_fields: Object.keys(data),
        });
      },
      { schema: 'users' }
    );

    return await this.getUserById(userId);
  }

  // Change username
  async changeUsername(userId: number, newUsername: string, password: string): Promise<void> {
    if (!newUsername || !password) {
      throw new Error('Username and current password are required');
    }

    // Get current password hash
    const userResult = await dbAdapter.query(
      'SELECT password_hash, username FROM users WHERE id = $1',
      [userId],
      { schema: 'users' }
    );

    const userRow = userResult.rows[0];

    // Use timing-safe password verification
    const passwordHash = userRow?.password_hash || null;
    const isValid = await safePasswordVerify(password, passwordHash);

    if (!isValid || !userRow) {
      throw new Error('Invalid current password');
    }

    // Check if new username is already taken
    const existingUser = await dbAdapter.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [newUsername, userId],
      { schema: 'users' }
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username already taken');
    }

    await dbAdapter.transaction(
      async () => {
        // Update username
        await dbAdapter.query(
          'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
          [newUsername, userId],
          { schema: 'users' }
        );

        // Log activity
        await this.logActivity(userId, 'user_auth', 'user', userId.toString(), 'username_change', {
          old_username: userRow.username,
          new_username: newUsername,
        });
      },
      { schema: 'users' }
    );
  }

  // Change password
  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    if (!oldPassword || !newPassword) {
      throw new Error('Old and new passwords are required');
    }

    // Get current password hash
    const userResult = await dbAdapter.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId],
      { schema: 'users' }
    );

    const userRow = userResult.rows[0];

    // Use timing-safe password verification
    const passwordHash = userRow?.password_hash || null;
    const isValid = await safePasswordVerify(oldPassword, passwordHash);

    if (!isValid || !userRow) {
      // Generic error to prevent information leakage
      throw normalizeAuthError(new Error('Password change failed'));
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await dbAdapter.transaction(
      async () => {
        // Update password
        await dbAdapter.query(
          'UPDATE users SET password_hash = $1, last_active = NOW() WHERE id = $2',
          [newPasswordHash, userId],
          { schema: 'users' }
        );

        // Log activity
        await this.logActivity(userId, 'user_auth', 'user', userId.toString(), 'password_change');
      },
      { schema: 'users' }
    );
  }

  // Change email
  async changeEmail(userId: number, password: string, newEmail: string): Promise<void> {
    if (!password || !newEmail) {
      throw new Error('Password and new email are required');
    }

    // Get current password hash
    const userResult = await dbAdapter.query(
      'SELECT password_hash, email FROM users WHERE id = $1',
      [userId],
      { schema: 'users' }
    );

    const userRow = userResult.rows[0];

    // Use timing-safe password verification
    const passwordHash = userRow?.password_hash || null;
    const isValid = await safePasswordVerify(password, passwordHash);

    if (!isValid || !userRow) {
      // Generic error to prevent information leakage
      throw normalizeAuthError(new Error('Invalid current password'));
    }

    // Check if new email is already taken
    const emailExists = await dbAdapter.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [newEmail, userId],
      { schema: 'users' }
    );

    if (emailExists.rows.length > 0) {
      throw new Error('This email address is already in use');
    }

    await dbAdapter.transaction(
      async () => {
        // Update email
        await dbAdapter.query(
          'UPDATE users SET email = $1, last_active = NOW() WHERE id = $2',
          [newEmail, userId],
          { schema: 'users' }
        );

        // Log activity
        await this.logActivity(userId, 'user_auth', 'user', userId.toString(), 'email_change', {
          old_email: userRow.email,
          new_email: newEmail,
        });
      },
      { schema: 'users' }
    );
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    const result = await dbAdapter.query('DELETE FROM sessions WHERE expires_at < NOW()', [], {
      schema: 'auth',
    });

    logger.info(`Cleaned up ${result.rowCount} expired sessions`);
  }

  // Get user permissions for a category or system
  async getUserPermissions(userId: number, categoryId?: number): Promise<string[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];

    // Admin has all permissions
    if (user.role === 'admin') {
      return [
        'wiki:read',
        'wiki:create',
        'wiki:edit',
        'wiki:delete',
        'wiki:moderate',
        'forum:read',
        'forum:create',
        'forum:reply',
        'forum:moderate',
        'user:profile',
      ];
    }

    // Moderator has most permissions
    if (user.role === 'moderator') {
      return [
        'wiki:read',
        'wiki:create',
        'wiki:edit',
        'wiki:moderate',
        'forum:read',
        'forum:create',
        'forum:reply',
        'forum:moderate',
        'user:profile',
      ];
    }

    // Regular user permissions
    const permissions = [
      'wiki:read',
      'wiki:create',
      'wiki:edit',
      'forum:read',
      'forum:create',
      'forum:reply',
      'user:profile',
    ];

    // Check for specific permissions
    if (categoryId) {
      const permsResult = await dbAdapter.query(
        `SELECT permission_type FROM user_permissions
         WHERE user_id = $1 AND entity_type = 'category' AND entity_id = $2`,
        [userId, categoryId.toString()],
        { schema: 'auth' }
      );

      permissions.push(...permsResult.rows.map(p => p.permission_type));
    }

    return Array.from(new Set(permissions));
  }

  // Check if user has specific permission
  async hasPermission(userId: number, permission: string, categoryId?: number): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, categoryId);
    return permissions.includes(permission);
  }

  // Grant permission to user
  async grantPermission(
    userId: number,
    permission: string,
    entityType?: string,
    entityId?: string,
    grantedBy?: number
  ): Promise<void> {
    await dbAdapter.transaction(
      async () => {
        await dbAdapter.query(
          `INSERT INTO user_permissions (user_id, permission_type, entity_type, entity_id, granted_by)
         VALUES ($1, $2, $3, $4, $5)`,
          [userId, permission, entityType || null, entityId || null, grantedBy || null],
          { schema: 'auth' }
        );

        // Log activity
        if (grantedBy) {
          await this.logActivity(
            grantedBy,
            'user_admin',
            'permission',
            `${userId}:${permission}`,
            'grant',
            {
              target_user: userId,
              permission,
              entity_type: entityType,
              entity_id: entityId,
            }
          );
        }
      },
      { schema: 'auth' }
    );
  }

  // Revoke permission from user
  async revokePermission(
    userId: number,
    permission: string,
    entityType?: string,
    entityId?: string,
    revokedBy?: number
  ): Promise<void> {
    await dbAdapter.transaction(
      async () => {
        let query = 'DELETE FROM user_permissions WHERE user_id = $1 AND permission_type = $2';
        const params: any[] = [userId, permission];
        let paramIndex = 3;

        if (entityType) {
          query += ` AND entity_type = $${paramIndex++}`;
          params.push(entityType);
        }

        if (entityId) {
          query += ` AND entity_id = $${paramIndex++}`;
          params.push(entityId);
        }

        await dbAdapter.query(query, params, { schema: 'auth' });

        // Log activity
        if (revokedBy) {
          await this.logActivity(
            revokedBy,
            'user_admin',
            'permission',
            `${userId}:${permission}`,
            'revoke',
            {
              target_user: userId,
              permission,
              entity_type: entityType,
              entity_id: entityId,
            }
          );
        }
      },
      { schema: 'auth' }
    );
  }

  // Get user activity across all systems
  async getUserActivity(userId: number, limit: number = 20, offset: number = 0): Promise<any[]> {
    const result = await dbAdapter.query(
      `SELECT * FROM unified_activity
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
      { schema: 'auth' }
    );

    return result.rows.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
    }));
  }

  // Log activity for unified tracking
  private async logActivity(
    userId: number,
    activityType: string,
    entityType: string,
    entityId: string,
    action: string,
    metadata?: any
  ): Promise<void> {
    try {
      await dbAdapter.query(
        `INSERT INTO unified_activity (user_id, activity_type, entity_type, entity_id, action, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          activityType,
          entityType,
          entityId,
          action,
          metadata ? JSON.stringify(metadata) : null,
        ],
        { schema: 'auth' }
      );
    } catch (error) {
      // Log but don't fail the operation if activity logging fails
      logger.error('Failed to log activity:', error);
    }
  }

  // Get user statistics
  async getUserStats(userId: number): Promise<{
    forum_posts: number;
    wiki_edits: number;
    total_activity: number;
    joined_days_ago: number;
  }> {
    const statsResult = await dbAdapter.query(
      `SELECT
        COUNT(CASE WHEN activity_type = 'forum_post' THEN 1 END) as forum_posts,
        COUNT(CASE WHEN activity_type = 'wiki_edit' THEN 1 END) as wiki_edits,
        COUNT(*) as total_activity
       FROM unified_activity
       WHERE user_id = $1`,
      [userId],
      { schema: 'auth' }
    );

    const stats = statsResult.rows[0];

    const user = await this.getUserById(userId);
    const joinedDate = user ? new Date(user.created_at) : new Date();
    const now = new Date();
    const joinedDaysAgo = Math.floor(
      (now.getTime() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      forum_posts: stats.forum_posts || 0,
      wiki_edits: stats.wiki_edits || 0,
      total_activity: stats.total_activity || 0,
      joined_days_ago: joinedDaysAgo,
    };
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  /**
   * Verify a password against a hash (timing-safe)
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await safePasswordVerify(password, hash, false);
  }
}

// Singleton instance
export const authService = new AuthService();
