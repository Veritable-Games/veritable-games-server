/**
 * Timed Releases Types
 *
 * Type definitions for the supporter early access system.
 */

import type { SupporterTier } from '@/lib/badges/types';

/**
 * Entity types that can have timed releases
 */
export type TimedReleaseEntityType = 'topic' | 'news' | 'project_update';

/**
 * Access status for a timed release
 */
export type ReleaseAccessStatus =
  | 'unreleased' // Not yet available to anyone
  | 'early_access' // Available to supporters only
  | 'public'; // Available to everyone

/**
 * Timed release record from database
 */
export interface TimedRelease {
  id: number;
  entity_type: TimedReleaseEntityType;
  entity_id: number;
  early_access_days: number;
  supporter_release_at: string;
  public_release_at: string;
  min_supporter_tier: SupporterTier;
  created_at: string;
  updated_at: string;
  created_by: number | null;
}

/**
 * Data for creating a new timed release
 */
export interface CreateTimedReleaseData {
  entity_type: TimedReleaseEntityType;
  entity_id: number;
  early_access_days?: number;
  supporter_release_at: Date;
  public_release_at: Date;
  min_supporter_tier?: SupporterTier;
  created_by?: number;
}

/**
 * Data for updating a timed release
 */
export interface UpdateTimedReleaseData {
  early_access_days?: number;
  supporter_release_at?: Date;
  public_release_at?: Date;
  min_supporter_tier?: SupporterTier;
}

/**
 * User context for access checks
 */
export interface TimedReleaseUserContext {
  userId?: number;
  supporterTier?: SupporterTier | null;
  isAdmin?: boolean;
}

/**
 * Access check result with details
 */
export interface AccessCheckResult {
  canAccess: boolean;
  status: ReleaseAccessStatus;
  releaseInfo?: {
    supporterReleaseAt: Date;
    publicReleaseAt: Date;
    minTier: SupporterTier;
    daysUntilPublic: number;
  };
  reason?: string;
}

/**
 * Timed release with access status
 */
export interface TimedReleaseWithStatus extends TimedRelease {
  accessStatus: ReleaseAccessStatus;
  daysUntilPublic: number;
}
