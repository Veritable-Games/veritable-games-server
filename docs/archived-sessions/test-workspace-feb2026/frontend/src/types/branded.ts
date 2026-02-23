/**
 * Branded Types for Domain Safety
 *
 * These branded types provide compile-time safety while maintaining runtime compatibility.
 * They prevent mixing different domain entities and catch errors at compile time.
 */

// Brand utility type
export type Brand<K, T> = K & { __brand: T };

// Generic branded type alias used by profile aggregation system
export type Branded<T, U> = T & { __brand: U };

// Core Domain Branded Types
export type UserId = Brand<string, 'UserId'>;
export type Username = Brand<string, 'Username'>;
export type Email = Brand<string, 'Email'>;
export type Slug = Brand<string, 'Slug'>;
export type ProjectSlug = Brand<string, 'ProjectSlug'>;
export type SessionToken = Brand<string, 'SessionToken'>;
export type WikiPageId = Brand<string, 'WikiPageId'>;
export type ForumTopicId = Brand<string, 'ForumTopicId'>;
export type CategoryId = Brand<string, 'CategoryId'>;

// Numeric branded types
export type DatabaseId = Brand<number, 'DatabaseId'>;
export type Timestamp = Brand<number, 'Timestamp'>;
export type FileSize = Brand<number, 'FileSize'>;
export type ViewCount = Brand<number, 'ViewCount'>;

// URL branded types
export type HttpUrl = Brand<string, 'HttpUrl'>;
export type AvatarUrl = Brand<string, 'AvatarUrl'>;
export type GithubUrl = Brand<string, 'GithubUrl'>;
export type SteamUrl = Brand<string, 'SteamUrl'>;

// Content types
export type MarkdownContent = Brand<string, 'MarkdownContent'>;
export type HtmlContent = Brand<string, 'HtmlContent'>;
export type PlainTextContent = Brand<string, 'PlainTextContent'>;

// Security types
export type HashedPassword = Brand<string, 'HashedPassword'>;
export type IpAddress = Brand<string, 'IpAddress'>;
export type UserAgent = Brand<string, 'UserAgent'>;

// Type guards for runtime validation
export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0;

export const isEmail = (value: unknown): value is Email =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isUsername = (value: unknown): value is Username =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{3,20}$/.test(value);

export const isSlug = (value: unknown): value is Slug =>
  typeof value === 'string' &&
  /^[a-z0-9-]+$/.test(value) &&
  !value.startsWith('-') &&
  !value.endsWith('-');

export const isHttpUrl = (value: unknown): value is HttpUrl => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

export const isDatabaseId = (value: unknown): value is DatabaseId =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

// Brand creation functions (factory functions)
export const createUserId = (id: string): UserId => {
  if (!isUserId(id)) throw new Error(`Invalid user ID: ${id}`);
  return id as UserId;
};

export const createEmail = (email: string): Email => {
  if (!isEmail(email)) throw new Error(`Invalid email: ${email}`);
  return email as Email;
};

export const createUsername = (username: string): Username => {
  if (!isUsername(username)) throw new Error(`Invalid username: ${username}`);
  return username as Username;
};

export const createSlug = (slug: string): Slug => {
  if (!isSlug(slug)) throw new Error(`Invalid slug: ${slug}`);
  return slug as Slug;
};

export const createHttpUrl = (url: string): HttpUrl => {
  if (!isHttpUrl(url)) throw new Error(`Invalid HTTP URL: ${url}`);
  return url as HttpUrl;
};

export const createDatabaseId = (id: number): DatabaseId => {
  if (!isDatabaseId(id)) throw new Error(`Invalid database ID: ${id}`);
  return id as DatabaseId;
};

// Utility functions for brand manipulation
export const unwrap = <T>(branded: Brand<T, any>): T => branded as T;

export const rebrand = <T, U, V>(value: Brand<T, U>, _brand: V): Brand<T, V> =>
  value as Brand<T, V>;

// Validation result types
export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export const validateAndBrand = <T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  errorMessage?: string
): ValidationResult<T> => {
  if (validator(value)) {
    return { success: true, data: value };
  }
  return { success: false, error: errorMessage || 'Validation failed' };
};

/**
 * Safe converters for handling type mismatches between auth system and branded types
 *
 * The auth system returns numeric user IDs, but workspace and other systems
 * expect string-branded UserId types. These converters handle the transition safely.
 */

/**
 * Convert a numeric user ID (from auth system) to a branded UserId string
 *
 * @param numericId - User ID as number from database/auth system
 * @returns Branded UserId string
 * @throws Error if the numeric ID is invalid
 */
export const userIdFromNumber = (numericId: number | string): UserId => {
  const num = typeof numericId === 'string' ? parseInt(numericId, 10) : numericId;
  if (!Number.isInteger(num) || num <= 0 || isNaN(num)) {
    throw new Error(`Invalid numeric user ID: ${numericId}`);
  }
  return String(num) as UserId;
};

/**
 * Unsafe converter for use when you're certain the value is valid
 * Use sparingly - prefer userIdFromNumber for auth system IDs
 *
 * @param value - Any value to convert to UserId
 * @returns Branded UserId (no validation)
 */
export const unsafeToUserId = (value: string | number): UserId => {
  return String(value) as UserId;
};

/**
 * Convert unknown value to UserId with validation
 * Returns null if validation fails (safe for optional chains)
 */
export const toUserIdSafe = (value: unknown): UserId | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return String(value) as UserId;
  }
  if (typeof value === 'string' && value.length > 0) {
    return value as UserId;
  }
  return null;
};
