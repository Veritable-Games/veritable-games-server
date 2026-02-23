/**
 * Centralized Type Exports
 *
 * Single source of truth for all TypeScript types in the application.
 * Organized by domain and functionality for easy imports.
 *
 * This barrel export provides access to:
 * - Branded types for domain safety
 * - API types for request/response handling
 * - Utility types for advanced TypeScript patterns
 * - Error handling and Result types
 * - Type guards and runtime validation
 * - Performance optimization utilities
 * - Module dependency analysis tools
 */

// Core type system exports - limited to avoid conflicts
export type * from './api';
export type {
  DeepPartial,
  DeepRequired,
  DeepReadonly,
  Mutable,
  NonEmptyArray,
  Prettify,
  RequiredKeys,
  OptionalKeys,
  AsyncResult,
  Try,
  AsyncTry,
  WithTimestamps,
  WithId,
  Entity,
  CreateInput,
  UpdateInput,
  Head,
  Tail,
  KeysOfType,
} from './utility';
export { isString, isNumber, isBoolean, isObject, isArray, isDefined } from './utility';
export type {
  Result,
  ValidationError,
  DatabaseError,
  NetworkError,
  AuthError,
  AppError,
} from './error-handling';
export {
  success,
  failure,
  isSuccess,
  isFailure,
  map,
  mapError,
  unwrapOr,
  trySync,
  tryAsync,
  chain,
  all,
  createValidationError,
  createDatabaseError,
  createNetworkError,
  createAuthError,
} from './error-handling';
export * from './guards';
export * from './performance';
export * from './module-analyzer';

// Re-export commonly used types from existing modules
export type {
  User,
  UserProfile,
  UnifiedActivity,
  CreateUserData,
  UpdateUserData,
  UserSearchOptions,
  UserSession,
  LoginData,
  RegisterData,
  Permission,
  ActivitySummary,
  UserStats,
} from '../lib/users/types';

// Profile aggregation system types
export type {
  // Core profile aggregation types
  UserId,
  AggregatedUserProfile,
  CoreUserProfile,
  UserStatsSummary,
  UserActivitySummary,
  CrossServiceActivity,

  // Service-specific stats
  ForumUserStats,
  WikiUserStats,
  MessageUserStats,

  // Service interfaces
  ProfileAggregatorService,
  ServiceDependencies,
  ProfileCacheService,

  // Configuration types
  ProfileAggregatorConfig,
  ServiceType,
  VisibilityLevel,

  // Error types
  ServiceError,
  AggregationError,

  // Query builder
  ProfileQueryBuilder,
  ProfileQuery,
} from './profile-aggregation';

export type {
  ProjectMetadata,
  ProjectContentStructure,
  ProjectSectionConfig,
  ProjectSection,
  ProjectWithContent,
  // WikiRevisionSummary removed - type does not exist in projects/types
  ContentReference,
  ProjectEditRequest,
  ProjectListItem,
  ProjectStatus,
  ProjectCategory,
} from '../lib/projects/types';

export type {
  DatabaseRow,
  CountResult,
  IdResult,
  StatsResult,
  SettingRow,
  UserRow,
  ForumTopicRow,
  ForumReplyRow,
  WikiPageRow,
  LibraryDocumentRow,
  LibraryTagRow,
  SystemBackupRow,
  NextRequestExtended,
} from '../lib/database/types';

// Form data types from schemas
export type {
  UserId as SchemaUserId,
  Email as SchemaEmail,
  Username as SchemaUsername,
  LoginFormData,
  RegisterFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
  ProfileFormData,
  ChangePasswordFormData,
  ForumCategoryFormData,
  NewTopicFormData,
  ReplyFormData,
  WikiPageFormData,
  WikiRevisionFormData,
  LibraryDocumentFormData,
  FileUploadFormData,
  ImageUploadFormData,
  AvatarUploadFormData,
  MessageFormData,
  UserModerationFormData,
  SearchFormData,
} from '../lib/forms/schemas';

// Validation input types
export type {
  UserInput,
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  ChangePasswordInput,
  WikiPageInput,
  CreateWikiPageInput,
  UpdateWikiPageInput,
  WikiCategoryInput,
  ForumTopicInput,
  CreateTopicInput,
  UpdateTopicInput,
  ForumReplyInput,
  CreateReplyInput,
  UpdateReplyInput,
  ForumCategoryInput,
  SearchInput,
  PaginationInput,
  SanitizationOptionsInput,
} from '../lib/validation/schemas';

// Type aliases for commonly used patterns
export type ID = number | string;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Generic response wrapper
export type Response<T> = {
  data?: T;
  error?: string;
  message?: string;
  status: number;
};

// Generic async operation
export type AsyncOperation<T> = () => Promise<T>;

// Component prop utilities
export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// State management types
export type StateAction<T> = {
  type: string;
  payload?: T;
};

export type StateReducer<S, A> = (state: S, action: A) => S;

// Hook return types
export type UseAsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export type UseFormState<T> = {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setError: <K extends keyof T>(field: K, error: string) => void;
  clearErrors: () => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e?: React.FormEvent) => void;
  reset: (values?: Partial<T>) => void;
};

// Event types
export type CustomEvent<T = any> = {
  type: string;
  data?: T;
  timestamp: number;
};

export type EventListener<T = any> = (event: CustomEvent<T>) => void;

// Configuration types
export type AppConfig = {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  features: Record<string, boolean>;
  limits: {
    maxFileSize: number;
    maxImageSize: number;
    maxContentLength: number;
  };
};

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorScheme = {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  base: string;
  info: string;
  success: string;
  warning: string;
  error: string;
};

// Layout types
export type LayoutProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export type PageProps<T = {}> = {
  params: T;
  searchParams?: Record<string, string | string[] | undefined>;
};

// Metadata types for SEO
export type PageMetadata = {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  noIndex?: boolean;
};
