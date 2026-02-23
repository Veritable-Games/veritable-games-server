// Database result types for comprehensive type safety
// This file defines interfaces for all database query results

// =============================================================================
// BASE TYPES
// =============================================================================

export interface BaseRecord {
  id: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =============================================================================
// USER MANAGEMENT
// =============================================================================

export interface User extends BaseRecord {
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  role: 'admin' | 'moderator' | 'user';
  is_active: boolean;
  email_verified: boolean;
  last_login?: string;
  preferences?: string;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
  social_links?: string;
  privacy_settings?: string;
}

// =============================================================================
// FORUM SYSTEM
// =============================================================================

export interface ForumCategory extends BaseRecord {
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  active: boolean;
  topic_count?: number;
  reply_count?: number;
}

export interface ForumTopic extends BaseRecord {
  title: string;
  content: string;
  category_id: number;
  author_id: number;
  author_username?: string;
  author_display_name?: string;
  category_name?: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  view_count: number;
  last_reply_at?: string;
  last_reply_author?: string;
}

export interface ForumReply extends BaseRecord {
  topic_id: number;
  author_id: number;
  author_username?: string;
  author_display_name?: string;
  content: string;
  parent_reply_id?: number;
  is_solution?: boolean;
}

// =============================================================================
// WIKI SYSTEM
// =============================================================================

export interface WikiPage extends BaseRecord {
  title: string;
  slug: string;
  content: string;
  summary?: string;
  category_id?: number;
  category_name?: string;
  author_id: number;
  author_username?: string;
  is_published: boolean;
  view_count: number;
  revision_number: number;
  wiki_page_id?: number; // For bulk operations
}

export interface WikiCategory extends BaseRecord {
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  display_order: number;
  page_count?: number;
}

export interface WikiRevision extends BaseRecord {
  wiki_page_id: number;
  revision_number: number;
  title: string;
  content: string;
  summary?: string;
  author_id: number;
  author_username?: string;
  is_current: boolean;
}

// =============================================================================
// LIBRARY SYSTEM
// =============================================================================

export interface LibraryDocument extends BaseRecord {
  title: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description?: string;
  tags?: string;
  category_id?: number;
  author_id: number;
  author_username?: string;
  download_count: number;
  is_public: boolean;
}

export interface LibraryTag extends BaseRecord {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  document_count?: number;
  type?: string;
}

export interface LibraryCategory extends BaseRecord {
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  display_order: number;
  document_count?: number;
}

// =============================================================================
// PROJECT MANAGEMENT
// =============================================================================

export interface Project extends BaseRecord {
  name: string;
  slug: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_date?: string;
  end_date?: string;
  progress_percentage: number;
  assigned_to?: number;
  created_by: number;
}

export interface ProjectTask extends BaseRecord {
  project_id: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  assigned_to?: number;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

// =============================================================================
// CONTENT MANAGEMENT
// =============================================================================

export interface NewsItem extends BaseRecord {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featured_image?: string;
  author_id: number;
  author_username?: string;
  category_id?: number;
  is_published: boolean;
  published_at?: string;
  view_count: number;
}

export interface TeamMember extends BaseRecord {
  name: string;
  role: string;
  bio?: string;
  avatar_url?: string;
  email?: string;
  social_links?: string;
  display_order: number;
  is_active: boolean;
}

// =============================================================================
// WORKFLOW SYSTEM
// =============================================================================

export interface Workflow extends BaseRecord {
  name: string;
  description?: string;
  type: string;
  status: 'active' | 'inactive' | 'draft';
  steps: WorkflowStep[];
  created_by: number;
}

export interface WorkflowStep {
  id: number;
  workflow_id: number;
  name: string;
  description?: string;
  step_order: number;
  action_type: string;
  config?: Record<string, any>;
}

// =============================================================================
// SEARCH & ANALYTICS
// =============================================================================

export interface SearchResult {
  id: number;
  type: 'topic' | 'reply' | 'wiki_page' | 'library_doc';
  title?: string;
  content: string;
  highlighted_content?: string;
  highlighted_title?: string;
  author_username: string;
  author_display_name?: string;
  category_name?: string;
  created_at: string;
  topic_id?: number;
  score: number;
  relevance_score?: number;
}

export interface ActivityLog extends BaseRecord {
  user_id: number;
  username?: string;
  action: string;
  entity_type: string;
  entity_id: number;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type OrderDirection = 'ASC' | 'DESC';

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface BulkOperation {
  action: 'delete' | 'update' | 'archive' | 'publish';
  ids: number[];
  params?: Record<string, any>;
}

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
}

// =============================================================================
// API ROUTE CONTEXT TYPES
// =============================================================================

export interface RouteContext<T = Record<string, string>> {
  params: Promise<T>;
}

// Updated for Next.js 15 async params
export interface UserRouteContext {
  params: Promise<{ id: string }>;
}

export interface CategoryRouteContext {
  params: Promise<{ id: string; categoryId?: string }>;
}

export interface DocumentRouteContext {
  params: Promise<{ id: string; documentId?: string }>;
}

export interface TopicRouteContext {
  params: Promise<{ id: string; topicId?: string }>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export interface APIError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
}

export interface APISuccess<T = any> {
  success: true;
  data?: T;
  message?: string;
}

export type APIResponse<T = any> = APISuccess<T> | APIError;
