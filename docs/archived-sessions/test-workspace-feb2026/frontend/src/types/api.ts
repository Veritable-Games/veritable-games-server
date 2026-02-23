/**
 * Comprehensive API Response Types
 *
 * Type-safe API response patterns with proper error handling,
 * pagination, and result wrapping for the entire application.
 */

import {
  UserId,
  Username,
  Email,
  Slug,
  ProjectSlug,
  DatabaseId,
  Timestamp,
  ViewCount,
  MarkdownContent,
} from './branded';

// Core API result wrapper types
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string | undefined;
  meta?: ResponseMeta | undefined;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any> | undefined;
    field?: string | undefined;
  };
  meta?: ResponseMeta | undefined;
}

export interface ResponseMeta {
  timestamp: Timestamp;
  requestId?: string;
  version?: string;
  rateLimit?: RateLimit;
}

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: Timestamp;
}

// Pagination types
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// User API types
export interface UserResponse {
  id: UserId;
  username: Username;
  email: Email;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  profile: UserProfile;
}

export interface UserProfile {
  location?: string;
  websiteUrl?: string;
  githubUrl?: string;
  mastodonUrl?: string;
  discordUsername?: string;
  steamUrl?: string;
  xboxGamertag?: string;
  psnId?: string;
  blueskyUrl?: string;
  avatarPositionX: number;
  avatarPositionY: number;
  avatarScale: number;
}

export type UserRole = 'user' | 'moderator' | 'developer' | 'admin';
export type UserStatus = 'active' | 'banned' | 'suspended' | 'pending';

export interface UserStatsResponse {
  forumTopicCount: number;
  forumReplyCount: number;
  forumReputation: number;
  wikiPageCount: number;
  wikiEditCount: number;
  totalActivityCount: number;
}

// Authentication API types
export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: UserResponse;
  token: string;
  expiresAt: Timestamp;
}

export interface RegisterRequest {
  username: Username;
  email: Email;
  password: string;
  displayName: string;
}

// Forum API types
export interface ForumCategoryResponse {
  id: DatabaseId;
  name: string;
  slug: Slug;
  description?: string;
  color: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  topicCount: number;
  replyCount: number;
  lastActivity?: ForumActivitySummary;
}

export interface ForumTopicResponse {
  id: DatabaseId;
  title: string;
  slug: Slug;
  content: MarkdownContent;
  authorId: UserId;
  author: UserSummary;
  categoryId: DatabaseId;
  category: CategorySummary;
  status: TopicStatus;
  isPinned: boolean;
  isLocked: boolean;
  tags: string[];
  viewCount: ViewCount;
  replyCount: number;
  lastReplyAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ForumReplyResponse {
  id: DatabaseId;
  content: MarkdownContent;
  topicId: DatabaseId;
  authorId: UserId;
  author: UserSummary;
  parentId?: DatabaseId;
  isSolution: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type TopicStatus = 'open' | 'closed' | 'pinned' | 'locked';

export interface ForumActivitySummary {
  topicId?: DatabaseId;
  topicTitle?: string;
  authorId: UserId;
  authorName: string;
  timestamp: Timestamp;
}

// Wiki API types
export interface WikiPageResponse {
  id: DatabaseId;
  title: string;
  slug: Slug;
  content: MarkdownContent;
  namespace?: string;
  status: WikiPageStatus;
  protectionLevel: WikiProtectionLevel;
  authorId: UserId;
  author: UserSummary;
  categories: string[];
  tags: string[];
  viewCount: ViewCount;
  revisionCount: number;
  lastRevision: WikiRevisionSummary;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type WikiPageStatus = 'draft' | 'published' | 'archived';
export type WikiProtectionLevel = 'none' | 'semi' | 'full';

export interface WikiRevisionSummary {
  id: DatabaseId;
  summary?: string;
  authorId: UserId;
  authorName: string;
  timestamp: Timestamp;
  sizeBytes: number;
  isMinor: boolean;
}

// Project API types
export interface ProjectResponse {
  slug: ProjectSlug;
  title: string;
  status: ProjectStatus;
  category: string;
  color: string;
  description?: string;
  content: MarkdownContent;
  sections: ProjectSectionResponse[];
  mainWikiPageId?: DatabaseId;
  editLocked: boolean;
  lastMajorEdit?: Timestamp;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectSectionResponse {
  id: DatabaseId;
  projectSlug: ProjectSlug;
  sectionKey: string;
  title: string;
  description?: string;
  wikiPageId?: DatabaseId;
  displayOrder: number;
  isVisible: boolean;
  isEditable: boolean;
}

export type ProjectStatus =
  | 'In Development'
  | 'Pre-Production'
  | 'Planning'
  | 'Concept'
  | 'Archive';

// Search API types
export interface SearchRequest {
  query: string;
  category?: SearchCategory;
  filters?: SearchFilters;
  sort?: SearchSort;
  pagination: PaginationParams;
}

export type SearchCategory = 'all' | 'topics' | 'wiki' | 'library' | 'users' | 'projects';
export type SearchSort = 'relevance' | 'date' | 'title' | 'activity';

export interface SearchFilters {
  author?: Username;
  tags?: string[];
  dateRange?: {
    start?: Timestamp;
    end?: Timestamp;
  };
  status?: string;
}

export interface SearchResult {
  type: SearchCategory;
  id: string;
  title: string;
  content: string;
  url: string;
  score: number;
  highlights?: string[];
  metadata?: Record<string, any>;
}

// Common utility types
export interface UserSummary {
  id: UserId;
  username: Username;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
}

export interface CategorySummary {
  id: DatabaseId;
  name: string;
  slug: Slug;
  color: string;
}

// Error code constants
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;

// Type guards for API results
export const isApiSuccess = <T>(result: ApiResult<T>): result is ApiSuccess<T> =>
  result.success === true;

export const isApiError = <T>(result: ApiResult<T>): result is ApiError => result.success === false;

// Utility functions for creating API responses
export const createApiSuccess = <T>(
  data: T,
  message?: string | undefined,
  meta?: ResponseMeta | undefined
): ApiSuccess<T> => ({
  success: true,
  data,
  message,
  meta,
});

export const createApiError = (
  code: ApiErrorCode,
  message: string,
  details?: Record<string, any> | undefined,
  field?: string | undefined,
  meta?: ResponseMeta | undefined
): ApiError => ({
  success: false,
  error: {
    code: API_ERROR_CODES[code],
    message,
    details,
    field,
  },
  meta,
});

// Type for handling async operations
export type AsyncApiResult<T> = Promise<ApiResult<T>>;

// Conditional types for request/response mapping
export type RequestType<T extends string> = T extends 'login'
  ? LoginRequest
  : T extends 'register'
    ? RegisterRequest
    : T extends 'search'
      ? SearchRequest
      : never;

export type ResponseType<T extends string> = T extends 'login'
  ? LoginResponse
  : T extends 'user'
    ? UserResponse
    : T extends 'forum-topic'
      ? ForumTopicResponse
      : T extends 'wiki-page'
        ? WikiPageResponse
        : T extends 'project'
          ? ProjectResponse
          : never;
