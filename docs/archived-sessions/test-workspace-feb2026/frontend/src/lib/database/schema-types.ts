/**
 * Complete Database Schema Types
 * Generated from SQLite database schemas to eliminate 'any' usage
 */

// Branded types for type safety
export type UserId = number & { readonly brand: 'UserId' };
export type ForumId = number & { readonly brand: 'ForumId' };
export type TopicId = number & { readonly brand: 'TopicId' };
export type ReplyId = number & { readonly brand: 'ReplyId' };
export type WikiPageId = number & { readonly brand: 'WikiPageId' };
export type CategoryId = string & { readonly brand: 'CategoryId' };
export type ProjectId = number & { readonly brand: 'ProjectId' };
export type RevisionId = number & { readonly brand: 'RevisionId' };
export type AuthenticatorId = number & { readonly brand: 'AuthenticatorId' };
export type ChallengeId = number & { readonly brand: 'ChallengeId' };
export type BackupCodeId = number & { readonly brand: 'BackupCodeId' };
export type ReferenceImageId = number & { readonly brand: 'ReferenceImageId' };
export type ReferenceTagId = string & { readonly brand: 'ReferenceTagId' };
export type ReferenceCategoryId = string & { readonly brand: 'ReferenceCategoryId' };
export type AlbumId = number & { readonly brand: 'AlbumId' };

// Helper functions for branded types
export const brandUserId = (id: number): UserId => id as UserId;
export const brandForumId = (id: number): ForumId => id as ForumId;
export const brandTopicId = (id: number): TopicId => id as TopicId;
export const brandReplyId = (id: number): ReplyId => id as ReplyId;
export const brandWikiPageId = (id: number): WikiPageId => id as WikiPageId;
export const brandCategoryId = (id: string): CategoryId => id as CategoryId;
export const brandProjectId = (id: number): ProjectId => id as ProjectId;
export const brandRevisionId = (id: number): RevisionId => id as RevisionId;
export const brandAuthenticatorId = (id: number): AuthenticatorId => id as AuthenticatorId;
export const brandChallengeId = (id: number): ChallengeId => id as ChallengeId;
export const brandBackupCodeId = (id: number): BackupCodeId => id as BackupCodeId;
export const brandReferenceImageId = (id: number): ReferenceImageId => id as ReferenceImageId;
export const brandReferenceTagId = (id: string): ReferenceTagId => id as ReferenceTagId;
export const brandReferenceCategoryId = (id: string): ReferenceCategoryId =>
  id as ReferenceCategoryId;
export const brandAlbumId = (id: number): AlbumId => id as AlbumId;

// User types
export interface UserRecord {
  id: UserId;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  avatar_position_x?: number;
  avatar_position_y?: number;
  avatar_scale?: number;
  bio?: string;
  role: 'user' | 'moderator' | 'developer' | 'admin';
  reputation: number;
  post_count: number;
  created_at: string;
  updated_at: string;
  last_active: string;
  is_active: boolean;
  email_verified: boolean;
  password_hash: string;
  password_salt: string;
}

export interface UserProfileRecord {
  user_id: UserId;
  location?: string;
  website?: string;
  social_links?: string; // JSON
  preferences?: string; // JSON
  privacy_settings?: string; // JSON
  created_at: string;
  updated_at: string;
}

// Forum types
export interface ForumCategoryRecord {
  id: ForumId;
  name: string;
  description?: string;
  slug: string;
  position: number;
  color?: string;
  icon?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForumTopicRecord {
  id: TopicId;
  title: string;
  slug: string;
  content: string;
  category_id: ForumId;
  user_id: UserId;
  is_pinned: boolean;
  is_locked: boolean;
  is_announcement: boolean;
  view_count: number;
  reply_count: number;
  last_reply_at?: string;
  last_reply_user_id?: UserId;
  created_at: string;
  updated_at: string;
}

export interface ForumReplyRecord {
  id: ReplyId;
  topic_id: TopicId;
  user_id: UserId;
  content: string;
  parent_id?: ReplyId;
  is_solution: boolean;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumTagRecord {
  id: number;
  name: string;
  slug: string;
  color?: string;
  usage_count: number;
  created_at: string;
}

export interface ForumTopicTagRecord {
  topic_id: TopicId;
  tag_id: number;
  created_at: string;
}

// Wiki types
export interface WikiPageRecord {
  id: WikiPageId;
  slug: string;
  title: string;
  namespace: string;
  status: 'draft' | 'published' | 'archived';
  protection_level?: string;
  category_id: CategoryId;
  created_by?: UserId;
  created_at: string;
  updated_at: string;
  content_type?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  document_author?: string;
  publication_date?: string;
  download_count: number;
}

export interface WikiRevisionRecord {
  id: RevisionId;
  page_id: WikiPageId;
  content: string;
  content_format: 'markdown' | 'html';
  summary?: string;
  author_id?: UserId;
  author_ip?: string;
  is_minor: boolean;
  size_bytes: number;
  created_at: string;
}

export interface WikiCategoryRecord {
  id: CategoryId;
  name: string;
  description?: string;
  parent_id?: CategoryId;
  position: number;
  color?: string;
  icon?: string;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface WikiPageCategoryRecord {
  page_id: WikiPageId;
  category_id: CategoryId;
  added_at: string;
}

export interface WikiTagRecord {
  id: number;
  name: string;
  slug: string;
  description?: string;
  usage_count: number;
  created_at: string;
}

export interface WikiPageTagRecord {
  page_id: WikiPageId;
  tag_id: number;
  added_at: string;
}

export interface WikiPageViewRecord {
  page_id: WikiPageId;
  view_date: string;
  view_count: number;
}

export interface WikiPageLinkRecord {
  source_page_id: WikiPageId;
  target_page_id: WikiPageId;
  link_text: string;
  created_at: string;
}

export interface WikiInfoboxRecord {
  id: number;
  page_id: WikiPageId;
  template_id?: number;
  data: string; // JSON
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WikiTemplateRecord {
  id: number;
  name: string;
  type: string;
  schema_definition: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface WikiTemplateFieldRecord {
  id: number;
  template_id: number;
  field_name: string;
  field_type: string;
  field_label: string;
  is_required: boolean;
  default_value?: string;
  display_order: number;
}

// Project types
export interface ProjectRecord {
  id: ProjectId;
  slug: string;
  title: string;
  description?: string;
  content: string;
  user_id: UserId;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'private' | 'unlisted';
  tags?: string; // JSON array
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectRevisionRecord {
  id: RevisionId;
  project_id: ProjectId;
  content: string;
  summary?: string;
  user_id: UserId;
  created_at: string;
}

export interface ProjectCollaboratorRecord {
  project_id: ProjectId;
  user_id: UserId;
  role: 'viewer' | 'editor' | 'admin';
  added_at: string;
  added_by: UserId;
}

// Messaging types
export interface MessageRecord {
  id: number;
  sender_id: UserId;
  recipient_id: UserId;
  subject: string;
  content: string;
  is_read: boolean;
  is_archived: boolean;
  parent_id?: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationRecord {
  id: number;
  participants: string; // JSON array of UserIds
  subject: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// Library types
export interface LibraryDocumentRecord {
  id: number;
  filename: string;
  title: string;
  description?: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  content_type?: string;
  author?: string;
  publication_date?: string;
  tags?: string; // JSON array
  download_count: number;
  is_public: boolean;
  uploaded_by: UserId;
  created_at: string;
  updated_at: string;
}

export interface LibraryAnnotationRecord {
  id: number;
  document_id: number;
  user_id: UserId;
  page_number?: number;
  position?: string; // JSON
  content: string;
  annotation_type: 'highlight' | 'note' | 'bookmark';
  created_at: string;
  updated_at: string;
}

// Authentication types
export interface SessionRecord {
  id: string;
  user_id: UserId;
  session_data: string; // JSON
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface TokenRecord {
  id: number;
  user_id: UserId;
  token_type: 'email_verification' | 'password_reset' | 'api_key';
  token_hash: string;
  expires_at?: string;
  used_at?: string;
  created_at: string;
}

// WebAuthn Authentication types
export interface AuthenticatorRecord {
  id: AuthenticatorId;
  user_id: UserId;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  credential_device_type: 'singleDevice' | 'multiDevice';
  credential_backed_up: boolean;
  transports?: string; // JSON array of supported transports
  aaguid?: string;
  attestation_object?: string;
  attestation_format?: string;
  attestation_statement?: string;
  attestation_trusted?: boolean;
  name?: string; // User-defined name for the authenticator
  last_used_at?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  sign_count_warning_threshold: number;
  security_flags?: string; // JSON object for additional security metadata
}

export interface AuthenticationChallengeRecord {
  id: ChallengeId;
  challenge: string;
  user_id?: UserId;
  type: 'registration' | 'authentication';
  origin: string;
  rp_id: string;
  user_verification?: 'required' | 'preferred' | 'discouraged';
  expires_at: string;
  created_at: string;
  used_at?: string;
  ip_address?: string;
  user_agent?: string;
  allowed_credentials?: string; // JSON array for authentication challenges
  authenticator_selection?: string; // JSON object for registration challenges
}

export interface AuthenticationLogRecord {
  id: number;
  user_id?: UserId;
  authenticator_id?: AuthenticatorId;
  action: 'register' | 'authenticate' | 'remove' | 'rename';
  result: 'success' | 'failure' | 'error';
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  origin?: string;
  rp_id?: string;
  counter_value?: number;
  uv_performed?: boolean; // User verification performed
  up_performed?: boolean; // User presence performed
  backup_eligible?: boolean;
  backup_state?: boolean;
  attestation_format?: string;
  challenge_created_at?: string;
  challenge_resolved_at?: string;
  created_at: string;
  session_id?: string;
  rate_limit_passed?: boolean;
}

export interface WebAuthnSettingsRecord {
  user_id: UserId;
  passwordless_enabled: boolean;
  require_user_verification: boolean;
  max_authenticators: number;
  allow_password_fallback: boolean;
  preferred_authenticator_id?: AuthenticatorId;
  backup_codes_generated_at?: string;
  backup_codes_used_count: number;
  last_authenticator_used?: AuthenticatorId;
  security_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackupCodeRecord {
  id: BackupCodeId;
  user_id: UserId;
  code_hash: string;
  used_at?: string;
  created_at: string;
  expires_at?: string;
}

// System types
export interface SystemConfigRecord {
  key: string;
  value: string; // JSON
  description?: string;
  updated_at: string;
}

export interface ActivityLogRecord {
  id: number;
  user_id?: UserId;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: string; // JSON
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface NotificationRecord {
  id: number;
  user_id: UserId;
  type: string;
  title: string;
  content: string;
  data?: string; // JSON
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

// Content types
export interface ContentBlockRecord {
  id: number;
  type: string;
  title?: string;
  content: string;
  metadata?: string; // JSON
  position: number;
  is_active: boolean;
  created_by: UserId;
  created_at: string;
  updated_at: string;
}

export interface MenuItemRecord {
  id: number;
  label: string;
  url: string;
  icon?: string;
  parent_id?: number;
  position: number;
  is_active: boolean;
  permissions?: string; // JSON
  created_at: string;
  updated_at: string;
}

// Settings types
export interface SiteSettingsRecord {
  key: string;
  value: string;
  updated_at: string;
  updated_by?: UserId;
}

// Database schema mapping
export interface DatabaseSchemas {
  users: {
    users: UserRecord;
    user_profiles: UserProfileRecord;
  };
  forums: {
    categories: ForumCategoryRecord;
    topics: ForumTopicRecord;
    replies: ForumReplyRecord;
    tags: ForumTagRecord;
    topic_tags: ForumTopicTagRecord;
    site_settings: SiteSettingsRecord;
  };
  wiki: {
    wiki_pages: WikiPageRecord;
    wiki_revisions: WikiRevisionRecord;
    wiki_categories: WikiCategoryRecord;
    wiki_page_categories: WikiPageCategoryRecord;
    wiki_tags: WikiTagRecord;
    wiki_page_tags: WikiPageTagRecord;
    wiki_page_views: WikiPageViewRecord;
    wiki_page_links: WikiPageLinkRecord;
    wiki_infoboxes: WikiInfoboxRecord;
    wiki_templates: WikiTemplateRecord;
    wiki_template_fields: WikiTemplateFieldRecord;
  };
  content: {
    projects: ProjectRecord;
    project_revisions: ProjectRevisionRecord;
    project_collaborators: ProjectCollaboratorRecord;
    content_blocks: ContentBlockRecord;
    menu_items: MenuItemRecord;
  };
  messaging: {
    messages: MessageRecord;
    conversations: ConversationRecord;
  };
  library: {
    library_documents: LibraryDocumentRecord;
    library_annotations: LibraryAnnotationRecord;
  };
  auth: {
    sessions: SessionRecord;
    tokens: TokenRecord;
    authenticators: AuthenticatorRecord;
    authentication_challenges: AuthenticationChallengeRecord;
    authentication_logs: AuthenticationLogRecord;
    webauthn_settings: WebAuthnSettingsRecord;
    backup_codes: BackupCodeRecord;
  };
  system: {
    system_config: SystemConfigRecord;
    activity_log: ActivityLogRecord;
    notifications: NotificationRecord;
  };
}

// Utility type for getting table types by database
export type TableRecord<
  DB extends keyof DatabaseSchemas,
  Table extends keyof DatabaseSchemas[DB],
> = DatabaseSchemas[DB][Table];

export default DatabaseSchemas;
