/**
 * Database Result Type Definitions
 *
 * These types ensure type safety for database query results
 */

// Generic database row type
export interface DatabaseRow {
  [key: string]: any;
}

// Specific result types for common queries
export interface CountResult {
  count: number;
}

export interface IdResult {
  id: number;
}

export interface StatsResult {
  status: string;
  priority_level?: number;
  count: number;
}

export interface SettingRow {
  key: string;
  value: string;
  type?: string;
  category?: string;
  description?: string;
}

export interface UserRow {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  role: 'user' | 'moderator' | 'developer' | 'admin';
  created_at: string;
  updated_at?: string;
  last_login?: string;
  is_active?: boolean;
  avatar_url?: string;
}

export interface ForumTopicRow {
  id: number;
  title: string;
  content: string;
  author_id: number;
  category_id: number;
  created_at: string;
  updated_at?: string;
  view_count: number;
  is_pinned?: boolean;
  is_locked?: boolean;
  deleted_at?: string;
}

export interface ForumReplyRow {
  id: number;
  content: string;
  topic_id: number;
  author_id: number;
  parent_id?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface WikiPageRow {
  id: number;
  title: string;
  slug: string;
  content: string;
  namespace?: string;
  status: 'draft' | 'published' | 'archived' | 'featured';
  created_by: number;
  created_at: string;
  updated_at?: string;
  view_count: number;
  tags?: string;
  categories?: string;
}

export interface LibraryDocumentRow {
  id: number;
  title: string;
  slug: string;
  content?: string;
  filename?: string;
  file_size?: number;
  mime_type?: string;
  author_id: number;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
  download_count: number;
}

export interface LibraryTagRow {
  id: number;
  name: string;
  type: 'content' | 'format' | 'category' | 'author';
  color?: string;
  description?: string;
  usage_count: number;
  created_at: string;
  updated_at?: string;
}

export interface SystemBackupRow {
  id: number;
  name: string;
  file_path: string;
  file_size: number;
  backup_type: 'full' | 'incremental';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
}

export interface NextRequestExtended {
  ip?: string;
  user?: UserRow;
  session?: {
    userId?: number;
    sessionId?: string;
  };
}

// Type guards for runtime validation
export function isCountResult(row: unknown): row is CountResult {
  return typeof row === 'object' && row !== null && 'count' in row;
}

export function isStatsResult(row: unknown): row is StatsResult {
  return typeof row === 'object' && row !== null && 'status' in row && 'count' in row;
}

export function isSettingRow(row: unknown): row is SettingRow {
  return typeof row === 'object' && row !== null && 'key' in row && 'value' in row;
}

// Helper to safely cast database results
export function asType<T>(value: unknown): T {
  return value as T;
}

// Safe array type assertion
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}

// Safe object type assertion with default
export function asObject<T extends object>(value: unknown, defaultValue: T): T {
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }
  return defaultValue;
}
