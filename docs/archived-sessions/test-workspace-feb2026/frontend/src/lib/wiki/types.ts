// Wiki system type definitions

export interface WikiPage {
  id: number;
  slug: string;
  title: string;
  namespace: string;
  status: 'published' | 'archived';
  protection_level: 'none' | 'semi' | 'full';
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined data from latest revision
  content?: string;
  content_format?: 'markdown' | 'html' | 'wikitext';
  size_bytes?: number;

  // Joined data from relationships
  categories?: string[]; // Category names for display
  category_ids?: string[]; // Category IDs for navigation
  tags?: Array<{ id: number; name: string; color?: string }>; // Full tag objects with IDs
  total_views?: number;

  // Infobox data
  infoboxes?: any[]; // Array of infoboxes with template and field data

  // User data
  author?: User;

  // Document-specific fields (for library integration)
  content_type?: 'page' | 'document';
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  document_author?: string;
  publication_date?: string;
  download_count?: number;
}

export interface WikiRevision {
  id: number;
  page_id: number;
  content: string;
  summary?: string;
  content_format: 'markdown' | 'html' | 'wikitext';
  author_id?: number;
  author_ip?: string;
  is_minor: boolean;
  size_bytes: number;
  revision_timestamp: string;

  // Joined data
  author?: User;
  page?: WikiPage;
}

export interface WikiCategory {
  id: string;
  parent_id?: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  sort_order: number;
  is_public?: boolean; // true = public (visible to all), false = admin-only
  created_at: string;

  // Computed data
  page_count?: number;
  subcategories?: WikiCategory[];
  parent?: WikiCategory;
}

export interface WikiTag {
  id: number;
  name: string;
  description?: string;
  color: string;
  usage_count: number;
  created_at: string;
}

export interface WikiPageView {
  id: number;
  page_id: number;
  view_date: string;
  view_count: number;
  unique_visitors: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: 'user' | 'moderator' | 'developer' | 'admin';
  reputation: number;
  post_count: number;
  created_at: string;
  last_active: string;
  is_active: boolean;
}

export interface UserSession {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request types for creating/updating content
export interface CreateWikiPageData {
  slug: string;
  title: string;
  content: string;
  namespace?: string;
  status?: 'draft' | 'published' | 'archived';
  summary?: string;
  categories?: string[];
  tags?: string[];
  content_format?: 'markdown' | 'html' | 'plain' | 'wikitext';
  contentFormat?: 'markdown' | 'html' | 'plain' | 'wikitext'; // camelCase alias for validation schema
  is_minor?: boolean;
  protectionLevel?: 'none' | 'semi' | 'full'; // camelCase alias for validation schema
}

export interface UpdateWikiPageData {
  title?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  protection_level?: 'none' | 'semi' | 'full';
  summary?: string;
  categories?: string[];
  tags?: string[];
  content_format?: 'markdown' | 'html' | 'plain' | 'wikitext';
  is_minor?: boolean;
  authorId?: number; // Added for compatibility
  document_author?: string; // Author of the document (for library items)
  publication_date?: string; // Publication date (for library items)
}

export interface CreateWikiCategoryData {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateWikiCategoryData {
  name?: string;
  description?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface CreateWikiTagData {
  name: string;
  description?: string;
  color?: string;
}

// Search and filter types
export interface WikiSearchParams {
  query?: string;
  namespace?: string;
  status?: 'published' | 'archived';
  category?: string;
  tags?: string[];
  author?: string;
  sort?: 'updated' | 'created' | 'views' | 'title' | 'relevance';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  created_after?: string; // ISO date string
  created_before?: string; // ISO date string
  updated_after?: string; // ISO date string
  updated_before?: string; // ISO date string
}

export interface WikiSearchResult {
  pages: WikiPage[];
  total: number;
  has_more: boolean;
}

// Cross-system reference types (will be added in next task)
export interface ForumWikiReference {
  id: number;
  forum_topic_id: number;
  wiki_page_id: number;
  reference_type: 'mention' | 'related' | 'source';
  created_at: string;
}

export interface UnifiedActivity {
  id: number;
  user_id: number;
  activity_type: 'forum_post' | 'wiki_edit';
  entity_type: 'topic' | 'page';
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'view';
  metadata?: any; // JSON with system-specific data
  timestamp: string;
}

// Permission types
export type WikiPermission =
  | 'wiki:read'
  | 'wiki:create'
  | 'wiki:edit'
  | 'wiki:delete'
  | 'wiki:moderate'
  | 'wiki:admin';

export interface WikiPermissions {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_moderate: boolean;
  can_admin: boolean;
}

// Content format conversion types
export interface WikiContentFormats {
  original_format: 'markdown' | 'html' | 'wikitext';
  markdown_content?: string;
  wikitext_content?: string;
  html_content?: string;
  search_content?: string; // Stripped text for search
}

// Template and Infobox types
export interface WikiTemplate {
  id: number;
  name: string;
  type: 'infobox' | 'template' | 'notice';
  category?: string;
  schema_definition: string; // JSON schema for the template fields
  default_data?: string; // JSON default values
  description?: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;

  // Computed/joined data
  fields?: WikiTemplateField[];
  usage_count?: number;
}

export interface WikiTemplateField {
  id: number;
  template_id: number;
  field_name: string;
  field_type: 'text' | 'textarea' | 'image' | 'url' | 'date' | 'list' | 'boolean' | 'number';
  field_label: string;
  field_description?: string;
  is_required: boolean;
  default_value?: string;
  validation_rules?: string; // JSON validation rules
  display_order: number;
}

export interface WikiInfobox {
  id: number;
  page_id: number;
  template_id: number;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  data: string; // JSON data for the infobox fields
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Joined data
  template?: WikiTemplate;
  parsed_data?: Record<string, any>; // Parsed JSON data
}

export interface WikiPageLink {
  id: number;
  source_page_id: number;
  target_slug: string;
  target_page_id?: number;
  link_text?: string;
  link_context?: string;
  created_at: string;

  // Computed data
  is_broken: boolean; // True if target_page_id is null
  target_page?: WikiPage;
}

// Request types for templates and infoboxes
export interface CreateWikiTemplateData {
  name: string;
  type: 'infobox' | 'template' | 'notice';
  category?: string;
  description?: string;
  fields: Omit<WikiTemplateField, 'id' | 'template_id'>[];
}

export interface UpdateWikiTemplateData {
  name?: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  fields?: Omit<WikiTemplateField, 'id' | 'template_id'>[];
}

export interface CreateWikiInfoboxData {
  page_id: number;
  template_id: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  data: Record<string, any>;
}

export interface UpdateWikiInfoboxData {
  template_id?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  data?: Record<string, any>;
  is_active?: boolean;
}

// Cache-related types
export interface WikiCacheEntry {
  cache_key: string;
  content: any;
  content_type: string;
  created_at: string;
  expires_at?: string;
  hit_count: number;
}

// Navigation and UI types
export interface WikiBreadcrumb {
  label: string;
  href: string;
  current?: boolean;
}

export interface WikiNavigation {
  breadcrumbs: WikiBreadcrumb[];
  parent_page?: WikiPage;
  child_pages: WikiPage[];
  related_pages: WikiPage[];
}

// Statistics and analytics types
export interface WikiPageStats {
  total_views: number;
  daily_views: { date: string; views: number }[];
  revision_count: number;
  category_count: number;
  tag_count: number;
  last_updated: string;
}

export interface WikiGlobalStats {
  total_pages: number;
  total_revisions: number;
  total_categories: number;
  total_tags: number;
  total_views: number;
  active_editors: number;
  recent_activity: UnifiedActivity[];
}
