/**
 * Users Database Access - PostgreSQL Only
 *
 * All user data is now in PostgreSQL users schema:
 * - users.users table
 * - users.permissions table
 * - users.activity_log table
 */

import { dbAdapter } from '../database/adapter';

/**
 * Execute a query on the users database (PostgreSQL)
 * @deprecated Use dbAdapter.query() directly with { schema: 'users' }
 */
export function getUsersDatabase() {
  throw new Error(
    'getUsersDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "users" } for user data.'
  );
}

/**
 * Helper to query users schema
 */
export async function queryUsers<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'users' });
}

/**
 * Execute a transaction on the users database (PostgreSQL)
 */
export async function executeUsersTransaction<T>(callback: () => Promise<T>): Promise<T> {
  return dbAdapter.transaction(
    async () => {
      return await callback();
    },
    { schema: 'users' }
  );
}
