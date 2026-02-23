/**
 * Permission System Types
 *
 * Comprehensive permission system for forum moderation and access control.
 * Supports role-based permissions with special case handling for locked topics,
 * banned users, and category-level moderation.
 */

import type { UserId, TopicId, ReplyId, CategoryId } from '@/lib/database/schema-types';
import type { User } from '@/lib/users/types';

/**
 * Permission Enum
 * Defines all possible permissions across forums, wiki, workspace, and users
 */
export enum Permission {
  // ===== Forum Permissions =====
  // View permissions
  FORUM_VIEW_CATEGORY = 'forum:view:category',
  FORUM_VIEW_PRIVATE_CATEGORY = 'forum:view:private-category',

  // Topic permissions
  FORUM_CREATE_TOPIC = 'forum:create:topic',
  FORUM_EDIT_OWN_TOPIC = 'forum:edit:own-topic',
  FORUM_EDIT_ANY_TOPIC = 'forum:edit:any-topic',
  FORUM_DELETE_OWN_TOPIC = 'forum:delete:own-topic',
  FORUM_DELETE_ANY_TOPIC = 'forum:delete:any-topic',

  // Reply permissions
  FORUM_REPLY_TO_TOPIC = 'forum:reply:topic',
  FORUM_EDIT_OWN_REPLY = 'forum:edit:own-reply',
  FORUM_EDIT_ANY_REPLY = 'forum:edit:any-reply',
  FORUM_DELETE_OWN_REPLY = 'forum:delete:own-reply',
  FORUM_DELETE_ANY_REPLY = 'forum:delete:any-reply',

  // Moderation permissions
  FORUM_PIN_TOPIC = 'forum:moderate:pin',
  FORUM_LOCK_TOPIC = 'forum:moderate:lock',
  FORUM_MODERATE = 'forum:moderate:general',
  FORUM_BAN_USER = 'forum:moderate:ban',
  FORUM_MANAGE_CATEGORIES = 'forum:manage:categories',
  FORUM_MANAGE_TAGS = 'forum:manage:tags',

  // Special permissions
  FORUM_VIEW_DELETED = 'forum:view:deleted',
  FORUM_BYPASS_RATE_LIMIT = 'forum:bypass:rate-limit',
  FORUM_MARK_SOLUTION = 'forum:mark:solution',

  // ===== Wiki Permissions =====
  WIKI_VIEW = 'wiki:view',
  WIKI_EDIT_ANY = 'wiki:edit:any',
  WIKI_CREATE = 'wiki:create',
  WIKI_DELETE = 'wiki:delete',
  WIKI_SET_PROTECTION = 'wiki:protection:set',

  // ===== Workspace Permissions =====
  WORKSPACE_VIEW = 'workspace:view',
  WORKSPACE_EDIT_NODE = 'workspace:edit:node',
  WORKSPACE_CREATE_NODE = 'workspace:create:node',
  WORKSPACE_DELETE_NODE = 'workspace:delete:node',
  WORKSPACE_MANAGE_CONNECTIONS = 'workspace:manage:connections',
  WORKSPACE_FULL_ACCESS = 'workspace:full-access',

  // ===== User Management Permissions =====
  USERS_VIEW_PROFILES = 'users:view:profiles',
  USERS_BAN = 'users:ban',
  USERS_DELETE = 'users:delete',
}

/**
 * Role hierarchy levels
 * Higher level = more permissions
 */
export const ROLE_HIERARCHY: Record<User['role'], number> = {
  user: 0,
  moderator: 1,
  developer: 2,
  admin: 3,
};

/**
 * Check if a role has at least the required level
 */
export function hasMinimumRole(userRole: User['role'], requiredRole: User['role']): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if a role is exactly the specified role
 */
export function isRole(userRole: User['role'], role: User['role']): boolean {
  return userRole === role;
}

/**
 * Check if a role is admin or developer (common check for workspace/wiki access)
 */
export function isDeveloperOrAbove(role: User['role']): boolean {
  return hasMinimumRole(role, 'developer');
}

/**
 * Check if a role is moderator or above
 */
export function isModeratorOrAbove(role: User['role']): boolean {
  return hasMinimumRole(role, 'moderator');
}

/**
 * Role-based permission mapping
 * Each role has a set of permissions they can perform
 * Hierarchy: user (0) → moderator (1) → developer (2) → admin (3)
 */
export const RolePermissions: Record<User['role'], Permission[]> = {
  admin: [
    // Admins have ALL permissions
    // Forum
    Permission.FORUM_VIEW_CATEGORY,
    Permission.FORUM_VIEW_PRIVATE_CATEGORY,
    Permission.FORUM_CREATE_TOPIC,
    Permission.FORUM_EDIT_OWN_TOPIC,
    Permission.FORUM_EDIT_ANY_TOPIC,
    Permission.FORUM_DELETE_OWN_TOPIC,
    Permission.FORUM_DELETE_ANY_TOPIC,
    Permission.FORUM_REPLY_TO_TOPIC,
    Permission.FORUM_EDIT_OWN_REPLY,
    Permission.FORUM_EDIT_ANY_REPLY,
    Permission.FORUM_DELETE_OWN_REPLY,
    Permission.FORUM_DELETE_ANY_REPLY,
    Permission.FORUM_PIN_TOPIC,
    Permission.FORUM_LOCK_TOPIC,
    Permission.FORUM_MODERATE,
    Permission.FORUM_BAN_USER,
    Permission.FORUM_MANAGE_CATEGORIES,
    Permission.FORUM_MANAGE_TAGS,
    Permission.FORUM_VIEW_DELETED,
    Permission.FORUM_BYPASS_RATE_LIMIT,
    Permission.FORUM_MARK_SOLUTION,
    // Wiki
    Permission.WIKI_VIEW,
    Permission.WIKI_EDIT_ANY,
    Permission.WIKI_CREATE,
    Permission.WIKI_DELETE,
    Permission.WIKI_SET_PROTECTION,
    // Workspace
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_EDIT_NODE,
    Permission.WORKSPACE_CREATE_NODE,
    Permission.WORKSPACE_DELETE_NODE,
    Permission.WORKSPACE_MANAGE_CONNECTIONS,
    Permission.WORKSPACE_FULL_ACCESS,
    // Users
    Permission.USERS_VIEW_PROFILES,
    Permission.USERS_BAN,
    Permission.USERS_DELETE,
  ],
  developer: [
    // Developers: forum same as moderator, full workspace, wiki create/delete
    // Forum (same as moderator)
    Permission.FORUM_VIEW_CATEGORY,
    Permission.FORUM_VIEW_PRIVATE_CATEGORY,
    Permission.FORUM_CREATE_TOPIC,
    Permission.FORUM_EDIT_OWN_TOPIC,
    Permission.FORUM_EDIT_ANY_TOPIC,
    Permission.FORUM_DELETE_OWN_TOPIC,
    Permission.FORUM_DELETE_ANY_TOPIC,
    Permission.FORUM_REPLY_TO_TOPIC,
    Permission.FORUM_EDIT_OWN_REPLY,
    Permission.FORUM_EDIT_ANY_REPLY,
    Permission.FORUM_DELETE_OWN_REPLY,
    Permission.FORUM_DELETE_ANY_REPLY,
    Permission.FORUM_PIN_TOPIC,
    Permission.FORUM_LOCK_TOPIC,
    Permission.FORUM_MODERATE,
    Permission.FORUM_BAN_USER,
    Permission.FORUM_VIEW_DELETED,
    Permission.FORUM_BYPASS_RATE_LIMIT,
    Permission.FORUM_MARK_SOLUTION,
    // Wiki (full access except protection)
    Permission.WIKI_VIEW,
    Permission.WIKI_EDIT_ANY,
    Permission.WIKI_CREATE,
    Permission.WIKI_DELETE,
    // Workspace (full access)
    Permission.WORKSPACE_VIEW,
    Permission.WORKSPACE_EDIT_NODE,
    Permission.WORKSPACE_CREATE_NODE,
    Permission.WORKSPACE_DELETE_NODE,
    Permission.WORKSPACE_MANAGE_CONNECTIONS,
    Permission.WORKSPACE_FULL_ACCESS,
    // Users
    Permission.USERS_VIEW_PROFILES,
    Permission.USERS_BAN,
  ],
  moderator: [
    // Moderators: forum moderation, wiki edit, no workspace edit
    // Forum
    Permission.FORUM_VIEW_CATEGORY,
    Permission.FORUM_VIEW_PRIVATE_CATEGORY,
    Permission.FORUM_CREATE_TOPIC,
    Permission.FORUM_EDIT_OWN_TOPIC,
    Permission.FORUM_EDIT_ANY_TOPIC,
    Permission.FORUM_DELETE_OWN_TOPIC,
    Permission.FORUM_DELETE_ANY_TOPIC,
    Permission.FORUM_REPLY_TO_TOPIC,
    Permission.FORUM_EDIT_OWN_REPLY,
    Permission.FORUM_EDIT_ANY_REPLY,
    Permission.FORUM_DELETE_OWN_REPLY,
    Permission.FORUM_DELETE_ANY_REPLY,
    Permission.FORUM_PIN_TOPIC,
    Permission.FORUM_LOCK_TOPIC,
    Permission.FORUM_MODERATE,
    Permission.FORUM_BAN_USER,
    Permission.FORUM_VIEW_DELETED,
    Permission.FORUM_BYPASS_RATE_LIMIT,
    Permission.FORUM_MARK_SOLUTION,
    // Wiki (edit only)
    Permission.WIKI_VIEW,
    Permission.WIKI_EDIT_ANY,
    // Workspace (view only)
    Permission.WORKSPACE_VIEW,
    // Users
    Permission.USERS_VIEW_PROFILES,
    Permission.USERS_BAN,
  ],
  user: [
    // Regular users: basic forum, wiki view, workspace view
    // Forum
    Permission.FORUM_VIEW_CATEGORY,
    Permission.FORUM_CREATE_TOPIC,
    Permission.FORUM_EDIT_OWN_TOPIC,
    Permission.FORUM_DELETE_OWN_TOPIC,
    Permission.FORUM_REPLY_TO_TOPIC,
    Permission.FORUM_EDIT_OWN_REPLY,
    Permission.FORUM_DELETE_OWN_REPLY,
    Permission.FORUM_MARK_SOLUTION,
    // Wiki (view only)
    Permission.WIKI_VIEW,
    // Workspace (view only)
    Permission.WORKSPACE_VIEW,
    // Users
    Permission.USERS_VIEW_PROFILES,
  ],
};

/**
 * Permission context for contextual permission checks
 * Provides additional information for permission evaluation
 */
export interface PermissionContext {
  // Topic context
  topicId?: TopicId;
  topicUserId?: UserId;
  topicIsLocked?: boolean;
  topicIsPinned?: boolean;

  // Reply context
  replyId?: ReplyId;
  replyUserId?: UserId;
  replyTopicId?: TopicId;

  // Category context
  categoryId?: CategoryId;
  categoryIsPrivate?: boolean;

  // User context
  isOwner?: boolean;
  isBanned?: boolean;

  // Additional metadata
  metadata?: Record<string, unknown>;
}

/**
 * Permission check result with detailed information
 */
export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  context?: PermissionContext;
}

/**
 * Permission error types
 */
export enum PermissionErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  USER_BANNED = 'USER_BANNED',
  TOPIC_LOCKED = 'TOPIC_LOCKED',
  NOT_OWNER = 'NOT_OWNER',
  INVALID_CONTEXT = 'INVALID_CONTEXT',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Permission error class
 */
export class PermissionError extends Error {
  constructor(
    public code: PermissionErrorCode,
    message: string,
    public context?: PermissionContext
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Cache key for permission checks
 */
export interface PermissionCacheKey {
  userId: UserId;
  permission: Permission;
  contextHash?: string;
}

/**
 * Permission audit log entry
 */
export interface PermissionAuditEntry {
  userId: UserId;
  permission: Permission;
  granted: boolean;
  context?: PermissionContext;
  timestamp: Date;
  reason?: string;
}

/**
 * Permission service configuration
 */
export interface PermissionServiceConfig {
  enableCaching: boolean;
  cacheTTL: number; // seconds
  enableAuditing: boolean;
  strictMode: boolean; // If true, deny by default
}

/**
 * Type guard to check if a permission is a moderation permission
 */
export function isModerationPermission(permission: Permission): boolean {
  return [
    Permission.FORUM_PIN_TOPIC,
    Permission.FORUM_LOCK_TOPIC,
    Permission.FORUM_MODERATE,
    Permission.FORUM_BAN_USER,
    Permission.FORUM_MANAGE_CATEGORIES,
    Permission.FORUM_MANAGE_TAGS,
    Permission.FORUM_EDIT_ANY_TOPIC,
    Permission.FORUM_EDIT_ANY_REPLY,
    Permission.FORUM_DELETE_ANY_TOPIC,
    Permission.FORUM_DELETE_ANY_REPLY,
  ].includes(permission);
}

/**
 * Type guard to check if a permission requires ownership
 */
export function requiresOwnership(permission: Permission): boolean {
  return [
    Permission.FORUM_EDIT_OWN_TOPIC,
    Permission.FORUM_EDIT_OWN_REPLY,
    Permission.FORUM_DELETE_OWN_TOPIC,
    Permission.FORUM_DELETE_OWN_REPLY,
  ].includes(permission);
}

/**
 * Get permission display name for UI
 */
export function getPermissionDisplayName(permission: Permission): string {
  const displayNames: Record<Permission, string> = {
    // Forum
    [Permission.FORUM_VIEW_CATEGORY]: 'View Categories',
    [Permission.FORUM_VIEW_PRIVATE_CATEGORY]: 'View Private Categories',
    [Permission.FORUM_CREATE_TOPIC]: 'Create Topics',
    [Permission.FORUM_EDIT_OWN_TOPIC]: 'Edit Own Topics',
    [Permission.FORUM_EDIT_ANY_TOPIC]: 'Edit Any Topic',
    [Permission.FORUM_DELETE_OWN_TOPIC]: 'Delete Own Topics',
    [Permission.FORUM_DELETE_ANY_TOPIC]: 'Delete Any Topic',
    [Permission.FORUM_REPLY_TO_TOPIC]: 'Reply to Topics',
    [Permission.FORUM_EDIT_OWN_REPLY]: 'Edit Own Replies',
    [Permission.FORUM_EDIT_ANY_REPLY]: 'Edit Any Reply',
    [Permission.FORUM_DELETE_OWN_REPLY]: 'Delete Own Replies',
    [Permission.FORUM_DELETE_ANY_REPLY]: 'Delete Any Reply',
    [Permission.FORUM_PIN_TOPIC]: 'Pin Topics',
    [Permission.FORUM_LOCK_TOPIC]: 'Lock Topics',
    [Permission.FORUM_MODERATE]: 'Moderate Forums',
    [Permission.FORUM_BAN_USER]: 'Ban Users',
    [Permission.FORUM_MANAGE_CATEGORIES]: 'Manage Categories',
    [Permission.FORUM_MANAGE_TAGS]: 'Manage Tags',
    [Permission.FORUM_VIEW_DELETED]: 'View Deleted Content',
    [Permission.FORUM_BYPASS_RATE_LIMIT]: 'Bypass Rate Limits',
    [Permission.FORUM_MARK_SOLUTION]: 'Mark Solutions',
    // Wiki
    [Permission.WIKI_VIEW]: 'View Wiki Pages',
    [Permission.WIKI_EDIT_ANY]: 'Edit Wiki Pages',
    [Permission.WIKI_CREATE]: 'Create Wiki Pages',
    [Permission.WIKI_DELETE]: 'Delete Wiki Pages',
    [Permission.WIKI_SET_PROTECTION]: 'Set Wiki Protection',
    // Workspace
    [Permission.WORKSPACE_VIEW]: 'View Workspace',
    [Permission.WORKSPACE_EDIT_NODE]: 'Edit Workspace Nodes',
    [Permission.WORKSPACE_CREATE_NODE]: 'Create Workspace Nodes',
    [Permission.WORKSPACE_DELETE_NODE]: 'Delete Workspace Nodes',
    [Permission.WORKSPACE_MANAGE_CONNECTIONS]: 'Manage Connections',
    [Permission.WORKSPACE_FULL_ACCESS]: 'Full Workspace Access',
    // Users
    [Permission.USERS_VIEW_PROFILES]: 'View User Profiles',
    [Permission.USERS_BAN]: 'Ban Users',
    [Permission.USERS_DELETE]: 'Delete Users',
  };

  return displayNames[permission] || permission;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: User['role']): Permission[] {
  return RolePermissions[role] || [];
}

/**
 * Check if a role has a specific permission (static check)
 */
export function roleHasPermission(role: User['role'], permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) || false;
}
