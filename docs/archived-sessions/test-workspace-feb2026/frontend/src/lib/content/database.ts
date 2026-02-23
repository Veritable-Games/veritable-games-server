/**
 * Content Database Access - PostgreSQL Only
 *
 * All content data (projects, news, workspaces) is now in PostgreSQL content schema.
 */

import { dbAdapter } from '../database/adapter';

/**
 * Get content database connection
 * @deprecated Use dbAdapter.query() directly with { schema: 'content' }
 */
export function getContentDatabase() {
  throw new Error(
    'getContentDatabase() is deprecated. ' +
      'Use dbAdapter.query() with { schema: "content" } for content data.'
  );
}

/**
 * Helper to query content schema
 */
export async function queryContent<T = any>(sql: string, params: any[] = []) {
  return dbAdapter.query<T>(sql, params, { schema: 'content' });
}
