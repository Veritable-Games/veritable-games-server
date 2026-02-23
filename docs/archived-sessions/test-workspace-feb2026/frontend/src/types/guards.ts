/**
 * Comprehensive Type Guards and Runtime Validation
 *
 * Type-safe runtime validation utilities that integrate with our branded types
 * and provide comprehensive error handling.
 */

import {
  UserId,
  Username,
  Email,
  Slug,
  ProjectSlug,
  HttpUrl,
  DatabaseId,
  isUserId,
  isEmail,
  isUsername,
  isSlug,
  isHttpUrl,
  isDatabaseId,
} from './branded';
import {
  UserResponse,
  ForumTopicResponse,
  WikiPageResponse,
  ProjectResponse,
  ApiResult,
  ApiSuccess,
  ApiError,
  isApiSuccess,
  isApiError,
} from './api';
import { Result, Ok, Err } from './error-handling';

// Basic type guards
export const isString = (value: unknown): value is string => typeof value === 'string';

export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !isNaN(value);

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isArray = <T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is T[] => {
  if (!Array.isArray(value)) return false;
  if (!itemGuard) return true;
  return value.every(itemGuard);
};

export const isDefined = <T>(value: T | undefined | null): value is T =>
  value !== undefined && value !== null;

export const isNotEmpty = <T>(value: T[]): value is [T, ...T[]] =>
  Array.isArray(value) && value.length > 0;

export const hasProperty = <K extends string>(obj: unknown, prop: K): obj is Record<K, unknown> =>
  isObject(obj) && prop in obj;

export const hasRequiredProperty = <K extends string, T>(
  obj: unknown,
  prop: K,
  guard: (value: unknown) => value is T
): obj is Record<K, T> => hasProperty(obj, prop) && guard(obj[prop]);

// Array validation utilities
export const isNonEmptyArray = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is [T, ...T[]] => isArray(value, itemGuard) && value.length > 0;

export const isArrayWithLength = <T>(
  value: unknown,
  length: number,
  itemGuard: (item: unknown) => item is T
): value is T[] => isArray(value, itemGuard) && value.length === length;

export const isArrayWithMaxLength = <T>(
  value: unknown,
  maxLength: number,
  itemGuard: (item: unknown) => item is T
): value is T[] => isArray(value, itemGuard) && value.length <= maxLength;

// String validation utilities
export const isNonEmptyString = (value: unknown): value is string =>
  isString(value) && value.length > 0;

export const isStringWithLength = (
  value: unknown,
  minLength: number,
  maxLength?: number
): value is string =>
  isString(value) && value.length >= minLength && (maxLength ? value.length <= maxLength : true);

export const isStringMatching = (value: unknown, pattern: RegExp): value is string =>
  isString(value) && pattern.test(value);

// Date validation utilities
export const isDate = (value: unknown): value is Date =>
  value instanceof Date && !isNaN(value.getTime());

export const isValidDateString = (value: unknown): value is string =>
  isString(value) && !isNaN(Date.parse(value));

export const isTimestamp = (value: unknown): value is number =>
  isNumber(value) && value > 0 && Number.isInteger(value);

// Complex object type guards
export const isUserResponse = (value: unknown): value is UserResponse => {
  if (!isObject(value)) return false;

  return (
    hasRequiredProperty(value, 'id', isUserId) &&
    hasRequiredProperty(value, 'username', isUsername) &&
    hasRequiredProperty(value, 'email', isEmail) &&
    hasRequiredProperty(value, 'displayName', isString) &&
    hasRequiredProperty(
      value,
      'role',
      (v): v is 'user' | 'moderator' | 'developer' | 'admin' =>
        isString(v) && ['user', 'moderator', 'developer', 'admin'].includes(v)
    ) &&
    hasRequiredProperty(
      value,
      'status',
      (v): v is 'active' | 'banned' | 'suspended' | 'pending' =>
        isString(v) && ['active', 'banned', 'suspended', 'pending'].includes(v)
    )
  );
};

export const isForumTopicResponse = (value: unknown): value is ForumTopicResponse => {
  if (!isObject(value)) return false;

  return (
    hasRequiredProperty(value, 'id', isDatabaseId) &&
    hasRequiredProperty(value, 'title', isString) &&
    hasRequiredProperty(value, 'slug', isSlug) &&
    hasRequiredProperty(value, 'content', isString) &&
    hasRequiredProperty(value, 'authorId', isUserId) &&
    hasRequiredProperty(value, 'categoryId', isDatabaseId)
  );
};

export const isWikiPageResponse = (value: unknown): value is WikiPageResponse => {
  if (!isObject(value)) return false;

  return (
    hasRequiredProperty(value, 'id', isDatabaseId) &&
    hasRequiredProperty(value, 'title', isString) &&
    hasRequiredProperty(value, 'slug', isSlug) &&
    hasRequiredProperty(value, 'content', isString) &&
    hasRequiredProperty(value, 'authorId', isUserId)
  );
};

export const isProjectResponse = (value: unknown): value is ProjectResponse => {
  if (!isObject(value)) return false;

  return (
    hasRequiredProperty(value, 'slug', isSlug) &&
    hasRequiredProperty(value, 'title', isString) &&
    hasRequiredProperty(value, 'status', isString) &&
    hasRequiredProperty(value, 'content', isString)
  );
};

// API response type guards
export const isApiSuccessOfType = <T>(
  value: unknown,
  dataGuard: (data: unknown) => data is T
): value is ApiSuccess<T> => {
  if (!isObject(value)) return false;

  return (
    hasProperty(value, 'success') &&
    value.success === true &&
    hasProperty(value, 'data') &&
    dataGuard(value.data)
  );
};

export const isApiErrorResponse = (value: unknown): value is ApiError => {
  if (!isObject(value)) return false;

  return (
    hasProperty(value, 'success') &&
    value.success === false &&
    hasProperty(value, 'error') &&
    isObject(value.error) &&
    hasRequiredProperty(value.error, 'code', isString) &&
    hasRequiredProperty(value.error, 'message', isString)
  );
};

// Validation result creators
export const validateRequired = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  fieldName: string
): Result<T, string> => {
  if (!isDefined(value)) {
    return Err(`${fieldName} is required`);
  }

  if (!guard(value)) {
    return Err(`${fieldName} is invalid`);
  }

  return Ok(value);
};

export const validateOptional = <T>(
  value: unknown,
  guard: (value: unknown) => value is T
): Result<T | undefined, string> => {
  if (!isDefined(value)) {
    return Ok(undefined);
  }

  if (!guard(value)) {
    return Err('Value is invalid');
  }

  return Ok(value);
};

export const validateArray = <T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T,
  fieldName: string,
  options?: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
  }
): Result<T[], string> => {
  const { minLength, maxLength, required = true } = options || {};

  if (!isDefined(value)) {
    if (required) {
      return Err(`${fieldName} is required`);
    }
    return Ok([]);
  }

  if (!isArray(value, itemGuard)) {
    return Err(`${fieldName} must be a valid array`);
  }

  if (minLength !== undefined && value.length < minLength) {
    return Err(`${fieldName} must have at least ${minLength} items`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return Err(`${fieldName} must have at most ${maxLength} items`);
  }

  return Ok(value);
};

// Object validation utilities
export const validateObjectShape = <T extends Record<string, unknown>>(
  value: unknown,
  validators: {
    [K in keyof T]: (value: unknown) => Result<T[K], string>;
  }
): Result<T, Record<string, string>> => {
  if (!isObject(value)) {
    return Err({ root: 'Value must be an object' });
  }

  const errors: Record<string, string> = {};
  const result = {} as T;

  for (const [key, validator] of Object.entries(validators)) {
    const validationResult = validator(value[key]);

    if (validationResult.isError()) {
      errors[key] = String(validationResult.error);
    } else {
      result[key as keyof T] = validationResult.value;
    }
  }

  if (Object.keys(errors).length > 0) {
    return Err(errors);
  }

  return Ok(result);
};

// Conditional type guards based on discriminated unions
export const isStatusType = <T extends string>(
  value: unknown,
  allowedStatuses: readonly T[]
): value is T => isString(value) && (allowedStatuses as readonly string[]).includes(value);

export const isRoleType = (value: unknown): value is 'user' | 'moderator' | 'developer' | 'admin' =>
  isStatusType(value, ['user', 'moderator', 'developer', 'admin']);

export const isProjectStatus = (
  value: unknown
): value is 'In Development' | 'Pre-Production' | 'Planning' | 'Concept' | 'Archive' =>
  isStatusType(value, ['In Development', 'Pre-Production', 'Planning', 'Concept', 'Archive']);

// Environment variable type guards
export const isPort = (value: unknown): value is number => {
  return isNumber(value) && Number.isInteger(value) && value >= 1 && value <= 65535;
};

export const isBooleanString = (value: unknown): value is string => {
  return isString(value) && ['true', 'false', '1', '0'].includes(value.toLowerCase());
};

export const parseBoolean = (value: string): boolean => {
  return ['true', '1'].includes(value.toLowerCase());
};

// File validation utilities
export const isValidFileType = (file: File, allowedTypes: readonly string[]): boolean => {
  return allowedTypes.includes(file.type);
};

export const isValidFileSize = (file: File, maxSize: number): boolean => {
  return file.size <= maxSize && file.size > 0;
};

export const isImageFile = (file: File): boolean => {
  return isValidFileType(file, ['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
};

// URL validation utilities
export const isValidUrl = (value: unknown): value is string => {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const isHttpsUrl = (value: unknown): value is string => {
  if (!isValidUrl(value)) return false;
  return value.startsWith('https://');
};

export const isGithubUrl = (value: unknown): value is string => {
  return (
    isString(value) &&
    value.startsWith('https://github.com/') &&
    value.length > 'https://github.com/'.length
  );
};

export const isSteamUrl = (value: unknown): value is string => {
  return (
    isString(value) &&
    value.startsWith('https://steamcommunity.com/') &&
    value.length > 'https://steamcommunity.com/'.length
  );
};

// Composite validation for complex forms
export const validateLoginForm = (
  data: unknown
): Result<
  {
    identifier: string;
    password: string;
    rememberMe?: boolean;
  },
  Record<string, string>
> => {
  return validateObjectShape(data, {
    identifier: value => validateRequired(value, isNonEmptyString, 'identifier'),
    password: value => validateRequired(value, isNonEmptyString, 'password'),
    rememberMe: value => validateOptional(value, isBoolean),
  });
};

// Batch validation utilities
export const validateAll = <T>(
  validations: Array<() => Result<T, string>>
): Result<T[], string[]> => {
  const results: Result<T, string>[] = validations.map(fn => fn());
  const errors: string[] = [];
  const values: T[] = [];

  for (const result of results) {
    if (result.isError()) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  if (errors.length > 0) {
    return Err(errors);
  }

  return Ok(values);
};

// Type assertion utilities with better error messages
export const assertType = <T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  errorMessage?: string
): T => {
  if (!guard(value)) {
    throw new TypeError(errorMessage || 'Type assertion failed');
  }
  return value;
};

export const assertDefined = <T>(value: T | undefined | null, errorMessage?: string): T => {
  if (!isDefined(value)) {
    throw new TypeError(errorMessage || 'Expected value to be defined');
  }
  return value;
};
