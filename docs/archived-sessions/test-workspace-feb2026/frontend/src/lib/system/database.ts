/**
 * System Database Access - PostgreSQL Only
 *
 * All system data is now in PostgreSQL system schema.
 */

import { dbAdapter } from '../database/adapter';

/**
 * Get system database connection
 * @deprecated Use dbAdapter.query() directly with { schema: 'system' }
 */
export function getSystemDatabase() {
  throw new Error(
    'getSystemDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "system" } for system data.'
  );
}

/**
 * Helper to query system schema
 */
export async function querySystem<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'system' });
}
