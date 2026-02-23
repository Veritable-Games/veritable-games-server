/**
 * Category Access Service
 *
 * Handles access control for forum categories based on:
 * - User roles (admin, moderator, developer, user)
 * - Specific badges (e.g., 'admiral' badge)
 * - Badge types (e.g., any 'supporter' badge)
 */

import { dbAdapter } from '@/lib/database/adapter';
import { badgeService } from '@/lib/badges/service';
import type { BadgeType } from '@/lib/badges/types';

/**
 * Access types for category restrictions
 */
export type AccessType = 'role' | 'badge' | 'badge_type';

/**
 * Permission levels for category access
 */
export type PermissionLevel = 'view' | 'post' | 'moderate';

/**
 * Category access rule from database
 */
export interface CategoryAccessRule {
  id: number;
  category_slug: string;
  access_type: AccessType;
  access_value: string;
  permission_level: PermissionLevel;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating a new access rule
 */
export interface CreateAccessRuleData {
  category_slug: string;
  access_type: AccessType;
  access_value: string;
  permission_level: PermissionLevel;
}

/**
 * User context for access checks
 */
export interface UserAccessContext {
  userId?: number;
  role?: string;
  badges?: { slug: string; badge_type: BadgeType }[];
}

export class CategoryAccessService {
  private schema = 'forums' as const;

  // ==================== Access Rule CRUD ====================

  /**
   * Get all access rules for a category
   */
  async getCategoryAccessRules(categorySlug: string): Promise<CategoryAccessRule[]> {
    const result = await dbAdapter.query<CategoryAccessRule>(
      `SELECT id, category_slug, access_type, access_value, permission_level, created_at, updated_at
       FROM category_access
       WHERE category_slug = $1
       ORDER BY permission_level DESC, access_type`,
      [categorySlug],
      { schema: this.schema }
    );
    return result.rows;
  }

  /**
   * Get all categories with access restrictions
   */
  async getRestrictedCategories(): Promise<string[]> {
    const result = await dbAdapter.query<{ category_slug: string }>(
      `SELECT DISTINCT category_slug FROM category_access`,
      [],
      { schema: this.schema }
    );
    return result.rows.map(r => r.category_slug);
  }

  /**
   * Add an access rule to a category
   */
  async addAccessRule(data: CreateAccessRuleData): Promise<CategoryAccessRule> {
    const result = await dbAdapter.query<CategoryAccessRule>(
      `INSERT INTO category_access (category_slug, access_type, access_value, permission_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (category_slug, access_type, access_value, permission_level) DO UPDATE SET
         updated_at = NOW()
       RETURNING id, category_slug, access_type, access_value, permission_level, created_at, updated_at`,
      [data.category_slug, data.access_type, data.access_value, data.permission_level],
      { schema: this.schema }
    );
    return result.rows[0] as CategoryAccessRule;
  }

  /**
   * Remove an access rule
   */
  async removeAccessRule(ruleId: number): Promise<boolean> {
    const result = await dbAdapter.query(`DELETE FROM category_access WHERE id = $1`, [ruleId], {
      schema: this.schema,
    });
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Remove all access rules for a category (make it public)
   */
  async removeAllAccessRules(categorySlug: string): Promise<number> {
    const result = await dbAdapter.query(
      `DELETE FROM category_access WHERE category_slug = $1`,
      [categorySlug],
      { schema: this.schema }
    );
    return result.rowCount ?? 0;
  }

  // ==================== Access Checking ====================

  /**
   * Check if a user has access to a category at a specific permission level
   */
  async userHasAccess(
    categorySlug: string,
    permissionLevel: PermissionLevel,
    userContext: UserAccessContext
  ): Promise<boolean> {
    // Get access rules for this category
    const rules = await this.getCategoryAccessRules(categorySlug);

    // If no rules, category is public
    if (rules.length === 0) {
      return true;
    }

    // Filter to rules that match or exceed the requested permission level
    const relevantRules = rules.filter(rule =>
      this.permissionLevelIncludes(rule.permission_level, permissionLevel)
    );

    if (relevantRules.length === 0) {
      // No rules grant this permission level - check if category has any view rules
      // If it has view rules but user doesn't match, deny access
      return false;
    }

    // Check each rule to see if user qualifies
    for (const rule of relevantRules) {
      if (await this.userMatchesRule(rule, userContext)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a permission level includes another
   * moderate > post > view
   */
  private permissionLevelIncludes(
    ruleLevel: PermissionLevel,
    requestedLevel: PermissionLevel
  ): boolean {
    const levels: Record<PermissionLevel, number> = {
      view: 1,
      post: 2,
      moderate: 3,
    };
    return levels[ruleLevel] >= levels[requestedLevel];
  }

  /**
   * Check if a user matches a specific access rule
   */
  private async userMatchesRule(
    rule: CategoryAccessRule,
    userContext: UserAccessContext
  ): Promise<boolean> {
    switch (rule.access_type) {
      case 'role':
        return this.userHasRole(userContext.role, rule.access_value);

      case 'badge':
        return this.userHasBadge(userContext, rule.access_value);

      case 'badge_type':
        return this.userHasBadgeType(userContext, rule.access_value as BadgeType);

      default:
        return false;
    }
  }

  /**
   * Check if user role matches or exceeds required role
   */
  private userHasRole(userRole: string | undefined, requiredRole: string): boolean {
    if (!userRole) return false;

    // Role hierarchy: admin > developer > moderator > user
    const roleHierarchy: Record<string, number> = {
      user: 0,
      moderator: 1,
      developer: 2,
      admin: 3,
    };

    const userLevel = roleHierarchy[userRole] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
  }

  /**
   * Check if user has a specific badge
   */
  private userHasBadge(userContext: UserAccessContext, badgeSlug: string): boolean {
    if (!userContext.badges || userContext.badges.length === 0) {
      return false;
    }
    return userContext.badges.some(b => b.slug === badgeSlug);
  }

  /**
   * Check if user has any badge of a specific type
   */
  private userHasBadgeType(userContext: UserAccessContext, badgeType: BadgeType): boolean {
    if (!userContext.badges || userContext.badges.length === 0) {
      return false;
    }
    return userContext.badges.some(b => b.badge_type === badgeType);
  }

  // ==================== Batch Access Checking ====================

  /**
   * Get list of accessible categories for a user
   * Returns category slugs the user can access at the given permission level
   */
  async getAccessibleCategories(
    permissionLevel: PermissionLevel,
    userContext: UserAccessContext
  ): Promise<Set<string>> {
    // Get all restricted categories
    const restrictedCategories = await this.getRestrictedCategories();

    // Get all categories user has access to
    const accessibleRestricted = new Set<string>();

    for (const categorySlug of restrictedCategories) {
      if (await this.userHasAccess(categorySlug, permissionLevel, userContext)) {
        accessibleRestricted.add(categorySlug);
      }
    }

    return accessibleRestricted;
  }

  /**
   * Filter a list of category slugs to only those the user can access
   */
  async filterAccessibleCategories(
    categorySlugs: string[],
    permissionLevel: PermissionLevel,
    userContext: UserAccessContext
  ): Promise<string[]> {
    const accessible: string[] = [];

    for (const slug of categorySlugs) {
      if (await this.userHasAccess(slug, permissionLevel, userContext)) {
        accessible.push(slug);
      }
    }

    return accessible;
  }

  // ==================== Helper Methods ====================

  /**
   * Build user context from user ID (fetches badges from database)
   */
  async buildUserContext(userId: number, role: string): Promise<UserAccessContext> {
    const badges = await badgeService.getUserBadges(userId, false);
    return {
      userId,
      role,
      badges: badges.map(b => ({ slug: b.slug, badge_type: b.badge_type })),
    };
  }

  /**
   * Check if category requires access control
   */
  async categoryIsRestricted(categorySlug: string): Promise<boolean> {
    const result = await dbAdapter.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM category_access WHERE category_slug = $1`,
      [categorySlug],
      { schema: this.schema }
    );
    return parseInt(result.rows[0]?.count ?? '0') > 0;
  }
}

// Export singleton instance
export const categoryAccessService = new CategoryAccessService();
