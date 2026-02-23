/**
 * Base Repository Class
 *
 * Provides common database operations and error handling for forum repositories.
 * All forum repositories extend this class to inherit connection management and Result pattern.
 *
 * Key Features:
 * - Automatic database connection via dbPool
 * - Result pattern for type-safe error handling
 * - Transaction support
 * - Cross-database user fetching (auth.db)
 * - Consistent error normalization
 */

import { dbAdapter } from '@/lib/database/adapter';
import { Result, Ok, Err } from '@/lib/utils/result';
import type { UserId, ForumUser } from '../types';

/**
 * Base repository error types
 */
export type RepositoryError =
  | { type: 'not_found'; entity: string; id: number | string }
  | { type: 'database'; operation: string; message: string; cause?: unknown }
  | { type: 'validation'; field: string; message: string }
  | { type: 'constraint'; constraint: string; message: string };

/**
 * Base repository class with common database operations
 */
export abstract class BaseRepository {
  protected readonly dbName: string = 'forums';

  /**
   * Execute a query with error handling
   */
  protected async execute<T>(
    operation: string,
    callback: () => Promise<T>
  ): Promise<Result<T, RepositoryError>> {
    try {
      const result = await callback();
      return Ok<T>(result);
    } catch (error) {
      return this.handleError(operation, error);
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  protected async transaction<T>(
    operation: string,
    callback: () => Promise<T>
  ): Promise<Result<T, RepositoryError>> {
    try {
      const result = await dbAdapter.transaction(async () => {
        return await callback();
      });
      return Ok<T>(result);
    } catch (error) {
      return this.handleError(operation, error);
    }
  }

  /**
   * Fetch user information from users.db
   *
   * IMPORTANT: Users are in users.db, NOT forums.db
   * This method handles cross-database queries properly.
   */
  protected async fetchUser(userId: UserId): Promise<Result<ForumUser | null, RepositoryError>> {
    try {
      const result = await dbAdapter.query(
        `SELECT
          id,
          username,
          display_name,
          avatar_url,
          role,
          0 as reputation,
          0 as post_count
        FROM users
        WHERE id = $1`,
        [userId],
        { schema: 'users' }
      );
      const user = result.rows[0] as ForumUser | undefined;

      return Ok<ForumUser | null>(user || null);
    } catch (error) {
      return this.handleError('fetchUser', error);
    }
  }

  /**
   * Fetch multiple users by IDs (batch operation)
   *
   * IMPORTANT: Users are in users.db, NOT forums.db
   */
  protected async fetchUsers(
    userIds: UserId[]
  ): Promise<Result<Map<UserId, ForumUser>, RepositoryError>> {
    try {
      if (userIds.length === 0) {
        return Ok<Map<UserId, ForumUser>>(new Map());
      }

      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
      const result = await dbAdapter.query(
        `SELECT
          id,
          username,
          display_name,
          avatar_url,
          role,
          0 as reputation,
          0 as post_count
        FROM users
        WHERE id IN (${placeholders})`,
        userIds,
        { schema: 'users' }
      );
      const users = result.rows as ForumUser[];

      const userMap = new Map<UserId, ForumUser>();
      for (const user of users) {
        userMap.set(user.id, user);
      }

      return Ok<Map<UserId, ForumUser>>(userMap);
    } catch (error) {
      return this.handleError('fetchUsers', error);
    }
  }

  /**
   * Handle database errors and normalize to RepositoryError
   */
  protected handleError(operation: string, error: unknown): ErrResult<RepositoryError> {
    // PostgreSQL constraint violation
    if (error && typeof error === 'object' && 'code' in error) {
      const pgError = error as { code: string; message: string; constraint?: string };

      // PostgreSQL constraint violation codes
      if (pgError.code === '23505' || pgError.code === '23503' || pgError.code === '23514') {
        return Err({
          type: 'constraint',
          constraint: pgError.constraint || 'unknown',
          message: pgError.message || 'Constraint violation',
        });
      }
    }

    // Generic database error
    return Err({
      type: 'database',
      operation,
      message: error instanceof Error ? error.message : String(error),
      cause: error,
    });
  }

  /**
   * Create a not found error
   */
  protected notFound(entity: string, id: number | string): ErrResult<RepositoryError> {
    return Err({
      type: 'not_found',
      entity,
      id,
    });
  }

  /**
   * Create a validation error
   */
  protected validationError(field: string, message: string): ErrResult<RepositoryError> {
    return Err({
      type: 'validation',
      field,
      message,
    });
  }

  /**
   * Helper: Build pagination LIMIT/OFFSET clause
   */
  protected buildPaginationClause(page: number = 1, limit: number = 20): string {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }

  /**
   * Helper: Calculate total pages
   */
  protected calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  /**
   * Helper: Sanitize LIKE pattern (prevent SQL injection)
   */
  protected sanitizeLikePattern(pattern: string): string {
    return pattern.replace(/[%_]/g, '\\$&');
  }
}

/**
 * Type alias for ErrResult (commonly used)
 */
type ErrResult<E> = {
  readonly isOk: () => false;
  readonly isErr: () => true;
  readonly value: never;
  readonly error: E;
};
