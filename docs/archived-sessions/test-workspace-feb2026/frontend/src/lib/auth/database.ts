/**
 * Auth Database Access - PostgreSQL Only
 *
 * All authentication data is now in PostgreSQL:
 * - users table → users.users schema
 * - sessions table → auth.sessions schema
 * - activity_log table → auth.activity_log schema
 */

import { dbAdapter } from '../database/adapter';

/**
 * Execute a query on the auth database (PostgreSQL)
 * @deprecated Use dbAdapter.query() directly with { schema: 'auth' } or { schema: 'users' }
 */
export function getAuthDatabase() {
  throw new Error(
    'getAuthDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "auth" } for sessions/logs, ' +
      'or { schema: "users" } for user data.'
  );
}

// Alias for backward compatibility
export { getAuthDatabase as getAuthDb };

/**
 * Helper to query users schema
 */
export async function queryUsers<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'users' });
}

/**
 * Helper to query auth schema
 */
export async function queryAuth<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'auth' });
}
