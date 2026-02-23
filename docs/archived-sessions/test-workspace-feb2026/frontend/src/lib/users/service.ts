import bcrypt from 'bcryptjs';
import { dbAdapter } from '../database/adapter';
import { logger } from '@/lib/utils/logger';
import {
  User,
  UserProfile,
  UnifiedActivity,
  UpdateUserData,
  UserSearchOptions,
  UserSession,
  Permission,
  ActivitySummary,
  UserStats,
} from './types';

export class UserService {
  private readonly saltRounds = 12;

  constructor() {
    // No database instance needed - using dbAdapter
  }

  // User CRUD operations
  async getUserById(userId: number): Promise<User | null> {
    const result = await dbAdapter.query<User>(
      `SELECT id, username, email, display_name, bio, avatar_url, role, is_active,
             email_verified, last_login_at, created_at, updated_at, last_active,
             location, website_url, github_url, mastodon_url, linkedin_url, discord_username,
             steam_url, xbox_gamertag, psn_id, bluesky_url,
             avatar_position_x, avatar_position_y, avatar_scale,
             reputation, post_count, ban_type, ban_reason, banned_at, banned_by
      FROM users
      WHERE id = ?`,
      [userId],
      { schema: 'users' }
    );

    return result.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await dbAdapter.query<User>(
      `SELECT id, username, email, display_name, bio, avatar_url, role, is_active,
             email_verified, last_login_at, created_at, updated_at, last_active,
             location, website_url, github_url, mastodon_url, linkedin_url, discord_username,
             steam_url, xbox_gamertag, psn_id, bluesky_url,
             avatar_position_x, avatar_position_y, avatar_scale,
             reputation, post_count, ban_type, ban_reason, banned_at, banned_by
      FROM users
      WHERE username = ?`,
      [username],
      { schema: 'users' }
    );

    return result.rows[0] || null;
  }

  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const statsResult = await dbAdapter.query<any>(
      `SELECT
        COALESCE(forum_stats.topic_count, 0) as forum_topic_count,
        COALESCE(forum_stats.reply_count, 0) as forum_reply_count,
        COALESCE(wiki_stats.page_count, 0) as wiki_page_count,
        COALESCE(wiki_stats.edit_count, 0) as wiki_edit_count,
        COALESCE(activity_stats.total_count, 0) as total_activity_count
      FROM (SELECT 1) as dummy
      LEFT JOIN (
        SELECT
          COUNT(CASE WHEN activity_type = 'topic_created' THEN 1 END) as topic_count,
          COUNT(CASE WHEN activity_type = 'reply_created' THEN 1 END) as reply_count
        FROM unified_activity
        WHERE user_id = ? AND entity_type IN ('topic', 'reply')
      ) as forum_stats ON 1=1
      LEFT JOIN (
        SELECT
          COUNT(CASE WHEN activity_type = 'page_created' THEN 1 END) as page_count,
          COUNT(CASE WHEN activity_type IN ('page_created', 'page_updated') THEN 1 END) as edit_count
        FROM unified_activity
        WHERE user_id = ? AND entity_type = 'wiki_page'
      ) as wiki_stats ON 1=1
      LEFT JOIN (
        SELECT COUNT(*) as total_count
        FROM unified_activity
        WHERE user_id = ?
      ) as activity_stats ON 1=1`,
      [userId, userId, userId],
      { schema: 'users' }
    );

    const stats = statsResult.rows[0];

    // Get recent activity
    const recentActivity = await this.getUserActivity(userId, 10);

    return {
      ...user,
      forum_topic_count: stats.forum_topic_count || 0,
      forum_reply_count: stats.forum_reply_count || 0,
      forum_reputation: 0, // TODO: Implement reputation system
      wiki_page_count: stats.wiki_page_count || 0,
      wiki_edit_count: stats.wiki_edit_count || 0,
      total_activity_count: stats.total_activity_count || 0,
      recent_activity: recentActivity,
    };
  }

  async updateUser(userId: number, data: UpdateUserData, updatedBy: number): Promise<User> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.username !== undefined) {
      // Check if username is taken
      const existingResult = await dbAdapter.query(
        `SELECT id FROM users WHERE username = ? AND id != ?`,
        [data.username, userId],
        { schema: 'users' }
      );
      if (existingResult.rows.length > 0) {
        throw new Error('Username already taken');
      }

      updates.push('username = ?');
      params.push(data.username);
    }

    if (data.email !== undefined) {
      // Check if email is taken
      const existingResult = await dbAdapter.query(
        `SELECT id FROM users WHERE email = ? AND id != ?`,
        [data.email, userId],
        { schema: 'users' }
      );
      if (existingResult.rows.length > 0) {
        throw new Error('Email already taken');
      }

      updates.push('email = ?');
      params.push(data.email);
    }

    if (data.display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(data.display_name);
    }

    if (data.bio !== undefined) {
      updates.push('bio = ?');
      params.push(data.bio);
    }

    if (data.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(data.avatar_url);
    }

    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }

    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(data.is_active);
    }

    // Add missing social and profile fields
    if (data.location !== undefined) {
      updates.push('location = ?');
      params.push(data.location);
    }

    if (data.website_url !== undefined) {
      updates.push('website_url = ?');
      params.push(data.website_url);
    }

    if (data.github_url !== undefined) {
      updates.push('github_url = ?');
      params.push(data.github_url);
    }

    if (data.mastodon_url !== undefined) {
      updates.push('mastodon_url = ?');
      params.push(data.mastodon_url);
    }

    if (data.linkedin_url !== undefined) {
      updates.push('linkedin_url = ?');
      params.push(data.linkedin_url);
    }

    if (data.discord_username !== undefined) {
      updates.push('discord_username = ?');
      params.push(data.discord_username);
    }

    if (data.steam_url !== undefined) {
      updates.push('steam_url = ?');
      params.push(data.steam_url);
    }

    if (data.xbox_gamertag !== undefined) {
      updates.push('xbox_gamertag = ?');
      params.push(data.xbox_gamertag);
    }

    if (data.psn_id !== undefined) {
      updates.push('psn_id = ?');
      params.push(data.psn_id);
    }

    if (data.bluesky_url !== undefined) {
      updates.push('bluesky_url = ?');
      params.push(data.bluesky_url);
    }

    if (data.avatar_position_x !== undefined) {
      updates.push('avatar_position_x = ?');
      params.push(data.avatar_position_x);
    }

    if (data.avatar_position_y !== undefined) {
      updates.push('avatar_position_y = ?');
      params.push(data.avatar_position_y);
    }

    if (data.avatar_scale !== undefined) {
      updates.push('avatar_scale = ?');
      params.push(data.avatar_scale);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    // Update users table (no transaction - PostgreSQL transaction handling is broken)
    const updateResult = await dbAdapter.query(
      `UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?`,
      params,
      { schema: 'users' }
    );

    if (updateResult.rowCount === 0) {
      throw new Error('User not found');
    }

    // Log activity (best-effort, non-critical)
    try {
      await this.logActivity({
        user_id: updatedBy,
        activity_type: 'user_updated',
        entity_id: String(userId),
        entity_type: 'user',
        action: 'profile_updated',
        metadata: { updated_fields: Object.keys(data) },
      });
    } catch (logError) {
      logger.warn('Failed to log user update activity:', logError);
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to update user');
    }

    return user;
  }

  // Search and listing
  async searchUsers(options: UserSearchOptions = {}): Promise<User[]> {
    const { query, role, limit = 20, offset = 0, sort = 'recent', viewerRole } = options;

    // Determine which users to show based on viewer role
    // Production uses is_active (boolean), not status enum
    let statusFilter: string;
    if (viewerRole === 'admin' || viewerRole === 'moderator') {
      // Moderators and admins can see ALL users including banned ones
      statusFilter = '1=1';
    } else {
      // Regular users can only see active users
      statusFilter = 'is_active = true';
    }

    let sql = `
      SELECT id, username, email, display_name, bio, avatar_url, role, is_active,
             email_verified, last_login_at, created_at, updated_at, last_active,
             location, website_url, github_url, mastodon_url, linkedin_url, discord_username,
             steam_url, xbox_gamertag, psn_id, bluesky_url,
             avatar_position_x, avatar_position_y, avatar_scale,
             reputation, post_count, ban_type, ban_reason, banned_at, banned_by
      FROM users
      WHERE ${statusFilter}
    `;
    const params: any[] = [];

    if (query) {
      sql += ` AND (username LIKE ? OR display_name LIKE ? OR email LIKE ?)`;
      params.push(`%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (role) {
      sql += ` AND role = ?`;
      params.push(role);
    }

    // Add sorting
    switch (sort) {
      case 'recent':
        sql += ` ORDER BY created_at DESC`;
        break;
      case 'alphabetical':
        sql += ` ORDER BY username ASC`;
        break;
      case 'activity':
        sql += ` ORDER BY last_login_at DESC NULLS LAST`;
        break;
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await dbAdapter.query<User>(sql, params, { schema: 'users' });
    return result.rows;
  }

  // Activity tracking
  async getUserActivity(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<UnifiedActivity[]> {
    const result = await dbAdapter.query<any>(
      `SELECT * FROM unified_activity
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?`,
      [userId, limit, offset],
      { schema: 'users' }
    );

    return result.rows.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : undefined,
    }));
  }

  async getActivitySummary(userId: number, days: number = 30): Promise<ActivitySummary[]> {
    const result = await dbAdapter.query<ActivitySummary>(
      `SELECT
        DATE(timestamp) as date,
        COUNT(CASE WHEN entity_type IN ('topic', 'reply') THEN 1 END) as forum_activity,
        COUNT(CASE WHEN entity_type = 'wiki_page' THEN 1 END) as wiki_activity,
        COUNT(*) as total_activity
      FROM unified_activity
      WHERE user_id = ? AND created_at >= NOW() - (? || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [userId, days],
      { schema: 'users' }
    );

    return result.rows;
  }

  private async logActivity(activity: Omit<UnifiedActivity, 'id' | 'timestamp'>): Promise<void> {
    await dbAdapter.query(
      `INSERT INTO unified_activity (
        user_id, activity_type, entity_id, entity_type, action, metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        activity.user_id,
        activity.activity_type,
        String(activity.entity_id), // Defensive: ensure string type
        activity.entity_type,
        activity.action || 'updated',
        JSON.stringify(activity.metadata || {}),
      ],
      { schema: 'users' }
    );
  }

  // Permissions
  async grantPermission(
    userId: number,
    permission: string,
    grantedBy: number,
    resourceType?: string,
    resourceId?: number,
    expiresAt?: string
  ): Promise<Permission> {
    const result = await dbAdapter.query(
      `INSERT INTO user_permissions (
        user_id, permission, resource_type, resource_id, granted_by, granted_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      RETURNING *`,
      [userId, permission, resourceType || null, resourceId || null, grantedBy, expiresAt || null],
      { schema: 'users' }
    );

    return result.rows[0] as Permission;
  }

  async revokePermission(permissionId: number): Promise<void> {
    const result = await dbAdapter.query(
      `DELETE FROM user_permissions WHERE id = ?`,
      [permissionId],
      { schema: 'users' }
    );

    if (result.rowCount === 0) {
      throw new Error('Permission not found');
    }
  }

  async getUserPermissions(userId: number): Promise<Permission[]> {
    const result = await dbAdapter.query<Permission>(
      `SELECT * FROM user_permissions
      WHERE user_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [userId],
      { schema: 'users' }
    );

    return result.rows;
  }

  async hasPermission(
    userId: number,
    permission: string,
    resourceType?: string,
    resourceId?: number
  ): Promise<boolean> {
    let sql = `
      SELECT COUNT(*) as count FROM user_permissions
      WHERE user_id = ? AND permission = ?
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const params = [userId, permission];

    if (resourceType) {
      sql += ` AND resource_type = ?`;
      params.push(resourceType);
    }

    if (resourceId) {
      sql += ` AND resource_id = ?`;
      params.push(resourceId);
    }

    const result = await dbAdapter.query<{ count: number }>(sql, params, { schema: 'users' });

    return (result.rows[0]?.count ?? 0) > 0;
  }

  // Statistics
  async getUserStats(): Promise<UserStats> {
    const statsResult = await dbAdapter.query<any>(
      `SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '1 day' THEN 1 END) as active_users_today,
        COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as active_users_week,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as new_users_today
      FROM users
      WHERE is_active = true`,
      [],
      { schema: 'users' }
    );

    const stats = statsResult.rows[0];

    // Get top contributors (by total activity)
    const contributorsResult = await dbAdapter.query<any>(
      `SELECT
        u.id, u.username, u.display_name, u.avatar_url,
        COUNT(ua.id) as total_activity_count
      FROM users u
      LEFT JOIN unified_activity ua ON u.id = ua.user_id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY total_activity_count DESC
      LIMIT 10`,
      [],
      { schema: 'users' }
    );

    const contributors = contributorsResult.rows;

    // Get full profiles for top contributors
    const topContributors: UserProfile[] = [];
    for (const contributor of contributors) {
      const profile = await this.getUserProfile(contributor.id);
      if (profile) {
        topContributors.push(profile);
      }
    }

    return {
      total_users: stats.total_users || 0,
      active_users_today: stats.active_users_today || 0,
      active_users_week: stats.active_users_week || 0,
      new_users_today: stats.new_users_today || 0,
      top_contributors: topContributors,
    };
  }

  // Password reset (basic implementation)
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const userResult = await dbAdapter.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = ?`,
      [userId],
      { schema: 'users' }
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = bcrypt.compareSync(currentPassword, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = bcrypt.hashSync(newPassword, this.saltRounds);

    await dbAdapter.query(
      `UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [newPasswordHash, userId],
      { schema: 'users' }
    );

    // Log password change
    await this.logActivity({
      user_id: userId,
      activity_type: 'password_changed',
      entity_id: String(userId),
      entity_type: 'user',
      action: 'password_changed',
    });
  }

  // Ban/Unban methods
  async softBanUser(userId: number, bannedBy: number, reason?: string): Promise<void> {
    // Prevent self-banning
    if (userId === bannedBy) {
      throw new Error('You cannot ban yourself');
    }

    // Set is_active to false and ban_type to 'soft'
    await dbAdapter.query(
      `UPDATE users
       SET is_active = false,
           ban_type = 'soft',
           ban_reason = ?,
           banned_at = CURRENT_TIMESTAMP,
           banned_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason || null, bannedBy, userId],
      { schema: 'users' }
    );

    // Log ban activity
    await this.logActivity({
      user_id: bannedBy,
      activity_type: 'user_banned',
      entity_id: userId.toString(),
      entity_type: 'user',
      action: 'soft_ban',
      metadata: { reason: reason || 'No reason provided' },
    });
  }

  async unbanUser(userId: number, unbannedBy: number): Promise<void> {
    // Check if user is hard banned - cannot unban hard banned users easily
    const user = await this.getUserById(userId);
    if (user?.ban_type === 'hard') {
      throw new Error('Cannot unban a hard-banned user. Hard bans are permanent.');
    }

    // Clear all ban fields
    await dbAdapter.query(
      `UPDATE users
       SET is_active = true,
           ban_type = NULL,
           ban_reason = NULL,
           banned_at = NULL,
           banned_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId],
      { schema: 'users' }
    );

    // Log unban activity
    await this.logActivity({
      user_id: unbannedBy,
      activity_type: 'user_unbanned',
      entity_id: userId.toString(),
      entity_type: 'user',
      action: 'unban',
    });
  }

  async hardBanUser(userId: number, bannedBy: number, reason?: string): Promise<void> {
    // Prevent self-banning
    if (userId === bannedBy) {
      throw new Error('You cannot ban yourself');
    }

    // Get user info before deletion for logging
    const user = await this.getUserById(userId);
    const username = user?.username || `user_${userId}`;
    const email = user?.email;

    // Add email to banned_emails table to prevent re-registration
    if (email) {
      try {
        await dbAdapter.query(
          `INSERT INTO banned_emails (email, banned_by, reason, notes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO NOTHING`,
          [
            email,
            bannedBy,
            reason || 'Hard ban - user account permanently deleted',
            `User ${username} (ID: ${userId}) hard-banned and deleted`,
          ],
          { schema: 'users' }
        );
      } catch (error) {
        // Log but don't fail the hard ban if email blacklist insertion fails
        logger.error('Failed to add email to banned_emails table:', error);
      }
    }

    // Log the deletion BEFORE deleting (so we have a record)
    await this.logActivity({
      user_id: bannedBy,
      activity_type: 'user_deleted',
      entity_id: userId.toString(),
      entity_type: 'user',
      action: 'hard_ban',
      metadata: {
        reason: reason || 'No reason provided',
        deleted_username: username,
        permanent: true,
      },
    });

    // Actually DELETE the user from the database
    // Foreign key constraints should CASCADE delete related data
    await dbAdapter.query(`DELETE FROM users WHERE id = ?`, [userId], { schema: 'users' });
  }

  async batchBanUsers(userIds: number[], bannedBy: number, reason?: string): Promise<void> {
    // Filter out self-bans
    const filteredIds = userIds.filter(id => id !== bannedBy);
    for (const userId of filteredIds) {
      await this.softBanUser(userId, bannedBy, reason);
    }
  }

  async batchUnbanUsers(userIds: number[], unbannedBy: number): Promise<void> {
    for (const userId of userIds) {
      await this.unbanUser(userId, unbannedBy);
    }
  }

  async batchHardBanUsers(userIds: number[], bannedBy: number, reason?: string): Promise<void> {
    // Filter out self-bans
    const filteredIds = userIds.filter(id => id !== bannedBy);
    for (const userId of filteredIds) {
      await this.hardBanUser(userId, bannedBy, reason);
    }
  }

  async createUserAsAdmin(
    username: string,
    email: string,
    generatedPassword: string,
    createdBy: number
  ): Promise<{ user: User; password: string }> {
    const userId = await dbAdapter.transaction(
      async () => {
        // Check if username or email already exists
        const existingResult = await dbAdapter.query(
          `SELECT id FROM users
        WHERE username = ? OR email = ?`,
          [username, email],
          { schema: 'users' }
        );

        if (existingResult.rows.length > 0) {
          throw new Error('Username or email already exists');
        }

        // Hash password
        const passwordHash = bcrypt.hashSync(generatedPassword, this.saltRounds);

        // Insert user
        const insertResult = await dbAdapter.query(
          `INSERT INTO users (
          username, email, password_hash, display_name, role, is_active,
          email_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'user', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id`,
          [username, email, passwordHash, username],
          { schema: 'users', returnLastId: true }
        );

        const userId = insertResult.rows[0].id;

        // Log user creation by admin
        await this.logActivity({
          user_id: createdBy,
          activity_type: 'user_created',
          entity_id: userId.toString(),
          entity_type: 'user',
          action: 'admin_created',
        });

        return userId;
      },
      { schema: 'users' }
    );

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return { user, password: generatedPassword };
  }

  // Session management
  async cleanupExpiredSessions(): Promise<number> {
    const result = await dbAdapter.query(
      `DELETE FROM user_sessions
      WHERE expires_at <= CURRENT_TIMESTAMP`,
      [],
      { schema: 'users' }
    );

    return result.rowCount;
  }

  async getUserSessions(userId: number): Promise<UserSession[]> {
    const result = await dbAdapter.query<UserSession>(
      `SELECT id, user_id, expires_at, user_agent, ip_address, created_at
      FROM user_sessions
      WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC`,
      [userId],
      { schema: 'users' }
    );

    return result.rows;
  }
}
