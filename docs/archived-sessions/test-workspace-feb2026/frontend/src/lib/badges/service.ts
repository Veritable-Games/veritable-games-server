/**
 * Badge Service
 *
 * Handles all badge-related operations including:
 * - Badge CRUD operations
 * - Granting/revoking badges
 * - Querying user badges
 * - Automatic supporter badge assignment based on donations
 */

import { dbAdapter } from '@/lib/database/adapter';
import type {
  Badge,
  UserBadge,
  UserBadgeWithDetails,
  BadgeDisplay,
  BadgeDisplayWithUserId,
  CreateBadgeData,
  UpdateBadgeData,
  GrantBadgeData,
  BadgeType,
} from './types';
import { getSupporterTierForAmount, SUPPORTER_TIERS } from './types';
import { logger } from '@/lib/utils/logger';

export class BadgeService {
  // ==================== Badge Definition CRUD ====================

  /**
   * Get all badges, optionally filtered by type
   */
  async getAllBadges(type?: BadgeType, activeOnly = true): Promise<Badge[]> {
    let query = `
      SELECT id, slug, name, description, icon, color, badge_type, tier_level,
             min_donation_amount, is_stackable, display_priority, is_active,
             created_at, updated_at
      FROM badges
      WHERE 1=1
    `;
    const params: any[] = [];

    if (activeOnly) {
      query += ` AND is_active = true`;
    }

    if (type) {
      params.push(type);
      query += ` AND badge_type = $${params.length}`;
    }

    query += ` ORDER BY display_priority DESC, tier_level DESC`;

    const result = await dbAdapter.query(query, params, { schema: 'users' });
    return result.rows as Badge[];
  }

  /**
   * Get a badge by ID
   */
  async getBadgeById(id: number): Promise<Badge | null> {
    const result = await dbAdapter.query(
      `SELECT id, slug, name, description, icon, color, badge_type, tier_level,
              min_donation_amount, is_stackable, display_priority, is_active,
              created_at, updated_at
       FROM badges WHERE id = $1`,
      [id],
      { schema: 'users' }
    );
    return (result.rows[0] as Badge) || null;
  }

  /**
   * Get a badge by slug
   */
  async getBadgeBySlug(slug: string): Promise<Badge | null> {
    const result = await dbAdapter.query(
      `SELECT id, slug, name, description, icon, color, badge_type, tier_level,
              min_donation_amount, is_stackable, display_priority, is_active,
              created_at, updated_at
       FROM badges WHERE slug = $1`,
      [slug],
      { schema: 'users' }
    );
    return (result.rows[0] as Badge) || null;
  }

  /**
   * Create a new badge definition
   */
  async createBadge(data: CreateBadgeData): Promise<Badge> {
    const result = await dbAdapter.query(
      `INSERT INTO badges (slug, name, description, icon, color, badge_type,
                          tier_level, min_donation_amount, is_stackable,
                          display_priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, slug, name, description, icon, color, badge_type, tier_level,
                 min_donation_amount, is_stackable, display_priority, is_active,
                 created_at, updated_at`,
      [
        data.slug,
        data.name,
        data.description || null,
        data.icon || null,
        data.color || '#3b82f6',
        data.badge_type,
        data.tier_level || 0,
        data.min_donation_amount || null,
        data.is_stackable || false,
        data.display_priority || 0,
        data.is_active !== false,
      ],
      { schema: 'users' }
    );
    return result.rows[0] as Badge;
  }

  /**
   * Update a badge definition
   */
  async updateBadge(id: number, data: UpdateBadgeData): Promise<Badge | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      params.push(data.icon);
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      params.push(data.color);
    }
    if (data.tier_level !== undefined) {
      updates.push(`tier_level = $${paramIndex++}`);
      params.push(data.tier_level);
    }
    if (data.min_donation_amount !== undefined) {
      updates.push(`min_donation_amount = $${paramIndex++}`);
      params.push(data.min_donation_amount);
    }
    if (data.is_stackable !== undefined) {
      updates.push(`is_stackable = $${paramIndex++}`);
      params.push(data.is_stackable);
    }
    if (data.display_priority !== undefined) {
      updates.push(`display_priority = $${paramIndex++}`);
      params.push(data.display_priority);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.is_active);
    }

    if (updates.length === 0) {
      return this.getBadgeById(id);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await dbAdapter.query(
      `UPDATE badges SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, slug, name, description, icon, color, badge_type, tier_level,
                 min_donation_amount, is_stackable, display_priority, is_active,
                 created_at, updated_at`,
      params,
      { schema: 'users' }
    );

    return (result.rows[0] as Badge) || null;
  }

  /**
   * Delete a badge (soft delete by setting is_active = false)
   */
  async deleteBadge(id: number): Promise<boolean> {
    const result = await dbAdapter.query(
      `UPDATE badges SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
      { schema: 'users' }
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== User Badge Operations ====================

  /**
   * Get all badges for a user
   */
  async getUserBadges(userId: number, displayedOnly = false): Promise<BadgeDisplay[]> {
    let query = `
      SELECT b.id, b.slug, b.name, b.description, b.icon, b.color,
             b.badge_type, b.tier_level, ub.granted_at, ub.is_displayed
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = $1 AND b.is_active = true
    `;

    if (displayedOnly) {
      query += ` AND ub.is_displayed = true`;
    }

    query += `
      AND (ub.expires_at IS NULL OR ub.expires_at > NOW())
      ORDER BY b.display_priority DESC, b.tier_level DESC
    `;

    const result = await dbAdapter.query(query, [userId], { schema: 'users' });
    return result.rows as BadgeDisplay[];
  }

  /**
   * Get badges for multiple users (for list views)
   */
  async getUsersBadges(userIds: number[]): Promise<Map<number, BadgeDisplay[]>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
      SELECT ub.user_id, b.id, b.slug, b.name, b.description, b.icon, b.color,
             b.badge_type, b.tier_level, ub.granted_at, ub.is_displayed
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id IN (${placeholders})
        AND b.is_active = true
        AND ub.is_displayed = true
        AND (ub.expires_at IS NULL OR ub.expires_at > NOW())
      ORDER BY b.display_priority DESC, b.tier_level DESC
    `;

    const result = await dbAdapter.query<BadgeDisplayWithUserId>(query, userIds, {
      schema: 'users',
    });

    const badgeMap = new Map<number, BadgeDisplay[]>();
    for (const row of result.rows) {
      const userId = row.user_id;
      if (!badgeMap.has(userId)) {
        badgeMap.set(userId, []);
      }
      // Extract only BadgeDisplay fields (excluding user_id)
      const { user_id, ...badgeDisplay } = row;
      badgeMap.get(userId)!.push(badgeDisplay);
    }

    return badgeMap;
  }

  /**
   * Check if a user has a specific badge
   */
  async userHasBadge(userId: number, badgeSlug: string): Promise<boolean> {
    const result = await dbAdapter.query(
      `SELECT 1 FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND b.slug = $2
         AND (ub.expires_at IS NULL OR ub.expires_at > NOW())`,
      [userId, badgeSlug],
      { schema: 'users' }
    );
    return result.rows.length > 0;
  }

  /**
   * Check if a user has any supporter badge
   */
  async userHasAnySupporterBadge(userId: number): Promise<boolean> {
    const result = await dbAdapter.query(
      `SELECT 1 FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1 AND b.badge_type = 'supporter'
         AND b.is_active = true
         AND (ub.expires_at IS NULL OR ub.expires_at > NOW())
       LIMIT 1`,
      [userId],
      { schema: 'users' }
    );
    return result.rows.length > 0;
  }

  /**
   * Grant a badge to a user
   */
  async grantBadge(data: GrantBadgeData): Promise<UserBadge> {
    const result = await dbAdapter.query(
      `INSERT INTO user_badges (user_id, badge_id, granted_by, expires_at, quantity, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, badge_id) DO UPDATE SET
         quantity = user_badges.quantity + EXCLUDED.quantity,
         updated_at = NOW()
       RETURNING id, user_id, badge_id, granted_at, granted_by, expires_at,
                 quantity, is_displayed, notes, created_at, updated_at`,
      [
        data.user_id,
        data.badge_id,
        data.granted_by || null,
        data.expires_at || null,
        data.quantity || 1,
        data.notes || null,
      ],
      { schema: 'users' }
    );
    return result.rows[0] as UserBadge;
  }

  /**
   * Grant a badge by slug
   */
  async grantBadgeBySlug(
    userId: number,
    badgeSlug: string,
    grantedBy?: number,
    notes?: string
  ): Promise<UserBadge | null> {
    const badge = await this.getBadgeBySlug(badgeSlug);
    if (!badge) {
      return null;
    }

    return this.grantBadge({
      user_id: userId,
      badge_id: badge.id,
      granted_by: grantedBy,
      notes,
    });
  }

  /**
   * Revoke a badge from a user
   */
  async revokeBadge(userId: number, badgeId: number): Promise<boolean> {
    const result = await dbAdapter.query(
      `DELETE FROM user_badges WHERE user_id = $1 AND badge_id = $2`,
      [userId, badgeId],
      { schema: 'users' }
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Revoke a badge by slug
   */
  async revokeBadgeBySlug(userId: number, badgeSlug: string): Promise<boolean> {
    const badge = await this.getBadgeBySlug(badgeSlug);
    if (!badge) {
      return false;
    }
    return this.revokeBadge(userId, badge.id);
  }

  /**
   * Update badge display preference
   */
  async setBadgeDisplayed(userId: number, badgeId: number, isDisplayed: boolean): Promise<boolean> {
    const result = await dbAdapter.query(
      `UPDATE user_badges SET is_displayed = $1, updated_at = NOW()
       WHERE user_id = $2 AND badge_id = $3`,
      [isDisplayed, userId, badgeId],
      { schema: 'users' }
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Donation Badge Integration ====================

  /**
   * Update supporter badge based on cumulative donation amount
   * This should be called after a donation is processed
   */
  async updateSupporterBadgeForDonation(
    userId: number,
    totalDonationAmount: number
  ): Promise<Badge | null> {
    const tier = getSupporterTierForAmount(totalDonationAmount);
    if (!tier) {
      return null;
    }

    // Get the badge for this tier
    const badge = await this.getBadgeBySlug(tier.slug);
    if (!badge) {
      return null;
    }

    // Check if user already has this badge
    const hasBadge = await this.userHasBadge(userId, tier.slug);
    if (hasBadge) {
      return badge; // Already has the badge
    }

    // Revoke all lower tier supporter badges first
    const lowerTiers = SUPPORTER_TIERS.filter(t => t.minAmount < tier.minAmount);
    for (const lowerTier of lowerTiers) {
      await this.revokeBadgeBySlug(userId, lowerTier.slug);
    }

    // Grant the new badge (automatic grant, so no granted_by)
    await this.grantBadge({
      user_id: userId,
      badge_id: badge.id,
      notes: `Automatic grant for cumulative donation of $${totalDonationAmount.toFixed(2)}`,
    });

    return badge;
  }

  /**
   * Get the supporter badge a user would qualify for based on amount
   */
  async getQualifyingSupporterBadge(amount: number): Promise<Badge | null> {
    const tier = getSupporterTierForAmount(amount);
    if (!tier) {
      return null;
    }
    return this.getBadgeBySlug(tier.slug);
  }

  // ==================== Admin Operations ====================

  /**
   * Get all users with a specific badge
   */
  async getUsersWithBadge(badgeId: number): Promise<{ user_id: number; granted_at: string }[]> {
    const result = await dbAdapter.query(
      `SELECT user_id, granted_at FROM user_badges
       WHERE badge_id = $1
       ORDER BY granted_at DESC`,
      [badgeId],
      { schema: 'users' }
    );
    return result.rows as { user_id: number; granted_at: string }[];
  }

  /**
   * Bulk grant badges to multiple users
   */
  async bulkGrantBadge(
    userIds: number[],
    badgeId: number,
    grantedBy: number,
    notes?: string
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    let granted = 0;
    for (const userId of userIds) {
      try {
        await this.grantBadge({
          user_id: userId,
          badge_id: badgeId,
          granted_by: grantedBy,
          notes,
        });
        granted++;
      } catch (error) {
        // Ignore errors for individual grants (e.g., constraint violations)
        logger.error(`Failed to grant badge to user ${userId}:`, error);
      }
    }
    return granted;
  }

  /**
   * Get badge statistics
   */
  async getBadgeStats(): Promise<
    { badge_id: number; slug: string; name: string; count: number }[]
  > {
    const result = await dbAdapter.query(
      `SELECT b.id as badge_id, b.slug, b.name, COUNT(ub.id) as count
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id
       WHERE b.is_active = true
       GROUP BY b.id, b.slug, b.name
       ORDER BY count DESC`,
      [],
      { schema: 'users' }
    );
    return result.rows as { badge_id: number; slug: string; name: string; count: number }[];
  }
}

// Export singleton instance
export const badgeService = new BadgeService();
