/**
 * Centralized User Lookup Service - PostgreSQL Only
 *
 * This service provides a single point for fetching user data from PostgreSQL users schema.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { logger } from '@/lib/utils/logger';

export interface UserBasic {
  id: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
}

export interface UserDetailed extends UserBasic {
  email: string;
  bio?: string;
  reputation: number;
  post_count: number;
  created_at: string;
  last_active?: string;
  is_active: boolean;
}

export class UserLookupService {
  /**
   * Get basic user info for displaying in lists, bylines, etc.
   */
  async getUserBasic(userId: number): Promise<UserBasic | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, username, display_name, avatar_url, role
         FROM users
         WHERE id = $1`,
        [userId],
        { schema: 'users' }
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching basic user info:', error);
      return null;
    }
  }

  /**
   * Get basic info for multiple users (efficient for lists)
   */
  async getUsersBasic(userIds: number[]): Promise<Map<number, UserBasic>> {
    const userMap = new Map<number, UserBasic>();

    if (userIds.length === 0) return userMap;

    try {
      // Remove duplicates and filter out invalid IDs
      const uniqueIds = [...new Set(userIds.filter(id => id > 0))];

      if (uniqueIds.length === 0) return userMap;

      // Build placeholders for PostgreSQL: $1, $2, $3, etc.
      const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');

      const result = await dbAdapter.query(
        `SELECT id, username, display_name, avatar_url, role
         FROM users
         WHERE id IN (${placeholders})`,
        uniqueIds,
        { schema: 'users' }
      );

      result.rows.forEach((user: UserBasic) => {
        userMap.set(user.id, user);
      });
    } catch (error) {
      logger.error('Error fetching basic users info:', error);
    }

    return userMap;
  }

  /**
   * Get detailed user info (for profiles, admin, etc.)
   */
  async getUserDetailed(userId: number): Promise<UserDetailed | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, username, display_name, email, avatar_url, bio, role,
                reputation, post_count, created_at, last_active, is_active
         FROM users
         WHERE id = $1`,
        [userId],
        { schema: 'users' }
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching detailed user info:', error);
      return null;
    }
  }

  /**
   * Check if a user exists (lightweight check)
   */
  async userExists(userId: number): Promise<boolean> {
    try {
      const result = await dbAdapter.query(`SELECT 1 FROM users WHERE id = $1 LIMIT 1`, [userId], {
        schema: 'users',
      });

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking user existence:', error);
      return false;
    }
  }

  /**
   * Validate multiple user IDs exist
   */
  async validateUserIds(userIds: number[]): Promise<{
    valid: number[];
    invalid: number[];
  }> {
    const result: { valid: number[]; invalid: number[] } = { valid: [], invalid: [] };

    if (userIds.length === 0) return result;

    try {
      const uniqueIds = [...new Set(userIds.filter(id => id > 0))];

      if (uniqueIds.length === 0) {
        result.invalid = [...userIds];
        return result;
      }

      const placeholders = uniqueIds.map((_, i) => `$${i + 1}`).join(',');

      const queryResult = await dbAdapter.query(
        `SELECT id FROM users WHERE id IN (${placeholders})`,
        uniqueIds,
        { schema: 'users' }
      );

      const existingIds = new Set(queryResult.rows.map((u: { id: number }) => u.id));

      uniqueIds.forEach(id => {
        if (existingIds.has(id)) {
          result.valid.push(id);
        } else {
          result.invalid.push(id);
        }
      });
    } catch (error) {
      logger.error('Error validating user IDs:', error);
      result.invalid = [...userIds];
    }

    return result;
  }

  /**
   * Get user by username (for lookups, mentions, etc.)
   * Note: Uses ILIKE for case-insensitive matching (PostgreSQL)
   */
  async getUserByUsername(username: string): Promise<UserBasic | null> {
    try {
      const result = await dbAdapter.query(
        `SELECT id, username, display_name, avatar_url, role
         FROM users
         WHERE username ILIKE $1`,
        [username],
        { schema: 'users' }
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching user by username:', error);
      return null;
    }
  }

  /**
   * Search users by username pattern (for autocomplete, etc.)
   */
  async searchUsers(query: string, limit: number = 10): Promise<UserBasic[]> {
    try {
      const searchPattern = `%${query}%`;

      const result = await dbAdapter.query(
        `SELECT id, username, display_name, avatar_url, role
         FROM users
         WHERE username ILIKE $1 OR display_name ILIKE $2
         ORDER BY username
         LIMIT $3`,
        [searchPattern, searchPattern, limit],
        { schema: 'users' }
      );

      return result.rows;
    } catch (error) {
      logger.error('Error searching users:', error);
      return [];
    }
  }
}

// Export singleton instance
export const userLookupService = new UserLookupService();

// Types already exported above
