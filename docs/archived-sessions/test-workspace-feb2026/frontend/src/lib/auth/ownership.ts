/**
 * Centralized Authorization Utilities
 *
 * Provides consistent ownership verification and role checking across the application.
 * Handles type inconsistencies (user_id as string/number) and provides clear error messages.
 *
 * @module auth/ownership
 */

import { PermissionError } from '@/lib/utils/api-errors';

/**
 * List of privileged roles that bypass ownership checks
 */
const PRIVILEGED_ROLES = ['admin', 'developer'] as const;

/**
 * Options for ownership verification
 */
export interface OwnershipOptions {
  /**
   * If true, admin/developer roles bypass ownership check
   * @default false
   */
  allowAdmin?: boolean;
}

/**
 * Entity with user_id (journal, category, etc.)
 */
export interface OwnedEntity {
  user_id: string | number | null | undefined;
}

/**
 * User object with id and optional role
 */
export interface UserIdentity {
  id: number;
  role?: string;
}

/**
 * Normalize user_id to string for comparison
 * Handles string, number, null, and undefined consistently
 *
 * @param userId - User ID in any format
 * @returns Normalized string ID or null
 *
 * @example
 * normalizeUserId(123) // "123"
 * normalizeUserId("456") // "456"
 * normalizeUserId(null) // null
 */
function normalizeUserId(userId: string | number | null | undefined): string | null {
  if (userId === null || userId === undefined) {
    return null;
  }
  return String(userId).trim();
}

/**
 * Check if user has a privileged role (admin/developer)
 *
 * @param userRole - User role string
 * @returns True if user is admin or developer
 *
 * @example
 * verifyAdminRole('admin') // true
 * verifyAdminRole('developer') // true
 * verifyAdminRole('user') // false
 */
export function verifyAdminRole(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return PRIVILEGED_ROLES.includes(userRole as (typeof PRIVILEGED_ROLES)[number]);
}

/**
 * Check if user owns an entity (journal, category, etc.)
 * Handles type inconsistencies between string and number user_id
 *
 * @param entity - Entity with user_id property
 * @param user - User object with id and optional role
 * @param options - Ownership verification options
 * @returns True if user owns entity or has admin privileges
 *
 * @example
 * const journal = { user_id: "123" };
 * const user = { id: 123, role: "user" };
 * verifyJournalOwnership(journal, user) // true
 *
 * @example
 * const journal = { user_id: "456" };
 * const admin = { id: 123, role: "admin" };
 * verifyJournalOwnership(journal, admin, { allowAdmin: true }) // true
 */
export function verifyJournalOwnership(
  entity: OwnedEntity,
  user: UserIdentity,
  options: OwnershipOptions = {}
): boolean {
  // Admin bypass if enabled
  if (options.allowAdmin && verifyAdminRole(user.role)) {
    return true;
  }

  // NULL user_id: allow (system-created entities)
  const normalizedEntityUserId = normalizeUserId(entity.user_id);
  if (normalizedEntityUserId === null) {
    return true;
  }

  // Compare normalized IDs
  const normalizedUserId = normalizeUserId(user.id);
  return normalizedEntityUserId === normalizedUserId;
}

/**
 * Assert user owns an entity, throw PermissionError if not
 * Convenience wrapper around verifyJournalOwnership for API routes
 *
 * @param entity - Entity with user_id property
 * @param user - User object with id and optional role
 * @param options - Ownership verification options
 * @throws {PermissionError} If user doesn't own entity and isn't admin
 *
 * @example
 * const journal = { user_id: "456" };
 * const user = { id: 123 };
 * assertJournalOwnership(journal, user); // throws PermissionError
 */
export function assertJournalOwnership(
  entity: OwnedEntity,
  user: UserIdentity,
  options: OwnershipOptions = {}
): void {
  if (!verifyJournalOwnership(entity, user, options)) {
    throw new PermissionError('You do not have permission to access this resource');
  }
}

/**
 * Assert user has admin role, throw PermissionError if not
 * Convenience wrapper for checking admin privileges in API routes
 *
 * @param userRole - User role string
 * @throws {PermissionError} If user is not admin or developer
 *
 * @example
 * assertAdminRole('user'); // throws PermissionError
 * assertAdminRole('admin'); // passes
 */
export function assertAdminRole(userRole: string | undefined): void {
  if (!verifyAdminRole(userRole)) {
    throw new PermissionError('Only admins can perform this action');
  }
}

/**
 * Check if all entities in array are owned by user
 * Useful for bulk operations
 *
 * @param entities - Array of entities with user_id
 * @param user - User object with id and optional role
 * @param options - Ownership verification options
 * @returns Object with { authorized: boolean, unauthorized: Entity[] }
 *
 * @example
 * const journals = [{ id: 1, user_id: "123" }, { id: 2, user_id: "456" }];
 * const user = { id: 123 };
 * const result = verifyBulkOwnership(journals, user);
 * // result.authorized = false
 * // result.unauthorized = [{ id: 2, user_id: "456" }]
 */
export function verifyBulkOwnership<T extends OwnedEntity>(
  entities: T[],
  user: UserIdentity,
  options: OwnershipOptions = {}
): {
  authorized: boolean;
  unauthorized: T[];
} {
  const unauthorized = entities.filter(entity => !verifyJournalOwnership(entity, user, options));

  return {
    authorized: unauthorized.length === 0,
    unauthorized,
  };
}

/**
 * Assert all entities are owned by user, throw PermissionError if not
 * Convenience wrapper for bulk operations in API routes
 *
 * @param entities - Array of entities with user_id
 * @param user - User object with id and optional role
 * @param options - Ownership verification options
 * @throws {PermissionError} If any entity is not owned by user
 *
 * @example
 * const journals = [{ user_id: "123" }, { user_id: "456" }];
 * const user = { id: 123 };
 * assertBulkOwnership(journals, user); // throws PermissionError
 */
export function assertBulkOwnership<T extends OwnedEntity>(
  entities: T[],
  user: UserIdentity,
  options: OwnershipOptions = {}
): void {
  const result = verifyBulkOwnership(entities, user, options);

  if (!result.authorized) {
    throw new PermissionError(
      `You do not have permission to access ${result.unauthorized.length} of ${entities.length} resource(s)`
    );
  }
}
