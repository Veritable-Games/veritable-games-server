/**
 * Result Pattern Implementation for Type-Safe Error Handling
 *
 * Eliminates exceptions and provides explicit error handling with composable operations.
 * This pattern forces developers to handle errors explicitly at compile-time.
 *
 * @example Basic usage
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Err('Division by zero');
 *   return Ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.isOk()) {
 *   logger.info(result.value); // 5
 * } else {
 *   logger.error(result.error);
 * }
 * ```
 *
 * @example Chaining operations
 * ```typescript
 * const result = await getUserById(id)
 *   .then(user => ResultUtils.andThen(user, getOrders))
 *   .then(orders => ResultUtils.map(orders, formatOrders));
 * ```
 */

/**
 * Success result type
 * Contains the successful value and provides type-safe access
 */
export interface OkResult<T> {
  readonly isOk: () => true;
  readonly isErr: () => false;
  readonly value: T;
  readonly error: never;
}

/**
 * Error result type
 * Contains the error value and prevents access to success value
 */
export interface ErrResult<E> {
  readonly isOk: () => false;
  readonly isErr: () => true;
  readonly value: never;
  readonly error: E;
}

/**
 * Result union type
 * Represents either success (Ok) or failure (Err)
 */
export type Result<T, E> = OkResult<T> | ErrResult<E>;

/**
 * Create a successful result
 */
export function Ok<T>(value: T): OkResult<T> {
  return {
    isOk: () => true,
    isErr: () => false,
    value,
    error: undefined as never,
  };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): ErrResult<E> {
  return {
    isOk: () => false,
    isErr: () => true,
    value: undefined as never,
    error,
  };
}

/**
 * Result utility methods
 */
export const ResultUtils = {
  /**
   * Map over the success value if result is Ok
   */
  map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    return result.isOk() ? Ok(fn(result.value)) : (result as Result<U, E>);
  },

  /**
   * Map over the error value if result is Err
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.isErr() ? Err(fn(result.error)) : (result as Result<T, F>);
  },

  /**
   * Chain results together (flatMap)
   */
  andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
    return result.isOk() ? fn(result.value) : (result as Result<U, E>);
  },

  /**
   * Return the value or a default if error
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.isOk() ? result.value : defaultValue;
  },

  /**
   * Return the value or compute a default if error
   */
  unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
    return result.isOk() ? result.value : fn(result.error);
  },

  /**
   * Convert Result to Promise (for async compatibility)
   */
  toPromise<T, E extends Error>(result: Result<T, E>): Promise<T> {
    return result.isOk() ? Promise.resolve(result.value) : Promise.reject(result.error);
  },

  /**
   * Convert Promise to Result
   */
  async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
      const value = await promise;
      return Ok(value);
    } catch (error) {
      return Err(error instanceof Error ? error : new Error(String(error)));
    }
  },

  /**
   * Combine multiple Results into one
   */
  combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isErr()) {
        return result as Result<T[], E>;
      }
      values.push(result.value);
    }
    return Ok(values);
  },

  /**
   * Return first successful result or last error
   */
  firstOk<T, E>(results: Result<T, E>[]): Result<T, E> {
    let lastError: E | undefined;
    for (const result of results) {
      if (result.isOk()) {
        return result;
      }
      lastError = result.error;
    }
    return Err(lastError!);
  },
};

/**
 * Async Result utilities
 */
export const AsyncResult = {
  /**
   * Async map
   */
  async map<T, U, E>(result: Result<T, E>, fn: (value: T) => Promise<U>): Promise<Result<U, E>> {
    if (result.isErr()) return result as Result<U, E>;
    try {
      const value = await fn(result.value);
      return Ok(value);
    } catch (error) {
      return Err(error as E);
    }
  },

  /**
   * Async chain
   */
  async andThen<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>
  ): Promise<Result<U, E>> {
    return result.isOk() ? await fn(result.value) : (result as Result<U, E>);
  },

  /**
   * Parallel processing of Results
   */
  async all<T, E>(results: Promise<Result<T, E>>[]): Promise<Result<T[], E>> {
    const settled = await Promise.allSettled(results);
    const values: T[] = [];

    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        return Err(outcome.reason);
      }
      const result = outcome.value;
      if (result.isErr()) {
        return result as Result<T[], E>;
      }
      values.push(result.value);
    }

    return Ok(values);
  },
};

/**
 * Type guards for Result pattern
 */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.isOk();
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return result.isErr();
}

export default Result;
