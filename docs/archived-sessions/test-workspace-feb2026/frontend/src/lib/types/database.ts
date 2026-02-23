// Database result types for SQLite queries
// Provides type safety for database query results

export interface DatabaseError extends Error {
  code?: string;
  errno?: number;
  constraint?: string;
}

// Common database row interface
export interface BaseRow {
  id: number;
  created_at: string;
  updated_at?: string;
}

// User-related types
export interface UserRow extends BaseRow {
  username: string;
  email: string;
  password_hash: string;
  role: string;
  status: 'active' | 'suspended' | 'pending';
  avatar_url?: string;
  display_name?: string;
}

// Forum-related types
export interface ForumTopicRow extends BaseRow {
  title: string;
  content: string;
  user_id: number;
  category_id: number;
  status: 'active' | 'locked' | 'archived';
  reply_count: number;
  view_count: number;
  last_reply_at?: string;
}

export interface ForumReplyRow extends BaseRow {
  content: string;
  user_id: number;
  topic_id: number;
  parent_id?: number;
  reply_depth: number;
  status: 'active' | 'deleted' | 'moderated';
}

export interface ForumCategoryRow extends BaseRow {
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  status: 'active' | 'archived';
  topic_count: number;
}

// Wiki-related types
export interface WikiPageRow extends BaseRow {
  title: string;
  slug: string;
  content: string;
  author_id: number;
  category_id?: number;
  status: 'published' | 'draft' | 'archived';
  version: number;
  view_count: number;
}

export interface WikiRevisionRow extends BaseRow {
  page_id: number;
  content: string;
  summary?: string;
  author_id: number;
  version: number;
}

export interface WikiCategoryRow extends BaseRow {
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  sort_order: number;
  page_count: number;
}

// Library-related types
export interface LibraryDocumentRow extends BaseRow {
  title: string;
  slug: string;
  content: string;
  author_id: number;
  category_id?: number;
  status: 'published' | 'draft' | 'archived';
  file_path?: string;
  file_size?: number;
  mime_type?: string;
}

export interface LibraryTagRow extends BaseRow {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  usage_count: number;
}

export interface LibraryTagUsageRow {
  id: number;
  document_id: number;
  tag_id: number;
  created_at: string;
}

// System-related types
export interface SystemLogRow extends BaseRow {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  user_id?: number;
  ip_address?: string;
  user_agent?: string;
}

export interface SystemBackupRow extends BaseRow {
  name: string;
  path: string;
  size: number;
  status: 'pending' | 'completed' | 'failed';
  type: 'full' | 'partial' | 'incremental';
}

// Activity and monitoring types
export interface ActivityLogRow extends BaseRow {
  user_id?: number;
  action: string;
  entity_type: string;
  entity_id: number;
  details?: string;
  ip_address?: string;
}

export interface MetricRow extends BaseRow {
  name: string;
  value: number;
  tags?: string;
  timestamp: string;
}

// Generic query result types
export interface CountResult {
  count: number;
}

export interface ExistsResult {
  exists: 0 | 1;
}

// Utility types for query results
export type QueryResult<T> = T | undefined;
export type QueryResults<T> = T[];

// Database operation types
export interface DatabaseTransaction {
  commit(): void;
  rollback(): void;
}

// Generic database row type for unknown results
export interface UnknownRow {
  [key: string]: any;
}

// Type guards for database results
export function isCountResult(result: any): result is CountResult {
  return result && typeof result.count === 'number';
}

export function isExistsResult(result: any): result is ExistsResult {
  return result && (result.exists === 0 || result.exists === 1);
}

export function isDatabaseError(error: any): error is DatabaseError {
  return error instanceof Error && 'code' in error;
}
