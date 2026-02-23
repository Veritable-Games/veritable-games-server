/**
 * Type-Safe Base Service Class
 * Provides common patterns for all services with proper error handling
 */

import { Result, Ok, Err } from '@/lib/utils/result';
import { TypeSafeQueryBuilder } from '@/lib/database/legacy/query-builder';
import { DatabaseSchemas, TableRecord } from '@/lib/database/schema-types';
import { logger } from '@/lib/utils/logger';

export class ServiceError extends Error {
  public code: string;
  public details?: any;
  public override cause?: Error;

  constructor(message: string, code: string, details?: any, cause?: Error) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
    this.cause = cause;
  }
}

export interface ServiceOptions {
  timeout?: number;
  retries?: number;
  validateInput?: boolean;
}

/**
 * Base service class providing type-safe database operations
 */
export abstract class BaseService<
  DB extends keyof DatabaseSchemas,
  Table extends keyof DatabaseSchemas[DB],
> {
  protected queryBuilder: TypeSafeQueryBuilder<TableRecord<DB, Table>>;
  protected tableName: string;
  protected databaseName: string;

  constructor(databaseName: DB, tableName: Table) {
    this.databaseName = databaseName as string;
    this.tableName = tableName as string;
    this.queryBuilder = new TypeSafeQueryBuilder<TableRecord<DB, Table>>(
      databaseName as string,
      tableName as string
    );
  }

  /**
   * Find a single record by criteria
   */
  public async findOne<K extends keyof TableRecord<DB, Table>>(
    where: Partial<Record<keyof TableRecord<DB, Table>, any>>,
    columns: K[] | '*' = '*'
  ): Promise<Result<Pick<TableRecord<DB, Table>, K> | null, ServiceError>> {
    const result = this.queryBuilder.selectOne(columns, where);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to find record in ${this.tableName}`,
          'FIND_ONE_ERROR',
          { where },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Find multiple records with filtering and pagination
   */
  public async findMany<K extends keyof TableRecord<DB, Table>>(
    options: {
      where?: Partial<Record<keyof TableRecord<DB, Table>, any>>;
      orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
      limit?: number;
      offset?: number;
      columns?: K[] | '*';
    } = {}
  ): Promise<Result<Pick<TableRecord<DB, Table>, K>[], ServiceError>> {
    const { columns = '*', ...selectOptions } = options;
    const result = this.queryBuilder.select(columns, selectOptions);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to find records in ${this.tableName}`,
          'FIND_MANY_ERROR',
          { options },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Create a new record
   */
  public async create<K extends keyof TableRecord<DB, Table>>(
    data: Pick<TableRecord<DB, Table>, K>
  ): Promise<Result<{ lastInsertRowid: number; changes: number }, ServiceError>> {
    const result = this.queryBuilder.insert(data);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to create record in ${this.tableName}`,
          'CREATE_ERROR',
          { data },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Update records by criteria
   */
  public async update<K extends keyof TableRecord<DB, Table>>(
    data: Partial<Pick<TableRecord<DB, Table>, K>>,
    where: Partial<Record<keyof TableRecord<DB, Table>, any>>
  ): Promise<Result<{ changes: number }, ServiceError>> {
    const result = this.queryBuilder.update(data, { where });

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to update records in ${this.tableName}`,
          'UPDATE_ERROR',
          { data, where },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Delete records by criteria
   */
  public async delete(
    where: Partial<Record<keyof TableRecord<DB, Table>, any>>
  ): Promise<Result<{ changes: number }, ServiceError>> {
    const result = this.queryBuilder.delete(where);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to delete records from ${this.tableName}`,
          'DELETE_ERROR',
          { where },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Count records matching criteria
   */
  public async count(
    where?: Partial<Record<keyof TableRecord<DB, Table>, any>>
  ): Promise<Result<number, ServiceError>> {
    const result = this.queryBuilder.count(where);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to count records in ${this.tableName}`,
          'COUNT_ERROR',
          { where },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Check if record exists
   */
  public async exists(
    where: Partial<Record<keyof TableRecord<DB, Table>, any>>
  ): Promise<Result<boolean, ServiceError>> {
    const result = this.queryBuilder.exists(where);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to check existence in ${this.tableName}`,
          'EXISTS_ERROR',
          { where },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Find or create a record
   */
  protected async findOrCreate<K extends keyof TableRecord<DB, Table>>(
    where: Partial<Record<keyof TableRecord<DB, Table>, any>>,
    defaults: Pick<TableRecord<DB, Table>, K>
  ): Promise<Result<{ record: Pick<TableRecord<DB, Table>, K>; created: boolean }, ServiceError>> {
    const result = this.queryBuilder.findOrCreate(where, defaults);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Failed to find or create record in ${this.tableName}`,
          'FIND_OR_CREATE_ERROR',
          { where, defaults },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Execute raw query with proper error handling
   */
  protected async rawQuery<R = any>(
    query: string,
    params: any[] = []
  ): Promise<Result<R[], ServiceError>> {
    const result = this.queryBuilder.rawQuery<R>(query, params);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Raw query failed in ${this.databaseName}`,
          'RAW_QUERY_ERROR',
          { query, params },
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Execute operations in a transaction
   */
  protected async transaction<R>(
    fn: (queryBuilder: TypeSafeQueryBuilder<TableRecord<DB, Table>>) => Result<R, ServiceError>
  ): Promise<Result<R, ServiceError>> {
    const result = this.queryBuilder.transaction(fn);

    if (!result.isOk()) {
      return Err(
        new ServiceError(
          `Transaction failed in ${this.tableName}`,
          'TRANSACTION_ERROR',
          {},
          result.error
        )
      );
    }

    return Ok(result.value);
  }

  /**
   * Validate input data (override in subclasses)
   */
  protected validateInput<T>(data: T, schema?: any): Result<T, ServiceError> {
    // Base implementation - override in subclasses for specific validation
    if (data === null || data === undefined) {
      return Err(new ServiceError('Input data is required', 'VALIDATION_ERROR'));
    }
    return Ok(data);
  }

  /**
   * Handle service-specific business logic validation
   */
  protected abstract validateBusinessRules<T>(data: T): Promise<Result<T, ServiceError>>;

  /**
   * Log service operations (can be overridden)
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, details?: any): void {
    const logEntry = {
      service: this.constructor.name,
      table: this.tableName,
      database: this.databaseName,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    switch (level) {
      case 'error':
        logger.error('[SERVICE ERROR]', logEntry);
        break;
      case 'warn':
        logger.warn('[SERVICE WARN]', logEntry);
        break;
      default:
        logger.info('[SERVICE INFO]', logEntry);
    }
  }
}

/**
 * Service factory for creating type-safe service instances
 */
export function createService<
  DB extends keyof DatabaseSchemas,
  Table extends keyof DatabaseSchemas[DB],
>(databaseName: DB, tableName: Table) {
  return new (class extends BaseService<DB, Table> {
    protected async validateBusinessRules<T>(data: T): Promise<Result<T, ServiceError>> {
      return Ok(data);
    }
  })(databaseName, tableName);
}

export default BaseService;
