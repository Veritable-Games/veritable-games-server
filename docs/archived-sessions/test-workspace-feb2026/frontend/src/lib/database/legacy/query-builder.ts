/**
 * Type-Safe Database Query Builder
 * Eliminates 'any' type assertions in database operations
 */

import Database from 'better-sqlite3';
import { dbPool } from './pool';
import { Result, Ok, Err } from '@/lib/utils/result';

export interface QueryConfig {
  timeout?: number;
  safeIntegers?: boolean;
  raw?: boolean;
}

export interface SelectOptions {
  where?: Record<string, any>;
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
  allowedColumns?: string[]; // For ORDER BY validation
}

export interface InsertOptions {
  onConflict?: 'IGNORE' | 'REPLACE' | 'FAIL';
  returning?: string[];
}

export interface UpdateOptions {
  where: Record<string, any>;
  returning?: string[];
}

/**
 * Type-safe database operation errors
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Validates SQL identifier (table/column name) to prevent injection
 * Only allows alphanumeric characters, underscores, and dots (for joins)
 */
function validateSQLIdentifier(identifier: string): boolean {
  if (!identifier || typeof identifier !== 'string') {
    return false;
  }
  // Allow alphanumeric, underscore, and dot (for table.column references)
  return /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(identifier);
}

/**
 * Validates numeric value to prevent injection in LIMIT/OFFSET
 */
function validateNumericValue(value: any): boolean {
  const num = Number(value);
  return !isNaN(num) && isFinite(num) && num >= 0 && Number.isInteger(num);
}

/**
 * Type-safe query builder for eliminating 'any' usage
 */
export class TypeSafeQueryBuilder<T = any> {
  private db: Database.Database;
  private tableName: string;

  constructor(databaseName: string, tableName: string) {
    this.db = dbPool.getConnection(databaseName);
    this.tableName = tableName;
  }

  /**
   * Type-safe SELECT operations
   */
  select<K extends keyof T>(
    columns: K[] | '*' = '*',
    options: SelectOptions = {}
  ): Result<Pick<T, K>[], DatabaseError> {
    try {
      const columnList = columns === '*' ? '*' : (columns as string[]).join(', ');
      let query = `SELECT ${columnList} FROM ${this.tableName}`;

      const params: any[] = [];

      // WHERE clause with validation to prevent SQL injection
      if (options.where) {
        const whereConditions: string[] = [];

        for (const [key, value] of Object.entries(options.where)) {
          // Validate WHERE clause column names
          if (!validateSQLIdentifier(key)) {
            return Err(
              new DatabaseError(`Invalid column name in WHERE clause: ${key}`, 'INVALID_COLUMN', {
                column: key,
              })
            );
          }
          params.push(value);
          whereConditions.push(`${key} = ?`);
        }

        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // ORDER BY clause with validation to prevent SQL injection
      if (options.orderBy && options.orderBy.length > 0) {
        const validatedOrderClauses: string[] = [];

        for (const order of options.orderBy) {
          // Validate column name to prevent SQL injection
          if (!validateSQLIdentifier(order.column)) {
            return Err(
              new DatabaseError(
                `Invalid column name for ORDER BY: ${order.column}`,
                'INVALID_COLUMN',
                { column: order.column }
              )
            );
          }

          // Additional validation: check against allowed columns if provided
          if (options.allowedColumns && !options.allowedColumns.includes(order.column)) {
            return Err(
              new DatabaseError(
                `Column not allowed for ORDER BY: ${order.column}`,
                'COLUMN_NOT_ALLOWED',
                { column: order.column, allowedColumns: options.allowedColumns }
              )
            );
          }

          // Validate direction (should already be restricted by TypeScript, but add runtime check)
          if (order.direction !== 'ASC' && order.direction !== 'DESC') {
            return Err(
              new DatabaseError(`Invalid sort direction: ${order.direction}`, 'INVALID_DIRECTION', {
                direction: order.direction,
              })
            );
          }

          validatedOrderClauses.push(`${order.column} ${order.direction}`);
        }

        query += ` ORDER BY ${validatedOrderClauses.join(', ')}`;
      }

      // LIMIT and OFFSET with validation to prevent SQL injection
      if (options.limit !== undefined) {
        if (!validateNumericValue(options.limit)) {
          return Err(
            new DatabaseError(`Invalid LIMIT value: ${options.limit}`, 'INVALID_LIMIT', {
              limit: options.limit,
            })
          );
        }
        query += ` LIMIT ${options.limit}`;

        if (options.offset !== undefined) {
          if (!validateNumericValue(options.offset)) {
            return Err(
              new DatabaseError(`Invalid OFFSET value: ${options.offset}`, 'INVALID_OFFSET', {
                offset: options.offset,
              })
            );
          }
          query += ` OFFSET ${options.offset}`;
        }
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as Pick<T, K>[];

      return Ok(rows);
    } catch (error) {
      return Err(
        new DatabaseError(
          `Select failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SELECT_ERROR',
          { table: this.tableName, options }
        )
      );
    }
  }

  /**
   * Type-safe SELECT ONE operation
   */
  selectOne<K extends keyof T>(
    columns: K[] | '*' = '*',
    where: Record<string, any>
  ): Result<Pick<T, K> | null, DatabaseError> {
    const result = this.select(columns, { where, limit: 1 });

    if (!result.isOk()) {
      return Err(result.error);
    }

    const rows = result.value;
    return Ok(rows.length > 0 ? (rows[0] ?? null) : null);
  }

  /**
   * Type-safe INSERT operations
   */
  insert<K extends keyof T>(
    data: Pick<T, K> | Pick<T, K>[],
    options: InsertOptions = {}
  ): Result<{ lastInsertRowid: number; changes: number }, DatabaseError> {
    try {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        return Err(new DatabaseError('No data provided for insert', 'NO_DATA'));
      }

      const firstRecord = records[0];
      if (!firstRecord) {
        return Err(new DatabaseError('First record is undefined', 'INVALID_DATA'));
      }

      const columns = Object.keys(firstRecord) as string[];

      // Validate all column names to prevent SQL injection
      for (const column of columns) {
        if (!validateSQLIdentifier(column)) {
          return Err(
            new DatabaseError(`Invalid column name: ${column}`, 'INVALID_COLUMN', {
              column,
              tableName: this.tableName,
            })
          );
        }
      }

      const placeholders = columns.map(() => '?').join(', ');

      let query = `INSERT`;
      if (options.onConflict === 'IGNORE') {
        query += ' OR IGNORE';
      } else if (options.onConflict === 'REPLACE') {
        query += ' OR REPLACE';
      }

      query += ` INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      if (options.returning && options.returning.length > 0) {
        // Validate RETURNING column names to prevent SQL injection
        for (const column of options.returning) {
          if (!validateSQLIdentifier(column)) {
            return Err(
              new DatabaseError(`Invalid column name in RETURNING: ${column}`, 'INVALID_COLUMN', {
                column,
              })
            );
          }
        }
        query += ` RETURNING ${options.returning.join(', ')}`;
      }

      const stmt = this.db.prepare(query);

      if (records.length === 1) {
        const values = columns.map(col => (records[0] as Record<string, unknown>)[col]);
        const result = stmt.run(...values);
        return Ok({
          lastInsertRowid: Number(result.lastInsertRowid),
          changes: result.changes,
        });
      } else {
        // Batch insert
        const transaction = this.db.transaction((items: Pick<T, K>[]) => {
          let totalChanges = 0;
          let lastId = 0;

          for (const item of items) {
            const values = columns.map(col => (item as Record<string, unknown>)[col]);
            const result = stmt.run(...values);
            totalChanges += result.changes;
            lastId = Number(result.lastInsertRowid);
          }

          return { lastInsertRowid: lastId, changes: totalChanges };
        });

        const result = transaction(records);
        return Ok(result);
      }
    } catch (error) {
      return Err(
        new DatabaseError(
          `Insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INSERT_ERROR',
          { table: this.tableName, data }
        )
      );
    }
  }

  /**
   * Type-safe UPDATE operations
   */
  update<K extends keyof T>(
    data: Partial<Pick<T, K>>,
    options: UpdateOptions
  ): Result<{ changes: number }, DatabaseError> {
    try {
      const updateColumns = Object.keys(data);
      if (updateColumns.length === 0) {
        return Err(new DatabaseError('No data provided for update', 'NO_DATA'));
      }

      // Validate SET clause column names to prevent SQL injection
      for (const column of updateColumns) {
        if (!validateSQLIdentifier(column)) {
          return Err(
            new DatabaseError(`Invalid column name in SET clause: ${column}`, 'INVALID_COLUMN', {
              column,
            })
          );
        }
      }

      // Validate WHERE clause column names to prevent SQL injection
      for (const key of Object.keys(options.where)) {
        if (!validateSQLIdentifier(key)) {
          return Err(
            new DatabaseError(`Invalid column name in WHERE clause: ${key}`, 'INVALID_COLUMN', {
              column: key,
            })
          );
        }
      }

      const setClause = updateColumns.map(col => `${col} = ?`).join(', ');
      const whereConditions = Object.entries(options.where).map(([key]) => `${key} = ?`);

      let query = `UPDATE ${this.tableName} SET ${setClause} WHERE ${whereConditions.join(' AND ')}`;

      if (options.returning && options.returning.length > 0) {
        // Validate RETURNING column names to prevent SQL injection
        for (const column of options.returning) {
          if (!validateSQLIdentifier(column)) {
            return Err(
              new DatabaseError(`Invalid column name in RETURNING: ${column}`, 'INVALID_COLUMN', {
                column,
              })
            );
          }
        }
        query += ` RETURNING ${options.returning.join(', ')}`;
      }

      const params = [
        ...updateColumns.map(col => (data as Record<string, unknown>)[col]),
        ...Object.values(options.where),
      ];

      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);

      return Ok({ changes: result.changes });
    } catch (error) {
      return Err(
        new DatabaseError(
          `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'UPDATE_ERROR',
          { table: this.tableName, data, where: options.where }
        )
      );
    }
  }

  /**
   * Type-safe DELETE operations
   */
  delete(where: Record<string, any>): Result<{ changes: number }, DatabaseError> {
    try {
      // Validate WHERE clause column names to prevent SQL injection
      for (const key of Object.keys(where)) {
        if (!validateSQLIdentifier(key)) {
          return Err(
            new DatabaseError(`Invalid column name in WHERE clause: ${key}`, 'INVALID_COLUMN', {
              column: key,
            })
          );
        }
      }

      const whereConditions = Object.entries(where).map(([key]) => `${key} = ?`);
      const query = `DELETE FROM ${this.tableName} WHERE ${whereConditions.join(' AND ')}`;
      const params = Object.values(where);

      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);

      return Ok({ changes: result.changes });
    } catch (error) {
      return Err(
        new DatabaseError(
          `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'DELETE_ERROR',
          { table: this.tableName, where }
        )
      );
    }
  }

  /**
   * Type-safe COUNT operations
   */
  count(where?: Record<string, any>): Result<number, DatabaseError> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (where) {
        // Validate WHERE clause column names to prevent SQL injection
        for (const key of Object.keys(where)) {
          if (!validateSQLIdentifier(key)) {
            return Err(
              new DatabaseError(`Invalid column name in WHERE clause: ${key}`, 'INVALID_COLUMN', {
                column: key,
              })
            );
          }
        }

        const whereConditions = Object.entries(where).map(([key, value]) => {
          params.push(value);
          return `${key} = ?`;
        });
        query += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };

      return Ok(result.count);
    } catch (error) {
      return Err(
        new DatabaseError(
          `Count failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'COUNT_ERROR',
          { table: this.tableName, where }
        )
      );
    }
  }

  /**
   * Type-safe raw query execution with proper typing
   */
  rawQuery<R = any>(query: string, params: any[] = []): Result<R[], DatabaseError> {
    try {
      const stmt = this.db.prepare(query);
      const result = stmt.all(...params) as R[];
      return Ok(result);
    } catch (error) {
      return Err(
        new DatabaseError(
          `Raw query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'RAW_QUERY_ERROR',
          { query, params }
        )
      );
    }
  }

  /**
   * Type-safe transaction support
   */
  transaction<R>(
    fn: (builder: TypeSafeQueryBuilder<T>) => Result<R, DatabaseError>
  ): Result<R, DatabaseError> {
    try {
      const transaction = this.db.transaction(() => {
        return fn(this);
      });

      const result = transaction();

      if (!result.isOk()) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error) {
      return Err(
        new DatabaseError(
          `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'TRANSACTION_ERROR',
          { table: this.tableName }
        )
      );
    }
  }

  /**
   * Check if record exists
   */
  exists(where: Record<string, any>): Result<boolean, DatabaseError> {
    const countResult = this.count(where);
    if (!countResult.isOk()) {
      return countResult as Result<boolean, DatabaseError>;
    }
    return Ok(countResult.value > 0);
  }

  /**
   * Find or create pattern
   */
  findOrCreate<K extends keyof T>(
    where: Record<string, any>,
    defaults: Pick<T, K>
  ): Result<{ record: Pick<T, K>; created: boolean }, DatabaseError> {
    const existing = this.selectOne('*', where);
    if (!existing.isOk()) {
      return existing as Result<{ record: Pick<T, K>; created: boolean }, DatabaseError>;
    }

    if (existing.value) {
      return Ok({ record: existing.value as Pick<T, K>, created: false });
    }

    const createData = { ...where, ...defaults } as Pick<T, K>;
    const insertResult = this.insert(createData);
    if (!insertResult.isOk()) {
      return insertResult as Result<{ record: Pick<T, K>; created: boolean }, DatabaseError>;
    }

    // Fetch the created record
    const created = this.selectOne('*', where);
    if (!created.isOk()) {
      return created as Result<{ record: Pick<T, K>; created: boolean }, DatabaseError>;
    }

    return Ok({ record: created.value as Pick<T, K>, created: true });
  }
}

/**
 * Factory function for creating type-safe query builders
 */
export function createQueryBuilder<T>(
  databaseName: string,
  tableName: string
): TypeSafeQueryBuilder<T> {
  return new TypeSafeQueryBuilder<T>(databaseName, tableName);
}

/**
 * Helper for creating database-specific query builders
 */
export const QueryBuilders = {
  forums: <T>(tableName: string) => createQueryBuilder<T>('forums', tableName),
  wiki: <T>(tableName: string) => createQueryBuilder<T>('wiki', tableName),
  users: <T>(tableName: string) => createQueryBuilder<T>('users', tableName),
  system: <T>(tableName: string) => createQueryBuilder<T>('system', tableName),
  content: <T>(tableName: string) => createQueryBuilder<T>('content', tableName),
  library: <T>(tableName: string) => createQueryBuilder<T>('library', tableName),
  auth: <T>(tableName: string) => createQueryBuilder<T>('auth', tableName),
  messaging: <T>(tableName: string) => createQueryBuilder<T>('messaging', tableName),
};

export default TypeSafeQueryBuilder;
