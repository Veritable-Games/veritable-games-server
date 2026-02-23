/**
 * Error Handling Types and Utilities
 *
 * Functional approach to error handling using Result types to eliminate
 * try-catch blocks and provide better type safety.
 */

/**
 * Result type representing either success with data or failure with error
 */
export type ResultType<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Creates a successful result
 */
export function success<T>(data: T): ResultType<T, never> {
  return { success: true, data };
}

/**
 * Creates a failed result
 */
export function failure<E>(error: E): ResultType<never, E> {
  return { success: false, error };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T, E>(result: ResultType<T, E>): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if result is failure
 */
export function isFailure<T, E>(result: ResultType<T, E>): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Maps a successful result to a new value
 */
export function map<T, U, E>(result: ResultType<T, E>, fn: (data: T) => U): ResultType<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.data));
  }
  return result;
}

/**
 * Maps a failed result to a new error
 */
export function mapError<T, E, F>(result: ResultType<T, E>, fn: (error: E) => F): ResultType<T, F> {
  if (isFailure(result)) {
    return failure(fn(result.error));
  }
  return result;
}

/**
 * Unwraps a result, throwing if it's an error
 */
export function unwrap<T, E>(result: ResultType<T, E>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwraps a result with a default value for errors
 */
export function unwrapOr<T, E>(result: ResultType<T, E>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Wraps a potentially throwing function in a Result
 */
export function trySync<T>(fn: () => T): ResultType<T, Error> {
  try {
    return success(fn());
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Wraps an async function that might throw in a Result
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<ResultType<T, Error>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Chains multiple Result operations
 */
export function chain<T, U, E>(
  result: ResultType<T, E>,
  fn: (data: T) => ResultType<U, E>
): ResultType<U, E> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * Combines multiple results into a single result with an array of values
 */
export function all<T, E>(results: ResultType<T, E>[]): ResultType<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.data);
  }

  return success(values);
}

/**
 * Application-specific error types
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface DatabaseError {
  query: string;
  message: string;
  code?: string;
}

export interface NetworkError {
  url: string;
  status?: number;
  message: string;
}

export interface AuthError {
  type: 'unauthorized' | 'forbidden' | 'expired' | 'invalid';
  message: string;
}

/**
 * Union of all application error types
 */
export type AppError = ValidationError | DatabaseError | NetworkError | AuthError;

/**
 * Type-safe error creators
 */
export const createValidationError = (
  field: string,
  message: string,
  code = 'VALIDATION_ERROR'
): ValidationError => ({
  field,
  message,
  code,
});

export const createDatabaseError = (
  query: string,
  message: string,
  code?: string
): DatabaseError => ({
  query,
  message,
  code,
});

export const createNetworkError = (
  url: string,
  message: string,
  status?: number
): NetworkError => ({
  url,
  message,
  status,
});

export const createAuthError = (type: AuthError['type'], message: string): AuthError => ({
  type,
  message,
});

/**
 * Result class with static methods for compatibility with aggregation system
 */
class ResultClass<T, E = Error> {
  private constructor(
    private readonly _success: boolean,
    private readonly _data?: T,
    private readonly _error?: E
  ) {}

  static ok<T>(data: T): ResultClass<T, never> {
    return new ResultClass(true, data);
  }

  static error<E>(error: E): ResultClass<never, E> {
    return new ResultClass<never, E>(false, undefined as never, error);
  }

  isOk(): this is ResultClass<T, never> {
    return this._success;
  }

  isError(): this is ResultClass<never, E> {
    return !this._success;
  }

  get value(): T {
    if (!this._success) {
      throw new Error('Attempted to get value from error result');
    }
    return this._data!;
  }

  get error(): E {
    if (this._success) {
      throw new Error('Attempted to get error from success result');
    }
    return this._error!;
  }

  map<U>(fn: (data: T) => U): ResultClass<U, E> {
    if (this._success) {
      return ResultClass.ok(fn(this._data!));
    }
    return this as unknown as ResultClass<U, E>;
  }

  mapError<F>(fn: (error: E) => F): ResultClass<T, F> {
    if (!this._success) {
      return ResultClass.error(fn(this._error!));
    }
    return this as unknown as ResultClass<T, F>;
  }

  chain<U>(fn: (data: T) => ResultClass<U, E>): ResultClass<U, E> {
    if (this._success) {
      return fn(this._data!);
    }
    return this as unknown as ResultClass<U, E>;
  }

  unwrap(): T {
    if (!this._success) {
      throw this._error;
    }
    return this._data!;
  }

  unwrapOr(defaultValue: T): T {
    return this._success ? this._data! : defaultValue;
  }
}

// Export the class as Result (for compatibility with existing code using .isOk() methods)
export { ResultClass as Result };

// ResultType already exported above

// Export convenience constructors
export const Ok = ResultClass.ok;
export const Err = ResultClass.error;
