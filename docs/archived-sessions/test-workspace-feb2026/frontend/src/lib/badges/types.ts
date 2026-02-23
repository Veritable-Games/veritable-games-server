/**
 * Badge System Types
 *
 * Type definitions for the badge system including supporter badges,
 * achievement badges, and special recognition badges.
 */

/**
 * Badge type categories
 */
export type BadgeType = 'supporter' | 'achievement' | 'special';

/**
 * Supporter badge tier slugs
 */
export type SupporterTier = 'pioneer' | 'navigator' | 'voyager' | 'commander' | 'admiral';

/**
 * Badge definition from the database
 */
export interface Badge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  badge_type: BadgeType;
  tier_level: number;
  min_donation_amount: number | null;
  is_stackable: boolean;
  display_priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User badge assignment
 */
export interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  granted_at: string;
  granted_by: number | null;
  expires_at: string | null;
  quantity: number;
  is_displayed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User badge with full badge details (joined query result)
 */
export interface UserBadgeWithDetails extends UserBadge {
  badge: Badge;
}

/**
 * Badge for display in UI (simplified)
 */
export interface BadgeDisplay {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  badge_type: BadgeType;
  tier_level: number;
  granted_at?: string;
  is_displayed?: boolean;
}

/**
 * Badge display with user ID (for bulk queries)
 * Used when fetching badges for multiple users
 */
export interface BadgeDisplayWithUserId extends BadgeDisplay {
  user_id: number;
}

/**
 * Data for creating a new badge
 */
export interface CreateBadgeData {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  badge_type: BadgeType;
  tier_level?: number;
  min_donation_amount?: number;
  is_stackable?: boolean;
  display_priority?: number;
  is_active?: boolean;
}

/**
 * Data for updating a badge
 */
export interface UpdateBadgeData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  tier_level?: number;
  min_donation_amount?: number;
  is_stackable?: boolean;
  display_priority?: number;
  is_active?: boolean;
}

/**
 * Data for granting a badge to a user
 */
export interface GrantBadgeData {
  user_id: number;
  badge_id: number;
  granted_by?: number;
  expires_at?: string;
  quantity?: number;
  notes?: string;
}

/**
 * Supporter tier configuration
 */
export interface SupporterTierConfig {
  slug: SupporterTier;
  name: string;
  minAmount: number;
  color: string;
  icon: string;
  description: string;
}

/**
 * Supporter tier definitions
 */
export const SUPPORTER_TIERS: SupporterTierConfig[] = [
  {
    slug: 'pioneer',
    name: 'Pioneer',
    minAmount: 5,
    color: '#cd7f32', // Bronze
    icon: 'rocket',
    description: 'First step into the stars',
  },
  {
    slug: 'navigator',
    name: 'Navigator',
    minAmount: 25,
    color: '#c0c0c0', // Silver
    icon: 'compass',
    description: 'Charting new paths',
  },
  {
    slug: 'voyager',
    name: 'Voyager',
    minAmount: 100,
    color: '#ffd700', // Gold
    icon: 'globe',
    description: 'Seasoned explorer',
  },
  {
    slug: 'commander',
    name: 'Commander',
    minAmount: 500,
    color: '#e5e4e2', // Platinum
    icon: 'star',
    description: 'Leading the expedition',
  },
  {
    slug: 'admiral',
    name: 'Admiral',
    minAmount: 1000,
    color: '#b9f2ff', // Diamond
    icon: 'crown',
    description: 'Legendary contributor',
  },
];

/**
 * Get the supporter tier for a given donation amount
 */
export function getSupporterTierForAmount(amount: number): SupporterTierConfig | null {
  // Sort by minAmount descending to get highest qualifying tier
  const sortedTiers = [...SUPPORTER_TIERS].sort((a, b) => b.minAmount - a.minAmount);
  return sortedTiers.find(tier => amount >= tier.minAmount) || null;
}

/**
 * Check if a user has any supporter badge
 */
export function hasAnySupporterBadge(badges: BadgeDisplay[]): boolean {
  return badges.some(badge => badge.badge_type === 'supporter');
}

/**
 * Get the highest tier supporter badge from a list
 */
export function getHighestSupporterBadge(badges: BadgeDisplay[]): BadgeDisplay | null {
  const supporterBadges = badges.filter(b => b.badge_type === 'supporter');
  if (supporterBadges.length === 0) return null;

  return supporterBadges.reduce((highest, current) =>
    current.tier_level > highest.tier_level ? current : highest
  );
}

/**
 * Maximum number of badges to display inline
 */
export const MAX_INLINE_BADGES = 5;

/**
 * Badge icon mapping (for Lucide React icons)
 */
export const BADGE_ICONS: Record<string, string> = {
  rocket: 'Rocket',
  compass: 'Compass',
  globe: 'Globe',
  star: 'Star',
  crown: 'Crown',
  shield: 'Shield',
  clock: 'Clock',
  code: 'Code',
  trophy: 'Trophy',
  heart: 'Heart',
  zap: 'Zap',
  award: 'Award',
};
