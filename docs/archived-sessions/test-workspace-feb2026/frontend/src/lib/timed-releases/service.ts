/**
 * Timed Release Service
 *
 * Manages early access content for supporters.
 * Allows content creators to schedule content with supporter-only early access
 * before public release.
 */

import { dbAdapter } from '@/lib/database/adapter';
import { badgeService } from '@/lib/badges/service';
import { SUPPORTER_TIERS, type SupporterTier } from '@/lib/badges/types';
import type {
  TimedRelease,
  CreateTimedReleaseData,
  UpdateTimedReleaseData,
  TimedReleaseEntityType,
  TimedReleaseUserContext,
  AccessCheckResult,
  ReleaseAccessStatus,
  TimedReleaseWithStatus,
} from './types';

/**
 * Tier hierarchy for access comparison
 * Higher number = higher tier
 */
const TIER_HIERARCHY: Record<SupporterTier, number> = {
  pioneer: 1,
  navigator: 2,
  voyager: 3,
  commander: 4,
  admiral: 5,
};

export class TimedReleaseService {
  private schema = 'content' as const;

  // ==================== CRUD Operations ====================

  /**
   * Create a new timed release
   */
  async createTimedRelease(data: CreateTimedReleaseData): Promise<TimedRelease> {
    const result = await dbAdapter.query<TimedRelease>(
      `INSERT INTO timed_releases (
        entity_type, entity_id, early_access_days,
        supporter_release_at, public_release_at,
        min_supporter_tier, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.entity_type,
        data.entity_id,
        data.early_access_days ?? 3,
        data.supporter_release_at.toISOString(),
        data.public_release_at.toISOString(),
        data.min_supporter_tier ?? 'pioneer',
        data.created_by ?? null,
      ],
      { schema: this.schema }
    );
    return result.rows[0] as TimedRelease;
  }

  /**
   * Get a timed release by ID
   */
  async getTimedReleaseById(id: number): Promise<TimedRelease | null> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases WHERE id = $1`,
      [id],
      { schema: this.schema }
    );
    return (result.rows[0] as TimedRelease) || null;
  }

  /**
   * Get a timed release for a specific entity
   */
  async getTimedReleaseForEntity(
    entityType: TimedReleaseEntityType,
    entityId: number
  ): Promise<TimedRelease | null> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases
       WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
      { schema: this.schema }
    );
    return (result.rows[0] as TimedRelease) || null;
  }

  /**
   * Update a timed release
   */
  async updateTimedRelease(id: number, data: UpdateTimedReleaseData): Promise<TimedRelease | null> {
    const updates: string[] = ['updated_at = NOW()'];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (data.early_access_days !== undefined) {
      updates.push(`early_access_days = $${paramIndex++}`);
      values.push(data.early_access_days);
    }
    if (data.supporter_release_at !== undefined) {
      updates.push(`supporter_release_at = $${paramIndex++}`);
      values.push(data.supporter_release_at.toISOString());
    }
    if (data.public_release_at !== undefined) {
      updates.push(`public_release_at = $${paramIndex++}`);
      values.push(data.public_release_at.toISOString());
    }
    if (data.min_supporter_tier !== undefined) {
      updates.push(`min_supporter_tier = $${paramIndex++}`);
      values.push(data.min_supporter_tier);
    }

    if (values.length === 0) {
      return this.getTimedReleaseById(id);
    }

    values.push(id);
    const result = await dbAdapter.query<TimedRelease>(
      `UPDATE timed_releases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
      { schema: this.schema }
    );
    return (result.rows[0] as TimedRelease) || null;
  }

  /**
   * Delete a timed release
   */
  async deleteTimedRelease(id: number): Promise<boolean> {
    const result = await dbAdapter.query(`DELETE FROM timed_releases WHERE id = $1`, [id], {
      schema: this.schema,
    });
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete timed release for a specific entity
   */
  async deleteTimedReleaseForEntity(
    entityType: TimedReleaseEntityType,
    entityId: number
  ): Promise<boolean> {
    const result = await dbAdapter.query(
      `DELETE FROM timed_releases WHERE entity_type = $1 AND entity_id = $2`,
      [entityType, entityId],
      { schema: this.schema }
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Access Checking ====================

  /**
   * Check if a user can access a timed release entity
   */
  async checkAccess(
    entityType: TimedReleaseEntityType,
    entityId: number,
    userContext: TimedReleaseUserContext
  ): Promise<AccessCheckResult> {
    // Admins always have access
    if (userContext.isAdmin) {
      return {
        canAccess: true,
        status: 'public',
        reason: 'Admin access',
      };
    }

    // Check if this entity has a timed release
    const release = await this.getTimedReleaseForEntity(entityType, entityId);

    // No timed release = public content
    if (!release) {
      return {
        canAccess: true,
        status: 'public',
        reason: 'No timed release configured',
      };
    }

    const now = new Date();
    const supporterReleaseAt = new Date(release.supporter_release_at);
    const publicReleaseAt = new Date(release.public_release_at);
    const daysUntilPublic = Math.ceil(
      (publicReleaseAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check public release first
    if (now >= publicReleaseAt) {
      return {
        canAccess: true,
        status: 'public',
        releaseInfo: {
          supporterReleaseAt,
          publicReleaseAt,
          minTier: release.min_supporter_tier as SupporterTier,
          daysUntilPublic: 0,
        },
      };
    }

    // Check supporter early access
    if (now >= supporterReleaseAt) {
      // User needs to be a supporter with sufficient tier
      if (userContext.supporterTier) {
        const userTierLevel = TIER_HIERARCHY[userContext.supporterTier] ?? 0;
        const requiredTierLevel = TIER_HIERARCHY[release.min_supporter_tier as SupporterTier] ?? 0;

        if (userTierLevel >= requiredTierLevel) {
          return {
            canAccess: true,
            status: 'early_access',
            releaseInfo: {
              supporterReleaseAt,
              publicReleaseAt,
              minTier: release.min_supporter_tier as SupporterTier,
              daysUntilPublic,
            },
          };
        }
      }

      // Supporter access period but user doesn't qualify
      return {
        canAccess: false,
        status: 'early_access',
        releaseInfo: {
          supporterReleaseAt,
          publicReleaseAt,
          minTier: release.min_supporter_tier as SupporterTier,
          daysUntilPublic,
        },
        reason: `Requires ${release.min_supporter_tier} tier or higher`,
      };
    }

    // Not yet released to anyone
    return {
      canAccess: false,
      status: 'unreleased',
      releaseInfo: {
        supporterReleaseAt,
        publicReleaseAt,
        minTier: release.min_supporter_tier as SupporterTier,
        daysUntilPublic,
      },
      reason: 'Content not yet released',
    };
  }

  /**
   * Build user context from user ID (fetches supporter tier)
   */
  async buildUserContext(
    userId: number | undefined,
    isAdmin: boolean = false
  ): Promise<TimedReleaseUserContext> {
    if (!userId) {
      return { isAdmin };
    }

    const badges = await badgeService.getUserBadges(userId, false);
    const supporterBadge = badges
      .filter(b => b.badge_type === 'supporter')
      .sort((a, b) => b.tier_level - a.tier_level)[0];

    return {
      userId,
      supporterTier: supporterBadge?.slug as SupporterTier | undefined,
      isAdmin,
    };
  }

  // ==================== Listing & Filtering ====================

  /**
   * Get all timed releases
   */
  async getAllTimedReleases(): Promise<TimedRelease[]> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases ORDER BY public_release_at ASC`,
      [],
      { schema: this.schema }
    );
    return result.rows as TimedRelease[];
  }

  /**
   * Get upcoming timed releases (not yet public)
   */
  async getUpcomingReleases(): Promise<TimedReleaseWithStatus[]> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases
       WHERE public_release_at > NOW()
       ORDER BY public_release_at ASC`,
      [],
      { schema: this.schema }
    );

    return (result.rows as TimedRelease[]).map(release => this.addStatusToRelease(release));
  }

  /**
   * Get releases currently in early access (supporter period)
   */
  async getEarlyAccessReleases(): Promise<TimedReleaseWithStatus[]> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases
       WHERE supporter_release_at <= NOW() AND public_release_at > NOW()
       ORDER BY public_release_at ASC`,
      [],
      { schema: this.schema }
    );

    return (result.rows as TimedRelease[]).map(release => this.addStatusToRelease(release));
  }

  /**
   * Get releases by entity type
   */
  async getReleasesByEntityType(
    entityType: TimedReleaseEntityType
  ): Promise<TimedReleaseWithStatus[]> {
    const result = await dbAdapter.query<TimedRelease>(
      `SELECT * FROM timed_releases
       WHERE entity_type = $1
       ORDER BY public_release_at ASC`,
      [entityType],
      { schema: this.schema }
    );

    return (result.rows as TimedRelease[]).map(release => this.addStatusToRelease(release));
  }

  /**
   * Get entity IDs the user can access for a given type
   */
  async getAccessibleEntityIds(
    entityType: TimedReleaseEntityType,
    userContext: TimedReleaseUserContext
  ): Promise<{ accessible: number[]; earlyAccess: number[] }> {
    // Get all timed releases for this entity type
    const releases = await this.getReleasesByEntityType(entityType);

    const accessible: number[] = [];
    const earlyAccess: number[] = [];

    for (const release of releases) {
      const access = await this.checkAccess(entityType, release.entity_id, userContext);
      if (access.canAccess) {
        accessible.push(release.entity_id);
        if (access.status === 'early_access') {
          earlyAccess.push(release.entity_id);
        }
      }
    }

    return { accessible, earlyAccess };
  }

  // ==================== Helpers ====================

  /**
   * Add status information to a release
   */
  private addStatusToRelease(release: TimedRelease): TimedReleaseWithStatus {
    const now = new Date();
    const supporterReleaseAt = new Date(release.supporter_release_at);
    const publicReleaseAt = new Date(release.public_release_at);
    const daysUntilPublic = Math.ceil(
      (publicReleaseAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    let accessStatus: ReleaseAccessStatus;
    if (now >= publicReleaseAt) {
      accessStatus = 'public';
    } else if (now >= supporterReleaseAt) {
      accessStatus = 'early_access';
    } else {
      accessStatus = 'unreleased';
    }

    return {
      ...release,
      accessStatus,
      daysUntilPublic: Math.max(0, daysUntilPublic),
    };
  }

  /**
   * Create a timed release with automatic date calculation
   */
  async createWithEarlyAccessDays(
    entityType: TimedReleaseEntityType,
    entityId: number,
    publicReleaseAt: Date,
    earlyAccessDays: number = 3,
    minSupporterTier: SupporterTier = 'pioneer',
    createdBy?: number
  ): Promise<TimedRelease> {
    const supporterReleaseAt = new Date(publicReleaseAt);
    supporterReleaseAt.setDate(supporterReleaseAt.getDate() - earlyAccessDays);

    return this.createTimedRelease({
      entity_type: entityType,
      entity_id: entityId,
      early_access_days: earlyAccessDays,
      supporter_release_at: supporterReleaseAt,
      public_release_at: publicReleaseAt,
      min_supporter_tier: minSupporterTier,
      created_by: createdBy,
    });
  }

  /**
   * Get tier configuration
   */
  getTierConfig(tier: SupporterTier) {
    return SUPPORTER_TIERS.find(t => t.slug === tier);
  }

  /**
   * Get all tier options for UI
   */
  getAllTiers() {
    return SUPPORTER_TIERS;
  }
}

// Export singleton instance
export const timedReleaseService = new TimedReleaseService();
