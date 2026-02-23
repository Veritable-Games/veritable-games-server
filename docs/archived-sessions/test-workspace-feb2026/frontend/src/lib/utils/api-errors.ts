/**
 * API Error Utilities
 *
 * Provides standardized error handling for API routes with:
 * - Custom error classes with type safety
 * - Error conversion from exceptions to API responses
 * - Consistent error format across all endpoints
 * - Proper HTTP status code mapping
 *
 * Usage:
 *   import { ValidationError, toAPIError, errorResponse } from '@/lib/utils/api-errors';
 *
 *   // In services: throw custom errors
 *   throw new ValidationError('Invalid input', { email: ['Invalid format'] });
 *
 *   // In API routes: convert to standardized responses
 *   return errorResponse(error);
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

/**
 * Standardized API error format
 */
export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
}

/**
 * Validation Error - 400 Bad Request
 * Use when user input fails validation
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any // Accept any format (array or object)
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not Found Error - 404 Not Found
 * Use when a requested resource doesn't exist
 */
export class NotFoundError extends Error {
  constructor(resource: string, identifier: string | number) {
    super(`${resource} not found: ${identifier}`);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Permission Error - 403 Forbidden
 * Use when user lacks permission to perform action
 */
export class PermissionError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * Conflict Error - 409 Conflict
 * Use when the request conflicts with current state (e.g., duplicate username)
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 * Use when user is not authenticated
 */
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Use when user exceeds rate limits
 */
export class RateLimitError extends Error {
  constructor(
    message: string = 'Too many requests',
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Database Error - 500 Internal Server Error
 * Use when database operations fail
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Convert any error into standardized API error format
 *
 * Maps errors to appropriate HTTP status codes and formats
 *
 * @param error - Any error (Error, custom class, Zod error, unknown)
 * @returns Standardized API error object
 */
export function toAPIError(error: unknown): APIError {
  // Zod validation errors
  if (error instanceof z.ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  // Custom error types
  if (error instanceof ValidationError) {
    // Normalize details to consistent format
    let normalizedDetails = error.details;

    // If it's an array of {field, message} objects, convert to Record<string, string[]>
    if (Array.isArray(error.details)) {
      const fieldErrors: Record<string, string[]> = {};
      error.details.forEach((err: any) => {
        if (err && err.field) {
          if (!fieldErrors[err.field]) {
            fieldErrors[err.field] = [];
          }
          const errorMessage = err.message || 'Validation error';
          fieldErrors[err.field]!.push(errorMessage); // Non-null assertion - we just created it above
        }
      });
      normalizedDetails = fieldErrors;
    }

    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      statusCode: 400,
      details: normalizedDetails,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: error.message,
      statusCode: 404,
    };
  }

  if (error instanceof PermissionError) {
    return {
      code: 'PERMISSION_DENIED',
      message: error.message,
      statusCode: 403,
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      code: 'UNAUTHORIZED',
      message: error.message,
      statusCode: 401,
    };
  }

  if (error instanceof ConflictError) {
    return {
      code: 'CONFLICT',
      message: error.message,
      statusCode: 409,
    };
  }

  if (error instanceof RateLimitError) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: error.message,
      statusCode: 429,
      details: error.retryAfter ? { retryAfter: error.retryAfter } : undefined,
    };
  }

  if (error instanceof DatabaseError) {
    return {
      code: 'DATABASE_ERROR',
      message: 'A database error occurred',
      statusCode: 500,
      // Don't expose internal database details
      details:
        process.env.NODE_ENV === 'development'
          ? { originalMessage: error.originalError?.message }
          : undefined,
    };
  }

  // Generic Error with message inspection
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Try to infer error type from message
    if (message.includes('not found') || message.includes('does not exist')) {
      return {
        code: 'NOT_FOUND',
        message: error.message,
        statusCode: 404,
      };
    }

    if (
      message.includes('permission') ||
      message.includes('forbidden') ||
      message.includes('not allowed')
    ) {
      return {
        code: 'PERMISSION_DENIED',
        message: error.message,
        statusCode: 403,
      };
    }

    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('login required')
    ) {
      return {
        code: 'UNAUTHORIZED',
        message: error.message,
        statusCode: 401,
      };
    }

    if (
      message.includes('already exists') ||
      message.includes('duplicate') ||
      message.includes('conflict')
    ) {
      return {
        code: 'CONFLICT',
        message: error.message,
        statusCode: 409,
      };
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        statusCode: 400,
      };
    }

    // Default to internal server error for unknown Error types
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      statusCode: 500,
    };
  }

  // Unknown error type (not even an Error instance)
  logger.error('[API Error] Unknown error type:', error);
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
    details: process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined,
  };
}

/**
 * Create NextResponse with standardized error format
 *
 * Automatically converts errors, sets status codes, and logs appropriately
 *
 * @param error - Any error
 * @returns NextResponse with error JSON
 *
 * @example
 *   try {
 *     const user = await getUser(id);
 *     return NextResponse.json({ success: true, data: user });
 *   } catch (error) {
 *     return errorResponse(error);
 *   }
 */
export function errorResponse(error: unknown): NextResponse {
  const apiError = toAPIError(error);

  // Log server errors (500s) but not client errors (400s)
  if (apiError.statusCode >= 500) {
    logger.error('[API Error]', {
      code: apiError.code,
      message: apiError.message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else if (apiError.statusCode >= 400 && process.env.NODE_ENV === 'development') {
    // Log client errors only in development for debugging
    logger.warn('[API Error]', {
      code: apiError.code,
      message: apiError.message,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        ...(apiError.details && { details: apiError.details }),
      },
    },
    { status: apiError.statusCode }
  );
}

/**
 * Type guard to check if error is one of our custom errors
 */
export function isCustomError(
  error: unknown
): error is
  | ValidationError
  | NotFoundError
  | PermissionError
  | AuthenticationError
  | ConflictError
  | RateLimitError
  | DatabaseError {
  return (
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof PermissionError ||
    error instanceof AuthenticationError ||
    error instanceof ConflictError ||
    error instanceof RateLimitError ||
    error instanceof DatabaseError
  );
}

/**
 * Wrap async handler with automatic error conversion
 *
 * @param handler - Async function that might throw
 * @returns Handler that catches errors and returns errorResponse
 *
 * @example
 *   export const GET = withErrorHandler(async (request) => {
 *     const user = await getUser(123);
 *     return NextResponse.json({ success: true, data: user });
 *   });
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  }) as T;
}
