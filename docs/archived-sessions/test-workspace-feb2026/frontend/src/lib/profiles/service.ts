import { getCurrentUser } from '../auth/server';
import { dbAdapter } from '../database/adapter';
import {
  UserId,
  ProfileServiceDependency,
  CoreUserProfile,
  ServiceError,
  CrossServiceActivity,
  UserPrivacySettings as AggregatedUserPrivacySettings,
  ServiceType,
  ActivityType,
  EntityType,
} from '@/types/profile-aggregation';
import { Result, Ok, Err } from '@/lib/utils/result';
import { Result as ResultClass } from '@/types/error-handling';
import { logger } from '@/lib/utils/logger';

/**
 * Database row types for query results
 */
interface UserRow {
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  avatar_position_x?: number | null;
  avatar_position_y?: number | null;
  avatar_scale?: number | null;
  bio?: string | null;
  location?: string | null;
  website_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  discord_username?: string | null;
  steam_url?: string | null;
  xbox_gamertag?: string | null;
  psn_id?: string | null;
  bluesky_url?: string | null;
  mastodon_url?: string | null;
  role?: string | null;
  reputation?: number | null;
  post_count?: number | null;
  created_at?: string | null;
  last_active?: string | null;
  last_login_at?: string | null;
  login_count?: number | null;
  is_active?: boolean | null;
  email_verified?: boolean | null;
  two_factor_enabled?: boolean | null;
  profile_visibility?: string | null;
  email_visibility?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

interface ActivityRow {
  id: number;
  activity_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action?: string | null;
  metadata?: string | null;
  activity_data?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
  entity_title?: string | null;
  entity_url?: string | null;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  avatar_position_x?: number;
  avatar_position_y?: number;
  avatar_scale?: number;
  bio?: string;
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
  role: string;
  reputation: number;
  post_count: number;
  created_at: string;
  last_active?: string;
  last_login_at?: string;
  login_count: number;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
}

export interface UserPrivacySettings {
  profile_visibility: 'public' | 'members' | 'private';
  activity_visibility: 'public' | 'members' | 'private';
  email_visibility: 'public' | 'members' | 'admin' | 'private';
  show_online_status: boolean;
  show_last_active: boolean;
  allow_messages: boolean;
  show_reputation_details: boolean;
  show_forum_activity: boolean;
  show_wiki_activity: boolean;
  show_messaging_activity: boolean;
}

export interface UserActivity {
  id: number;
  activity_type: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  entity_title?: string | null;
  entity_url?: string | null;
}

export interface ReputationChange {
  id: number;
  change_amount: number;
  reason: string;
  entity_type?: string | null;
  entity_id?: string | null;
  given_by?: number | null;
  given_by_username?: string | null;
  created_at: string;
}

export interface LoginHistoryEntry {
  id: number;
  login_timestamp: string;
  ip_address?: string;
  user_agent?: string;
  login_method: string;
  success: boolean;
  failure_reason?: string;
}

export interface ProfileStats {
  forum: {
    total_topics: number;
    total_replies: number;
    total_votes_received: number;
    solutions_provided: number;
    recent_topics: never[];
    recent_replies: never[];
  };
  wiki: {
    total_pages_created: number;
    total_edits: number;
    pages_viewed: number;
    recent_edits: never[];
    favorite_pages: never[];
  };
  reputation: {
    total: number;
    recent_changes: ReputationChange[];
    breakdown: {
      forum_posts: number;
      wiki_edits: number;
      helpful_votes: number;
      solutions: number;
    };
  };
}

export class ProfileService implements ProfileServiceDependency {
  readonly serviceName: ServiceType = 'profile';

  constructor() {
    // No database instance needed - using dbAdapter
  }

  // Health check implementation
  async isHealthy(): Promise<boolean> {
    try {
      // Test database connection and basic query
      const result = await dbAdapter.query('SELECT 1 as test', [], { schema: 'users' });
      return result.rows[0]?.test === 1;
    } catch (error) {
      logger.error('ProfileService health check failed:', error);
      return false;
    }
  }

  async getLastUpdateTime(userId: UserId): Promise<string | null> {
    try {
      const result = await dbAdapter.query(
        'SELECT updated_at FROM users WHERE id = $1',
        [Number(userId)],
        { schema: 'users' }
      );
      return result.rows[0]?.updated_at || null;
    } catch (error) {
      logger.error('Error getting last update time:', error);
      return null;
    }
  }

  async getUserStats(userId: UserId): Promise<ResultClass<CoreUserProfile, ServiceError>> {
    const result = await this.getUserProfile(userId);
    if (result.isOk()) {
      return ResultClass.ok(result.value);
    } else {
      return ResultClass.error(result.error);
    }
  }

  // Interface implementation - get user profile with Result type
  async getUserProfile(
    userId: UserId,
    viewerId?: UserId
  ): Promise<ResultClass<CoreUserProfile, ServiceError>> {
    const userIdNum = Number(userId);
    const viewerIdNum = viewerId ? Number(viewerId) : undefined;

    try {
      // Get basic user data
      const result = await dbAdapter.query(
        `
        SELECT u.*, ups.*
        FROM users u
        LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
        WHERE u.id = $1 AND u.is_active = TRUE
      `,
        [userIdNum],
        { schema: 'users' }
      );

      const userRow = result.rows[0];
      if (!userRow) {
        return ResultClass.error({
          type: 'user_not_found' as const,
          service: 'profile' as const,
          userId,
          message: `User profile not found for ID: ${userId}`,
          retryable: false,
        } as ServiceError);
      }

      // Check privacy permissions
      const canView = await this.canViewProfile(userIdNum, viewerIdNum, userRow.profile_visibility);
      if (!canView) {
        return ResultClass.error({
          type: 'permission_denied' as const,
          service: 'profile' as const,
          requiredPermission: 'view_profile',
          message: 'Permission denied to view this profile',
          retryable: false,
        } as ServiceError);
      }

      const coreProfile = this.transformToCoreProfile(userRow, userId);
      return ResultClass.ok(coreProfile);
    } catch (error) {
      logger.error('Error fetching user profile:', error);

      // If the error is due to missing table, try a fallback query
      if (error instanceof Error && error.message.includes('user_privacy_settings')) {
        try {
          const fallbackResult = await dbAdapter.query(
            `SELECT * FROM users WHERE id = $1 AND is_active = TRUE`,
            [userIdNum],
            { schema: 'users' }
          );
          const userRow = fallbackResult.rows[0];
          if (!userRow) {
            return ResultClass.error({
              type: 'user_not_found',
              service: 'profile',
              userId,
              message: `User profile not found for ID: ${userId}`,
              retryable: false,
            });
          }
          const coreProfile = this.transformToCoreProfile(userRow, userId);
          return ResultClass.ok(coreProfile);
        } catch (fallbackError) {
          logger.error('Fallback query also failed:', fallbackError);
        }
      }

      return ResultClass.error({
        type: 'database_connection' as const,
        service: 'profile' as const,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      } as ServiceError);
    }
  }

  // Legacy method for backward compatibility
  async getUserProfileLegacy(userId: number, viewerId?: number): Promise<UserProfile | null> {
    try {
      // Get basic user data
      const result = await dbAdapter.query(
        `
        SELECT u.*, ups.*
        FROM users u
        LEFT JOIN user_privacy_settings ups ON u.id = ups.user_id
        WHERE u.id = $1 AND u.is_active = TRUE
      `,
        [userId],
        { schema: 'users' }
      );

      const userRow = result.rows[0];
      if (!userRow) return null;

      // Check privacy permissions
      const canView = await this.canViewProfile(userId, viewerId, userRow.profile_visibility);
      if (!canView) return null;

      return this.sanitizeUserForViewer(userRow, viewerId);
    } catch (error) {
      logger.error('Error fetching user profile:', error);

      // If the error is due to missing table, try a fallback query
      if (error instanceof Error && error.message.includes('user_privacy_settings')) {
        try {
          const fallbackResult = await dbAdapter.query(
            `SELECT * FROM users WHERE id = $1 AND is_active = TRUE`,
            [userId],
            { schema: 'users' }
          );
          const userRow = fallbackResult.rows[0];
          if (!userRow) return null;
          return this.sanitizeUserForViewer(userRow, viewerId);
        } catch (fallbackError) {
          logger.error('Fallback query also failed:', fallbackError);
        }
      }

      return null;
    }
  }

  // Legacy method compatibility (updated to use new privacy method)
  async getUserPrivacySettingsLegacy(userId: number): Promise<UserPrivacySettings> {
    const result = await this.getUserPrivacySettings(userId as UserId);
    if (result.isOk()) {
      return {
        profile_visibility: result.value.profileVisibility,
        activity_visibility: result.value.activityVisibility,
        email_visibility: result.value.emailVisibility,
        show_online_status: result.value.showOnlineStatus,
        show_last_active: result.value.showLastActive,
        allow_messages: result.value.allowMessages,
        show_reputation_details: result.value.showReputationDetails,
        show_forum_activity: result.value.showForumActivity,
        show_wiki_activity: result.value.showWikiActivity,
      } as UserPrivacySettings;
    }
    return {} as UserPrivacySettings;
  }

  // REMOVED: getProfileStats method - use ProfileAggregatorService instead
  // This method contained cross-database queries and has been replaced by the aggregation architecture

  // Get user activities across platforms (legacy method)
  async getUserActivitiesLegacy(
    userId: number,
    viewerId?: number,
    limit = 20
  ): Promise<UserActivity[]> {
    try {
      const privacy = await this.getUserPrivacySettingsLegacy(userId);
      const canViewActivity = await this.canViewActivity(
        userId,
        viewerId,
        privacy.activity_visibility || 'public'
      );

      if (!canViewActivity) return [];

      const result = await dbAdapter.query(
        `
        SELECT
          ua.*,
          JSON_EXTRACT(ua.activity_data, '$.title') as entity_title,
          JSON_EXTRACT(ua.activity_data, '$.url') as entity_url
        FROM unified_activity ua
        WHERE ua.user_id = $1
        ORDER BY ua.created_at DESC
        LIMIT $2
      `,
        [userId, limit],
        { schema: 'users' }
      );

      const activitiesRows = result.rows as ActivityRow[];

      // Serialize database rows to plain objects
      return activitiesRows.map((activity: ActivityRow) => ({
        id: Number(activity.id),
        activity_type: String(activity.activity_type || ''),
        entity_type: String(activity.entity_type || ''),
        entity_id: String(activity.entity_id || ''),
        action: String(activity.action || ''),
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
        timestamp: String(activity.timestamp || ''),
        entity_title: activity.entity_title ? String(activity.entity_title) : null,
        entity_url: activity.entity_url ? String(activity.entity_url) : null,
      }));
    } catch (error) {
      logger.error('Error fetching user activities:', error);
      return [];
    }
  }

  // Privacy and permissions (Legacy)
  async getUserPrivacySettingsOld(userId: number): Promise<UserPrivacySettings> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM user_privacy_settings WHERE user_id = $1`,
        [userId],
        { schema: 'users' }
      );

      const settingsRow = result.rows[0];

      // Return a clean, serializable privacy settings object
      if (settingsRow) {
        return {
          profile_visibility: String(settingsRow.profile_visibility || 'public') as
            | 'public'
            | 'members'
            | 'private',
          activity_visibility: String(settingsRow.activity_visibility || 'public') as
            | 'public'
            | 'members'
            | 'private',
          email_visibility: String(settingsRow.email_visibility || 'private') as
            | 'public'
            | 'members'
            | 'admin'
            | 'private',
          show_online_status: Boolean(settingsRow.show_online_status ?? true),
          show_last_active: Boolean(settingsRow.show_last_active ?? true),
          allow_messages: Boolean(settingsRow.allow_messages ?? true),
          show_reputation_details: Boolean(settingsRow.show_reputation_details ?? true),
          show_forum_activity: Boolean(settingsRow.show_forum_activity ?? true),
          show_wiki_activity: Boolean(settingsRow.show_wiki_activity ?? true),
          show_messaging_activity: Boolean(settingsRow.show_messaging_activity ?? true),
        };
      }

      return {
        profile_visibility: 'public',
        activity_visibility: 'public',
        email_visibility: 'private',
        show_online_status: true,
        show_last_active: true,
        allow_messages: true,
        show_reputation_details: true,
        show_forum_activity: true,
        show_wiki_activity: true,
        show_messaging_activity: true,
      };
    } catch (error) {
      logger.error('Error fetching privacy settings:', error);
      return {} as UserPrivacySettings;
    }
  }

  async updatePrivacySettings(
    userId: number,
    settings: Partial<UserPrivacySettings>
  ): Promise<boolean> {
    try {
      // First check if a row exists
      const checkResult = await dbAdapter.query(
        'SELECT user_id FROM user_privacy_settings WHERE user_id = $1',
        [userId],
        { schema: 'users' }
      );
      const exists = checkResult.rows[0];

      if (exists) {
        // Update existing row
        const keys = Object.keys(settings);
        const setClause = keys.map((key, idx) => `${key} = $${idx + 2}`).join(', ');
        const values = [...Object.values(settings), userId];

        await dbAdapter.query(
          `
          UPDATE user_privacy_settings
          SET ${setClause}, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `,
          [userId, ...Object.values(settings)],
          { schema: 'users' }
        );
      } else {
        // Insert new row with defaults merged with provided settings
        const defaults = {
          profile_visibility: 'public',
          activity_visibility: 'public',
          email_visibility: 'private',
          show_online_status: true,
          show_last_active: true,
          allow_messages: true,
          show_reputation_details: true,
          show_forum_activity: true,
          show_wiki_activity: true,
        };

        const mergedSettings = { ...defaults, ...settings };

        await dbAdapter.query(
          `
          INSERT INTO user_privacy_settings (
            user_id, profile_visibility, activity_visibility, email_visibility,
            show_online_status, show_last_active, allow_messages,
            show_reputation_details, show_forum_activity, show_wiki_activity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
          [
            userId,
            mergedSettings.profile_visibility,
            mergedSettings.activity_visibility,
            mergedSettings.email_visibility,
            mergedSettings.show_online_status,
            mergedSettings.show_last_active,
            mergedSettings.allow_messages,
            mergedSettings.show_reputation_details,
            mergedSettings.show_forum_activity,
            mergedSettings.show_wiki_activity,
          ],
          { schema: 'users' }
        );
      }

      return true;
    } catch (error) {
      logger.error('Error updating privacy settings:', error);
      return false;
    }
  }

  // Data export
  async requestDataExport(userId: number, exportType = 'full'): Promise<string | null> {
    try {
      const requestId = `export_${userId}_${Date.now()}`;

      await dbAdapter.query(
        `
        INSERT INTO user_data_exports (user_id, request_type, status)
        VALUES ($1, $2, 'pending')
      `,
        [userId, exportType],
        { schema: 'users' }
      );

      // In a real implementation, this would queue a background job
      // For now, we'll return the request ID
      return requestId;
    } catch (error) {
      logger.error('Error requesting data export:', error);
      return null;
    }
  }

  // Private helper methods
  private async canViewProfile(
    userId: number,
    viewerId?: number,
    visibility = 'public'
  ): Promise<boolean> {
    if (!viewerId) return visibility === 'public';
    if (userId === viewerId) return true;

    const viewer = await this.getUserProfileLegacy(viewerId);
    if (viewer?.role === 'admin') return true;

    switch (visibility) {
      case 'public':
        return true;
      case 'members':
        return !!viewer;
      case 'private':
        return false;
      default:
        return false;
    }
  }

  private async canViewActivity(
    userId: number,
    viewerId?: number,
    visibility = 'public'
  ): Promise<boolean> {
    return this.canViewProfile(userId, viewerId, visibility);
  }

  private sanitizeUserForViewer(user: UserRow, viewerId?: number): UserProfile {
    // Create a clean, serializable user profile object
    const sanitized: UserProfile = {
      id: Number(user.id),
      username: String(user.username || ''),
      email: String(user.email || ''),
      display_name: user.display_name ? String(user.display_name) : undefined,
      avatar_url: user.avatar_url ? String(user.avatar_url) : undefined,
      avatar_position_x: user.avatar_position_x !== undefined ? Number(user.avatar_position_x) : 50,
      avatar_position_y: user.avatar_position_y !== undefined ? Number(user.avatar_position_y) : 50,
      avatar_scale: user.avatar_scale !== undefined ? Number(user.avatar_scale) : 100,
      bio: user.bio ? String(user.bio) : undefined,
      location: user.location ? String(user.location) : undefined,
      website_url: user.website_url ? String(user.website_url) : undefined,
      github_url: user.github_url ? String(user.github_url) : undefined,
      linkedin_url: user.linkedin_url ? String(user.linkedin_url) : undefined,
      discord_username: user.discord_username ? String(user.discord_username) : undefined,
      steam_url: user.steam_url ? String(user.steam_url) : undefined,
      xbox_gamertag: user.xbox_gamertag ? String(user.xbox_gamertag) : undefined,
      psn_id: user.psn_id ? String(user.psn_id) : undefined,
      bluesky_url: user.bluesky_url ? String(user.bluesky_url) : undefined,
      mastodon_url: user.mastodon_url ? String(user.mastodon_url) : undefined,
      role: String(user.role || 'user'),
      reputation: Number(user.reputation || 0),
      post_count: Number(user.post_count || 0),
      created_at: String(user.created_at || ''),
      last_active: user.last_active ? String(user.last_active) : undefined,
      last_login_at: user.last_login_at ? String(user.last_login_at) : undefined,
      login_count: Number(user.login_count || 0),
      is_active: Boolean(user.is_active),
      email_verified: Boolean(user.email_verified),
      two_factor_enabled: Boolean(user.two_factor_enabled),
    };

    // Remove sensitive information based on privacy settings
    if (user.email_visibility === 'private' && user.id !== viewerId) {
      sanitized.email = '';
    }

    return sanitized;
  }

  // Transform database row to CoreUserProfile
  private transformToCoreProfile(user: UserRow, userId: UserId): CoreUserProfile {
    return {
      id: userId,
      username: String(user.username || ''),
      email: String(user.email || ''),
      displayName: user.display_name ? String(user.display_name) : undefined,
      avatarUrl: user.avatar_url ? String(user.avatar_url) : undefined,
      avatarPosition:
        user.avatar_position_x !== undefined
          ? {
              x: Number(user.avatar_position_x),
              y: Number(user.avatar_position_y) || 50,
              scale: Number(user.avatar_scale) || 100,
            }
          : undefined,
      bio: user.bio ? String(user.bio) : undefined,
      location: user.location ? String(user.location) : undefined,
      socialLinks: {
        website: user.website_url ? String(user.website_url) : undefined,
        github: user.github_url ? String(user.github_url) : undefined,
        linkedin: user.linkedin_url ? String(user.linkedin_url) : undefined,
        discord: user.discord_username ? String(user.discord_username) : undefined,
        steam: user.steam_url ? String(user.steam_url) : undefined,
        xbox: user.xbox_gamertag ? String(user.xbox_gamertag) : undefined,
        psn: user.psn_id ? String(user.psn_id) : undefined,
        bluesky: user.bluesky_url ? String(user.bluesky_url) : undefined,
        mastodon: user.mastodon_url ? String(user.mastodon_url) : undefined,
      },
      role: String(user.role || 'user') as 'user' | 'moderator' | 'developer' | 'admin' | 'banned',
      reputation: Number(user.reputation || 0),
      createdAt: String(user.created_at || ''),
      lastActive: user.last_active ? String(user.last_active) : undefined,
      lastLogin: user.last_login_at ? String(user.last_login_at) : undefined,
      loginCount: Number(user.login_count || 0),
      isActive: Boolean(user.is_active),
      emailVerified: Boolean(user.email_verified),
      twoFactorEnabled: Boolean(user.two_factor_enabled),
    };
  }

  // Interface implementation - get user privacy settings with Result type
  async getUserPrivacySettings(
    userId: UserId
  ): Promise<ResultClass<AggregatedUserPrivacySettings, ServiceError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT * FROM user_privacy_settings WHERE user_id = $1`,
        [Number(userId)],
        { schema: 'users' }
      );

      const settingsRow = result.rows[0];

      // Return a clean, serializable privacy settings object
      if (settingsRow) {
        const settings: AggregatedUserPrivacySettings = {
          profileVisibility: String(settingsRow.profile_visibility || 'public') as
            | 'public'
            | 'members'
            | 'private',
          activityVisibility: String(settingsRow.activity_visibility || 'public') as
            | 'public'
            | 'members'
            | 'private',
          emailVisibility: String(settingsRow.email_visibility || 'private') as
            | 'public'
            | 'members'
            | 'admin'
            | 'private',
          showOnlineStatus: Boolean(settingsRow.show_online_status ?? true),
          showLastActive: Boolean(settingsRow.show_last_active ?? true),
          allowMessages: Boolean(settingsRow.allow_messages ?? true),
          showReputationDetails: Boolean(settingsRow.show_reputation_details ?? true),
          showForumActivity: Boolean(settingsRow.show_forum_activity ?? true),
          showWikiActivity: Boolean(settingsRow.show_wiki_activity ?? true),
          showMessagingActivity: Boolean(settingsRow.show_messaging_activity ?? true),
        };
        return ResultClass.ok(settings);
      }

      const defaultSettings: AggregatedUserPrivacySettings = {
        profileVisibility: 'public',
        activityVisibility: 'public',
        emailVisibility: 'private',
        showOnlineStatus: true,
        showLastActive: true,
        allowMessages: true,
        showReputationDetails: true,
        showForumActivity: true,
        showWikiActivity: true,
        showMessagingActivity: true,
      };
      return ResultClass.ok(defaultSettings);
    } catch (error) {
      logger.error('Error fetching privacy settings:', error);
      return ResultClass.error({
        type: 'database_connection' as const,
        service: 'profile' as const,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      } as ServiceError);
    }
  }

  // Interface implementation - get user activities with Result type
  async getUserActivities(
    userId: UserId,
    limit = 20
  ): Promise<ResultClass<readonly CrossServiceActivity[], ServiceError>> {
    const userIdNum = Number(userId);

    try {
      // user_activities table doesn't exist - return empty array
      // Activity tracking is handled by individual services (forums, wiki, etc.)
      const activitiesRows: ActivityRow[] = [];

      // Serialize database rows to CrossServiceActivity objects
      const activities: CrossServiceActivity[] = activitiesRows.map((activity: ActivityRow) => {
        // Parse activity_data if it's a JSON string
        const activityData = activity.activity_data ? JSON.parse(activity.activity_data) : {};

        return {
          id: `profile:${activity.id}`,
          service: this.mapEntityTypeToService(
            activity.entity_type || activityData.entity_type || activity.activity_type
          ),
          activityType: this.mapActionToActivityType(
            activity.action || activityData.action || activity.activity_type
          ),
          entityType: this.mapEntityType(
            activity.entity_type || activityData.entity_type || activity.activity_type
          ),
          entityId: String(activity.entity_id || activityData.entity_id || ''),
          entityTitle: activity.entity_title || activityData.title || undefined,
          entityUrl: activity.entity_url || activityData.url || undefined,
          action: String(activity.action || activityData.action || activity.activity_type || ''),
          timestamp: String(activity.timestamp || activity.created_at || ''),
          metadata: activityData.metadata || undefined,
        };
      });

      return ResultClass.ok(activities);
    } catch (error) {
      logger.error('Error fetching user activities:', error);
      return ResultClass.error({
        type: 'database_connection' as const,
        service: 'profile' as const,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        retryable: true,
      } as ServiceError);
    }
  }

  // Helper methods for activity type mapping
  private mapEntityTypeToService(entityType: string): ServiceType {
    switch (entityType) {
      case 'forum_topic':
      case 'forum_reply':
        return 'forum';
      case 'wiki_page':
      case 'wiki_revision':
        return 'wiki';
      case 'conversation':
      case 'message':
        return 'messaging';
      default:
        return 'profile';
    }
  }

  private mapActionToActivityType(action: string): ActivityType {
    switch (action.toLowerCase()) {
      case 'create':
      case 'created':
        return 'create';
      case 'update':
      case 'updated':
      case 'edit':
      case 'edited':
        return 'update';
      case 'delete':
      case 'deleted':
        return 'delete';
      case 'view':
      case 'viewed':
        return 'view';
      case 'vote':
      case 'voted':
        return 'vote';
      case 'reply':
      case 'replied':
        return 'reply';
      default:
        return 'update';
    }
  }

  private mapEntityType(entityType: string): EntityType {
    switch (entityType) {
      case 'forum_topic':
        return 'topic';
      case 'forum_reply':
        return 'reply';
      case 'wiki_page':
        return 'wiki_page';
      case 'wiki_revision':
        return 'wiki_revision';
      case 'conversation':
        return 'conversation';
      case 'message':
        return 'message';
      case 'user':
        return 'user';
      default:
        return 'user';
    }
  }

  // REMOVED: getForumStats method - contained cross-database queries to forum_topics/forum_replies
  // Forum statistics should now be retrieved via ForumService through ProfileAggregatorService

  // REMOVED: getWikiStats method - contained cross-database queries to wiki_pages/wiki_revisions
  // Wiki statistics should now be retrieved via WikiService through ProfileAggregatorService

  private async getReputationStats(
    userId: number,
    privacy: UserPrivacySettings,
    viewerId?: number
  ) {
    if (!privacy.show_reputation_details && userId !== viewerId) {
      return {
        total: 0,
        recent_changes: [],
        breakdown: {
          forum_posts: 0,
          wiki_edits: 0,
          helpful_votes: 0,
          solutions: 0,
        },
      };
    }

    try {
      const result = await dbAdapter.query('SELECT reputation FROM users WHERE id = $1', [userId], {
        schema: 'users',
      });
      const user = result.rows[0];

      // Reputation history system has been purged

      // Calculate breakdown (simplified) - using proper PostgreSQL syntax
      // Reputation history table purged, using estimated breakdown
      const reputation = Number(user?.reputation || 0);
      const forumPostsRep = Math.floor(reputation * 0.6);
      const wikiEditsRep = Math.floor(reputation * 0.3);

      // Reputation changes history purged
      const serializedRecentChanges: ReputationChange[] = [];

      return {
        total: Number(user?.reputation || 0),
        recent_changes: serializedRecentChanges,
        breakdown: {
          forum_posts: Number(forumPostsRep),
          wiki_edits: Number(wikiEditsRep),
          helpful_votes: 0, // TODO: Implement voting
          solutions: 0, // TODO: Implement solution rep
        },
      };
    } catch (error) {
      logger.error('Error fetching reputation stats:', error);
      return {
        total: 0,
        recent_changes: [],
        breakdown: {
          forum_posts: 0,
          wiki_edits: 0,
          helpful_votes: 0,
          solutions: 0,
        },
      };
    }
  }
}
